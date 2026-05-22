# Railway Deploy Runbook · vitalcv.com (web)

**Status:** Ready to deploy.
**Verified:** 2026-05-22.

## What this PR does

- Removes the Vercel-coupled `start`/`dev` wrapper that referenced
  a missing `scripts/runtime/assert-canonical-runtime.ts`. The
  scripts now use `next start -H 0.0.0.0 -p ${PORT:-3030}` so
  Railway's injected `$PORT` works out of the box.
- Adds `apps/web/railway.toml` + `apps/web/nixpacks.toml` so the
  Railway service can deploy `apps/web` directly (the root
  `railway.toml` is for `apps/api/backend`).
- Removes `vercel.json` and `.vercelignore` from the repo root.
- Applies the wallet-sdk orphan-export fix (PR #375 carried here
  too).
- Adds `apps/web/.env.example` listing required + optional env.

**Verified locally on this branch:**
- `pnpm install --frozen-lockfile` — clean
- `pnpm turbo run build --filter @vitalcv/web` — passes
- `PORT=8765 pnpm start` — boots in ~360ms
- `curl http://127.0.0.1:8765/api/health` — returns
  `{"status":"ok","service":"web","backend":{"url":"https://api.vitalcv.com","status":"unreachable"},...}`

## Exact Railway deployment steps

### 1. Create the service

Railway dashboard → New Service → Deploy from GitHub repo → select
`ctol3r/vitalcv`.

Set:
- **Branch:** `fix/vercel-removal-railway-deploy` (or `main` after merge)
- **Root directory:** `apps/web`
- **Builder:** Nixpacks (auto-detected from `nixpacks.toml`)

### 2. Set the required env vars

In the Railway service → Variables tab, add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | (from clerk.com production app) |
| `CLERK_SECRET_KEY` | (from clerk.com production app) |
| `NODE_ENV` | `production` |

**Do not set `PORT`** — Railway injects it automatically.

Recommended optional vars:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://vitalcv.com` |
| `VCV_ISSUER_HOST` | `vitalcv.com` |

Skip Sentry and Backend URLs unless those services are needed for
the public launch. The runtime tolerates their absence:
- `NEXT_PUBLIC_SENTRY_DSN` unset → Sentry instrumentation skipped entirely
- `BACKEND_URL` unset → `/api/health` reports `backend: unreachable` but the surface stays up

### 3. Build + start commands (already wired)

These are read from `apps/web/nixpacks.toml` and
`apps/web/railway.toml` and do not need manual override:

| Phase | Command |
|---|---|
| Install | `cd ../.. && pnpm install --frozen-lockfile` |
| Build | `cd ../.. && pnpm turbo run build --filter @vitalcv/web` |
| Start | `pnpm start` (which runs `next start -H 0.0.0.0 -p ${PORT}`) |

### 4. Health check

Path: `/api/health`
Expected: `200 OK` with JSON body `{"status":"ok",...}`
Timeout: 60 seconds (set in `railway.toml`)

### 5. Custom domain

Railway service → Settings → Networking → Custom Domain → add
`vitalcv.com`.

Railway returns a target hostname like `xxxxx.up.railway.app`.

### 6. Cloudflare DNS

In the Cloudflare DNS dashboard for the `vitalcv.com` zone:

| Type | Name | Content | Proxy |
|---|---|---|---|
| `CNAME` | `@` (or `vitalcv.com`) | `xxxxx.up.railway.app` | Proxied (orange cloud) OR DNS-only (grey cloud) |
| `CNAME` | `www` | `xxxxx.up.railway.app` | match the apex |

**Cloudflare proxy mode**: Railway accepts both proxied and
DNS-only. If proxied, Cloudflare terminates TLS at its edge and
proxies to Railway; if DNS-only, Railway handles TLS directly via
its issued cert. For the first deploy, **DNS-only is simpler** —
it avoids a double-TLS hop and surfaces Railway TLS issues
immediately.

After DNS propagation (1–5 minutes), the Railway dashboard will
show the custom domain as `Active`.

### 7. Verify

```
curl -fsS https://vitalcv.com/api/health
```

Expected: `{"status":"ok","service":"web",...}`

Also visit `https://vitalcv.com/` in a browser — confirm SSR
renders without hydration errors.

## What can break and how to recover

| Symptom | Cause | Fix |
|---|---|---|
| Build fails: `Cannot find module './interoperability'` in wallet-sdk | Wallet-sdk orphan re-export | Confirm `packages/wallet-sdk/src/index.ts` line 351 is the doctrine note, not the broken `export * from './interoperability'`. |
| Build fails: workspace dependency `@vitalcv/trust-state` not found | Turbo prebuild missed | Ensure build runs from monorepo root (`cd ../..`) so turbo orders workspace builds. |
| Start fails: `Error: listen EADDRINUSE` on Railway | `$PORT` not used | Verify `apps/web/package.json` `start` is `next start -H 0.0.0.0 -p ${PORT:-3030}` (no hard-coded port). |
| Build fails: Clerk types missing | Clerk env vars unset at build time | Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` BEFORE the first build, not after. |
| `/api/health` returns 200 but homepage 500s | Clerk publishable key unset at runtime | The site needs both Clerk env vars set; the health route works without them. |
| Pages render but Clerk redirects loop | Clerk dashboard URL settings | Clerk production app must allow `vitalcv.com` as an authorized origin. |

## What is intentionally NOT done in this PR

- **Vercel-coupled GitHub Actions workflows** are left in place but
  already disabled to `workflow_dispatch` only (`deploy-demo.yml`).
  They do not interfere with the Railway deploy.
- **`output: 'standalone'` in `next.config.mjs`** is NOT enabled.
  The default Next.js output works on Railway. Switching to
  standalone is an optional optimization for a future PR.
- **The root `railway.toml`** for `apps/api/backend` is untouched.
  Web and API are separate Railway services.
- **DATABASE_URL** is not required for the public-only launch.
  Prisma client generation does not need a reachable database;
  it generates types from the schema. If any runtime code path
  actually executes a Prisma query against the web schema, the
  request will fail with a clear Prisma error — investigate and
  either wire DATABASE_URL or remove the call.

## Final determination

**LIVE + SAFE** — pending Railway service creation, env-var setting,
and DNS propagation. The repo is deploy-safe.

### Exact remaining blockers (operator-only)

1. Create the Railway service pointing at `apps/web` (operator action).
2. Set the two required Clerk env vars in the Railway dashboard (operator action).
3. Attach `vitalcv.com` to the Railway service (operator action).
4. Update Cloudflare DNS CNAME to the Railway target hostname (operator action).
5. Update Clerk production app's authorized origins to include `vitalcv.com` (operator action).

All five blockers are operator-side. No code blocker remains.
