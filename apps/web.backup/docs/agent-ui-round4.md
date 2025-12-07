# Agent UI Round 4 - Approvals & MCP Management

## Overview

Round 4 adds comprehensive approval workflows, MCP import/export capabilities, promotion to native tools, and enhanced audit tracking.

## Features

### 1. Approval Workflow

#### 403 → Approval Banner
- When an MCP requires approval (tagged as `sensitive`), the agent returns a 403 response
- The UI displays an interactive approval banner with:
  - **Approve (admin)** button for immediate approval
  - **Re-run** button to retry after external approval
- Approvals are persisted in the `AgentApproval` table with full audit trail

#### Admin Approvals Page
- **Location:** `/admin/approvals`
- **Features:**
  - View all pending and historical approvals
  - Approve/Deny with one click
  - Filter by status (pending, approved, denied)
  - Shows requester, decider, timestamps, and notes

### 2. MCP Import/Export

#### Export MCPs
- **Location:** `/admin/mcp-tools`
- Export all MCPs as JSON for:
  - Backup
  - Migration between environments
  - Sharing tool definitions

#### Import MCPs
- Bulk import MCP definitions
- Validates manifest structure
- Creates or updates existing MCPs

### 3. Promote to Native Tool

#### Promotion Flow
- **Location:** MCP Console (`/admin/mcp`)
- Click "Promote" button on any MCP
- Adds `promoted` tag to the MCP
- Operations team can later replace with optimized native implementation
- Maintains backward compatibility during transition

### 4. Tenant-Aware Rate Limiting

#### Tenant Guard Middleware
- Rate limits by tenant ID (via `x-tenant-id` header)
- Default: 120 requests per minute
- Returns 429 with `retry_after_ms` when limit exceeded
- Configurable via `AgentTenantQuota` table

### 5. Audit & SOC2 Breadcrumbs

#### Audit Events
- All approval requests, approvals, and denials are logged
- Stored in `AgentAudit` table with:
  - Actor (user ID)
  - Action (e.g., `approval.requested`, `approval.approved`)
  - Details (JSON payload)
  - Request ID and Trace ID for correlation

#### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`

### 6. Data Retention

#### Pruning Job
- **Script:** `npm run agent:prune`
- Deletes:
  - Unused MCPs (usage_count=0) older than 30 days
  - Traces older than 90 days
- Run as daily cron job

## API Endpoints

### Approvals

```bash
# Get all approvals
GET /api/agent/admin/approvals

# Approve pending request
POST /api/agent/admin/approve
{
  "traceId": "trace-123",
  "mcp": "mcp-name",
  "decider": "admin@example.com",
  "notes": "Approved for pilot testing"
}

# Deny pending request
POST /api/agent/admin/deny
{
  "traceId": "trace-123",
  "mcp": "mcp-name",
  "decider": "admin@example.com",
  "notes": "Security concern"
}
```

### MCP Management

```bash
# Export all MCPs
GET /api/agent/mcp-admin/export

# Import MCP
POST /api/agent/mcp-admin/import
{
  "manifest": {
    "name": "example-tool",
    "description": "...",
    "scope": "global",
    "tags": ["example"]
  },
  "code": "function example() { ... }"
}

# Promote MCP to native
POST /api/agent/admin/promote
{
  "name": "mcp-name"
}
```

## Database Schema

### AgentApproval Table
```sql
CREATE TABLE "AgentApproval" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT NOT NULL,
  mcp_name TEXT NOT NULL,
  gate TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by TEXT,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### AgentAudit Table
```sql
CREATE TABLE "AgentAudit" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ DEFAULT now(),
  rid TEXT,
  trace_id TEXT,
  actor TEXT,
  action TEXT,
  details JSONB
);
```

### AgentTenantQuota Table
```sql
CREATE TABLE "AgentTenantQuota" (
  tenant_id TEXT PRIMARY KEY,
  rpm INT DEFAULT 120,
  burst INT DEFAULT 60
);
```

## Usage Examples

### 1. Testing Approval Flow

```bash
# Run agent task with sensitive MCP
curl -X POST http://localhost:4000/api/agent/solve \
  -H "Content-Type: application/json" \
  -d '{
    "task": "sensitive operation",
    "input": {},
    "userId": "test-user"
  }'

