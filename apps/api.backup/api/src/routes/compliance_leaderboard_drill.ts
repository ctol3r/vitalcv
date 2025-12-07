import { Router } from 'express';
import { pool } from '../db';

export const ldrNpi = Router();

const SOURCES = ['license', 'board', 'dea', 'npdb', 'oig', 'caqh', 'pecos'];

function inWin(d: Date | null, m: string | null) {
  const days = d ? (Date.now() - d.getTime()) / 86400000 : 9999;
  return { ok: days <= (m === 'CVO' ? 90 : 120), days: Math.floor(days) };
}

ldrNpi.get('/api/compliance/leaderboard/:npi', async (req, res) => {
  const npi = req.params.npi;
  const out: any[] = [];

  for (const s of SOURCES) {
    const q = await pool.query(
      'SELECT pulled_at, method, source_name FROM "VerificationEvent" WHERE subject_npi=$1 AND source_name LIKE $2 ORDER BY pulled_at DESC LIMIT 1',
      [npi, s + '%']
    );
    const r = q.rows[0];
    const st = inWin(r ? new Date(r.pulled_at) : null, r?.method || null);
    out.push({
      source: s,
      latest_at: r?.pulled_at || null,
      method: r?.method || null,
      ok: st.ok,
      days_since: st.days,
    });
  }

  res.json({ rows: out });
});

