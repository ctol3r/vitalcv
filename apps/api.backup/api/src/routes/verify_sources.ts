import { Router } from 'express';
import { pool } from '../db';

export const src = Router();

const ADAPTERS = ['license', 'board', 'dea', 'npdb', 'oig', 'caqh', 'pecos'];

src.get('/api/verify/sources', (_req, res) => res.json({ rows: ADAPTERS }));

src.post('/api/verify/run', async (req, res) => {
  const s = (req.query.source || '').toString();
  const npi = (req.query.npi || '').toString();

  if (!ADAPTERS.includes(s)) return res.status(400).json({ ok: false });

  await pool.query(
    'INSERT INTO "VerificationEvent"(subject_npi,source_name,source_url,method,result,pulled_at,evidence_hash) VALUES($1,$2,$3,$4,$5,now(),$6)',
    [npi, s, 'https://example.org/' + s, 'API', 'ok', 'sha256:stub']
  );

  res.json({ ok: true });
});


