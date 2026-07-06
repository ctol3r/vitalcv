# Disaster Recovery Runbook — Postgres backups & restore (M5-6)

**Date:** 2026-07-06 · **Owner:** founder (team of one) · **Status:** procedures
written; **first restore drill NOT yet executed** — this doc is honest about that.

## What we run on

- **Railway Postgres** (single primary) — the only stateful store. Web + API are
  stateless containers redeployable from git (`main` → Railway auto-deploy).
- Migrations auto-apply on deploy via `railway.toml` `preDeployCommand`
  (`prisma migrate deploy`).

## Backup posture (verify, don't assume)

Railway-managed Postgres provides **daily automated backups with PITR on paid
plans**, but plan-dependent. Owner checklist (one-time, ~10 min):

1. Railway dashboard → Postgres service → **Backups** tab: confirm schedule is
   ON and note retention window here: `retention = ____ days` (fill in).
2. Confirm the plan supports restore-to-new-service (that is the restore path).
3. **Belt-and-suspenders logical dump** (recommended until drilled): weekly
   `pg_dump` to object storage:
   ```bash
   pg_dump "$DATABASE_URL" --format=custom --no-owner \
     --file="vitalcv-$(date +%F).dump"
   # upload to a private bucket; keep 8 weekly + 6 monthly
   ```

## Targets

- **RPO:** ≤ 24 h (daily backup) — ≤ 1 h once PITR is confirmed on the plan.
- **RTO:** ≤ 4 h (restore-to-new-service + repoint `DATABASE_URL` + redeploy).

## Restore procedure

1. **Do not touch the broken primary** (forensics + PITR base).
2. Railway → Postgres → Backups → **Restore to new service** (or
   `pg_restore --no-owner --dbname "$NEW_DATABASE_URL" file.dump`).
3. Point the **api** and **web** services' `DATABASE_URL` at the new instance.
4. Redeploy both; `preDeployCommand` reconciles migrations.
5. Verify: `/health` (api), `/api/health` (web), then the wedge path
   (NPI ingest → passport render → employer review queue).
6. Post-incident: audit-event gap check for the data-loss window; note any
   AuditEvent discontinuity in the incident log (append-only trust contract).

## Quarterly drill (calendar it)

Restore latest backup to a scratch service → run
`SELECT count(*) FROM "AuditEvent";` and spot-check a passport → **record
date + timing below** → delete scratch service.

| Drill date | Backup restored | Time-to-restore | Verified by |
|---|---|---|---|
| _none yet — first drill pending_ | | | |

## Explicit gaps

- First restore drill not executed (targets above are estimates until timed).
- Weekly logical-dump job not automated (manual command above).
- In-memory state (rate-limit counters, health snapshots) is lost on redeploy
  by design — no recovery needed (documented in deploy-health-probe memory).
