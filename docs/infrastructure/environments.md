# Production Infrastructure — Environments & Configuration

> Verified via `railway variables` on 2026-06-29. Values are never shown here.

## Environments

| Environment | Where | Notes |
|---|---|---|
| `production` | Railway env `production` (region us-west2) | apex `vitalcv.com` + `api.vitalcv.com` |
| local dev | developer machine | `next dev` (web :3030), API `:4000` |

There is currently a single Railway environment (`production`). A `staging`
environment is recommended (scorecard → Operational maturity).

## Secrets management

- All secrets live in **Railway service variables**, injected at build/runtime.
- **No secrets in git.** `.gitignore` covers `.env`, `.env*.local`, `.vercel`.
  `apps/api/backend/.env.production` is a **commented template** (no active
  assignments) — it should be renamed `.env.production.example` (scorecard → Config hygiene).
- Railway also injects deploy metadata: `RAILWAY_ENVIRONMENT`, `RAILWAY_GIT_COMMIT_SHA`,
  `RAILWAY_GIT_BRANCH`, `RAILWAY_PUBLIC_DOMAIN` (read by `lib/deployInfo.ts`).

## `vitalcv-web` variables (names only — verified set)

**Build-time (baked into client bundle):**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` ✓ — required, else browser Clerk init fails.
- `NEXT_PUBLIC_API_BASE` ✓ — client API base.

**Runtime:**
- `CLERK_SECRET_KEY` ✓ · `DATABASE_URL` ✓ (web Prisma: `worklistRepo`, `issuerPersistenceWriter`)
- `RECEIPT_KID` ✓ · `RECEIPT_PRIVATE_KEY_JWK` ✓ (ES256 receipts)
- `ALLOWED_CORS_ORIGINS` ✓ · `NODE_ENV` ✓ · `NEXT_TELEMETRY_DISABLED` ✓
- `BACKEND_URL` — **not set**, but optional: `getBackendBase()` / `lib/backend-url.ts`
  fall back to `NEXT_PUBLIC_API_BASE` (which is set), so server-side reads work.
- `NEXT_PUBLIC_SENTRY_DSN` — **not set** → no frontend error tracking (scorecard → Observability).

## `delightful-essence` (API) variables (names only — verified set)

- `DATABASE_URL` ✓ · `API_KEYS` ✓ · `CLERK_SECRET_KEY` ✓ · `JWT_SECRET` ✓
- `VCV_PRIVATE_KEY` ✓ · `VCV_PUBLIC_KEY` ✓ · `ADMIN_SEED_TOKEN` ✓
- `CORS_ORIGIN` ✓ · `NODE_ENV` ✓ · `SKIP_STARTUP_MIGRATION` ✓
- `DEMO_MODE`, `YC_DEMO_MODE`, `SYSTEM_FROZEN` — **flags present in production**;
  confirm intended behavior (scorecard → Security).

## `Postgres`

- Connection string consumed by both services via `DATABASE_URL` (Railway private network).
- Engine: `postgres-ssl:17`. Backups: Railway-managed — **must be verified/enabled** (scorecard → Disaster recovery).

## Required-to-run matrix

| Var | web | api | Effect if missing |
|---|---|---|---|
| `DATABASE_URL` | ✓ | ✓ | web issuer/verifier routes + all API DB ops fail |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (build) | ✓ | — | browser auth broken |
| `CLERK_SECRET_KEY` | ✓ | ✓ | server auth broken |
| `NEXT_PUBLIC_API_BASE` (build) or `BACKEND_URL` | ✓ | — | web → API calls target wrong host |
| `API_KEYS` | — | ✓ | API write endpoints reject |
| `RECEIPT_PRIVATE_KEY_JWK` / `VCV_PRIVATE_KEY` | ✓ | ✓ | signing fails |
