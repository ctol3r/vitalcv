#!/bin/bash

# Quick integration test for NPI flow
# Usage: ./scripts/test-npi-flow.sh [BACKEND_URL] [NPI]

BACKEND_URL=${1:-"http://localhost:4000"}
NPI=${2:-"1538102066"}  # Test NPI

echo "🧪 Testing NPI Flow"
echo "Backend URL: $BACKEND_URL"
echo "NPI: $NPI"
echo ""

# Test 1: Health check
echo "1️⃣ Testing health endpoint..."
HEALTH=$(curl -s "$BACKEND_URL/api/health")
if echo "$HEALTH" | grep -q "ok"; then
  echo "✅ Health check passed"
else
  echo "❌ Health check failed"
  exit 1
fi
echo ""

# Test 2: NPI lookup
echo "2️⃣ Testing NPI lookup..."
NPI_RESULT=$(curl -s "$BACKEND_URL/api/npi/lookup?number=$NPI")
if echo "$NPI_RESULT" | grep -q "entityTypeCode"; then
  echo "✅ NPI lookup successful"
  echo "$NPI_RESULT" | jq '.' 2>/dev/null || echo "$NPI_RESULT"
else
  echo "❌ NPI lookup failed"
  echo "$NPI_RESULT"
  exit 1
fi
echo ""

# Test 3: Metrics endpoint
echo "3️⃣ Testing metrics endpoint..."
METRICS=$(curl -s "$BACKEND_URL/metrics")
if echo "$METRICS" | grep -q "vitalcv"; then
  echo "✅ Metrics endpoint accessible"
else
  echo "⚠️  Metrics endpoint returned unexpected format"
fi
echo ""

# Test 4: Metrics summary
echo "4️⃣ Testing metrics summary..."
SUMMARY=$(curl -s "$BACKEND_URL/api/metrics-summary")
if echo "$SUMMARY" | grep -q "slos"; then
  echo "✅ Metrics summary successful"
  echo "$SUMMARY" | jq '.slos' 2>/dev/null || echo "$SUMMARY"
else
  echo "❌ Metrics summary failed"
  echo "$SUMMARY"
fi
echo ""

# Test 5: PubMed search (optional)
echo "5️⃣ Testing PubMed search..."
PUBMED=$(curl -s "$BACKEND_URL/api/pubmed/search?q=cardiology&max=2")
if echo "$PUBMED" | grep -q "results"; then
  echo "✅ PubMed search successful"
  echo "$PUBMED" | jq '.count' 2>/dev/null || echo "Results found"
else
  echo "⚠️  PubMed search returned unexpected format"
fi
echo ""

echo "✅ All tests completed!"

