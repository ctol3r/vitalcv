import { Router } from 'express';
import { pool } from '../db';

export const alitagEval = Router();

alitagEval.get('/api/alitag/eval', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT domain, count(*)::int AS c
     FROM "AgentLog"
     WHERE created_at > now() - interval '30 days'
     GROUP BY domain
     ORDER BY c DESC`
  );

  res.json({ last30d: rows });
});

