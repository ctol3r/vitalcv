import { Router } from 'express';
import { pool } from '../db';

export const sourceModes = Router();

const SOURCE_KEYS = ['license', 'board', 'dea', 'npdb', 'oig', 'caqh', 'pecos'];

sourceModes.get('/api/verify/sources/modes', async (_req, res) => {
  try {
    const modes: any = {};

    for (const key of SOURCE_KEYS) {
      const flagKey = `source.${key}.mode`;
      const result = await pool.query(
        'SELECT value FROM "RuntimeFlag" WHERE key = $1',
        [flagKey]
      );

      modes[key] = result.rows[0]?.value || 'mock';
    }

    res.json(modes);
  } catch (error) {
    console.error('Source modes error:', error);
    res.status(500).json({ error: 'Failed to fetch source modes' });
  }
});

