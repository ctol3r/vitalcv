# VitalCV Verifier Quickstart

Integration guide for external verifiers consuming VitalCV-issued credentials and receipts. Every endpoint listed here is real on `origin/main`; the lockdown test at `apps/web/__tests__/verifier-quickstart-accuracy.test.ts` enforces that.

## Endpoints overview

| Endpoint | Method | Purpose |
|---|---|---|
| `/.well-known/jwks.json` | `GET` | Public JWKS for ES256 signature verification |
| `/api/receipts/verify` | `POST` | Verify an ES256-signed receipt JWT |
| `/api/passport/[npi]` | `GET` | Read a clinician passport (subject of the receipt) |
| `/status-list/status/:credential_id` | `GET` | Check credential revocation state |
| `/status-list/2021` | `GET` | StatusList2021 VC envelope |
| `/status-list/2021/bitstring` | `GET` | Raw revocation bitstring |

JWKS endpoint is the trust root. Fetch it once, cache it for the `Cache-Control` window, validate every signed payload against the cached keys.

## Verify a signed receipt

**`POST /api/receipts/verify`**

Request body:

```json
{
  "token": "<receipt-jwt>"
}
```

Constraints (enforced by `apps/web/app/api/receipts/verify/route.ts`):
- `token` is REQUIRED, must be a string.
- Token length ≤ 8192 chars — longer tokens are rejected with `400`.
- Verification is performed by `lib/trust/jwtVerifier.verifyReceiptJWT`.

Response (success, HTTP 200):

```json
{
  "verified": true,
  "...": "verification-result fields"
}
```

Response (failure, HTTP 422):

```json
{
  "verified": false,
  "...": "reason fields"
}
```

The endpoint never returns 200 with `verified: false` — `verified` and HTTP status are kept consistent so a verifier can rely on either signal.

## Fetch the JWKS

**`GET /.well-known/jwks.json`**

Returns:

```json
{
  "keys": [
    {
      "kty": "EC",
      "crv": "P-256",
      "x": "...",
      "y": "...",
      "kid": "...",
      "alg": "ES256",
      "use": "sig"
    }
  ]
}
```

