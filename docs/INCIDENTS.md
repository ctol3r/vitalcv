# Incident Response Runbook

## Healthcheck fails (503 or timeout)

### Symptoms
- Railway shows "1/1 replicas never became healthy"
- `/health` returns 503 with `{"status":"error","error":"..."}`
- `/health` returns 200 with `{"status":"starting"}` (stuck in boot)

### Step 1: Check Railway runtime logs

```bash
railway logs
```

Look for these structured log events:

| Event | Meaning | Fix |
|-------|---------|-----|
| `env_validation_failed` | Missing or invalid env vars | Check `missing_keys` field. Set vars with `railway variables set` |
| `production_env_validation_failed` | Required production vars missing | Likely `DATABASE_URL` or `API_KEYS`. See DEPLOYMENT.md |
| `zod_env_validation_failed` | Env var has wrong format | Check `fields` array for specific validation errors |
| `server_startup_failed` | App crashed during bootstrap | Check `error` and `details` fields |
| `early_server_bound` | Server bound port successfully | Good sign — port binding works |
| `server_started` | App fully ready | Should see this within 30s of `early_server_bound` |

### Step 2: Run env contract check

```bash
# Check which vars are missing in Railway
railway run -- node scripts/env/check.mjs --mode=production
```

### Step 3: Check if it's a migration failure

If `releaseCommand` failed, the deploy is aborted before the server starts.

```bash
# Check migration status
railway run -- npx prisma migrate status --schema apps/api/backend/prisma/schema.prisma
```

### Step 4: Check if it's a port issue

The server must bind to `0.0.0.0:$PORT`. Verify in logs:
```
{"event":"early_server_bound","host":"0.0.0.0","port":...}
```

If this log doesn't appear, the server crashed before binding.

## Rollback

### Option A: Railway rollback (fastest)

Railway dashboard → Service → Deployments → click a previous healthy deployment → Rollback.

### Option B: Git revert

```bash
git revert HEAD
git push origin main
```

Railway auto-deploys the reverted commit.

### Option C: Pin to a known-good commit

```bash
# Find the last healthy commit
git log --oneline -10

# Create a branch and force-deploy
git checkout -b hotfix/rollback <good-commit-sha>
git push origin hotfix/rollback
```

Then in Railway dashboard, temporarily change deploy branch to `hotfix/rollback`.

## Deploy stuck / build fails

### Build fails with "pnpm: not found"

`railway.toml` must not set `builder = "NIXPACKS"` or `builder = "DOCKERFILE"`. Remove the builder line and let Railway use Railpack (default). Railpack reads `packageManager` from root `package.json`.

### Build fails with "npm ci" error

Same as above. Railpack auto-detects pnpm from `packageManager: "pnpm@..."` in root `package.json`.

### Build fails with postinstall errors

`railway.toml` `installCommand` must include `--ignore-scripts`:
```toml
installCommand = "pnpm install --frozen-lockfile --ignore-scripts"
```

### Build passes but deploy fails

Check `releaseCommand` (migrations). If the database is unreachable, migrations fail and the deploy is aborted.

## Branch drift

### Symptoms
- Pushing to `main` but Railway deploys an old commit
- Railway shows a different branch in deploy logs

### Fix
1. Railway dashboard → Service → Settings → Source → Deploy Branch
2. Set to `main`
3. Redeploy

### Prevention
- CI smoke test (`deploy-api.yml`) catches this — if `/health` fails after push to main, investigate.
- `railway.toml` doesn't control the deploy branch — it's a dashboard setting.

## Common env validation errors

| Error message | Cause | Fix |
|---------------|-------|-----|
| `DATABASE_URL is required` | No Postgres linked | Link Postgres plugin in Railway dashboard |
| `API_KEYS must be defined in production` | No API keys set | `railway variables set API_KEYS=$(openssl rand -hex 32)` |
| `CORS_ORIGIN must not be "*" in production` | No CORS origin and no RAILWAY_PUBLIC_DOMAIN | `railway variables set CORS_ORIGIN=https://your-domain.railway.app` |
| `YC_DEMO_MODE cannot be enabled in production` | Demo mode + production | Set `YC_DEMO_MODE=false` or `SYSTEM_FROZEN=true` |

## Smoke test

Run after any deploy to verify all critical endpoints:

```bash
./scripts/smoke/prod.sh https://your-domain.railway.app
```
