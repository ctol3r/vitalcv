#!/usr/bin/env bash
#
# pg_restore.sh — VitalCV database restore companion to pg_dump.sh.
#
# Restores a custom-format Postgres dump into the database pointed to
# by DATABASE_URL. Closes OPERATE-1 PR364A (recovery verification) by
# providing the restore path that pairs with pg_dump.sh.
#
# Truth contract:
#   - `set -euo pipefail` makes DATABASE_URL-unset fail via -u rather
#     than silently restoring into an unintended target.
#   - The dump file path is REQUIRED as $1. No default — never
#     restores from "latest" without explicit user choice.
#   - The script REFUSES to run when DATABASE_URL looks like a
#     production-domain hostname (basic safety guard). Override with
#     ALLOW_PROD_RESTORE=1 if you really mean it.
#   - DATABASE_URL is never printed.
#
# Usage:
#   DATABASE_URL="postgresql://…" ./scripts/backups/pg_restore.sh ./backups/vitalcv_20260511_120000.dump
#
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <dump-file>" >&2
  echo "Example: $0 ./backups/vitalcv_20260511_120000.dump" >&2
  exit 64  # EX_USAGE
fi

DUMP_FILE="$1"

if [ ! -f "$DUMP_FILE" ]; then
  echo "Dump file not found: $DUMP_FILE" >&2
  exit 66  # EX_NOINPUT
fi

# Basic production-host guard. Override with ALLOW_PROD_RESTORE=1.
# We DO NOT print DATABASE_URL itself — only the host segment for
# the warning when the guard triggers.
_AFTER_AT="${DATABASE_URL#*@}"
HOST_SEGMENT="${_AFTER_AT%%[:/?]*}"
ALLOW_PROD_RESTORE="${ALLOW_PROD_RESTORE:-0}"

case "$HOST_SEGMENT" in
  *prod*|*production*|api.vitalcv.com|*.vitalcv.com)
    if [ "$ALLOW_PROD_RESTORE" != "1" ]; then
      echo "ABORT: DATABASE_URL host '$HOST_SEGMENT' looks production-shaped." >&2
      echo "Restoring over production is irreversible. Re-run with" >&2
      echo "ALLOW_PROD_RESTORE=1 if you really intend this." >&2
      exit 77  # EX_NOPERM
    fi
    ;;
esac

echo "Restoring $DUMP_FILE into host: $HOST_SEGMENT"
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "$DUMP_FILE"

echo "Restore complete."
