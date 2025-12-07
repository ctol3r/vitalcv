import { Router } from 'express';
import { pool } from '../agent/db';

export const newsletter = Router();

newsletter.post('/newsletter/subscribe', async (req, res) => {
  const { email, source } = req.body || {};

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }

  await pool.query(
    'INSERT INTO "Newsletter"(email, source) VALUES($1, $2) ON CONFLICT (email) DO NOTHING',
    [email, source || 'site']
  );

  res.json({ ok: true });
});

newsletter.get('/newsletter/list', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT email, created_at, source FROM "Newsletter" ORDER BY created_at DESC LIMIT 1000'
  );
  res.json({ rows });
});

