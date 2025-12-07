import { Router } from 'express';
import fs from 'fs';

export const heatmap = Router();

function last() {
  try {
    return JSON.parse(fs.readFileSync('digest_last.json', 'utf8'));
  } catch {
    return null;
  }
}

function prev() {
  try {
    return JSON.parse(fs.readFileSync('digest_prev.json', 'utf8'));
  } catch {
    return null;
  }
}

export const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA',
  'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE',
  'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY'
];

heatmap.get('/api/digests/heatmap', async (_req, res) => {
  const L = last();
  const P = prev();

  if (!L || !P) {
    return res.json({ ok: false, note: 'no snapshots' });
  }

  const set = (arr: any[], key: string) =>
    new Set(arr.filter(Boolean).map((r: any) => `${r[key]}:${(r.status ?? r.uniform) ?? true}`));

  const cmL = set(L.compacts || [], 'state');
  const cmP = set(P.compacts || [], 'state');
  const srL = set(L.state_rules || [], 'state');
  const srP = set(P.state_rules || [], 'state');
  const mpL = set(L.mpje || [], 'state');
  const mpP = set(P.mpje || [], 'state');

  const rows = STATES.map(s => {
    const comp = Array.from(cmL).some(x => x.startsWith(s + ':')) !== Array.from(cmP).some(x => x.startsWith(s + ':'));
    const rules = Array.from(srL).some(x => x.startsWith(s + ':')) !== Array.from(srP).some(x => x.startsWith(s + ':'));
    const mpje = Array.from(mpL).some(x => x.startsWith(s + ':')) !== Array.from(mpP).some(x => x.startsWith(s + ':'));

    return {
      state: s,
      changed: (comp || rules || mpje),
      buckets: { compacts: comp, state_rules: rules, mpje }
    };
  });

  res.json({ ok: true, rows });
});

