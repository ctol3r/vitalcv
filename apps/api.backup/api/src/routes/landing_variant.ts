import { Router } from 'express';
import { pool } from '../agent/db';

export const landing = Router();

landing.get('/landing/variant', async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT value FROM \"RuntimeFlag\" WHERE key='press_landing'"
  );
  const val = rows[0]?.value ?? { enabled: false };
  res.json(val);
});

