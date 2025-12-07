import { pool } from '../agent/db';
import { abstractTraceToMcp } from '../agent/abstraction';
import { upsertMcp } from '../agent/store';

/**
 * Learning job: Mines recent successful traces and converts them to MCPs
 * Run this periodically to automatically learn from successful executions
 *
 * @param hours - Look back N hours for successful traces
 */
export async function learnFromRecent(hours = 6): Promise<{
  processed: number;
  learned: number;
  errors: number;
}> {
  console.log(`[Learn] Mining traces from last ${hours} hours...`);

  const { rows } = await pool.query(
    `SELECT * FROM "AgentTrace"
     WHERE (outcome->>'success')::boolean = true
     AND created_at > now() - ($1 || ' hours')::interval
     ORDER BY created_at DESC
     LIMIT 50`,
    [String(hours)]
  );

  console.log(`[Learn] Found ${rows.length} successful traces`);

  let learned = 0;
  let errors = 0;

  for (const trace of rows) {
    try {
      // Parse JSON fields if they're strings
      const parsedTrace = {
        ...trace,
        input: typeof trace.input === 'string' ? JSON.parse(trace.input) : trace.input,
        steps: typeof trace.steps === 'string' ? JSON.parse(trace.steps) : trace.steps,
        outcome: typeof trace.outcome === 'string' ? JSON.parse(trace.outcome) : trace.outcome,
      };

      // Abstract trace to MCP
      const mcp = await abstractTraceToMcp(parsedTrace);

      // Store the learned MCP
      const mcpId = await upsertMcp(mcp);

      console.log(`[Learn] Created MCP "${mcp.name}" (${mcpId}) from trace ${trace.id}`);
      learned++;
    } catch (error: any) {
      console.error(`[Learn] Failed to learn from trace ${trace.id}:`, error.message);
      errors++;
    }
  }

  console.log(`[Learn] Complete. Learned: ${learned}, Errors: ${errors}`);

  return {
    processed: rows.length,
    learned,
    errors,
  };
}

/**
 * CLI entry point
 */
if (require.main === module) {
  learnFromRecent(12)
    .then((stats) => {
      console.log('Learning complete:', stats);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Learning failed:', error);
      process.exit(1);
    });
}

