import { pool } from '../db';

export async function audit(
  actor: string | undefined,
  action: string,
  details: any,
  ctx: { rid?: string, traceId?: string, tenant?: string } = {}
) {
  // Normalize action to be namespaced with 'agent.' prefix if not already
  const normalizedAction = action.startsWith('agent.') ? action : `agent.${action}`;

  // Include tenant in details if provided
  const enrichedDetails = ctx.tenant
    ? { ...details, tenant: ctx.tenant }
    : details;

  await pool.query(
    'INSERT INTO "AgentAudit"(rid,trace_id,actor,action,details) VALUES($1,$2,$3,$4,$5)',
    [ctx.rid || null, ctx.traceId || null, actor || null, normalizedAction, enrichedDetails || {}]
  );
}

