import { Router } from 'express';
import { signArtifact, verifyArtifact } from '../crypto/artifacts';

export const artifactsRouter = Router();

artifactsRouter.post('/sign', async (req, res) => {
  const { payload } = req.body || {};
  const jws = await signArtifact(payload || {});
  res.json({ jws });
});

artifactsRouter.post('/verify', async (req, res) => {
  const { jws, jwk } = req.body || {};
  try {
    const out = await verifyArtifact(jws, jwk);
    res.json({ ok: true, out });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
});

