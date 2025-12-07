import { Router } from 'express';
import { pool } from '../db';
import { adminGuard } from '../middleware/admin_guard';

export const runs = Router();

runs.get('/api/dev/demo/runs', adminGuard, async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id,name,started_at,finished_at,status,summary FROM "DemoRun" ORDER BY started_at DESC LIMIT 50'
  );
  res.json({ rows });
});

