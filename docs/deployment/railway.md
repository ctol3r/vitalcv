# Railway Deployment Guide

## One-Command Deploy

```bash
./scripts/railway/autopilot.sh
```

The autopilot script verifies local state, builds, runs preflight checks, triggers a Railway deploy, and smoke-tests the live `/health` endpoint.

### Options

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `DEPLOY_BRANCH` | `main` | Branch to deploy |
| `SKIP_BUILD` | `0` | Set to `1` to skip local build (if CI already passed) |
| `HEALTH_TIMEOUT` | `180` | Seconds to wait for healthcheck |
| `HEALTH_INTERVAL` | `10` | Seconds between healthcheck polls |

## Required Environment Variables

Run `node scripts/railway/print-required-env.mjs` for the full list.

### Must Set Manually

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (use Railway template syntax: `${{Postgres.DATABASE_URL}}`) |
| `API_KEYS` | Comma-separated API keys for write endpoints |
| `NODE_ENV` | Must be `production` |

### Auto-Set by Railway

| Variable | Description |
|----------|-------------|
| `PORT` | Listening port |
| `RAILWAY_PUBLIC_DOMAIN` | Public domain (used for CORS auto-detection) |
| `RAILWAY_GIT_BRANCH` | Branch being deployed |
| `RAILWAY_GIT_COMMIT_SHA` | Commit SHA being deployed |

### Recommended

| Variable | Description |
|----------|-------------|
| `CORS_ORIGIN` | Comma-separated allowed origins (auto-detects from `RAILWAY_PUBLIC_DOMAIN` if unset) |
| `SENTRY_DSN` | Server-side error tracking |
| `MONITORING_SECRET` | Secret for `/api/internal/health` endpoint |

## Architecture

```
Container boot
  │
  ├─ Early HTTP server binds to 0.0.0.0:$PORT immediately
  │   └─ GET /health → {status: "starting"} (passes Railway healthcheck)
  │
  ├─ bootstrapApp() loads all dependencies via dynamic import()
  │   ├─ loadEnv() validates environment with Zod
  │   ├─ Express app created with all routes
  │   └─ Early server hands socket to Express (no rebind gap)
  │
  └─ GET /health → {status: "ok"} (Express now handles requests)
```

- **Migrations** run in `releaseCommand` (before start), not at startup
- `SKIP_STARTUP_MIGRATION=1` in `startCommand` prevents duplicate migrations
- If `bootstrapApp()` crashes, the early server stays alive so Railway can read logs

## Health Endpoints

| Path | Purpose | Auth | DB? | Use For |
|------|---------|------|-----|---------|
| `/health` | Liveness probe | None | No | Railway healthcheck |
| `/readyz` | Readiness probe | None | Yes (`SELECT 1`) | Deep readiness |
| `/api/internal/health` | Full system check | `MONITORING_SECRET` | Yes | Monitoring |

All health responses include `git_branch` and `git_sha` fields to identify the running deployment.

## Failure Map

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "1/1 replicas never became healthy" | Port not bound, or healthcheck timeout too short | Verify `server.ts` early bind; check `healthcheckTimeout` in `railway.toml` |
| `/health` returns `{status: "starting"}` indefinitely | `bootstrapApp()` crashed or hung | Check Railway runtime logs for the actual error |
| `/health` returns `{status: "error", error: "..."}` | `loadEnv()` or import failure | Check env vars; the `error` field tells you what failed |
| `/readyz` returns 503 | `DATABASE_URL` wrong or DB unreachable | Verify PostgreSQL connection string |
| Build fails with type errors | Code or dependency issue | Run `pnpm --filter @vitalcv/api run build` locally |
| Migration fails in `releaseCommand` | Schema drift or missing migrations dir | Run `prisma migrate deploy` locally; check `prisma/migrations/` exists |
| "environment validation failed" in logs | Missing required env vars | Logs include `missing` array with exact var names |
| Wrong branch deployed | Railway deploying non-main branch | Check `RAILWAY_GIT_BRANCH` in `/health` response or logs |

## Preflight Checks

```bash
node scripts/railway/preflight.mjs
```

Validates 11 deploy invariants without starting the application:

1. Server binds to `0.0.0.0` on `PORT`
2. `/health` route exists and is DB-independent
3. `/readyz` route exists
4. Environment validation logs missing keys
5. `railway.toml` has correct healthcheck path
6. Start command skips inline migrations
7. Install uses frozen lockfile

The CI workflow (`.github/workflows/ci-preflight.yml`) runs these checks on every PR to `main`/`develop`.

## Configuration

All Railway config lives in `railway.toml` at the repo root:

```toml
[build]
installCommand = "pnpm install --frozen-lockfile --ignore-scripts"
buildCommand = "pnpm --filter @vitalcv/api run build"

[deploy]
releaseCommand = "pnpm --filter @vitalcv/api run db:migrate:deploy"
startCommand = "SKIP_STARTUP_MIGRATION=1 node apps/api/backend/dist/apps/api/backend/src/server.js"
healthcheckPath = "/health"
healthcheckTimeout = 120
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 5
```
