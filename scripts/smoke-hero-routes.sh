#!/usr/bin/env bash
# Smoke test for VitalCV hero routes.
#
# Usage:
#   ./scripts/smoke-hero-routes.sh [BASE_URL]
#   BASE_URL defaults to http://localhost:3000
#
# Exit codes:
#   0 = all routes returned HTTP 200 with text/html Content-Type
#   1 = one or more routes failed
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"

GREEN='\033[0;32m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0

check_route() {
  local path="$1"
  local url="${BASE_URL}${path}"

  local http_code content_type
  http_code=$(curl -s -o /tmp/smoke_hero_body \
    -w '%{http_code}' \
    -H 'Accept: text/html' \
    --max-time 10 \
    "$url" 2>/dev/null || echo "000")

  content_type=$(curl -s -o /dev/null \
    -w '%{content_type}' \
    -H 'Accept: text/html' \
    --max-time 10 \
    "$url" 2>/dev/null || echo "")

  if [[ "$http_code" == "200" ]] && [[ "$content_type" == *"text/html"* ]]; then
    echo -e "  ${GREEN}PASS${NC}  GET  ${path}  (${http_code}  ${content_type%%;})"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC}  GET  ${path}  (http=${http_code}  content-type=${content_type})"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo -e "${BOLD}VitalCV hero-route smoke — ${BASE_URL}${NC}"
echo ""

check_route "/"
check_route "/pilot"
check_route "/pricing"
check_route "/signup"
check_route "/status"
check_route "/docs"
check_route "/privacy"
check_route "/terms"

echo ""
TOTAL=$((PASS + FAIL))
echo -e "${BOLD}Results: ${PASS}/${TOTAL} passed${NC}"

if [[ $FAIL -gt 0 ]]; then
  echo -e "${RED}${FAIL} route(s) failed the smoke check.${NC}"
  exit 1
fi

echo -e "${GREEN}All hero routes healthy.${NC}"
