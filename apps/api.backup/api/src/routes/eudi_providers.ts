import { Router } from 'express';
import fs from 'fs';

export const eudiProv = Router();

eudiProv.get('/api/eudi/providers', (_req, res) => {
  try {
    const j = JSON.parse(fs.readFileSync('trusted_list_snapshot.json', 'utf8'));
    res.json({
      rows: j.providers || [],
      warnings: j.warnings || [],
      template: j.template,
      fetched_at: j.fetched_at
    });
  } catch {
    res.json({
      rows: [],
      warnings: [],
      note: 'sync first'
    });
  }
});

eudiProv.post('/api/eudi/providers/override', (_req, res) => {
  // stub: store local whitelist file for pilot
  res.json({ ok: true });
});


