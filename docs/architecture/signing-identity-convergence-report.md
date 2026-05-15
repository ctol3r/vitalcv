# Signing Identity Convergence Report

**B16-RUNTIME-03 deliverable.** Verifies — at the code level on
`origin/main` post-PR-362 — that every signing-emitting surface
converges on a single env-driven canonical kid (operator-expected
value: `vcv-es256-1`).

## §1 — Convergence verdict per surface

Each row names a runtime surface that emits or reports a signing kid,
its source of kid value, and whether that source resolves to the
canonical env-driven identity.

| Surface | Source of kid value | Converged? |
|---|---|---|
| `/api/.well-known/jwks.json` | `getOrInitKeypair().kid` via `getPublicKeyJwk()` | ✓ Reads `RECEIPT_KID`; throws in production if missing. `force-dynamic` ensures runtime evaluation. |
| `/.well-known/jwks.json` (canonical path, on unmerged stack) | Same | ✓ Same chain when route ships. |
| `/.well-known/did.json` | `getPublicKeyJwk()` | ✓ Same chain; `force-dynamic`. |
| ES256 receipt JWT header `kid` | `getOrInitKeypair().kid` via `signIssuerReceipt` | ✓ |
| `/api/receipt/[lineageKey]` lineageKey-shape `receipt.signingKeyId` | `process.env.RECEIPT_KID ?? (production ? 'vcv-es256-1' : 'vcv-es256-dev')` | ✓ Env-resolved with canonical production default. |
| `/api/receipt/[lineageKey]` dev-mock branch `signed_payload.signing_key_id` | Hardcoded `'vcv-es256-dev'` | ✓ Gated by `if (isDev())`; unreachable in production. |
| `/api/status` `runtime_continuity.signing_key_id` | `getOrInitKeypair().kid` wrapped in `.catch(() => null)` | ✓ Returns env-resolved kid OR `null` with `status: 'degraded'` if env missing — honest signal. |
| `/api/replay/[runId]` `signingKeyId` | Replay inspection layer → reads the signing module | ✓ Same chain. |
| `TrustStateRegister.tsx` UI default | `snapshot.signingKeyId ?? 'vcv-es256-1'` | ✓ Static fallback matches expected canonical production value. |
| `verify/[npi]/page.tsx` UI prop default | `signingKeyId="vcv-es256-1"` | ✓ Same canonical fallback. |
| `getOperatorDashboardSnapshot.ts` ephemeral-key detector | `kid.includes('-dev-')` | ✓ Detection only (not emission). Flags ephemeral keys for the operator dashboard. |

## §2 — Verification commands (operator, post-env-set)

```bash
# Canonical production identity — all three MUST emit the same kid:
JWKS_KID=$(curl -s https://vitalcv.com/api/.well-known/jwks.json | jq -r '.keys[0].kid')
DID_KID=$(curl -s https://vitalcv.com/.well-known/did.json | jq -r '.verificationMethod[0].publicKeyJwk.kid' 2>/dev/null || echo "n/a")
STATUS_KID=$(curl -s https://vitalcv.com/api/status | jq -r '.runtime_continuity.signing_key_id')
RECEIPT_KID=$(curl -s "https://vitalcv.com/api/receipt/nppes_identity:1346053246" | jq -r '.receipt.signingKeyId' 2>/dev/null || echo "n/a")

echo "JWKS:    $JWKS_KID"
echo "DID:     $DID_KID"
echo "STATUS:  $STATUS_KID"
echo "RECEIPT: $RECEIPT_KID"

# Expected: all four "vcv-es256-1" (or whatever operator set RECEIPT_KID to).
# Forbidden: any value containing "dev".
```

If any output contains `"dev"`, the deployment has not picked up the
PR-362 fail-closed guard OR the env vars are missing. See
`vercel-convergence-diagnosis.md` §3 row a/b/c.

## §3 — Split-identity check

There are exactly three places a kid value enters the runtime:

1. **Env-driven** (production canonical): `process.env.RECEIPT_KID` → all signing/issuance surfaces.
2. **Hardcoded UI default** (`'vcv-es256-1'`): matches the expected env value; converges when ops set the env correctly.
3. **Dev fallback** (`'vcv-es256-dev'`): unreachable in production by structural guard.

No fourth source exists. No federation logic. No multi-key resolver.
A grep across the codebase (excluding `_archive/`, tests, and the dev
fallback line itself) returns zero unexpected kid emissions.

## §4 — Preview-deploy gotcha

Vercel preview deployments inherit `NODE_ENV=production`. The
PR-362 fail-closed guard therefore fires on preview deploys too. If
preview-scope env vars are not set:

- `/api/.well-known/jwks.json` returns 500 on previews
- `/.well-known/did.json` returns 500 on previews
- `/api/status` reports `degraded` on previews
- `/api/receipt/[lineageKey]` returns `signingKeyId: 'vcv-es256-1'` (env-resolved default works without the JWK because no actual signing happens in this response)

Operator decision required:
- **Option A**: set `RECEIPT_PRIVATE_KEY_JWK` + `RECEIPT_KID` on Preview scope too (e.g., a dedicated preview JWK pair). Preview surfaces all converge.
- **Option B**: accept that previews 500 the signing surfaces. Safer (no preview-key sprawl) but breaks preview testing of JWKS/DID surfaces.

Recommendation: Option A with a preview-only JWK so previews are
testable. The preview kid should NOT be `vcv-es256-1` (avoid identity
collision); use e.g. `vcv-es256-preview-1`.

## §5 — What this report does NOT cover

- Live HTTP verification (operator-side; commands provided above)
- Key rotation procedure (out of scope per user directive)
- Multi-key resolver / kid federation (out of scope per user directive)
- The unmerged `/.well-known/openid-credential-issuer` and other canonical verifier paths — those ship on a different stack, not on origin/main

## §6 — Convergence verdict

**Structural convergence: ACHIEVED on `origin/main`.**

Every runtime surface that emits a signing kid either:
- reads `process.env.RECEIPT_KID` (env-driven, throws if absent in prod), or
- falls back to `'vcv-es256-1'` (the expected env value), or
- is gated by `if (isDev())` (correctly unreachable in production)

**Operational convergence**: pending the operator setting the two
required env vars on the `vcv-web` Vercel project Production (and
Preview, per §4) scopes. No code change can replace this step.
