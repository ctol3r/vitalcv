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
packet = data.get('packetShares', {})
reviews = data.get('reviewsOpened', {})
decisions = data.get('decisions', {})
so = data.get('startOutcomes', {})
v = data.get('velocity', {})
readiness = data.get('readinessDistribution', {})
event_chain = data.get('eventChain', {})
applied_filter = data.get('appliedFilter', {})
gaps = data.get('gaps', [])

def fmt_metric(value, sample=None, unit='days'):
    if value is None:
        if sample is None:
            return 'Insufficient data'
        return f'Insufficient data (n={sample})'
    if sample is None:
        return f'{value} {unit}'
    return f'{value} {unit} (n={sample})'

def fmt_filter(value):
    return value if value else '(all)'

ready_total = readiness.get('total', 0)
ready_count = readiness.get('ready', 0)
ready_pct = None
if ready_total:
    ready_pct = round((ready_count / ready_total) * 100)

print('FUNNEL')
print(f'  Packets shared:         {packet.get(\"total\", 0)}')
print(f'  Unique clinicians:      {packet.get(\"distinctEntities\", 0)}')
print(f'  Employer reviews:       {reviews.get(\"total\", 0)}')
print(f'  Decisions recorded:     {decisions.get(\"total\", 0)}')
print(f'  Proceed / refresh:      {decisions.get(\"proceedCount\", 0)} / {decisions.get(\"refreshCount\", 0)}')
print()
print('OUTCOMES')
print(f'  Confirmed starts:       {so.get(\"totalStarts\", \"N/A\")}')
if ready_pct is None:
    print('  Ready at first review:  Insufficient data')
else:
    print(f'  Ready at first review:  {ready_pct}% ({ready_count}/{ready_total})')
print()

print('VELOCITY')
sample_sizes = v.get('sampleSizes', {})
print(f'  Review -> decision:     {fmt_metric(v.get(\"medianDaysFirstReviewToDecision\"), sample_sizes.get(\"reviewToDecision\"))}')
print(f'  Review -> ready:        {fmt_metric(v.get(\"medianDaysFirstReviewToReady\"), sample_sizes.get(\"reviewToReady\"))}')
print(f'  Review -> start:        {fmt_metric(v.get(\"medianDaysFirstReviewToStart\"), sample_sizes.get(\"reviewToStart\"))}')
print(f'  Share -> decision:      {fmt_metric(v.get(\"medianDaysShareToDecision\"), sample_sizes.get(\"shareToDecision\"))}')
print()

print('SCOPE')
print(f'  Pilot ID:               {fmt_filter(applied_filter.get(\"pilotId\"))}')
print(f'  Workflow lane:          {fmt_filter(applied_filter.get(\"workflowLane\"))}')
print(f'  Org context:            {fmt_filter(applied_filter.get(\"orgContextId\"))}')
print(f'  Geography:              {fmt_filter(applied_filter.get(\"geographyTag\"))}')
print()

print('EVENT CHAIN')
print(f'  Share / review events:  {event_chain.get(\"bundleShareEvents\", 0)} / {event_chain.get(\"advisoryOutcomeEvents\", 0)}')
print(f'  Decision / start:       {event_chain.get(\"employerDecisionEvents\", 0)} / {event_chain.get(\"startOutcomeEvents\", 0)}')
print()

print('GAPS')
if gaps:
    for gap in gaps:
        print(f'  - {gap}')
else:
    print('  None')

print()
ts = data.get('generatedAt', data.get('timestamp', 'unknown'))
print(f'Generated: {ts}')
"

echo ""
echo "=== End Report ==="
