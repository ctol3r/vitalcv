-- approvals table
CREATE TABLE IF NOT EXISTS "AgentApproval" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT NOT NULL,
  mcp_name TEXT NOT NULL,
  gate TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|approved|denied
  requested_by TEXT,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- audit events
CREATE TABLE IF NOT EXISTS "AgentAudit" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ DEFAULT now(),
  rid TEXT,
  trace_id TEXT,
  actor TEXT,
  action TEXT,
  details JSONB
);
-- tenant throttles (simple)
CREATE TABLE IF NOT EXISTS "AgentTenantQuota" (
  tenant_id TEXT PRIMARY KEY,
  rpm INT DEFAULT 120,         -- requests per minute
  burst INT DEFAULT 60
);

