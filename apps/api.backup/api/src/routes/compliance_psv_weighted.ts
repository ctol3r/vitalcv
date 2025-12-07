import { Router } from 'express';
import { pool } from '../db';

export const wscore = Router();

const SOURCES = ['license', 'board', 'dea', 'npdb', 'oig', 'caqh', 'pecos'];

function inWin(d: Date | null, m: string | null): boolean {
  const days = d ? (Date.now() - d.getTime()) / 86400000 : 9999;
  return days <= (m === 'CVO' ? 90 : 120);
}

async function weights(): Promise<Map<string, number>> {
  const r = await pool.query('SELECT source, weight FROM "PSVWeightConfig"');
  const m = new Map<string, number>();
  r.rows.forEach((x: any) => m.set(x.source, Number(x.weight || 0)));
  return m;
}

wscore.get('/api/compliance/psv-score/weighted', async (req, res) => {
  const npi = (req.query.npi || '').toString();
  const tenant = (req.query.tenant || '').toString();
  const W = await weights();
  const max = Array.from(W.values()).reduce((a, b) => a + b, 0);

  async function scoreFor(n: string) {
    let got = 0;
    for (const s of SOURCES) {
      const q = await pool.query(
        'SELECT pulled_at, method FROM "VerificationEvent" WHERE subject_npi=$1 AND source_name LIKE $2 ORDER BY pulled_at DESC LIMIT 1',
        [n, s + '%']
      );
      const r = q.rows[0];
      if (inWin(r ? new Date(r.pulled_at) : null, r?.method || null)) {
        got += W.get(s) || 0;
      }
    }
    const pct = max ? Math.round((100 * got) / max) : 0;
    const grade = pct >= 90 ? 'A' : pct >= 75 ? 'B' : 'C';
    return { pct, grade };
  }

  if (npi) {
    return res.json(await scoreFor(npi));
  }

  // tenant rollup: average across NPIs
  const q = await pool.query(
    'SELECT DISTINCT subject_npi FROM "VerificationEvent" WHERE ($1=\'\' OR result->>\'tenant_id\'=$1)',
    [tenant]
  );
  const ids = (q.rows || []).map((r: any) => r.subject_npi);
  let sum = 0;
  for (const id of ids) {
    sum += (await scoreFor(id)).pct;
  }
  const avg = ids.length ? Math.round(sum / ids.length) : 0;
  const grade = avg >= 90 ? 'A' : avg >= 75 ? 'B' : 'C';
  res.json({ pct: avg, grade, count: ids.length });
});

