# DB Migration Cutover Runbook

**Audience:** on-call engineer or release manager applying a Prisma migration to the production VitalCV database.

**Scope:** the `vitalcv-api` Postgres instance behind Railway, schema source `apps/api/backend/prisma/schema.prisma`.

**Status:** authoritative. Do not deviate without written sign-off.

---

## Pre-flight (T-24h)

1. **Confirm a green main build.** Check the latest CI run on `main` is green for `ci-preflight`, `monorepo`, and `web-quality`. If any are red, abort.
2. **Generate a dry-run plan** locally:
   ```bash
   PROD_DATABASE_URL='<read-only role>' ./scripts/db-migrate-prod-dry-run.sh > /tmp/cutover-plan.sql
   ```
   The script refuses to apply migrations. Read the SQL output yourself before continuing.
3. **Check for destructive statements.** The migration must not contain bare `DROP TABLE`, `DROP COLUMN`, or `ALTER TABLE ... DROP CONSTRAINT` statements. The `migration-shape` test (`apps/api/backend/src/__tests__/migration-shape.test.ts`) blocks these in CI; this is a re-check, not a substitute.
4. **Notify the team.** Post to `#vitalcv-eng` with the cutover plan SQL attached and a 24-hour heads-up window. Include rollback path (below).
5. **Confirm full backup exists.** Railway snapshots are taken hourly; verify the latest snapshot is < 60 min old in the Railway dashboard. Record the snapshot id in the cutover ticket — that is the rollback target.

## Cutover (T-0)

1. **Open a maintenance window.** Set `MAINTENANCE_BANNER_ENABLED=true` in Railway env if user-facing surfaces will be affected. For migrations that are additive only (new columns, new tables, new indexes with `CONCURRENTLY`), no banner is needed.
2. **Run `db-migrate-prod-dry-run.sh` one more time** against the live `PROD_DATABASE_URL` to confirm the plan has not drifted in the last 24 hours.
3. **Apply the migration.** Trigger `ci-preflight.yml`'s `migrate-deploy` job by pushing to `main` with the migration commit. The workflow gates on `DATABASE_URL` secret being present and the branch being `main`.
   - The job runs `prisma migrate deploy` against the `DATABASE_URL` secret.
   - It does NOT run dry-run mode in CI — that is local-only.
4. **Watch for errors.** The Railway logs and the GitHub Actions step output are the two truth sources. If either reports a non-zero exit, STOP and follow the **Rollback** section below.
5. **Verify schema parity post-deploy.** Run the `migration-shape` test locally against prod:
   ```bash
   cd apps/api/backend && pnpm test -- migration-shape
   ```
   This re-asserts schema parity (expected migrations applied, no DROPs leaked).

## Post-cutover (T+30min)

1. **Smoke test the API.** `bash scripts/smoke/prod.sh https://vitalcv-api.up.railway.app` — all checks must pass.
2. **Smoke test the web hero routes.** `bash scripts/smoke-hero-routes.sh https://vitalcv.com` — all routes must return 200 + text/html.
3. **Confirm new tables/columns are visible** by reading `pg_stat_user_tables` for at least one INSERT row count > previous baseline within 10 minutes (proves the application is writing through the new schema).
4. **Close the maintenance window** if it was opened. Set `MAINTENANCE_BANNER_ENABLED=false` in Railway env.
5. **Post completion** to `#vitalcv-eng` with timing, rows affected (if known), and a link to the cutover ticket.

---

## Rollback path

The application of every migration is reversible. There are two rollback strategies; pick the one that matches the failure mode.

### Strategy A — Schema-level rollback (preferred when the migration applied but is now causing application errors)

1. Identify the failed migration directory under `apps/api/backend/prisma/migrations/`.
2. Generate the *inverse* SQL using `prisma migrate diff`:
   ```bash
   npx prisma migrate diff \
     --from-schema-datamodel apps/api/backend/prisma/schema.prisma \
     --to-migrations apps/api/backend/prisma/migrations \
     --script > /tmp/rollback.sql
   ```
3. Review `/tmp/rollback.sql` carefully — confirm it only undoes the failed migration's changes.
4. Apply via `psql "$PROD_DATABASE_URL" < /tmp/rollback.sql` *only after* getting written sign-off in the cutover ticket from one other on-call engineer.
5. Mark the migration as rolled back in `_prisma_migrations` table:
   ```sql
   UPDATE "_prisma_migrations" SET rolled_back_at = NOW() WHERE migration_name = '<migration_dir_name>';
   ```

### Strategy B — Snapshot restore (preferred when the migration corrupted data or schema-level rollback would lose data)

1. Open Railway dashboard → vitalcv-api Postgres service → Snapshots.
2. Locate the snapshot id recorded in the cutover ticket (T-24h pre-flight step 5).
3. Click **Restore** on that snapshot. Railway provisions a new database from the snapshot — old database is preserved.
4. Update `DATABASE_URL` in Railway service env to point at the restored instance.
5. Restart the API service.
6. Post to `#vitalcv-eng` that prod is on the snapshot DB and a follow-up cutover plan is needed.

### Common rollback errors

- **"migration already rolled back"** — the `_prisma_migrations` row already has `rolled_back_at`. Safe to ignore.
- **"foreign key violation during inverse"** — manual data cleanup needed before the inverse SQL succeeds. Do NOT force with `CASCADE`. Open an incident.
- **"column does not exist"** — the inverse SQL is targeting a column that was never applied. Re-run the dry-run; the migration may not have actually applied.

---

## Operator checklist (cut & paste)

- [ ] Pre-flight green (CI, dry-run, banned statements check)
- [ ] Snapshot id recorded in cutover ticket
- [ ] `#vitalcv-eng` 24h notice posted
- [ ] Maintenance banner toggled (if needed)
- [ ] `migrate-deploy` job green
- [ ] Schema parity test green
- [ ] API smoke green
- [ ] Web hero-routes smoke green
- [ ] Maintenance banner toggled off
- [ ] `#vitalcv-eng` completion post
