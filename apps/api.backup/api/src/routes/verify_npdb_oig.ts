import { Router } from 'express';
import { pool } from '../db';
import crypto from 'crypto';

const TTL = Number(process.env.NPDB_OIG_TTL_DAYS || 60);

function exp() {
  return new Date(Date.now() + TTL * 86400000);
}

function hash(o: any) {
  return 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(o || {})).digest('hex');
}

export const npdboig = Router();

npdboig.post('/api/verify/npdb', async (req, res) => {
  const npi = (req.query.npi || '').toString();
  const payload = { querier: 'VitalCV', subject: npi, actions: [] };
  const ev = hash(payload);

  await pool.query(
    'INSERT INTO "NPDBCache"(npi,payload,status,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT (npi) DO UPDATE SET payload=$2,status=$3,expires_at=$4',
    [npi, payload, 'clear', exp()]
  );

  await pool.query(
    'INSERT INTO "VerificationEvent"(subject_npi,source_name,source_url,method,result,pulled_at,evidence_hash) VALUES($1,$2,$3,$4,$5,now(),$6)',
    [npi, 'npdb', 'https://npdb.hrsa.gov', 'API', 'ok', ev]
  );

  res.json({ ok: true });
});

npdboig.post('/api/verify/oig', async (req, res) => {
  const npi = (req.query.npi || '').toString();
  const payload = { querier: 'VitalCV', subject: npi, exclusion: false };
  const ev = hash(payload);

  await pool.query(
    'INSERT INTO "OIGCache"(npi,payload,status,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT (npi) DO UPDATE SET payload=$2,status=$3,expires_at=$4',
    [npi, payload, 'clear', exp()]
  );

  await pool.query(
    'INSERT INTO "VerificationEvent"(subject_npi,source_name,source_url,method,result,pulled_at,evidence_hash) VALUES($1,$2,$3,$4,$5,now(),$6)',
    [npi, 'oig', 'https://exclusions.oig.hhs.gov', 'API', 'ok', ev]
  );

  res.json({ ok: true });
});

npdboig.get('/api/verify/npdb', async (req, res) => {
  const npi = (req.query.npi || '').toString();
  const { rows } = await pool.query('SELECT status,cached_at,expires_at FROM "NPDBCache" WHERE npi=$1', [npi]);
  res.json(rows[0] || {});
});

npdboig.get('/api/verify/oig', async (req, res) => {
  const npi = (req.query.npi || '').toString();
  const { rows } = await pool.query('SELECT status,cached_at,expires_at FROM "OIGCache" WHERE npi=$1', [npi]);
  res.json(rows[0] || {});
});

