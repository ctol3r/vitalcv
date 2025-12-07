import { Router } from 'express';

export const v1 = Router();

v1.get('/health', (_req, res) => res.json({ ok: true, version: '1.0' }));

