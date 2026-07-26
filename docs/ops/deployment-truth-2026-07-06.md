# M0-7 — Deployment Truth Check

**Date:** 2026-07-06T18:06Z
**Method:** Live `curl` of public endpoints (no prod credentials required).

## Result: production is LIVE and HEALTHY on Railway.

| Probe | Status | Evidence |
|---|---|---|
| `https://vitalcv.com` | **200** | Serves the live app (design-system HTML) |
| `https://vitalcv.com/api/version` | **200** | `platform: railway`, `branch: main`, `commit 9525877`, `environment: production`, deploymentId `d5a5741b…` |
| `https://vitalcv.com/api/health` | **200** | `status: ok`; backend `https://api.vitalcv.com` → `status: ok`; Clerk `enabled: true, mode: production` |
| `https://api.vitalcv.com/health` | **200** | `status: ok`, `git_branch: main`, `git_sha 9525877` (**matches web — synchronized deploy**) |
| `https://api.vitalcv.com/api/version` | **401** | `organization_context_required` — tenant guard enforcing authN. **Expected/correct**, not a fault. |

## Config truth (from `/api/health`)

- **Platform:** Railway (Vercel not in path — consistent with `docs/deployment/railway-migration.md`).
- **Web ↔ API on same commit** `9525877` → deploys are synchronized.
- **`BACKEND_URL`** correctly resolves to `https://api.vitalcv.com` (server-side reads hit real backend).
- **Clerk:** enabled, production mode.
- **Sentry:** `false` — **gap**, closed in M5-1.

## Security headers (from `curl -I https://vitalcv.com`)

- ✅ `Content-Security-Policy` present (Clerk custom-domain fix #536 holding).
- ✅ `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- ✅ `X-Frame-Options: DENY`.
- → M3-6 HTTP hardening already has a real baseline; remaining work is CSP tightening (drop `unsafe-inline`/`unsafe-eval` where possible) + securityheaders.com grade A verification.

## Owner-gated items (cannot verify without dashboard access)

- [ ] Full Railway web env-var checklist (`BACKEND_URL` ✅ inferred live; Clerk ✅ inferred live; remaining vars unverifiable externally).
- [ ] Vercel env parity — **N/A**, Vercel deprecated.
- [ ] Clerk JWT template on dashboard — inferred working (sign-in path live since #536); dashboard confirm still owner-side.

## Bottom line

The deployed environment is real, healthy, synchronized, and enforcing auth. No
deployment blocker for the wave program. The one concrete gap surfaced is
**Sentry disabled** (→ M5-1).
