import { Router } from 'express';
import { pool } from '../db';

export const consent = Router();

consent.post('/consent', async (req, res) => {
  const { user_id, action, meta } = req.body || {};
  await pool.query(
    'INSERT INTO "ConsentLog"(user_id,action,meta) VALUES($1,$2,$3)',
    [user_id, action, meta || {}]
  );
  res.json({ ok: true });
});

