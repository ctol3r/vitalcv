# Deployment Guide

## How to deploy

Push to `main`. That's it.

```bash
git checkout main
git merge your-branch
git push origin main
```

Railway auto-deploys the API. Vercel auto-deploys the marketing site.

### What happens on push to main

1. **CI** (`ci.yml`) — install, typecheck, lint, build, test
2. **Preflight** (`ci-preflight.yml`) — env contract check, Railway preflight assertions, migrations test
3. **Railway** — auto-builds with Railpack, runs `releaseCommand` (migrations), then `startCommand`
4. **Vercel** — auto-builds marketing site if `apps/marketing/**` changed
5. **Smoke test** (`deploy-api.yml`) — polls `/health` after Railway deploy

### Manual deploy (bypass auto-deploy)

```bash
# Full autopilot: build + verify + deploy + smoke test
./scripts/railway/autopilot.sh

# Skip local build (CI already passed)
SKIP_BUILD=1 ./scripts/railway/autopilot.sh
```

## Environment variables

### View required vars and defaults
```bash
node scripts/env/print-required.mjs --mode=production
```

### Check if current env is valid
```bash
node scripts/env/check.mjs --mode=production
```

### Set a Railway variable
```bash
railway variables set KEY=value
```

### Required in production

| Variable | Source | Notes |
|----------|--------|-------|
| `DATABASE_URL` | Railway Postgres plugin | Auto-injected when Postgres is linked |
| `API_KEYS` | Manual | Comma-separated. Generate: `openssl rand -hex 32` |
| `CORS_ORIGIN` | Manual or auto | Auto-resolves from `RAILWAY_PUBLIC_DOMAIN` if unset |
| `NODE_ENV` | Bootstrap script | Set to `production` |
| `SKIP_STARTUP_MIGRATION` | Bootstrap script | Set to `1` (releaseCommand handles migrations) |

### Auto-injected by Railway

| Variable | Description |
|----------|-------------|
| `PORT` | Assigned port (used by server.ts) |
| `RAILWAY_PUBLIC_DOMAIN` | Public domain for CORS auto-resolution |
| `RAILWAY_GIT_BRANCH` | Deployed branch |
| `RAILWAY_GIT_COMMIT_SHA` | Deployed commit |

## Secrets rotation

### Rotate API keys

1. Generate a new key: `openssl rand -hex 32`
2. Add to existing keys (comma-separated): `railway variables set API_KEYS=oldkey,newkey`
3. Update all clients to use the new key
4. Remove old key: `railway variables set API_KEYS=newkey`

### Rotate DATABASE_URL

Done via Railway dashboard when re-provisioning the Postgres plugin. All connections restart automatically on next deploy.

## Database migrations

### How migrations run

Migrations run via `releaseCommand` in `railway.toml`:
```
pnpm --filter @vitalcv/api run db:migrate:deploy
```

This runs **before** the new server starts. If migrations fail, the deploy is aborted.

### Run migrations manually

```bash
# Via Railway CLI
railway run -- npx prisma migrate deploy --schema apps/api/backend/prisma/schema.prisma

# Locally against a database
DATABASE_URL=postgresql://... npx prisma migrate deploy --schema apps/api/backend/prisma/schema.prisma
```

### Create a new migration

```bash
cd apps/api/backend
npx prisma migrate dev --name describe_the_change
```

## First-time setup

```bash
./scripts/railway/bootstrap.sh
```

See the script output for one-time dashboard steps (deploy branch, root directory, Postgres plugin).
