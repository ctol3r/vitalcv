# Production Infrastructure — Deployment

> Verified against Railway (project `inspiring-reflection`, env `production`) on
> 2026-06-29. Railway is the only supported deployment target.

## Trigger

Push to `main` on GitHub → Railway auto-deploys the changed service(s).
GitHub Actions (`deploy-api.yml`, `deploy-web.yml`) do **not** deploy — they wait
for Railway and run a `/health` smoke test. No Vercel.

## Per-service build + start (actual)

| Service | Builder | Build | Start | Health |
|---|---|---|---|---|
| `vitalcv-web` | Dockerfile `/apps/web/Dockerfile` | `pnpm turbo run build --filter @vitalcv/web` (in image) | `pnpm start` → `next start -H 0.0.0.0 -p $PORT` | `/api/health` (120s) |
| `delightful-essence` | Nixpacks (`railway.toml` + `nixpacks.toml`) | `pnpm install --frozen-lockfile && pnpm turbo build` | `node -r register-workspace-paths.js dist/apps/api/backend/src/server.js` | `/health` (120s) |
| `Postgres` | Railpack (managed image) | — | managed | — |

### Why two builders
The web app benefits from a pinned multi-stage Dockerfile (deterministic Node 22
image, explicit asset copy). The API uses Nixpacks because the root `railway.toml`
drives `prisma migrate deploy` in `preDeployCommand` and a turbo monorepo build.
Both are committed and version-controlled.

## Migrations

- API `preDeployCommand`: `cd apps/api/backend && npx prisma migrate deploy`.
- 51 migrations under `apps/api/backend/prisma/migrations`.
- `SKIP_STARTUP_MIGRATION=1` is set so the server does not also migrate on boot
  (migration happens once, in the pre-deploy step, before the new instance starts).

## Rollout & rollback

- **Rollout:** health-gated. Railway starts the new deploy, waits for the
  healthcheck, then cuts over. **Caveat:** every service runs **1 replica**, so the
  cutover has a brief unavailability window (no overlapping replicas; `drainingSeconds`
  unset). See scorecard → Deployment reliability.
- **Rollback:** Railway retains prior deployments (`railway deployment list` shows
  SUCCESS/REMOVED history; `canRedeploy: true`). Roll back via dashboard
  ("Redeploy" a prior deployment) or `railway redeploy`. See `runbooks.md`.

## Verifying a deploy

1. `railway status` → confirm linked project/env/service.
2. `curl https://api.vitalcv.com/health` → `200` + metrics.
3. `curl https://vitalcv.com/api/health` → `200`, `clerk.mode: production`, `backend.status: ok`.
4. GitHub Actions `deploy-api` / `deploy-web` smoke tests (require `RAILWAY_API_DOMAIN` / `RAILWAY_WEB_DOMAIN` secrets).

## Local parity

- `pnpm install --frozen-lockfile && pnpm turbo run build --filter @vitalcv/web` reproduces the web build.
- `pnpm --filter @vitalcv/web exec next start` reproduces the runtime (set `BACKEND_URL`/`NEXT_PUBLIC_API_BASE` to the real API).
- A local Docker build mirrors Railway's web build: `docker build -f apps/web/Dockerfile .` (requires the Docker daemon).
