import { Router } from 'express';
import { pool } from '../agent/db';

export const flags = Router();

// Public read-only endpoint
flags.get('/flags', async (_req, res) => {
  const { rows } = await pool.query('SELECT key, value FROM "RuntimeFlag"');
  const out: Record<string, any> = {};
  rows.forEach(r => out[r.key] = r.value);
  res.json(out);
});

// Admin endpoints
flags.get('/admin/flags', async (_req, res) => {
  const { rows } = await pool.query('SELECT key, value FROM "RuntimeFlag"');
  const out: Record<string, any> = {};
  rows.forEach((r: any) => out[r.key] = r.value);
  res.json(out);
});

flags.post('/admin/flags', async (req, res) => {
  const { key, value } = req.body || {};

  if (!key) {
    return res.status(400).json({ error: 'missing_key' });
  }

  await pool.query(
    'INSERT INTO "RuntimeFlag"(key, value, updated_at) VALUES($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=now()',
    [key, value ?? true]
  );

  res.json({ ok: true });
});

flags.delete('/admin/flags', async (req, res) => {
  const { key } = req.body || {};

  if (!key) {
    return res.status(400).json({ error: 'missing_key' });
  }

  await pool.query('DELETE FROM "RuntimeFlag" WHERE key=$1', [key]);
  res.json({ ok: true });
});

