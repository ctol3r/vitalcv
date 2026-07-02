# Production Infrastructure — Disaster Recovery

> Current state as of 2026-06-29. **This is the weakest area** — several items are
> not yet verified or automated; they are called out explicitly rather than assumed.

## What exists today

- **Source of truth:** GitHub `ctol3r/vitalcv@main`. A full rebuild is reproducible
  from the repo (`pnpm install --frozen-lockfile` + Railway build).
- **Deployment rollback:** Railway retains prior deployments; redeploy any prior
  `SUCCESS` deployment via dashboard or `railway redeploy`. Verified: history +
  `canRedeploy: true`.
- **Database:** Railway-managed Postgres 17.

## Gaps (must be closed for production-grade DR)

1. **Database backups — UNVERIFIED.** Confirm Railway Postgres automated backups
   are enabled and the retention window is adequate. Railway backup availability
   depends on the plan/volume config — do not assume. **Action:** verify in the
   Railway dashboard (Postgres service → Backups) and record the schedule here.
2. **No tested restore procedure.** A backup is only real if a restore has been
   rehearsed. **Action:** perform a restore drill into a scratch environment and
   document the runbook (see below).
3. **Single region (`us-west2`), single replica per service.** A region outage = full
   outage. No standby. **Action:** decide RTO/RPO targets; consider multi-region or
   at minimum documented re-provision steps.
4. **Ephemeral filesystem artifacts.** `verifierValidation.ts` writes "scrapbook"
   JSON to local disk (lost on redeploy). The audit ledger remains the system of
   record, so this is not data loss of record — but the artifacts are not recoverable.

## Target RTO / RPO (to be ratified)

| Metric | Proposed | Rationale |
|---|---|---|
| RTO (restore service) | < 1h | redeploy from main is minutes; DB restore is the long pole |
| RPO (max data loss) | < 24h | requires daily DB backups at minimum |

## Restore runbook (DRAFT — must be rehearsed before relied upon)

1. **App/service loss:** in Railway, redeploy `main` (or roll back to last good
   deployment). Verify `/health` + `/api/health`.
2. **Database loss/corruption:**
   a. Provision a new Railway Postgres (or restore from the latest backup snapshot).
   b. Point `DATABASE_URL` (both services) at the restored instance.
   c. Run `prisma migrate deploy` to reconcile schema.
   d. Verify `/health` metrics + a known credential lookup.
3. **Total project loss:** create a new Railway project from the repo, recreate the
   3 services with the variables in `environments.md`, restore the DB, re-map DNS
   (`vitalcv.com`, `api.vitalcv.com`).

## Secrets recovery

Secrets live only in Railway. **There is no documented secondary store.** Maintain
an out-of-band encrypted backup of: signing keys (`RECEIPT_PRIVATE_KEY_JWK`,
`VCV_PRIVATE_KEY`), `JWT_SECRET`, `API_KEYS`, Clerk keys, `DATABASE_URL`. Losing the
signing keys invalidates issued receipts — treat as critical.
