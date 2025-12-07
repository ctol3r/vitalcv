import { Router } from 'express';
import { pool } from '../db';

export const compacts = Router();

/**
 * GET /api/compacts
 * List compact memberships, optionally filtered by compact name
 * Query params:
 *   - compact: filter by compact name (NLC, IMLC, PSYPACT, etc.)
 */
compacts.get('/api/compacts', async (req, res) => {
  try {
    const c = req.query.compact?.toString() || '';
    const args: any[] = [];

    let sql = 'SELECT compact, state, status, special_rules FROM "CompactMatrix"';

    if (c) {
      args.push(c);
      sql += ' WHERE compact = $1';
    }

    sql += ' ORDER BY compact, state';

    const { rows } = await pool.query(sql, args);
    res.json({ rows });
  } catch (err) {
    console.error('Compacts query error:', err);
    res.status(500).json({ error: 'Query failed' });
  }
});

/**
 * GET /api/compacts/state/:xx
 * Get all compact memberships for a specific state
 * Params:
 *   - xx: two-letter state code
 */
compacts.get('/api/compacts/state/:xx', async (req, res) => {
  try {
    const s = req.params.xx.toUpperCase();

    const { rows } = await pool.query(
      'SELECT compact, status, special_rules FROM "CompactMatrix" WHERE state = $1 ORDER BY compact',
      [s]
    );

    res.json({ state: s, rows });
  } catch (err) {
    console.error('State compacts query error:', err);
    res.status(500).json({ error: 'Query failed' });
  }
});

