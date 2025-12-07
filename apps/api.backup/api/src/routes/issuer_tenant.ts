import { Router } from 'express';
import { pool } from '../agent/db';

export const issuerTenantRouter = Router();

issuerTenantRouter.get('/:tenant_id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM "IssuerTenant" WHERE tenant_id=$1',
    [req.params.tenant_id]
  );
  res.json(rows[0] || {});
});

issuerTenantRouter.post('/:tenant_id', async (req, res) => {
  const { issuer_url, auth_url, kid } = req.body || {};
  await pool.query(
    'INSERT INTO "IssuerTenant"(tenant_id,issuer_url,auth_url,kid) VALUES($1,$2,$3,$4) ON CONFLICT (tenant_id) DO UPDATE SET issuer_url=$2, auth_url=$3, kid=$4',
    [req.params.tenant_id, issuer_url, auth_url, kid]
  );
  res.json({ ok: true });
});

