import { Router } from 'express';
import fs from 'fs';

export const eudiCSV = Router();

eudiCSV.get('/api/eudi/trusted-list/noncompliance.csv', (_req, res) => {
  try {
    const j = JSON.parse(fs.readFileSync('trusted_list_snapshot.json', 'utf8'));
    const rows = (j.warnings || []).map((w: string, i: number) => ({ id: i + 1, warning: w }));

    const head = 'id,warning\n';
    const body = rows.map(r => `${r.id},"${r.warning.replace(/"/g, '""')}"`).join('\n');

    res.type('text/csv').send(head + body);
  } catch {
    res.status(404).send('no snapshot');
  }
});

