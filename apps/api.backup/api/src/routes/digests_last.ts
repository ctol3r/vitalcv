import { Router } from 'express';
import fs from 'fs';

export const last = Router();

last.get('/api/digests/weekly/last', (_req, res) => {
  try {
    const j = fs.readFileSync('digest_last.json', 'utf8');
    res.type('application/json').send(j);
  } catch {
    res.json({ ok: false, note: 'no digest yet' });
  }
});

