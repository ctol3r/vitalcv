import { Router } from 'express';
import { pool } from '../db';

export const psvScore = Router();

const SOURCES = ['license', 'board', 'dea', 'npdb', 'oig', 'caqh', 'pecos'];

function ok(d: Date | null, method: string | null) {
  const days = d ? (Date.now() - d.getTime()) / 86400000 : 9999;
  const limit = method === 'CVO' ? 90 : 120;
  return days <= limit;
}

psvScore.get('/api/compliance/psv-score', async (req, res) => {
  const npi = (req.query.npi || '').toString();
  const tenant = (req.query.tenant || '').toString();

  if (npi) {
    let okCount = 0;
    const total = SOURCES.length;

    for (const s of SOURCES) {
      const q = await pool.query(
        'SELECT pulled_at,method FROM "VerificationEvent" WHERE subject_npi=$1 AND source_name LIKE $2 ORDER BY pulled_at DESC LIMIT 1',
        [npi, s + '%']
      );
      const r = q.rows[0];
      if (ok(r ? new Date(r.pulled_at) : null, r?.method || null)) okCount++;
    }

    return res.json({
      sources_ok: okCount,
      total,
      score: Math.round(100 * okCount / total),
      overdue: total - okCount
    });
  }

  // tenant rollup (approx): count npi rows with at least one overdue
  const q = await pool.query(
    'SELECT subject_npi, source_name, method, pulled_at FROM "VerificationEvent" WHERE ($1=\'\' OR result->>\'tenant_id\'=$1)',
    [tenant]
  );

  const map = new Map<string, any[]>();
  q.rows.forEach(r => {
    const a = map.get(r.subject_npi) || [];
    a.push(r);
    map.set(r.subject_npi, a);
  });

  let overdue = 0;
  const total = map.size;

  for (const [, rows] of map) {
    let okAll = true;
    for (const s of SOURCES) {
      const latest = rows
        .filter(r => (r.source_name || '').startsWith(s))
        .sort((a, b) => new Date(b.pulled_at).getTime() - new Date(a.pulled_at).getTime())[0];
      if (!ok(latest ? new Date(latest.pulled_at) : null, latest?.method || null)) okAll = false;
    }
    if (!okAll) overdue++;
  }

  res.json({
    sources_ok: (total - overdue) * SOURCES.length,
    total: total * SOURCES.length,
    score: total ? Math.round(100 * (total - overdue) / total) : 0,
    overdue
  });
});

