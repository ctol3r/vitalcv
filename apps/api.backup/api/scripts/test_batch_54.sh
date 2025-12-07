#!/usr/bin/env bash
##
## Batch 54 Endpoint Verification Script
## Tests all new API endpoints
##

set -e

BASE_URL="${BASE_URL:-http://localhost:3001}"

echo "🧪 Testing Batch 54 Endpoints..."
echo "   Base URL: $BASE_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

test_endpoint() {
  local name=$1
  local endpoint=$2
  local expected_key=$3

  echo -n "Testing $name... "

  response=$(curl -s "$BASE_URL$endpoint")

  if echo "$response" | grep -q "$expected_key"; then
    echo -e "${GREEN}✓${NC}"
    return 0
  else
    echo -e "${RED}✗${NC}"
    echo "  Response: $response"
    return 1
  fi
}

# Test all Batch 54 endpoints
test_endpoint "EUDI Profiles" "/api/eudi/issuer/profiles" "profile_id"
test_endpoint "PSV Events" "/api/verify/events" "rows"
test_endpoint "JC Survey Export" "/api/audit/survey-export" "monthly_anchor"
test_endpoint "Behavioral Eligibility" "/api/behavioral/eligibility?mode=tele" "psypact"
test_endpoint "Agents Health" "/api/agents/health" "orchestrator"

echo ""
echo "🎉 All Batch 54 endpoints verified!"

