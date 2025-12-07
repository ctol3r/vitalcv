import { Router } from 'express';
import { pool } from '../db';

export const boardReg = Router();

boardReg.get('/api/verify/board/registry', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT state, endpoint_url, (auth_header IS NOT NULL) AS has_auth, updated_at FROM "BoardEndpoint" ORDER BY state'
  );
  res.json({ rows });
});

boardReg.post('/api/verify/board/registry', async (req, res) => {
  const { state, endpoint_url, auth_header } = req.body || {};
  await pool.query(
    'INSERT INTO "BoardEndpoint"(state, endpoint_url, auth_header, updated_at) VALUES($1, $2, $3, now()) ON CONFLICT (state) DO UPDATE SET endpoint_url=$2, auth_header=$3, updated_at=now()',
    [String(state || '').toUpperCase(), endpoint_url || '', auth_header || null]
  );
  res.json({ ok: true });
});

