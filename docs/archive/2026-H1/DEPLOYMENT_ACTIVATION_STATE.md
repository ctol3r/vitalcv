# Deployment Activation State
Generated: 2026-05-13T18:11:00Z
Branch: wave-10a/docs-status | Commit: 083ffeaf + (pending)

---

## Phase 4 Verdict: LOCAL RUNTIME ACTIVE — PRODUCTION ENV INCOMPLETE

Local runtime exits institutional degraded-shell.
Production (Vercel/Railway) has 3 known missing env vars that will cause degraded mode.

---

## 1. API Base Activation

| Env Var | Local | Production (Vercel) | Status |
|---|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:4000` | Empty in `.env.vercel.local` | ⚠️ Must be set to Railway URL |
| `NEXT_PUBLIC_API_BASE` | `http://localhost:4000` | Empty in `.env.vercel.local` | ⚠️ Must be set to Railway URL |

**Impact:** Without `NEXT_PUBLIC_BACKEND_URL`, all backend proxies (ingest, employer review, replay) will fail in production with connection refused.

## 2. Clerk Configuration

| Env Var | Local | Production | Status |
|---|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ SET | SET (`.env.vercel.local`) | ✅ |
| `CLERK_SECRET_KEY` | ✅ SET | SET (`.env.vercel.local`) | ✅ |
| Clerk middleware active | ✅ | ✅ | ✅ |
| Post-auth redirect | ✅ | ✅ | ✅ |

## 3. Signing Key

| Env Var | Local | Production | Status |
|---|---|---|---|
| `RECEIPT_PRIVATE_KEY_JWK` | Not set (ephemeral dev key) | Not set | ⚠️ CRITICAL |
| `RECEIPT_KID` | Not set (uses `vcv-es256-dev`) | Not set | ⚠️ |

**Impact:** Without `RECEIPT_PRIVATE_KEY_JWK`, every Vercel cold start generates a new ephemeral signing key. Receipts issued before the cold start will fail JWKS verification (key rotated away). This breaks verifier continuity under load.

**Fix (5 min):**
```bash
# Generate once, store in Vercel env as RECEIPT_PRIVATE_KEY_JWK
node -e "
const { generateKeyPair, exportJWK } = require('jose');
generateKeyPair('ES256', { extractable: true }).then(async ({ privateKey }) => {
  console.log(JSON.stringify(await exportJWK(privateKey)));
});
"
# Then: vercel env add RECEIPT_PRIVATE_KEY_JWK production
# And:  vercel env add RECEIPT_KID production  (value: vcv-es256-1)
```

## 4. CORS Configuration

| Env Var | Local | Production | Status |
|---|---|---|---|
| `CORS_ORIGIN` | Not set (permissive dev) | Not set | ⚠️ CRITICAL |

**Impact:** Backend `originAllowlist.ts` throws if `CORS_ORIGIN=*` in production. Without this set, the backend will reject all cross-origin requests in production mode.

**Fix (2 min):**
```bash
# Railway: set CORS_ORIGIN=https://vitalcv.com (or your Vercel URL)
railway variables --set "CORS_ORIGIN=https://vitalcv.com"
```

## 5. Environment Label

| Env Var | Local | Production | Status |
|---|---|---|---|
| `VITALCV_ENV_LABEL` | `pilot` ✅ | Not confirmed | ⚠️ Cosmetic |

**Impact:** `/api/status` will show `environment: development` instead of `pilot` on Vercel. Low severity.

## 6. Database URL

| Env Var | Local | Production | Status |
|---|---|---|---|
| `DATABASE_URL` | SET (PostgreSQL vitalcv_dev) | Not confirmed on Railway | ⚠️ Likely set |

**Note:** Pilot events and audit events use dual-mode fallback (Postgres + file). If `DATABASE_URL` is not set, these fall back to file storage — functionally degraded but not broken.

## 7. Demo Mode

| Env Var | Local | Production | Status |
|---|---|---|---|
| `NEXT_PUBLIC_DEMO_MODE` | Not set | Set (`.env.vercel.local`) | ✅ |

---

## Railway Seed

**Status:** Not run.

No seed script has been executed against Railway. All passport lookups for real NPIs will return 404/degraded until:
1. `POST /api/ingest/{npi}` is called for at least one clinician, OR
2. A Railway seed script is run

---

## Degraded-Mode Lock Status

| Degraded Condition | Local | Production |
|---|---|---|
| No RECEIPT_PRIVATE_KEY_JWK | Not locked (ephemeral ok in dev) | ⚠️ Will degrade on cold start |
| No CORS_ORIGIN | Not locked (dev permissive) | ⚠️ Will reject cross-origin |
| No BACKEND_URL | Not locked (localhost works) | ⚠️ All backend calls fail |
| No PILOT-1 ingest | Degraded (no NPI data) | ❌ Degraded |

**Local: exits degraded-shell for all trust infrastructure.**
**Production: 3 env vars needed before exiting degraded-shell.**

---

## Required Production Activation Sequence

```
1. vercel env add RECEIPT_PRIVATE_KEY_JWK production  (ES256 JWK JSON)
2. vercel env add RECEIPT_KID production               (e.g. "vcv-es256-1")
3. railway variables --set "CORS_ORIGIN=https://vitalcv.com"
4. vercel env add NEXT_PUBLIC_BACKEND_URL production   (Railway URL)
5. vercel env add NEXT_PUBLIC_API_BASE production      (Railway URL)
6. vercel env add VITALCV_ENV_LABEL production         ("pilot")
7. vercel redeploy (to pick up env vars)
8. POST /api/ingest/1457128589 (PILOT-1)
```

**Estimated time: 20 min.**
