import { Router } from 'express';
import { pool } from '../agent/db';

export const rbac = Router();

rbac.get('/rbac/perms', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM "Permission" ORDER BY key');
  res.json({ rows });
});

rbac.get('/rbac/roleperms', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM "RolePerm" ORDER BY role, perm_key');
  res.json({ rows });
});

rbac.post('/rbac/roleperms', async (req, res) => {
  const { role, perm_key } = req.body || {};
  await pool.query(
    'INSERT INTO "RolePerm"(role,perm_key) VALUES($1,$2) ON CONFLICT DO NOTHING',
    [role, perm_key]
  );
  res.json({ ok: true });
});

