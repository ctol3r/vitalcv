#!/usr/bin/env bash
# db-migrate-prod-dry-run.sh
#
# Prints the migration diff that would be applied to the production
# database WITHOUT executing it. Calls `prisma migrate diff` only —
# never `prisma migrate deploy`.
#
# Usage:
#   PROD_DATABASE_URL=postgresql://... ./scripts/db-migrate-prod-dry-run.sh
#
# The script refuses to run if any of these are present in the env:
#   - APPLY=1            (a guard to prove this is dry-run only)
#   - PRISMA_MIGRATE_DEPLOY (a guard against accidental deploy)
#
# Exit codes:
#   0 = diff printed (or "no diff" reported)
#   1 = configuration error (missing PROD_DATABASE_URL)
#   2 = guard tripped (someone tried to flip into apply mode)

set -uo pipefail

# Hard guards: never apply, even by accident.
if [[ "${APPLY:-}" == "1" ]] || [[ -n "${PRISMA_MIGRATE_DEPLOY:-}" ]]; then
  echo "ERROR: dry-run script refuses APPLY=1 / PRISMA_MIGRATE_DEPLOY env." >&2
  echo "       This script is read-only by design. Use migrate-deploy in CI for real cutover." >&2
  exit 2
fi

if [[ -z "${PROD_DATABASE_URL:-}" ]]; then
  echo "ERROR: PROD_DATABASE_URL is required." >&2
  echo "       Example: PROD_DATABASE_URL=postgresql://user:pass@host:5432/db ./scripts/db-migrate-prod-dry-run.sh" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_PATH="${REPO_ROOT}/apps/api/backend/prisma/schema.prisma"

if [[ ! -f "$SCHEMA_PATH" ]]; then
  echo "ERROR: Prisma schema not found at $SCHEMA_PATH" >&2
  exit 1
fi

echo "─────────────────────────────────────────────────────────────"
echo "db-migrate-prod-dry-run — schema vs prod database"
echo "Schema: $SCHEMA_PATH"
echo "Mode:   READ-ONLY (no migrations will be applied)"
echo "─────────────────────────────────────────────────────────────"
echo ""

# `migrate diff` is read-only — it only inspects schema state.
# --from-url:    current state of prod
# --to-schema-datamodel: desired state from schema.prisma
# --script: emit raw SQL (so reviewer can see exactly what would run)
cd "$REPO_ROOT/apps/api/backend"
npx prisma migrate diff \
  --from-url "$PROD_DATABASE_URL" \
  --to-schema-datamodel "$SCHEMA_PATH" \
  --script

DIFF_EXIT=$?

echo ""
echo "─────────────────────────────────────────────────────────────"
if [[ $DIFF_EXIT -eq 0 ]]; then
  echo "Dry-run complete. No migrations were applied."
  echo "To apply, follow docs/ops/db-migrate-cutover-runbook.md."
else
  echo "Dry-run reported errors (exit=$DIFF_EXIT). Review output above."
fi
echo "─────────────────────────────────────────────────────────────"

exit $DIFF_EXIT
