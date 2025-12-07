import { pool } from '../db';

export async function requiresApproval(mcp: any) {
  const tags = (mcp?.manifest?.tags || []).map(String);
  return tags.includes('sensitive');
}

export async function createApproval(traceId: string, mcpName: string, requester?: string) {
  await pool.query(
    'INSERT INTO "AgentApproval"(trace_id,mcp_name,gate,requested_by) VALUES($1,$2,$3,$4)',
    [traceId, mcpName, 'sensitive', requester || 'system']
  );
}

export async function getApprovalStatus(traceId: string, mcpName: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT status FROM "AgentApproval" WHERE trace_id=$1 AND mcp_name=$2 ORDER BY created_at DESC LIMIT 1',
    [traceId, mcpName]
  );
  return result.rows[0]?.status || null;
}

