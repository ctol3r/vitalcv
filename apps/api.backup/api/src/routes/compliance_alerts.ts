import { Router } from 'express';
import { exec } from 'child_process';

export const alerts = Router();

alerts.post('/api/compliance/alerts/weekly/send', (_req, res) => {
  exec('pnpm tsx scripts/psv_alert_weekly.ts', (e, so, se) => {
    res.type('text/plain').send(so || se || String(e || ''));
  });
});

