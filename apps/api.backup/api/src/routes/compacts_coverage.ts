/**
 * Compacts Coverage API
 * Returns active state counts per compact
 */

import { Router } from 'express';
import { pool } from '../db';

export const compCoverage = Router();

compCoverage.get('/api/compacts/coverage', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT compact, count(*)::int AS states
       FROM "CompactMatrix"
       WHERE status = 'active'
       GROUP BY compact
       ORDER BY compact`
    );

    res.json({ rows: result.rows });
  } catch (error) {
    console.error('Compacts coverage error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch compacts coverage' });
  }
});

