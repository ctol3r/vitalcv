import { pool } from "./db";
import { v4 as uuid } from "uuid";
import { AgentTrace } from "./types";

/**
 * Log an agent execution trace to the database
 */
export async function logTrace(trace: AgentTrace): Promise<string> {
  const id = uuid();

  const res = await pool.query(
    `
    INSERT INTO "AgentTrace"(id, task_type, user_id, domain, input, steps, outcome)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
    `,
    [
      id,
      trace.task_type,
      trace.user_id || null,
      trace.domain || null,
      JSON.stringify(trace.input),
      JSON.stringify(trace.steps || []),
      JSON.stringify(trace.outcome),
    ]
  );

  return res.rows[0].id;
}

/**
 * Get recent traces for analysis
 */
export async function getRecentTraces(
  taskType?: string,
  limit = 100
): Promise<any[]> {
  const query = taskType
    ? `SELECT * FROM "AgentTrace" WHERE task_type = $1 ORDER BY created_at DESC LIMIT $2`
    : `SELECT * FROM "AgentTrace" ORDER BY created_at DESC LIMIT $1`;

  const params = taskType ? [taskType, limit] : [limit];
  const res = await pool.query(query, params);

  return res.rows.map(row => ({
    ...row,
    input: typeof row.input === 'string' ? JSON.parse(row.input) : row.input,
    steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
    outcome: typeof row.outcome === 'string' ? JSON.parse(row.outcome) : row.outcome,
  }));
}

/**
 * Get successful traces for learning
 */
export async function getSuccessfulTraces(
  taskType?: string,
  limit = 50
): Promise<any[]> {
  const query = taskType
    ? `
      SELECT * FROM "AgentTrace"
      WHERE task_type = $1 AND (outcome->>'success')::boolean = true
      ORDER BY created_at DESC
      LIMIT $2
    `
    : `
      SELECT * FROM "AgentTrace"
      WHERE (outcome->>'success')::boolean = true
      ORDER BY created_at DESC
      LIMIT $1
    `;

  const params = taskType ? [taskType, limit] : [limit];
  const res = await pool.query(query, params);

  return res.rows.map(row => ({
    ...row,
    input: typeof row.input === 'string' ? JSON.parse(row.input) : row.input,
    steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
    outcome: typeof row.outcome === 'string' ? JSON.parse(row.outcome) : row.outcome,
  }));
}

