import { Router } from 'express';
import { anchorMerkleRoot, recentAnchors } from '../chain/substrate';

export const auditChainRouter = Router();

auditChainRouter.get('/anchors', async (_req, res) => {
  res.json({ roots: await recentAnchors(), events: [] });
});

auditChainRouter.post('/anchor', async (req, res) => {
  const { batchId, root } = req.body || {};
  const out = await anchorMerkleRoot(root || ('root-' + Date.now()));
  res.json({ ...out, batchId });
});

