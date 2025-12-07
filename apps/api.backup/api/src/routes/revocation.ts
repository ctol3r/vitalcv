import { Router } from 'express';
import { pool } from '../db';

export const revokeRouter = Router();

revokeRouter.get('/timeline/:did', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM "VcRevocation" WHERE subject_did=$1 ORDER BY created_at DESC',
    [req.params.did]
  );
  res.json({ rows });
});

revokeRouter.post('/revoke', async (req, res) => {
  const { subject_did, cred_id, cred_type, reason } = req.body || {};
  await pool.query(
    'INSERT INTO "VcRevocation"(subject_did,cred_type,cred_id,status,reason,revoked_at) VALUES($1,$2,$3,$4,$5,now())',
    [subject_did, cred_type, cred_id, 'revoked', reason || null]
  );
  res.json({ ok: true });
});

