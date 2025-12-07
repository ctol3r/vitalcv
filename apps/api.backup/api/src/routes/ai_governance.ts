/**
 * AI Governance API Route
 * Exposes governance events for dashboard consumption
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db';

export const aiGovernanceRouter = Router();

/**
 * GET /api/ai/governance
 * Get recent governance events
 */
aiGovernanceRouter.get('/api/ai/governance', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const result = await pool.query(
      `SELECT
         model_id,
         model_version,
         accuracy,
         bias_score,
         owner,
         ts,
         metrics
       FROM "GovernanceEvent"
       ORDER BY ts DESC
       LIMIT $1`,
      [limit]
    );

    res.json({
      rows: result.rows.map((row) => ({
        model_id: row.model_id,
        model_version: row.model_version,
        model: row.model_id, // Alias for frontend compatibility
        version: row.model_version, // Alias for frontend compatibility
        accuracy: row.accuracy,
        acc: row.accuracy, // Alias for frontend compatibility
        bias_score: row.bias_score,
        bias: row.bias_score, // Alias for frontend compatibility
        owner: row.owner,
        ts: row.ts,
        timestamp: row.ts, // Alias for frontend compatibility
        metrics: row.metrics,
      })),
    });
  } catch (error: any) {
    console.error('AI governance query error:', error);
    // If table doesn't exist yet, return empty array
    if (error.message?.includes('does not exist')) {
      return res.json({ rows: [] });
    }
    res.status(500).json({
      error: 'Failed to query governance events',
      message: error.message,
    });
  }
});

