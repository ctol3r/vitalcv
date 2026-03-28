#!/usr/bin/env bash
# Usage: ./scripts/pilot-kpi-snapshot.sh <monitoring_secret> [window_days]
# Pulls KPI JSON from the pilot backend and formats it for readability.
set -euo pipefail

SECRET="${1:-}"
WINDOW="${2:-30}"
API="${VITALCV_API_BASE:-https://delightful-essence-production.up.railway.app}"

if [ -z "$SECRET" ]; then
  echo "Usage: $0 <monitoring_secret> [window_days=30]" >&2
  exit 1
fi

echo "Fetching KPI snapshot (${WINDOW}-day window)..."
curl -sf "${API}/api/internal/pilot/kpis?days=${WINDOW}" \
  -H "X-Monitoring-Secret: ${SECRET}" \
  | python3 -m json.tool
