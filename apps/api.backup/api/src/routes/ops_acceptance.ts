import { Router } from 'express';
import { exec } from 'child_process';

export const ops = Router();

ops.get('/ops/acceptance', (_req, res) => {
  exec('pnpm tsx scripts/acceptance_e2e.ts', (err, stdout, stderr) => {
    res.type('text/plain').send(stdout || stderr || String(err));
  });
});

