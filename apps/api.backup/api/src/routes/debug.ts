import { Router } from 'express';
import { readPool } from '../db/replicas';

export const debugRouter = Router();

/**
 * GET /_debug/traces
 * List recent agent traces for debugging
 */
debugRouter.get('/traces', async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit || '25'));

    const { rows } = await readPool.query(
      `SELECT id, task_type, input, steps, outcome, created_at
       FROM "AgentTrace"
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    // Parse JSON fields
    const traces = rows.map(row => ({
      ...row,
      input: typeof row.input === 'string' ? JSON.parse(row.input) : row.input,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
      outcome: typeof row.outcome === 'string' ? JSON.parse(row.outcome) : row.outcome,
    }));

    res.json({ rows: traces });
  } catch (error: any) {
    console.error('Error fetching debug traces:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /_debug/mcps
 * List all MCPs for debugging
 */
debugRouter.get('/mcps', async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit || '50'));

    const { rows } = await readPool.query(
      `SELECT id, name, description, scope, tags, reliability_score, usage_count, created_at, updated_at
       FROM "McpTool"
       ORDER BY reliability_score DESC NULLS LAST, usage_count DESC
       LIMIT $1`,
      [limit]
    );

    res.json({ rows });
  } catch (error: any) {
    console.error('Error fetching debug MCPs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /_debug/health
 * Basic health check with agent stats
 */
debugRouter.get('/health', async (_req, res) => {
  try {
    const mcpCount = await readPool.query(`SELECT COUNT(*) as count FROM "McpTool"`);
    const traceCount = await readPool.query(`SELECT COUNT(*) as count FROM "AgentTrace"`);
    const successRate = await readPool.query(`
      SELECT
        COUNT(*) FILTER (WHERE (outcome->>'success')::boolean = true) * 100.0 / NULLIF(COUNT(*), 0) as rate
      FROM "AgentTrace"
      WHERE created_at > now() - interval '24 hours'
    `);

    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      stats: {
        totalMcps: parseInt(mcpCount.rows[0].count),
        totalTraces: parseInt(traceCount.rows[0].count),
        successRate24h: parseFloat(successRate.rows[0].rate || '0').toFixed(2) + '%',
      },
    });
  } catch (error: any) {
    console.error('Error in health check:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