Cache headers:
- Standard `apps/web` JWKS endpoint: `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`.
- Sandbox `apps/web-v2` JWKS endpoint (PR #316): same headers when configured, **shorter** (60s fresh / 5min SWR) when `VITALCV_SIGNING_PUBLIC_JWK` env var is missing — distinguishable via the `X-JWKS-Status` response header.

`X-JWKS-Status` values (web-v2 endpoint only):
- `ok` — public JWK is configured and served
- `not-configured` — env var absent; `{keys: []}` returned, verifiers must refuse to validate
- `malformed-env` — env var present but not valid JSON
- `invalid-jwk` — env var parses as JSON but is not a valid public JWK (e.g., missing `kty`, or contains a private `d` field which is explicitly rejected)

**The JWKS endpoint never serves a private key.** Even if env-injected with a JWK containing a `d` field, the endpoint rejects it and returns `invalid-jwk`.

## Check credential revocation

**`GET /status-list/status/:credential_id`**

Returns the current revocation state for a credential. Served by `apps/status-api`. Standard StatusList2021-compatible interface.

For bulk verifier workflows, prefer:

**`GET /status-list/2021`** → returns the StatusList2021 VC envelope
**`GET /status-list/2021/bitstring`** → returns the raw bitstring; verifier inspects the bit at the credential's `statusListIndex`

## Fail-closed verifier semantics

The verifier integration MUST honor:

1. **Unverifiable signatures → REJECT.** If `/api/receipts/verify` returns `{verified: false}` or HTTP 422, do not accept the credential.
2. **Empty JWKS → REJECT.** If `/.well-known/jwks.json` returns `{keys: []}` (any `X-JWKS-Status` other than `ok`), do not attempt to validate signatures — there is no key to validate against. Treating this as "trust by default" is a security failure.
3. **Revoked status → REJECT.** A credential whose `/status-list/status/:credential_id` returns revoked is no longer trustworthy regardless of signature validity.
4. **Nonce replay → REJECT.** For OpenID4VP presentation flows, the verifier MUST track nonces and reject reuse. VitalCV's verifier-side nonce table is `VerifierNonce` (Prisma model in `apps/api/backend/prisma/schema.prisma:221`).
5. **Stale JWKS → REJECT.** Don't trust a JWKS response older than your cache window. Re-fetch.

## Replay attribution (post PR #312/#313)

Credentials and passports issued after PRs #312 + #313 land may carry an optional `replayLineage` field:

```json
{
  "replayLineage": {
    "runId": "...",
    "eventDigest": "<sha256-hex>",
    "events": [
      { "eventId": "...", "eventType": "source_complete", "observedAt": "...", "sourceId": "nppes" },
      ...
    ],
    "sealedAt": "...",
    "comprehensive": true
  }
}
```

Verifiers SHOULD:
- Treat absence of `replayLineage` as missing-provenance — credential is signed but provenance cannot be reconstructed from the artifact alone.
- When present, recompute `computeEventDigest(runId, events)` and compare to the embedded `eventDigest` (canonical-JSON-then-SHA-256, same rule on both sides).
- Treat a digest mismatch as tampering — REJECT.

Reference implementation: `apps/web/lib/trust/replay-lineage.ts:verifyReplayLineageDigest`.

## Cross-tree byte-equality guarantee

The canonical-JSON serialization rule is implemented identically in:
- `apps/web/lib/trust/replay-lineage.ts` (web side)
- `apps/api/backend/src/services/passport/replayLineage.ts` (backend side, PR #313)
- `apps/web/lib/export/signedExportEnvelope.ts` (export envelope, PR #318)

All three sort object keys alphabetically before serializing, then SHA-256 the result. Pinned by `apps/api/backend/src/services/passport/__tests__/replayLineage.test.ts` (cross-tree assertion).

## Audit exports

For audit-grade evidence chains, verifiers may receive a signed export envelope from `/api/export/packet` (post PR #318 wiring):

```json
{
  "schema": "vitalcv.export.envelope.v1",
  "payload": { ... },
  "digest": "<sha256-hex of canonical-JSON(payload)>",
  "sealedAt": "...",
  "signed": true,
  "signature": "<ES256 JWS over digest>",
  "kid": "..."
}
```

Verify the envelope by:
1. Recompute `digest = SHA-256(canonical-JSON(payload))`. If it doesn't match `envelope.digest`, REJECT (tampering).
2. If `envelope.signed === true`, validate `envelope.signature` against `envelope.digest` using the public JWK from `/.well-known/jwks.json` filtered by `envelope.kid`.
3. If `envelope.signed === false`, the envelope's integrity is digest-only — no signer key was configured at seal time. Accept or reject per your policy; VitalCV does not claim signed status when none exists.

Reference implementation: `apps/web/lib/export/signedExportEnvelope.ts:verifyExportEnvelopeDigest`.

## What this doc does NOT promise

- **OpenID4VP full-protocol flow**: VitalCV has the verifier surface at `apps/verifier-api/src/oidc4vp/routes.ts` but full external-verifier OID4VP integration is per-partner. Contact the team for partner-specific test instances.
- **SD-JWT presentation**: The SD-JWT issuer at `apps/api/backend/src/services/sd-jwt/sdJwtIssuer.ts` produces credentials in `vc+sd-jwt` format. Presentation (`vp+sd-jwt`) consumption is an OID4VP flow.
- **Production endpoint base URLs**: Use your VitalCV-assigned domain. The status-list service is a separate process — typically `https://status.vitalcv.ai` (configurable via `PUBLIC_STATUS_URL` / `STATUS_URL` env).
