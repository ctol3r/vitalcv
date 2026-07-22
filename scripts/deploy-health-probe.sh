#!/usr/bin/env bash
# deploy-health-probe.sh
#
# Post-deploy probe: hits /api/internal/source-health/snapshots on the
# given base URL with the CRON_SECRET bearer and asserts that at least
# 4 source snapshots are returned (NPPES / OIG / PECOS / state-board).
#
# Usage:
#   CRON_SECRET=... ./scripts/deploy-health-probe.sh https://vitalcv.com
#
# Exit codes:
#   0 = >= 4 snapshots returned
#   1 = config error (missing BASE_URL or CRON_SECRET)
#   2 = endpoint returned non-200
#   3 = endpoint returned < 4 snapshots
set -uo pipefail

BASE_URL="${1:-}"

if [[ -z "$BASE_URL" ]]; then
  echo "ERROR: base URL required as first argument." >&2
  echo "       Example: ./scripts/deploy-health-probe.sh https://vitalcv.com" >&2
  exit 1
fi

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "ERROR: CRON_SECRET env var is required." >&2
  exit 1
fi

BASE_URL="${BASE_URL%/}"
URL="${BASE_URL}/api/internal/source-health/snapshots"
REFRESH_URL="${BASE_URL}/api/internal/source-health/probe"

# Refresh before asserting.
#
# The snapshot store is an in-memory Map (lib/source-health/store/snapshotStore.ts,
# "Ephemeral: serverless cold starts will reset this"). This script runs
# immediately after a deploy — i.e. immediately after a cold start — so reading
# the store first measured how warm the store was, not whether the sources are
# reachable. Every deploy produced a red probe, and a night of many merges
# produced a wall of them. A health signal that is red for a reason unrelated to
# health trains people to ignore it.
#
# Best-effort by design: if this POST fails we still fall through to the
# assertion below. A warm store from an earlier tick is a legitimate pass, and
# the GET remains the actual gate — so this can only remove false failures, not
# add new ones. A genuine outage still fails, because neither the refresh nor
# the store will yield 4 sources.
echo "Refreshing ${REFRESH_URL} before asserting..."
if curl -sS -o /dev/null -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H 'Accept: application/json' \
  --max-time 30 \
  "$REFRESH_URL" 2>/dev/null; then
  echo "Refresh completed."
else
  echo "WARN: refresh did not complete; asserting against whatever the store already holds." >&2
fi

echo "Probing ${URL}..."

# -s silent, -S show errors, -o body, -w status
# Use Authorization header (Bearer); never echo the secret to stdout.
HTTP_STATUS=$(curl -sS -o /tmp/deploy_health_probe_body \
  -w '%{http_code}' \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H 'Accept: application/json' \
  --max-time 15 \
  # `-w '%{http_code}'` already emits 000 when the request never completes, so
  # the old `|| echo "000"` concatenated a second one and reported "HTTP 000000".
  "$URL" 2>/dev/null || true)

# Normalise the "request never completed" case to a single 000. The old
# `|| echo "000"` appended to whatever `-w '%{http_code}'` had already written
# and reported "HTTP 000000"; dropping it alone leaves the status empty.
HTTP_STATUS="${HTTP_STATUS:-000}"

if [[ "$HTTP_STATUS" != "200" ]]; then
  echo "FAIL: endpoint returned HTTP ${HTTP_STATUS}" >&2
  # Body is generic shape only — safe to print.
  head -c 500 /tmp/deploy_health_probe_body 2>/dev/null >&2 || true
  echo "" >&2
  exit 2
fi

# Count snapshots without leaking payload contents.
# The snapshots endpoint returns { snapshots: [ { sourceId, ... }, ... ] }.
SNAPSHOT_COUNT=$(python3 -c '
import json, sys
try:
  data = json.load(open("/tmp/deploy_health_probe_body"))
  arr = data.get("snapshots", []) if isinstance(data, dict) else []
  print(len(arr) if isinstance(arr, list) else 0)
except Exception:
  print(0)
')

echo "Snapshots returned: ${SNAPSHOT_COUNT}"

if [[ "$SNAPSHOT_COUNT" -lt 4 ]]; then
  echo "FAIL: expected >= 4 snapshots (NPPES / OIG / PECOS / state-board), got ${SNAPSHOT_COUNT}" >&2
  exit 3
fi

echo "OK: deploy health probe passed."
