import { Router } from 'express';
import { exec } from 'child_process';
import fs from 'fs';

export const digests = Router();

digests.get('/api/digests/weekly', async (_req, res) => {
  // read last json if persisted; else run script via worker in ops
  res.json({ ok: true, note: 'Hook to weekly digest output' });
});

digests.get('/api/digests/weekly/send', (_req, res) => {
  exec('npx tsx scripts/digest_email.ts', (err, stdout, stderr) => {
    res.type('text/plain').send(stdout || stderr || String(err));
  });
});


