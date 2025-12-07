import { Router } from 'express';
import { syncTrustedList, readTrustedList } from '../services/eu_trust_sync';

export const eudiTrust = Router();

eudiTrust.get('/api/eudi/trusted-list/status', async (_req, res) => {
  const s = readTrustedList();
  res.json({
    ok: !!s,
    ...(s || {}),
    hint: 'POST /api/eudi/trusted-list/sync to refresh'
  });
});

eudiTrust.post('/api/eudi/trusted-list/sync', async (_req, res) => {
  const s = await syncTrustedList();
  res.json({ ok: true, ...s });
});

