# Production Env Requirements

**B20-CODE-01 deliverable.** Zero-assumption operator-facing env-var
reference for restoring `vitalcv.com` to externally reachable
production. Every var is classified by failure mode + default safety.

This document does not invent vars. Every entry is sourced from
existing code on `origin/main` (HEAD verified in the convergence PR).

## §1 — Required for production (FAIL CLOSED if missing)

These vars MUST be set on the canonical Vercel project's Production
scope. Without them, the named surface fails closed or returns 500
rather than degrading silently.

| Var | Consumer | Failure mode if missing | Safe default? |
|---|---|---|---|
| `RECEIPT_PRIVATE_KEY_JWK` | `apps/web/lib/crypto/receiptIssuer.ts:73-78` | `getOrInitKeypair()` throws in production → JWKS / DID / signed-receipt surfaces return 500 | **NO** — operator must supply ES256 private JWK |
| `RECEIPT_KID` | `apps/web/lib/crypto/receiptIssuer.ts:79-85` | Same fail-closed throw if private JWK is set but kid is not | **NO** — operator must set; expected value `vcv-es256-1` |
| `DATABASE_URL` | Prisma client (backend); some web routes via shared helpers | Backend boot fails fast (`apps/api/backend/src/config/env.ts`) | **NO** — operator must point to Railway production DB |
| `CLERK_SECRET_KEY` | `apps/web/middleware.ts:35` `CLERK_MIDDLEWARE_ENABLED` gate | Middleware enters fallback path; protected routes redirect to non-functional `/sign-in` | **NO** — operator must supply `sk_live_...` |

## §2 — Required for full functional surface (DEGRADE GRACEFULLY if missing)

These vars do NOT fail closed but cause specific observable defects.
Set them in production; their absence is honest-degradation, not a
crash.

| Var | Consumer | Effect when missing | Recommended value |
|---|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `apps/web/app/api/health/route.ts:7` + Clerk SDK | `/api/health` reports `clerk.enabled: false`; Clerk frontend SDK can't initialize | `pk_live_...` matching the secret in §1 |
| `NEXT_PUBLIC_API_BASE` | `apps/web/app/api/health/route.ts:15` + `lib/backend-url.ts:15` | `/api/health` reports `apiBase: false` (cosmetic); backend reachable via fallback chain | `https://api.vitalcv.com` |
| `BACKEND_URL` | `lib/backend-url.ts:11` (canonical resolver); inlined into ~40 ad-hoc routes | Inline-resolver routes fall back to `localhost:4000` on Vercel → `fetch failed` (per `upstream-fetch-topology.md` §A) | `https://api.vitalcv.com` |
| `NEXT_PUBLIC_BACKEND_URL` | Tertiary fallback in resolver chain | None individually; redundant with `BACKEND_URL` for legacy callers | Same value as `BACKEND_URL` |
| `CRON_SECRET` and/or `MONITORING_SECRET` | Probe runner cron + `_probe/` handlers | `LaneHealthMount` band reads UNKNOWN seeds; probe schedule cannot fire | Random secret per Vercel cron config |
| `NEXT_PUBLIC_SENTRY_DSN` | `/api/health:24`; Sentry frontend init | `/api/health` reports `sentry: false`; runtime errors not captured | Sentry production DSN |
| `ALLOWED_CORS_ORIGINS` | `apps/web/middleware.ts:111-124` | Cross-origin API requests blocked; same-origin works | Comma-separated allowlist |

## §3 — Recommended (cosmetic / labelling)

These vars improve operator legibility but do not affect functional
behavior on the happy path.

| Var | Consumer | Effect when missing | Recommended |
|---|---|---|---|
| `VITALCV_ENV_LABEL` | `apps/web/app/api/status/route.ts:19` | `/api/status` `environment` field reports `NODE_ENV` value (which is `"production"` on previews too — confusing) | `production` for Production scope; `preview` for Preview scope |
| `VITALCV_ISSUER_URL` (or `NEXT_PUBLIC_APP_URL`) | `apps/web/lib/crypto/receiptIssuer.ts:113-116` | Receipt JWT `iss` claim falls back through chain to `https://vitalcv.com` | `https://vitalcv.com` |

## §4 — Preview-scope-only (DIFFERENT from Production)

Vercel preview deploys inherit `NODE_ENV=production`, so the
production fail-closed guards fire on previews. Two options:

### Option A — Preview-key (recommended for institutional review)

Set on Preview scope:

