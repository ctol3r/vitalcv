import { Router } from 'express';
import { pool } from '../db';

export const delta = Router();

async function computeDelta() {
  const cur = (await pool.query('SELECT id, ts, endpoint FROM "DirectoryEntry" ORDER BY ts DESC LIMIT 500')).rows;
  const prev = (await pool.query('SELECT id, ts, endpoint FROM "DirectoryEntry" ORDER BY ts DESC OFFSET 500 LIMIT 500')).rows;
  const key = (x: any) => (x.endpoint?.address || '') + '|' + (x.endpoint?.connectionType?.code || '');
  const C = new Map(cur.map((x: any) => [key(x), x]));
  const P = new Map(prev.map((x: any) => [key(x), x]));
  const added: string[] = [];
  const updated: string[] = [];
  for (const [k, v] of C) {
    if (!P.has(k)) added.push(k);
    else if (JSON.stringify(P.get(k)?.endpoint) !== JSON.stringify(v.endpoint)) updated.push(k);
  }
  return { added, updated };
}

delta.get('/api/tefca/delta', async (_req, res) => {
  const result = await computeDelta();
  res.json(result);
});

delta.get('/api/tefca/delta.csv', async (_req, res) => {
  const r = await computeDelta();
  const head = 'change,key\n';
  const body = [...r.added.map((k: string) => `added,${k}`), ...r.updated.map((k: string) => `updated,${k}`)].join('\n');
  res.type('text/csv').send(head + body);
});
