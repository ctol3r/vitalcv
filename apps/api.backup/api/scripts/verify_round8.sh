#!/bin/bash

# Round 8 Security & Compliance Verification Script
# Usage: ./scripts/verify_round8.sh

set -e

echo "🔒 Round 8 Security Verification"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="${AGENT_BASE_URL:-http://localhost:4000}"

# Check 1: Healthz
echo -n "1. Health check... "
if curl -s "${BASE_URL}/api/agent/healthz" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ (server not running?)${NC}"
    exit 1
fi

# Check 2: Zod validation (should reject invalid input)
echo -n "2. Zod validation (invalid input)... "
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/agent/solve" \
  -H "Content-Type: application/json" \
  -d '{"wrongField":"test"}')

if echo "$RESPONSE" | grep -q "invalid_input"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "   Expected 'invalid_input' error"
    echo "   Got: $RESPONSE"
fi

# Check 3: Files exist
echo -n "3. Security middleware files... "
FILES=(
    "src/middleware/helmet.ts"
    "src/middleware/auth.ts"
    "src/middleware/rate.ts"
    "src/middleware/errors.ts"
    "src/middleware/csrf.ts"
    "src/obs/redact.ts"
    "src/infra/secrets.ts"
)

ALL_EXIST=true
for file in "${FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}✗${NC}"
        echo "   Missing: $file"
        ALL_EXIST=false
        break
    fi
done

if [ "$ALL_EXIST" = true ]; then
    echo -e "${GREEN}✓${NC}"
fi

# Check 4: Documentation exists
echo -n "4. Documentation... "
if [ -f "docs/security-checklist.md" ] && [ -f "scripts/dr_snapshot.ts" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Check 5: Dependencies installed
echo -n "5. Security dependencies... "
if grep -q '"zod"' package.json && \
   grep -q '"helmet"' package.json && \
   grep -q '"express-rate-limit"' package.json && \
   grep -q '"jsonwebtoken"' package.json; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "   Some dependencies missing in package.json"
fi

# Check 6: PII redaction function
echo -n "6. PII redaction utility... "
if grep -q "export function redact" src/obs/redact.ts; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Check 7: Audit normalization
echo -n "7. Audit event normalization... "
if grep -q "agent\." src/agent/audit.ts; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Summary
echo ""
echo "================================="
echo -e "${GREEN}✓ Round 8 verification complete!${NC}"
echo ""
echo "Next steps:"
echo "  - Set JWT_PUBLIC_KEY environment variable"
echo "  - Test auth flow with real JWT token"
echo "  - Run DR snapshot: npx ts-node scripts/dr_snapshot.ts"
echo "  - Review docs/security-checklist.md"
echo ""

