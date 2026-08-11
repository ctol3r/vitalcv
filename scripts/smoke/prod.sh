#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Production Smoke Test
#
# Hits critical endpoints and reports pass/fail.
#
# Usage:
#   ./scripts/smoke/prod.sh https://your-domain.railway.app
#   ./scripts/smoke/prod.sh http://localhost:4000
#
# Exit codes:
#   0 = all endpoints healthy
#   1 = one or more endpoints failed
# ──────────────────────────────────────────────────────────────
set -euo pipefail

BASE_URL="${1:-}"

if [[ -z "$BASE_URL" ]]; then
  echo "Usage: $0 <base-url>"
  echo "  e.g. $0 https://vitalcv-api.up.railway.app"
  exit 1
fi

# Strip trailing slash
BASE_URL="${BASE_URL%/}"

# ── Colors ────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check_get() {
  local path="$1"
  local expect_status="${2:-200}"
  local url="${BASE_URL}${path}"

  HTTP_CODE=$(curl -s -o /tmp/smoke_body -w '%{http_code}' "$url" 2>/dev/null || echo "000")

  if [[ "$HTTP_CODE" == "$expect_status" ]]; then
    echo -e "  ${GREEN}PASS${NC}  GET  ${path}  (${HTTP_CODE})"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC}  GET  ${path}  (expected ${expect_status}, got ${HTTP_CODE})"
    cat /tmp/smoke_body 2>/dev/null | head -c 200
    echo ""
    FAIL=$((FAIL + 1))
  fi
}

check_post() {
  local path="$1"
  local body="$2"
  local expect_status="${3:-200}"
  local url="${BASE_URL}${path}"

  HTTP_CODE=$(curl -s -o /tmp/smoke_body -w '%{http_code}' \
    -X POST \
    -H 'Content-Type: application/json' \
    -d "$body" \
    "$url" 2>/dev/null || echo "000")

  if [[ "$HTTP_CODE" == "$expect_status" ]]; then
    echo -e "  ${GREEN}PASS${NC}  POST ${path}  (${HTTP_CODE})"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC}  POST ${path}  (expected ${expect_status}, got ${HTTP_CODE})"
    cat /tmp/smoke_body 2>/dev/null | head -c 200
    echo ""
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo -e "${BOLD}Smoke testing: ${BASE_URL}${NC}"
echo ""

# ── Critical: healthcheck ─────────────────────────────────────
echo -e "${BOLD}Health${NC}"
check_get "/health"

# ── Demo endpoints ────────────────────────────────────────────
echo ""
echo -e "${BOLD}Demo${NC}"
check_get "/demo/status"
check_get "/demo/sample-npis"
# 1558395516 — check-digit-INVALID, NPPES result_count 0, final digit 6 preserved
# because the sandbox connectors branch on it. This was 1003000126 until
# 2026-08-10: a real physician (ARDALAN ENKESHAFI in NPPES). These two lines
# POST to PRODUCTION on every smoke run, issuing and verifying a demo credential
# against that person's identifier. No PR check runs this script, so it was
# never going to be caught by CI.
check_post "/demo/issue" '{"npi":"1558395516"}'
check_post "/demo/verify" '{"npi":"1558395516"}'

# ── Validation: bad input should return 400 ───────────────────
echo ""
echo -e "${BOLD}Validation${NC}"
check_post "/demo/issue" '{"npi":"bad"}' "400"
check_post "/demo/verify" '{"npi":"bad"}' "400"

# ── Summary ───────────────────────────────────────────────────
echo ""
TOTAL=$((PASS + FAIL))
echo -e "${BOLD}Results: ${PASS}/${TOTAL} passed${NC}"

if [[ $FAIL -gt 0 ]]; then
  echo -e "${RED}${FAIL} endpoint(s) failed.${NC}"
  exit 1
fi

echo -e "${GREEN}All endpoints healthy.${NC}"
