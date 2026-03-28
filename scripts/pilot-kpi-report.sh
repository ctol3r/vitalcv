#!/usr/bin/env bash
# Usage: ./scripts/pilot-kpi-report.sh <monitoring_secret> [window_days]
# Wraps the pilot KPI JSON into a human-readable report for buyer conversations.
set -euo pipefail

SECRET="${1:-}"
WINDOW="${2:-30}"
API="${VITALCV_API_BASE:-https://delightful-essence-production.up.railway.app}"

if [ -z "$SECRET" ]; then
  echo "Usage: $0 <monitoring_secret> [window_days=30]" >&2
  echo "  Fetches pilot KPIs and formats them as a readable report." >&2
  exit 1
fi

echo "=== VitalCV Pilot KPI Report (${WINDOW}-day window) ==="
echo ""

RESPONSE=$(curl -sf "${API}/api/internal/pilot/kpis?days=${WINDOW}" \
  -H "X-Monitoring-Secret: ${SECRET}") || {
  echo "ERROR: Failed to fetch KPIs. Check your monitoring secret and API base." >&2
  exit 1
}

echo "$RESPONSE" | python3 -c "
import json, sys

data = json.load(sys.stdin)
m = data.get('metrics', {})
so = data.get('startOutcomes', {})
v = data.get('velocity', {})

print('FUNNEL METRICS')
print(f'  NPI Lookups:            {m.get(\"readinessViewed\", \"N/A\")}')
print(f'  Passport Views:         {m.get(\"passportViewed\", \"N/A\")}')
print(f'  Review Requests:        {m.get(\"reviewRequested\", \"N/A\")}')
print(f'  Reviews Opened:         {m.get(\"reviewOpened\", \"N/A\")}')
print(f'  Employer Actions:       {m.get(\"employerActionClicked\", \"N/A\")}')
print()
print('START OUTCOMES')
print(f'  Confirmed Starts:       {so.get(\"totalStarts\", \"N/A\")}')
print()

tts = v.get('medianDaysFirstReviewToStart')
print('VELOCITY')
if tts is not None:
    print(f'  Median TTS (days):      {tts}')
else:
    print(f'  Median TTS (days):      Not enough data')

review_to_decision = v.get('medianDaysFirstReviewToDecision')
if review_to_decision is not None:
    print(f'  Review to Decision:     {review_to_decision} days')

print()
ts = data.get('generatedAt', data.get('timestamp', 'unknown'))
print(f'Generated: {ts}')
"

echo ""
echo "=== End Report ==="
