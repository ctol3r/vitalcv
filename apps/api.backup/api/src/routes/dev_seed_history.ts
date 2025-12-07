/**
 * Batch 62: Seed History API
 * Returns the latest seed history entries for the timeline UI
 */

import { Router } from 'express';
import { pool } from '../db';

export const seedHistory = Router();

seedHistory.get('/api/dev/seed-history', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 50);

    const { rows } = await pool.query(
      'SELECT ts, user_id, seeds, result FROM "SeedHistory" ORDER BY ts DESC LIMIT $1',
      [limit]
    );

    res.json({ ok: true, rows });
  } catch (error: any) {
    console.error('Seed history fetch error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to fetch seed history' });
  }
});

