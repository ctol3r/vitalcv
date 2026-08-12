#!/bin/bash
# VitalCV Launch Day Monitor
# Run: ./scripts/launch-monitor.sh
# Cron: */5 * * * * /path/to/launch-monitor.sh >> /tmp/vcv-monitor.log 2>&1

set -euo pipefail

BACKEND="https://delightful-essence-production.up.railway.app"
FRONTEND="https://vitalcv.com"

echo ""
echo "═══════════════════════════════════════════"
echo "  VitalCV Launch Monitor"
echo "  $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "═══════════════════════════════════════════"

FAIL=0

# ── 1. Backend Health ──────────────────────────────────────────────────────────
HEALTH=$(curl -sf "$BACKEND/health" 2>/dev/null || echo '{"status":"UNREACHABLE"}')
STATUS=$(echo "$HEALTH" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("status","UNKNOWN"))' 2>/dev/null)
SHA=$(echo "$HEALTH" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("git_sha","?")[:12])' 2>/dev/null)
ERRORS=$(echo "$HEALTH" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("metrics",{}).get("error_requests",0))' 2>/dev/null)
TOTAL=$(echo "$HEALTH" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("metrics",{}).get("total_requests",0))' 2>/dev/null)
LATENCY=$(echo "$HEALTH" | python3 -c 'import json,sys; print(round(json.load(sys.stdin).get("metrics",{}).get("avg_latency_ms",0),1))' 2>/dev/null)

if [ "$STATUS" = "ok" ]; then
  echo "✅ Backend:   $STATUS  sha=$SHA  latency=${LATENCY}ms  errors=$ERRORS/$TOTAL"
else
  echo "❌ Backend:   $STATUS"
  FAIL=1
fi

# ── 2. DB Readiness ────────────────────────────────────────────────────────────
READY=$(curl -sf "$BACKEND/readyz" 2>/dev/null || echo '{"status":"UNREACHABLE"}')
DB_STATUS=$(echo "$READY" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("status","UNKNOWN"))' 2>/dev/null)

if [ "$DB_STATUS" = "ready" ]; then
  echo "✅ Database:  $DB_STATUS"
else
  echo "❌ Database:  $DB_STATUS"
  FAIL=1
fi

# ── 3. Frontend Routes ────────────────────────────────────────────────────────
echo "── Frontend Routes ──"
ROUTES=("/" "/explore" "/employers" "/developers" "/demo" "/intelligence")
for r in "${ROUTES[@]}"; do
  CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$FRONTEND$r" 2>/dev/null || echo "000")
  if [ "$CODE" = "200" ]; then
    echo "  ✅ $CODE  $r"
  else
    echo "  ❌ $CODE  $r"
    FAIL=1
  fi
done

# ── 4. Data Counts ─────────────────────────────────────────────────────────────
echo "── Data Counts ──"

FINDINGS=$(curl -sf "$BACKEND/api/findings?limit=1" -H "x-org-id: monitor" 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("total",0))' 2>/dev/null || echo "?")
echo "  Findings:   $FINDINGS"
[ "$FINDINGS" = "0" ] && echo "  ⚠️  ALERT: Findings count is 0" && FAIL=1

FEED=$(curl -sf "$BACKEND/api/intelligence/feed?limit=1" -H "x-org-id: monitor" 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("total",0), "delivery=" + d.get("delivery",{}).get("mode","?"))' 2>/dev/null || echo "?")
echo "  Feed:       $FEED"

GRAPH=$(curl -sf "$BACKEND/api/graph/investigation?npi=1558395516&limit=1" -H "x-org-id: monitor" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print('nodes=%d edges=%d' % (len(d.get('nodes',[])), len(d.get('edges',[]))))" 2>/dev/null || echo "?")
echo "  Graph:      $GRAPH"

# ── 5. Threshold Alerts ────────────────────────────────────────────────────────
if [ "$TOTAL" != "0" ] && [ "$ERRORS" != "0" ]; then
  ERROR_RATE=$(python3 -c "print(round(int('$ERRORS')/max(int('$TOTAL'),1)*100,1))" 2>/dev/null || echo "0")
  if python3 -c "exit(0 if float('$ERROR_RATE') > 20 else 1)" 2>/dev/null; then
    echo "⚠️  ALERT: Error rate is ${ERROR_RATE}% (threshold: 20%)"
    FAIL=1
  fi
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════"
if [ "$FAIL" = "0" ]; then
  echo "  ✅ ALL CHECKS PASSED"
else
  echo "  ⚠️  ISSUES DETECTED — SEE ABOVE"
fi
echo "═══════════════════════════════════════════"

exit $FAIL
