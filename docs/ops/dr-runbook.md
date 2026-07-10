# Disaster Recovery Runbook — Postgres backups & restore (M5-6)

**Date:** 2026-07-06 (updated 2026-07-07) · **Owner:** founder (team of one)
· **Status:** procedures written; **first restore drill NOT yet executed.**

> ## ✅ 2026-07-07 backup audit — CRITICAL GAP FOUND, FULLY REMEDIATED SAME DAY
> A live check of the Railway Postgres **Backups** tab found the production
> database had **NO backup coverage at all**: Point-in-time recovery **OFF**,
> **no** volume-backup schedule, **zero** existing backups. Every clinician,
> credential, and audit-event row was unprotected (RPO = total loss on volume
> failure). Railway does **not** enable backups by default.
>
> **Remediation (all owner-authorized, verified live the same day):**
> 1. On-demand volume backup — `2026-07-07 13:28 UTC · 1.25 GB · manual`.
> 2. **Backup schedule enabled:** Daily (kept 6 days) + Weekly (kept 1 month)
>    + Monthly (kept 3 months) — active immediately, no redeploy needed.
> 3. **PITR enabled:** staged changes (Postgres-PITR bucket + 6 `WAL_ARCHIVE_*`
>    vars) deployed; Postgres redeployed once (~7 min, zero downtime — old
>    instance served until the new one was healthy; api/web stayed 200
>    throughout). **WAL archiving verified live** — green coverage timeline
>    from `2026-07-07 06:44:51 PT`, "Restore to this moment" enabled, no
>    credential warnings.
>
> Effective posture: **RPO ≈ minutes** (PITR) with a Daily/Weekly/Monthly
> snapshot ladder behind it. Remaining: the quarterly **restore drill** below.

## What we run on

- **Railway Postgres** (single primary) — the only stateful store. Web + API are
  stateless containers redeployable from git (`main` → Railway auto-deploy).
- Migrations auto-apply on deploy via `railway.toml` `preDeployCommand`
  (`prisma migrate deploy`).

## Backup posture (VERIFIED 2026-07-07 — do not assume)

Railway does **NOT** enable backups by default; everything below was switched on
manually on 2026-07-07 and verified in the dashboard:

| Control | State | Notes |
|---|---|---|
| Point-in-time recovery | **ON** (verified archiving) | WAL → `Postgres-PITR` bucket; coverage from 2026-07-07 06:44 PT; restore creates a new copy, current data untouched |
| Volume-backup schedule | **Daily / Weekly / Monthly** | retention: 6 days / 1 month / 3 months |
| Manual backups | 1 (2026-07-07 13:28 UTC, 1.25 GB) | taken during the audit, before PITR |

Remaining hardening:

1. Run the **quarterly restore drill** (section below) — targets are estimates
   until the first drill is timed.
2. **Belt-and-suspenders logical dump** (optional now that PITR is on): weekly
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
| 2026-07-10 | Live `pg_dump` of prod (19 MB custom-format, via public TCP proxy) → local PG 17.7 scratch | **90 s end-to-end** (dump 9 s · restore 2 s · verify 17 s; rest = scratch-instance setup) | Claude (owner-authorized): row counts identical prod↔restore — 393 AuditEvent · 11,585 VerificationArtifact · 152 tables; `pg_restore` exit 0, zero stderr; scratch + dump destroyed after |

**Drill #1 notes (2026-07-10):** this exercised the *logical* (pg_dump/pg_restore)
path — provider-independent, proves the schema+data restore end-to-end. It did
NOT exercise Railway's dashboard **PITR restore** button (dashboard session was
unavailable); drill #2 should use *Restore to this moment* → new service to
validate the PITR path specifically. macOS scratch-restore gotchas: use the
Homebrew `postgresql@17` binaries (Postgres.app 16 refuses a v17 server), set
`LC_ALL=C` (else `postmaster became multithreaded` on start), and pass
`-k /tmp` (deep socket paths exceed the 103-byte limit).

## Explicit gaps

- ~~First restore drill not executed~~ **Done 2026-07-10** (logical path, 90 s;
  PITR-button path still to be exercised in drill #2).
- Weekly logical-dump job not automated (manual command above) — though drill #1
  proves the manual path takes <10 s against today's data volume.
- In-memory state (rate-limit counters, health snapshots) is lost on redeploy
  by design — no recovery needed (documented in deploy-health-probe memory).
