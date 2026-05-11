#!/usr/bin/env bash
#
# pg_dump.sh — VitalCV database backup.
#
# Creates a custom-format Postgres dump of the database pointed to by
# DATABASE_URL. Custom format is binary, compressed, and supports
# selective pg_restore (per-table, per-schema).
#
# Truth contract:
#   - `set -euo pipefail` makes DATABASE_URL-unset fail loudly via
#     -u rather than silently dumping nothing.
#   - Backups land under ./backups/ with an ISO-ish timestamp suffix
#     so multiple runs do not overwrite each other.
#   - The script does NOT print or log DATABASE_URL — only the dump
#     path is printed on success.
#
# Usage (run locally; never via an agent that can leak DATABASE_URL):
#   DATABASE_URL="postgresql://…" ./scripts/backups/pg_dump.sh
#
# To restore: see ./scripts/backups/pg_restore.sh
#
set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"

mkdir -p "$BACKUP_DIR"

pg_dump "$DATABASE_URL" \
  --format=custom \
  --file="$BACKUP_DIR/vitalcv_$TIMESTAMP.dump"

echo "Backup complete:"
echo "$BACKUP_DIR/vitalcv_$TIMESTAMP.dump"