| Var | Recommended preview value | Why different from Production |
|---|---|---|
| `RECEIPT_PRIVATE_KEY_JWK` | Different ES256 JWK from production | Prevents identity collision; preview-signed receipts are clearly distinguishable from production-signed |
| `RECEIPT_KID` | `vcv-es256-preview-1` | Different kid means a verifier sees preview vs production receipts as different keys |
| `VITALCV_ENV_LABEL` | `preview` | `/api/status` reports honestly |

### Option B — Preview-500 (acceptable for transient PR previews)

Leave Preview scope env unset. JWKS / DID / signed-receipt surfaces
return 500 on previews; UI-only previews still work. No identity
leakage risk.

## §5 — Vars that should NEVER fall back silently

These vars exist in the codebase with fallback chains. The fallbacks
are explicit and (post-PR-362) safe. Documented for operator
awareness.

| Var | Fallback chain | Risk if fallback fires unexpectedly |
|---|---|---|
| `RECEIPT_PRIVATE_KEY_JWK` | Production: throws. Dev: ephemeral keypair. | None in production (fail-closed). |
| `RECEIPT_KID` | Production: throws. Dev: `vcv-es256-dev` (or `RECEIPT_KID_DEV`). | None in production (fail-closed). |
| `BACKEND_URL` | Chain: `BACKEND_URL` → `NEXT_PUBLIC_API_BASE` → `NEXT_PUBLIC_BACKEND_URL` → Railway prod URL (on Vercel) → `localhost:4000` (on local) | Inline resolvers (per `upstream-fetch-topology.md` §A) can fall back to `localhost:4000` even on Vercel if `BACKEND_URL` env not set. Set explicitly to avoid this. |
| `VITALCV_ENV_LABEL` | Chain: env → `NODE_ENV` → `"unknown"` | Reports `"production"` on previews if unset. Set explicitly. |
| `ISSUER_DID` | Falls back to hardcoded `'did:web:vitalcv.com'` | Safe; matches expected canonical. |

## §6 — Required-vs-recommended decision flow

```
QUESTION: For which env should I set this var?

  RECEIPT_PRIVATE_KEY_JWK + RECEIPT_KID
    → Production: REQUIRED.
    → Preview: REQUIRED if you want Option A; else leave for Option B (500 acceptable).
    → Local: not needed (dev fallback path generates ephemeral).

  CLERK_SECRET_KEY + NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    → Production: REQUIRED.
    → Preview: RECOMMENDED (else previews redirect to broken /sign-in).
    → Local: REQUIRED for authenticated flow testing.

  DATABASE_URL
    → Production: REQUIRED.
    → Preview: REQUIRED (point at preview DB or read-only replica).
    → Local: REQUIRED (point at local Postgres).

  BACKEND_URL
    → Production: REQUIRED (without it, inline resolvers fall back to localhost).
    → Preview: REQUIRED.
    → Local: omit (defaults to localhost:4000).

  VITALCV_ENV_LABEL
    → Production: RECOMMENDED (`production`).
    → Preview: RECOMMENDED (`preview`) — distinguishes from production in /api/status.
    → Local: omit.

  CRON_SECRET / MONITORING_SECRET
    → Production: REQUIRED (else lane-health snapshots stay UNKNOWN).
    → Preview: not applicable (no cron on previews).
    → Local: not applicable.

  NEXT_PUBLIC_SENTRY_DSN
    → All: RECOMMENDED.
```

## §7 — Operator setup checklist

In order on the Vercel dashboard for the **operator-confirmed
canonical project** (per `production-restore-sequence.md` §1):

1. Settings → Environment Variables → "Add New" for each row in §1
   (all four REQUIRED-fail-closed vars). Scope: Production.
2. Same for §2 rows (REQUIRED-degrade-gracefully).
3. Same for §3 rows (RECOMMENDED).
4. Apply Preview-scope per §4 chosen option.
5. Trigger a new deployment (env vars do not retroactively apply).
6. Run `scripts/verify-production-runtime.sh` (per `B20-CODE-02`)
   to verify each surface.

Without all of §1 set, the deployment will return 500 from JWKS/DID
and fail signed-receipt issuance. Without §2, the deployment will be
operationally degraded but not crash.

## §8 — What this document does NOT cover

- Where to source the ES256 JWK from (key generation procedure — out of scope per "no key rotation").
- Vercel team / billing settings (operator-side; not env vars).
- Railway DB schema migration state (separate ops concern).
- Backend env vars (this doc is web-app-scoped).

For Railway backend env vars, see `apps/api/backend/src/config/env.ts`.
