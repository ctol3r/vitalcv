import { Router } from 'express';
import { logSuccess } from '../alitag/harvest';

export const alitagSmoke = Router();

alitagSmoke.get('/api/alitag/smoke', async (_req, res) => {
  await logSuccess('compliance', 'telehealth_ok', { state: 'CA' });
  res.json({ ok: true });
});

