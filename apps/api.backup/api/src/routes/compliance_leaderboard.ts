import { Router } from 'express';
import { pool } from '../db';

export const ldr = Router();

const SOURCES = ['license', 'board', 'dea', 'npdb', 'oig', 'caqh', 'pecos'];

function inWin(d: Date | null, m: string | null): boolean {
  const days = d ? (Date.now() - d.getTime()) / 86400000 : 9999;
  return days <= (m === 'CVO' ? 90 : 120);
}

ldr.get('/api/compliance/leaderboard', async (req, res) => {
  const tenant = (req.query.tenant || '').toString();
  const lim = Number(req.query.limit || 50);

  const Q = await pool.query(
    'SELECT DISTINCT subject_npi FROM "VerificationEvent" WHERE ($1=\'\' OR result->>\'tenant_id\'=$1)',
    [tenant]
  );
  const ids = (Q.rows || []).map((r: any) => r.subject_npi);

  const results: any[] = [];

  for (const n of ids) {
    let overdue: string[] = [];
    for (const s of SOURCES) {
      const q = await pool.query(
        'SELECT pulled_at, method FROM "VerificationEvent" WHERE subject_npi=$1 AND source_name LIKE $2 ORDER BY pulled_at DESC LIMIT 1',
        [n, s + '%']
      );
      const r = q.rows[0];
      if (!inWin(r ? new Date(r.pulled_at) : null, r?.method || null)) {
        overdue.push(s);
      }
    }

    // Call weighted score endpoint
    const port = process.env.PORT || 4000;
    const sc = await fetch(`http://localhost:${port}/api/compliance/psv-score/weighted?npi=${n}`).then(r => r.json());
    results.push({ npi: n, pct: sc.pct, grade: sc.grade, overdue });
  }

  results.sort((a, b) => a.pct - b.pct);
  res.json({ rows: results.slice(0, lim) });
});