# Response (403):
{
  "ok": false,
  "needsApproval": true,
  "traceId": "trace-abc123",
  "gate": "sensitive",
  "mcp": "sensitive-mcp"
}

# Approve via UI or API
curl -X POST http://localhost:4000/api/agent/admin/approve \
  -H "Content-Type: application/json" \
  -d '{
    "traceId": "trace-abc123",
    "mcp": "sensitive-mcp",
    "decider": "admin"
  }'

# Re-run the task (now succeeds)
```

### 2. Testing Rate Limiting

```bash
# Send 150 requests within 1 minute
for i in {1..150}; do
  curl http://localhost:4000/api/agent/solve \
    -H "x-tenant-id: test-tenant" \
    -d '{"task":"test"}'
done

# After 120 requests, expect 429:
{
  "ok": false,
  "error": "rate_limited",
  "retry_after_ms": 15000
}
```

### 3. Export and Import MCPs

```bash
# Export
curl http://localhost:4000/api/agent/mcp-admin/export > mcps.json

# Import
curl -X POST http://localhost:4000/api/agent/mcp-admin/import \
  -H "Content-Type: application/json" \
  -d @new-mcp.json
```

## UI Components

### AgentApprovalBanner
- **Path:** `app/components/AgentApprovalBanner.tsx`
- **Props:** `{ traceId: string, mcp: string }`
- **Usage:** Automatically displayed when agent returns 403 with `needsApproval`

### Approvals Page
- **Path:** `app/admin/approvals/page.tsx`
- **Features:** Pending queue + approval history

### MCP Tools Page
- **Path:** `app/admin/mcp-tools/page.tsx`
- **Features:** Export/import UI with validation

### MCP Console
- **Path:** `app/admin/mcp/page.tsx`
- **Enhancement:** Added "Promote" button to each MCP

## Monitoring & Operations

### Audit Queries

```sql
-- Recent approval activity
SELECT * FROM "AgentAudit"
WHERE action LIKE 'approval%'
ORDER BY ts DESC LIMIT 50;

-- Approval success rate
SELECT
  COUNT(*) FILTER (WHERE status='approved') as approved,
  COUNT(*) FILTER (WHERE status='denied') as denied,
  COUNT(*) FILTER (WHERE status='pending') as pending
FROM "AgentApproval";

-- Top MCPs requiring approval
SELECT mcp_name, COUNT(*) as request_count
FROM "AgentApproval"
GROUP BY mcp_name
ORDER BY request_count DESC;
```

### Maintenance

```bash
# Run pruning job
npm run agent:prune

# Check tenant quotas
psql $DATABASE_URL -c "SELECT * FROM \"AgentTenantQuota\";"

# View audit log
psql $DATABASE_URL -c "SELECT * FROM \"AgentAudit\" ORDER BY ts DESC LIMIT 100;"
```

## Security Considerations

1. **Approval Gates:** Only MCPs tagged with `sensitive` require approval
2. **Audit Trail:** All approval decisions are logged with actor, timestamp, and notes
3. **Rate Limiting:** Prevents abuse via tenant-based throttling
4. **Security Headers:** Protect against common web vulnerabilities
5. **Data Retention:** Automatic pruning of old data reduces attack surface

## Next Steps (Round 5)

- Domain-specific MCP packs
- Evaluation dashboards
- Golden trace library
- Smart cache warming
- Enhanced reliability scoring

## Troubleshooting

### Approvals not showing in UI
- Check `NEXT_PUBLIC_AGENT_BASE` environment variable
- Verify backend is running and accessible
- Check browser console for CORS issues

### Rate limiting too aggressive
- Adjust `rpm` in `AgentTenantQuota` table
- Or modify default in `tenantGuard.ts` middleware

### Promote button not working
- Ensure `promoteMcp` function exists in backend
- Check `/api/agent/admin/promote` endpoint is accessible
- Verify MCP name is correct

