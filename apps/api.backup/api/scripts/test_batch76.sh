#!/bin/bash
# Batch 76 - Quick Test Script
# Tests all new endpoints and features

set -e

BASE_URL="${BACKEND_URL:-http://localhost:4000}"
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🧪 Testing Batch 76 Features"
echo "============================"
echo ""

# Test 1: FHIR $issue endpoint
echo "1. Testing FHIR \$issue endpoint..."
RESPONSE=$(curl -s -X POST "$BASE_URL/fhir/\$issue" \
  -H "Content-Type: application/json" \
  -d '{
    "bundle": {
      "resourceType": "Bundle",
      "type": "collection",
      "entry": [{
        "resource": {
          "resourceType": "Practitioner",
          "id": "practitioner-1",
          "name": [{"family": "Doe", "given": ["John"]}]
        }
      }]
    },
    "type": "FHIRPractitionerCredential"
  }')

if echo "$RESPONSE" | grep -q "resourceType"; then
  echo -e "${GREEN}✅ FHIR \$issue endpoint working${NC}"
else
  echo -e "${RED}❌ FHIR \$issue endpoint failed${NC}"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 2: EUDI Wallet verification
echo "2. Testing EUDI Wallet verification..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/verify/wallet" \
  -H "Content-Type: application/json" \
  -d '{
    "npi": "1234567890",
    "mode": "remote",
    "provider": "test-wallet",
    "certified_eudi": true
  }')

if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo -e "${GREEN}✅ Wallet verification working${NC}"
else
  echo -e "${RED}❌ Wallet verification failed${NC}"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 3: OIDC4VCI metadata
echo "3. Testing OIDC4VCI metadata..."
RESPONSE=$(curl -s "$BASE_URL/.well-known/openid-credential-issuer")

if echo "$RESPONSE" | grep -q "credential_issuer"; then
  echo -e "${GREEN}✅ OIDC4VCI metadata working${NC}"
else
  echo -e "${RED}❌ OIDC4VCI metadata failed${NC}"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 4: AI Governance endpoint
echo "4. Testing AI Governance endpoint..."
RESPONSE=$(curl -s "$BASE_URL/api/ai/governance")

if echo "$RESPONSE" | grep -q "rows"; then
  echo -e "${GREEN}✅ AI Governance endpoint working${NC}"
else
  echo -e "${RED}❌ AI Governance endpoint failed${NC}"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 5: Wallet events query
echo "5. Testing wallet events query..."
RESPONSE=$(curl -s "$BASE_URL/api/verify/wallet/1234567890")

if echo "$RESPONSE" | grep -q "events"; then
  echo -e "${GREEN}✅ Wallet events query working${NC}"
else
  echo -e "${RED}❌ Wallet events query failed${NC}"
  echo "Response: $RESPONSE"
fi
echo ""

echo "============================"
echo "✅ Batch 76 tests complete!"
echo ""
echo "Next steps:"
echo "1. Check frontend: http://localhost:3000/verifier/fhir"
echo "2. Check dashboard: http://localhost:3000/admin/ai/governance"
echo "3. Review logs for AI governance monitor startup"

