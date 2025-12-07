import { Router } from 'express';
import { pool } from '../db';

export const hashVerify = Router();

hashVerify.get('/api/audit/hash/verify', async (req, res) => {
  const h = (req.query.hash || '').toString();
  const { rowCount } = await pool.query(
    'SELECT 1 FROM "VerificationEvent" WHERE evidence_hash=$1',
    [h]
  );
  res.json({ ok: rowCount > 0 });
});


