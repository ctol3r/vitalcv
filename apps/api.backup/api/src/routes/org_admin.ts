import { Router } from 'express';
import { pool } from '../db';

export const orgAdmin = Router();

orgAdmin.post('/org/:id/region', async (req, res) => {
  await pool.query(
    'INSERT INTO "Org"(id,name,region) VALUES($1,$2,$3) ON CONFLICT (id) DO UPDATE SET region=$3',
    [req.params.id, req.body?.name || req.params.id, req.body?.region || 'us']
  );
  res.json({ ok: true });
});

orgAdmin.post('/org/:id/role', async (req, res) => {
  const { user_id, role } = req.body || {};
  await pool.query(
    'INSERT INTO "OrgUser"(org_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT (org_id,user_id) DO UPDATE SET role=$3',
    [req.params.id, user_id, role || 'member']
  );
  res.json({ ok: true });
});

