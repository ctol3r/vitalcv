import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export const runbookOps = Router();

runbookOps.get('/api/runbook/ops', (_req, res) => {
  try {
    const runbookPath = path.join(process.cwd(), 'docs', 'runbook_incidents.md');

    if (!fs.existsSync(runbookPath)) {
      return res.status(404).type('text/markdown').send('# Runbook Not Found\n\nThe ops runbook has not been created yet.');
    }

    const content = fs.readFileSync(runbookPath, 'utf8');
    res.type('text/markdown').send(content);
  } catch (err) {
    console.error('Failed to load runbook:', err);
    res.status(500).type('text/markdown').send('# Error\n\nFailed to load runbook.');
  }
});

