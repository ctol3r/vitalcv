import { Router } from 'express';
import { exec } from 'child_process';

export const opsReceipt = Router();

opsReceipt.get('/ops/receipt-smoke', (_req, res) => {
  exec('pnpm tsx scripts/receipt_smoke.ts', (err, stdout, stderr) => {
    res.type('text/plain').send(stdout || stderr || String(err));
  });
});

