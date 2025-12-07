import { Router } from 'express';
import { verifyAPIT } from '../adapters/psypact';

export const psychSmoke = Router();

psychSmoke.get('/api/psych/psypact/smoke', async (_req, res) => {
  const r = await verifyAPIT('DEMO');
  res.json(r);
});

