#!/bin/bash
# Round 4 Verification Script

echo "🔍 Round 4 Implementation Verification"
echo "========================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check database tables
echo ""
echo "1. Checking database tables..."
TABLES=$(psql $DATABASE_URL -t -c "SELECT tablename FROM pg_tables WHERE tablename LIKE 'Agent%' ORDER BY tablename;")

if echo "$TABLES" | grep -q "AgentApproval"; then
    echo -e "${GREEN}✓${NC} AgentApproval table exists"
else
    echo -e "${RED}✗${NC} AgentApproval table missing"
    echo -e "${YELLOW}  Run: psql \$DATABASE_URL -f prisma/migrations/20251102_agent_r4.sql${NC}"
fi

if echo "$TABLES" | grep -q "AgentAudit"; then
    echo -e "${GREEN}✓${NC} AgentAudit table exists"
else
    echo -e "${RED}✗${NC} AgentAudit table missing"
fi

if echo "$TABLES" | grep -q "AgentTenantQuota"; then
    echo -e "${GREEN}✓${NC} AgentTenantQuota table exists"
else
    echo -e "${RED}✗${NC} AgentTenantQuota table missing"
fi

# Check file existence
echo ""
echo "2. Checking backend files..."
FILES=(
    "src/agent/audit.ts"
    "src/agent/promote.ts"
    "src/middleware/tenantGuard.ts"
    "src/middleware/headers.ts"
    "src/routes/mcp_admin.ts"
    "src/jobs/prune.ts"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file missing"
    fi
done

# Check if server is running
echo ""
echo "3. Checking backend server..."
BACKEND_URL=${BACKEND_URL:-http://localhost:4000}

if curl -s -f -o /dev/null "$BACKEND_URL/api/agent/health"; then
    echo -e "${GREEN}✓${NC} Backend server running at $BACKEND_URL"

    # Check endpoints
    echo ""
    echo "4. Checking API endpoints..."

    # Health check
    if curl -s -f -o /dev/null "$BACKEND_URL/api/agent/health"; then
        echo -e "${GREEN}✓${NC} GET /api/agent/health"
    fi

    # Approvals endpoint
    APPROVALS_RESP=$(curl -s "$BACKEND_URL/api/agent/admin/approvals")
    if echo "$APPROVALS_RESP" | grep -q "rows"; then
        echo -e "${GREEN}✓${NC} GET /api/agent/admin/approvals"
    else
        echo -e "${RED}✗${NC} GET /api/agent/admin/approvals"
    fi

    # Export endpoint
    EXPORT_RESP=$(curl -s "$BACKEND_URL/api/agent/mcp-admin/export")
    if echo "$EXPORT_RESP" | grep -q "mcp"; then
        echo -e "${GREEN}✓${NC} GET /api/agent/mcp-admin/export"
    else
        echo -e "${RED}✗${NC} GET /api/agent/mcp-admin/export"
    fi

    # Security headers
    echo ""
    echo "5. Checking security headers..."
    HEADERS=$(curl -s -I "$BACKEND_URL/api/agent/health")

    if echo "$HEADERS" | grep -q "X-Content-Type-Options: nosniff"; then
        echo -e "${GREEN}✓${NC} X-Content-Type-Options header set"
    else
        echo -e "${RED}✗${NC} X-Content-Type-Options header missing"
    fi

    if echo "$HEADERS" | grep -q "X-Frame-Options: DENY"; then
        echo -e "${GREEN}✓${NC} X-Frame-Options header set"
    else
        echo -e "${RED}✗${NC} X-Frame-Options header missing"
    fi

    if echo "$HEADERS" | grep -q "Referrer-Policy: no-referrer"; then
        echo -e "${GREEN}✓${NC} Referrer-Policy header set"
    else
        echo -e "${RED}✗${NC} Referrer-Policy header missing"
    fi

else
    echo -e "${RED}✗${NC} Backend server not running at $BACKEND_URL"
    echo -e "${YELLOW}  Start with: npm run dev${NC}"
fi

# Summary
echo ""
echo "========================================"
echo "Verification complete!"
echo ""
echo "Next steps:"
echo "  1. If tables missing, run: psql \$DATABASE_URL -f prisma/migrations/20251102_agent_r4.sql"
echo "  2. If server not running: npm run dev"
echo "  3. Test approval flow: See ROUND4_AGENT_IMPLEMENTATION.md"
echo "  4. Check frontend: cd ../v0-vital-cv-frontend-mvp && npm run dev"
echo ""

