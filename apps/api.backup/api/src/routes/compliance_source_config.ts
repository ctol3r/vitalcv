import { Router } from 'express';
import { pool } from '../db';

export const srcCfg = Router();

srcCfg.get('/api/compliance/source-config', async (req, res) => {
  const t = (req.query.tenant || 'default').toString();
  const { rows } = await pool.query(
    'SELECT tenant_id, source, endpoint_url, (auth_header_json IS NOT NULL) AS has_auth, mode, updated_at FROM "PSVSourceConfig" WHERE tenant_id=$1 ORDER BY source',
    [t]
  );
  res.json({ rows });
});

srcCfg.post('/api/compliance/source-config', async (req, res) => {
  const { tenant_id = 'default', source, endpoint_url, auth_header_json, mode } = req.body || {};
  await pool.query(
    'INSERT INTO "PSVSourceConfig"(tenant_id, source, endpoint_url, auth_header_json, mode, updated_at) VALUES($1, $2, $3, $4, $5, now()) ON CONFLICT (tenant_id, source) DO UPDATE SET endpoint_url=$3, auth_header_json=$4, mode=$5, updated_at=now()',
    [tenant_id, source, endpoint_url || null, auth_header_json || null, mode || 'mock']
  );
  res.json({ ok: true });
});

