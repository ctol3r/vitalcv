import { Router } from 'express';
import { rotateKeys, getCurrentJwks } from '../security/jwks';

export const issuerAdminRouter = Router();

issuerAdminRouter.post('/rotate-keys', async (_req, res) => {
  const out = await rotateKeys();
  res.json({ ok: true, kid: out.kid });
});

issuerAdminRouter.get('/jwks', async (_req, res) => {
  res.json(getCurrentJwks());
});

