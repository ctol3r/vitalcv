import { Router } from 'express';
import { pool } from '../db';

export const weight = Router();

weight.get('/api/compliance/psv-weights', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT source, weight FROM "PSVWeightConfig" ORDER BY weight DESC'
  );
  res.json({ rows });
});

weight.post('/api/compliance/psv-weights', async (req, res) => {
  const arr = req.body?.rows || [];
  for (const r of arr) {
    await pool.query(
      'INSERT INTO "PSVWeightConfig"(source, weight) VALUES($1, $2) ON CONFLICT (source) DO UPDATE SET weight=$2',
      [r.source, r.weight]
    );
  }
  res.json({ ok: true });
});

