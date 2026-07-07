# Disaster Recovery Runbook — Postgres backups & restore (M5-6)

**Date:** 2026-07-06 (updated 2026-07-07) · **Owner:** founder (team of one)
· **Status:** procedures written; **first restore drill NOT yet executed.**

> ## ⚠️ 2026-07-07 backup audit — CRITICAL, PARTIALLY REMEDIATED
> A live check of the Railway Postgres **Backups** tab found the production
> database had **NO backup coverage at all**: Point-in-time recovery **OFF**,
> **no** volume-backup schedule, **zero** existing backups. Every clinician,
> credential, and audit-event row was unprotected (RPO = total loss on volume
> failure). The prior assumption below ("Railway provides daily automated
> backups") was **false for this project** — nothing is on by default.
>
> **Taken (non-disruptive):** one on-demand volume backup —
> `2026-07-07 13:28 UTC · 1.25 GB · manual`. Prod now has ONE recovery point.
>
> **Still required by the owner (both redeploy the DB / need dashboard access):**
> 1. **Enable PITR** (Backups → *Enable PITR* — redeploys once) for continuous
>    WAL archiving → RPO drops to minutes.
> 2. **Set a volume-backup schedule** (Backups → *Edit schedule*) — daily, with
>    a retention window; record it in the table below.
> Until both are on, coverage is a single manual snapshot that will go stale.

## What we run on

- **Railway Postgres** (single primary) — the only stateful store. Web + API are
  stateless containers redeployable from git (`main` → Railway auto-deploy).
- Migrations auto-apply on deploy via `railway.toml` `preDeployCommand`
  (`prisma migrate deploy`).

## Backup posture (VERIFIED 2026-07-07 — do not assume)

Railway does **NOT** enable backups by default for this project (verified in the
dashboard, not assumed). Current state after the 2026-07-07 audit:

| Control | State | Action |
|---|---|---|
| Point-in-time recovery | **OFF** | owner: Enable PITR (redeploys once) |
| Volume-backup schedule | **none** | owner: set daily schedule + retention |
| Existing backups | **1 manual** (2026-07-07 13:28 UTC, 1.25 GB) | will go stale without a schedule |

Owner checklist (one-time, ~10 min):

1. Railway → Postgres → **Backups**: click **Enable PITR**, then **Edit schedule**
   for daily volume backups; note retention window here: `retention = ____ days`.
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
