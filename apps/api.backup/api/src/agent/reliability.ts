import { pool } from './db';

// Metrics counters for observability (SLO tracking)
let mcpSuccessCount = 0;
let mcpFailureCount = 0;
let totalEvalTime = 0;
let evalCount = 0;

/**
 * Bump reliability scores for MCPs that were used successfully (or unsuccessfully)
 * @param names - Array of MCP names to update
 * @param delta - Change in reliability score (+1 for success, -1 for failure)
 */
export async function bumpReliability(names: string[], delta: number): Promise<void> {
  if (!names?.length) return;

  const now = new Date();

  for (const name of names) {
    try {
      await pool.query(
        `UPDATE "McpTool"
         SET reliability_score = COALESCE(reliability_score, 0.5) + $1,
             usage_count = COALESCE(usage_count, 0) + 1,
             updated_at = $3
         WHERE name = $2`,
        [delta * 0.01, name, now] // Scale delta to small increments
      );

      // Increment metrics counters for SLO tracking
      if (delta > 0) {
        mcpSuccessCount++;
      } else {
        mcpFailureCount++;
      }
    } catch (error) {
      console.error(`Failed to bump reliability for ${name}:`, error);
    }
  }
}

/**
 * Decay all reliability scores by a small factor
 * This ensures that old, unused MCPs gradually lose reliability
 * Run this periodically (e.g., daily via cron)
 */
export async function decayReliability(): Promise<void> {
  try {
    const result = await pool.query(
      `UPDATE "McpTool"
       SET reliability_score = reliability_score * 0.995
       WHERE reliability_score IS NOT NULL`
    );

    console.log(`[Reliability Decay] Updated ${result.rowCount} MCPs`);
  } catch (error) {
    console.error('Failed to decay reliability:', error);
    throw error;
  }
}

/**
 * Get reliability statistics for monitoring
 */
export async function getReliabilityStats(): Promise<{
  totalMcps: number;
  avgReliability: number;
  topPerformers: Array<{ name: string; score: number; usageCount: number }>;
  bottomPerformers: Array<{ name: string; score: number; usageCount: number }>;
}> {
  const statsQuery = await pool.query(`
    SELECT
      COUNT(*) as total,
      AVG(reliability_score) as avg_reliability
    FROM "McpTool"
  `);

  const topQuery = await pool.query(`
    SELECT name, reliability_score as score, usage_count
    FROM "McpTool"
    WHERE reliability_score IS NOT NULL
    ORDER BY reliability_score DESC, usage_count DESC
    LIMIT 10
  `);

  const bottomQuery = await pool.query(`
    SELECT name, reliability_score as score, usage_count
    FROM "McpTool"
    WHERE reliability_score IS NOT NULL
    ORDER BY reliability_score ASC, usage_count ASC
    LIMIT 10
  `);

  return {
    totalMcps: parseInt(statsQuery.rows[0].total || '0'),
    avgReliability: parseFloat(statsQuery.rows[0].avg_reliability || '0'),
    topPerformers: topQuery.rows,
    bottomPerformers: bottomQuery.rows,
  };
}

/**
 * Get metrics for SLO tracking
 * PSV (Precision, Success rate, Verification time), time-to-privilege, completeness
 */
export function getMetrics(): {
  mcpSuccessCount: number;
  mcpFailureCount: number;
  successRate: number;
  avgEvalTime: number;
} {
  const successRate = mcpSuccessCount + mcpFailureCount > 0
    ? mcpSuccessCount / (mcpSuccessCount + mcpFailureCount)
    : 0;

  const avgEvalTime = evalCount > 0 ? totalEvalTime / evalCount : 0;

  return {
    mcpSuccessCount,
    mcpFailureCount,
    successRate,
    avgEvalTime,
  };
}

/**
 * Record eval timing for SLO tracking
 */
export function recordEvalTime(timeMs: number): void {
  totalEvalTime += timeMs;
  evalCount++;
}

