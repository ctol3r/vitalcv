# Public Apex Validation
Generated: 2026-05-13T18:11:26Z
Runtime: localhost:3030 (Next.js) | localhost:4000 (Express)
Commit: 083ffeaf + readability fixes (pending commit)

---

## Phase 1 Verdict: ALL ENDPOINTS OPERATIONAL — LOCAL APEX CLEAN

13/13 endpoints: 200 OK. Zero SPA fallback on JSON routes. All content-types correct.

---

## Endpoint Probe Results

| Code | Content-Type | SPA Fallback | Endpoint |
|------|-------------|--------------|----------|
| 200 | application/json | ✅ None | `/.well-known/jwks.json` |
| 200 | application/json | ✅ None | `/.well-known/did.json` |
| 200 | application/json | ✅ None | `/.well-known/openid-credential-issuer` |
| 200 | application/json | ✅ None | `/.well-known/openid-configuration` |
| 200 | application/json | ✅ None | `/.well-known/trust.json` |
| 200 | application/json | ✅ None | `/.well-known/trust-register` |
| 200 | text/html (SSR) | N/A — expected | `/trust` |
| 200 | text/html (SSR) | N/A — expected | `/trust/doctrine` |
| 200 | text/html (SSR) | N/A — expected | `/verify` |
| 200 | application/json | ✅ None | `/api/receipt/nppes_identity:1457128589` |
| 200 | application/json | ✅ None | `/api/replay/test-run-001` |
| 200 | application/json | ✅ None | `/api/status` |
| 200 | text/html (SSR) | N/A — expected | `/status` |

**SPA fallback check:** All JSON API routes return `application/json` — no HTML fallback pages.
HTML routes (`/trust`, `/verify`, `/status`) are Next.js App Router SSR pages — `text/html` is correct.

---

## Payload Shape Verification

### `/.well-known/jwks.json`
```json
{ "keys": [{ "kid": "vcv-es256-dev", "alg": "ES256", "kty": "EC", "use": "sig" }] }
```
- ✅ `keys[]` present — 1 key
- ✅ `kid` stable: `vcv-es256-dev` (deterministic since this session's fix)
- ✅ No SPA fallback

### `/.well-known/did.json`
```json
{
  "id": "did:web:vitalcv.com",
  "verificationMethod": [{ "id": "...#vcv-signing-key-1", "type": "JsonWebKey2020" }],
  "authentication": ["...#vcv-signing-key-1"],
  "service": [
    { "type": "CredentialIssuer" },
    { "type": "ReceiptVerifier" },
    { "type": "OID4VCIIssuer" }
  ]
}
```
- ✅ `id`: `did:web:vitalcv.com` — canonical
- ✅ 3 service entries (fixed this wave)
- ✅ `JsonWebKey2020` verification method

### `/.well-known/openid-credential-issuer`
```json
{ "issuer": "https://vitalcv.com", "credential_issuer": "https://vitalcv.com", "jwks_uri": "https://vitalcv.com/.well-known/jwks.json" }
```
- ✅ OID4VCI Draft 13 compliant shape

### `/api/status`
```json
{ "overall": "operational", "environment": "pilot", "doctrine": { "version": "1.0", "anonymous_reads": "public", ... } }
```
- ✅ 11 endpoints listed, all `operational`
- ✅ Environment: `pilot`
- ✅ 7-point doctrine present

### `/api/receipt/nppes_identity:1457128589`
```json
{ "laneId": "nppes_identity", "providerId": "1457128589", "receipt": { "issuerDid": "did:web:vitalcv.com" } }
```
- ✅ `issuerDid`: `did:web:vitalcv.com` — canonical (no mock leak)
- ✅ `checkedAt` now in ISO 8601 Z-suffix format (fixed this wave)

### `/api/replay/test-run-001`
```json
{ "lineageKey": "...", "runId": "3a60de4c", "receipt_continuity": { "issuerDid": "did:web:vitalcv.com" } }
```
- ✅ Shape correct
- ✅ `issuerDid`: `did:web:vitalcv.com`

---

## Route Ownership

All routes are App Router owned (`route.ts` files under `app/api/`). No Express fallback on any `.well-known/` route. No SPA fallback on any JSON endpoint.

| Route pattern | Owner | Notes |
|---|---|---|
| `/.well-known/*` | Next.js App Router | `app/api/.well-known/*/route.ts` |
| `/api/replay/[runId]` | Next.js App Router | `app/api/replay/[runId]/route.ts` |
| `/api/receipt/[lineageKey]` | Next.js App Router | `app/api/receipt/[lineageKey]/route.ts` |
| `/api/status` | Next.js App Router | `app/api/status/route.ts` |
| `/trust` | Next.js App Router | `app/trust/page.tsx` (SSR) |
| `/verify` | Next.js App Router | `app/verify/page.tsx` (SSR) |

---

## Production (Vercel) State

**Vercel project:** `prj_ycAjB1G2LNw4lE2JZ6p6l7b9mi1o` (`web`)
**Org:** `team_V9t533j9uGEbBpXN51y7ZRz8`
**Vercel CLI:** not installed on this machine
**Current production URL:** Unknown — Vercel CLI required to query live deployment URL
**Last known env state:** `.env.vercel.local` present but `VERCEL_URL` is empty string (preview env, not production)

**What this means:** Local apex is fully verified. Production (Vercel) apex cannot be probed without:
1. Vercel CLI installed (`npm i -g vercel`) and authenticated, OR
2. The production deployment URL known

**Required for full external validation:**
```bash
npm i -g vercel
vercel ls --scope team_V9t533j9uGEbBpXN51y7ZRz8
# Then probe the production URL for each endpoint above
```

**Expected production gaps (documented in DEPLOYMENT_ACTIVATION_STATE.md):**
- `RECEIPT_PRIVATE_KEY_JWK` not set → signing key will be ephemeral on Vercel (regenerated per cold start)
- `CORS_ORIGIN` not set → production will reject cross-origin requests
- `DATABASE_URL` (backend) not confirmed set on Railway

---

## Edge Cache

Next.js `force-dynamic` is set on all API routes that must not be cached:
- `/api/replay/[runId]` — `export const dynamic = 'force-dynamic'`
- `/api/receipt/[lineageKey]` — `Cache-Control: no-store`
- `/api/status` — no caching

Well-known routes use `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` — appropriate for verifier discovery documents.

---

**SUCCESS: All 13 institutional surfaces return correct responses with zero SPA fallback.**
**Local apex clean. Production apex pending Vercel CLI probe.**
