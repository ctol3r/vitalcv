import { Router } from 'express';
import { fullHealth } from './health/full';

export const healthRouter = Router();

healthRouter.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));
healthRouter.get('/readyz', (_req, res) => res.json({ ok: true, ts: Date.now() }));
healthRouter.get('/full', fullHealth);
