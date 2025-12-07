import { Router } from 'express';
import { pool } from '../db';

export const verifyRecent = Router();

verifyRecent.get('/api/verify/recent', async (req, res) => {
  const n = Number(req.query.n || 50);
  const { rows } = await pool.query(
    'SELECT ts, request, result FROM "VerifyResultLog" ORDER BY ts DESC LIMIT $1',
    [n]
  );
  res.json({ rows });
});

