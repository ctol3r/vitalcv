import { Router } from 'express';
import { runAnchorCanarySigned } from '../chain/anchor_canary';

export const anchorCanary = Router();

anchorCanary.get('/ops/anchor-canary', async (_req, res) => {
  const out = await runAnchorCanarySigned();
  res.json(out);
});
