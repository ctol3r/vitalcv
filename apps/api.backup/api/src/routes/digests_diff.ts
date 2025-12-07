import { Router } from 'express';
import fs from 'fs';

export const diff = Router();

function read(name: string) {
  try {
    return JSON.parse(fs.readFileSync(name, 'utf8'));
  } catch {
    return null;
  }
}

function listByState(rows: any[], st: string, key: string) {
  return (rows || [])
    .filter((r: any) => (r.state || '').toUpperCase() === st.toUpperCase())
    .map((r: any) => (key in r ? r[key] : (r.status ?? r.uniform ?? true)));
}

diff.get('/api/digests/heatmap/diff/:state', (_req, res) => {
  const st = _req.params.state.toUpperCase();
  const L = read('digest_last.json');
  const P = read('digest_prev.json');

  if (!L || !P) return res.json({ ok: false, note: 'no snapshots' });

  const cL = listByState(L.compacts, st, 'compact');
  const cP = listByState(P.compacts, st, 'compact');
  const srL = listByState(L.state_rules, st, 'rules');
  const srP = listByState(P.state_rules, st, 'rules');
  const mpjeL = listByState(L.mpje, st, 'uniform');
  const mpjeP = listByState(P.mpje, st, 'uniform');

  const add = (a: string[], b: string[]) => a.filter(x => !b.includes(x));
  const rem = (a: string[], b: string[]) => b.filter(x => !a.includes(x));

  res.json({
    ok: true,
    state: st,
    compacts: { added: add(cL, cP), removed: rem(cL, cP) },
    state_rules: {
      changed: JSON.stringify(srL) !== JSON.stringify(srP),
      before: srP[0] || null,
      after: srL[0] || null
    },
    mpje: { before: mpjeP[0] ?? null, after: mpjeL[0] ?? null }
  });
});

