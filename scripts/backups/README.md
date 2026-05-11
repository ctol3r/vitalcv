# VitalCV Postgres backup + restore scripts

Companion scripts for the durable schema shipped in PR #319.

## What's here

| Script | Purpose |
|---|---|
| `pg_dump.sh` | Custom-format dump of the database pointed to by `DATABASE_URL`. |
| `pg_restore.sh` | Companion restore. Refuses to restore over production-shaped hosts unless `ALLOW_PROD_RESTORE=1`. |

## Truth contract

- **Never print `DATABASE_URL`.** Both scripts read it as an env var; neither logs it. Only the dump path (on backup) or the host segment (on restore, with a clear warning) appear in stdout.
- **`set -euo pipefail`** makes a missing `DATABASE_URL` fail loudly via `-u` rather than silently dumping/restoring nothing.
- **Restore requires an explicit dump path** as `$1`. There is no default. We never restore from "latest" without explicit user choice.
- **Custom format** for both. Lets `pg_restore` do selective `-t TABLE` or `-n SCHEMA` recovery without restoring everything.

## Usage

### Dump

```bash
DATABASE_URL="postgresql://…" ./scripts/backups/pg_dump.sh
# → ./backups/vitalcv_20260511_120000.dump
```

### Restore (development DB)

```bash
DATABASE_URL="postgresql://localhost/vitalcv_dev" \
  ./scripts/backups/pg_restore.sh ./backups/vitalcv_20260511_120000.dump
```

### Restore (production — irreversible; opt-in only)

The script refuses to run when the `DATABASE_URL` host segment matches
`prod*`, `production*`, `api.vitalcv.com`, or `*.vitalcv.com`. Override
with `ALLOW_PROD_RESTORE=1` — but only after you've taken a fresh dump
of the current production state (you almost never want to restore over
production without a snapshot of where you started).

```bash
DATABASE_URL="postgresql://…prod…" \
  ALLOW_PROD_RESTORE=1 \
  ./scripts/backups/pg_restore.sh ./backups/vitalcv_20260511_120000.dump
```

## When to dump

- **Before every `prisma migrate dev`** in any environment that has data you care about. The migration shipped in PR #319 affects schema, not data, but other migrations could.
- **Before any restore** — to capture the pre-restore state.
- **Daily / on a cron** in production. Custom format dumps are small (compressed); a daily dump + 30-day retention is cheap insurance.

## Where dumps land

Default: `./backups/` relative to wherever the script is invoked. Add `backups/` to your `.gitignore` if it isn't already — dumps contain PII / clinical data and must never enter the repo history.

## Recovery flow (OPERATE-1 PR364A)

The recovery verification path is:

1. `pg_dump.sh` produces a known-good snapshot.
2. Stand up an ephemeral DB (Postgres container or Supabase branch).
3. Point `DATABASE_URL` at the ephemeral target.
4. `pg_restore.sh` against that target.
5. Run targeted Prisma queries to verify the restored shape matches the live shape (e.g., row counts on key tables: `User`, `Recognition`, `IngestEvent`, `CredentialStatus`, `AuditExport`).

Step 5 is application-specific verification. The repo provides the dump/restore primitives; verification recipes are documented per release.
