import { pool } from '../agent/db';

export async function maybePromote(mcpNames: string[]) {
  if (!mcpNames?.length) return;

  // Simple: if an MCP appears in the last 20 eval PASS rows >= 8 times, promote
  const { rows } = await pool.query(
    "SELECT details->>'used' AS used FROM \"AgentAudit\" WHERE action='eval.run' ORDER BY ts DESC LIMIT 20"
  );

  const counts: Record<string, number> = {};
  rows.forEach((r) => {
    try {
      const arr = JSON.parse(String(r.used || '[]'));
      arr.forEach((n: string) => {
        counts[n] = (counts[n] || 0) + 1;
      });
    } catch {}
  });

  const winners = mcpNames.filter((n) => (counts[n] || 0) >= 8);

  for (const w of winners) {
    await pool.query(
      'UPDATE "McpTool" SET tags = array_append(tags,$2) WHERE name=$1 AND NOT tags @> ARRAY[$2]::text[]',
      [w, 'promoted:auto']
    );
  }
}

