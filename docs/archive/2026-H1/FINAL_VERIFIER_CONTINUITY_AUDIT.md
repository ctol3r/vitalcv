# Final Verifier Continuity Audit
Generated: 2026-05-13T06:07:00Z — ALL LIVE VERIFIED

---

## Live Probe Results (15/15 PASS)

| Endpoint | Status | Content-Type | Fields | Verdict |
|----------|--------|-------------|--------|---------|
| /.well-known/jwks.json | 200 | application/json | keys[0].kty=EC | ✓ PASS |
| /.well-known/did.json | 200 | application/json | id=did:web:vitalcv.com | ✓ PASS |
| /.well-known/openid-credential-issuer | 200 | application/json | issuer, jwks_uri | ✓ PASS |
| /.well-known/openid-configuration | 200 | application/json | issuer | ✓ PASS |
| /.well-known/trust.json | 200 | application/json | issuer, proof_tiers | ✓ PASS |
| /.well-known/trust-register | 200 | application/json | doctrine, issuer | ✓ PASS |
| /.well-known/verifier-manifest.json | 200 | application/json | issuer | ✓ PASS |
| /api/replay/[runId] | 200 | application/json | 12 fields including lineageKey, runId, ownership | ✓ PASS |
| /api/receipt/[lineageKey] | 200 | application/json | laneId=nppes_identity, providerId | ✓ PASS |
| /api/replay/integrity/[npi] | 200 | application/json | chain_valid, anomaly_count | ✓ PASS |
| /api/runtime/ping | 200 | application/json | alive=true | ✓ PASS |
| /api/status | 200 | application/json | overall=operational | ✓ PASS |
| /trust | 200 | text/html | — | ✓ PASS |
| /trust/doctrine | 200 | text/html | — | ✓ PASS |
| /verify | 200 | text/html | — | ✓ PASS |

No SPA fallback on any JSON route.
No 404s on any expected route.
App Router ownership confirmed on all routes.

---

## VC 2.0 Alignment

Receipt JWT claims:
- `iss`: https://vitalcv.com ✓
- `sub`: NPI (provider identity) ✓
- `azp`: Clerk userId (actor) ✓
- `vcv.actor_id`: Clerk userId ✓
- `vcv.provider_id`: NPI ✓
- `vcv.source`: source name ✓
- `vcv.status`: "confirmed" ✓
- Algorithm: ES256 ✓
- JWKS kid: matches /.well-known/jwks.json ✓

**VC 2.0 alignment: PARTIAL** — JWT format confirmed; W3C `@context` wrapper for full VC 2.0 spec not added (not required for current pilot).

## OID4VCI Alignment

`/.well-known/openid-credential-issuer` returns:
- `issuer`: https://vitalcv.com ✓
- `credential_issuer`: https://vitalcv.com ✓
- `credential_endpoint`: /api/credentials/issue ✓
- `jwks_uri`: /.well-known/jwks.json ✓
- `credentials_supported`: [VitalCVCredential] ✓

**OID4VCI alignment: OPERATIONAL for pilot.**

---

## Institutional Discoverability

A relying party starting from `did:web:vitalcv.com` can:
1. Resolve DID → `/.well-known/did.json` ✓
2. Find JWKS via DID verificationMethod → `/.well-known/jwks.json` ✓
3. Verify any receipt JWT against the JWKS ✓
4. Discover credential types via `/.well-known/openid-credential-issuer` ✓
5. Check trust manifest via `/.well-known/trust.json` ✓
6. Read machine-readable doctrine via `/.well-known/trust-register` ✓

**Independent verification possible without contacting VitalCV.** ✓

