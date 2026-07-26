# Production Infrastructure — Runbooks

> Operational procedures for the Railway deployment. Commands assume the Railway
> CLI is authenticated (`railway whoami`) and linked to project `inspiring-reflection`.

## Quick reference

| Need | Command / action |
|---|---|
| Confirm link | `railway status` |
| Service health | `curl https://api.vitalcv.com/health` · `curl https://vitalcv.com/api/health` |
| List deploys | `railway deployment list` |
| Logs (live) | `railway logs -s vitalcv-web` · `railway logs -s delightful-essence` |
| Variables (names) | `railway variables -s <service> --kv` |
| Redeploy / rollback | Railway dashboard → service → Deployments → Redeploy; or `railway redeploy` |

## Deploy a change
1. Merge to `main` (CI green). Railway auto-builds the affected service(s).
2. Watch `railway logs -s <service>`; wait for healthcheck to pass.
3. Smoke: `curl https://api.vitalcv.com/health` and `https://vitalcv.com/api/health` → `200`, `backend.status: ok`.

## Roll back a bad deploy
1. `railway deployment list` → find the last `SUCCESS` before the bad one.
2. Dashboard → Deployments → that deployment → **Redeploy** (or `railway redeploy <id>`).
3. Verify health. If the bad deploy included a migration, see "Migration rollback".

## Run / inspect migrations
- Migrations apply automatically in the API `preDeployCommand` (`prisma migrate deploy`).
- Status: `railway run -s delightful-essence -- npx prisma migrate status` (from `apps/api/backend`).
- **Migration rollback:** Prisma has no auto down-migration. To revert, ship a new
  forward migration that undoes the change, or restore the DB from backup
  (`disaster-recovery.md`). Never hand-edit applied migrations.

## "Backend shows degraded" on `vitalcv.com/api/health`
- The web probes the API's unauthenticated `/health`. If `degraded`/`unreachable`:
  1. `curl https://api.vitalcv.com/health` directly. If that is `200`, the issue is
     network/egress between services — check Railway private networking + `NEXT_PUBLIC_API_BASE`.
  2. If the API `/health` is down, check `railway logs -s delightful-essence` and recent deploys.

## Rotate a secret
1. Update the variable in Railway (`railway variables -s <service> --set KEY=NEWVALUE`).
2. Railway redeploys the service. For **build-time** `NEXT_PUBLIC_*` (web), a rebuild
   is required for the client bundle to pick it up.
3. For signing keys, coordinate rotation (old receipts must still verify) — see the
   signing-key rotation policy (TODO: scorecard → Security remediation).

## Scale a service (mitigate single-replica downtime)
- Dashboard → service → Settings → Replicas → set ≥ 2 (web + API). This enables
  overlapping rollout (zero-downtime) and basic HA. Verify both replicas healthy.

## Incident triage checklist
1. `railway status` + both `/health` endpoints.
2. `railway logs` for the failing service (structured JSON; filter by `level:"error"`).
3. Recent deploys (`railway deployment list`) — correlate with incident start; roll back if a deploy is implicated.
4. DB reachable? (API `/health` returns metrics only if DB-backed paths work.)
5. Escalate / communicate; capture timeline for a post-incident note.
