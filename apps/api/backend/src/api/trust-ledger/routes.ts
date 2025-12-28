import { Router } from 'express';

const router = Router();

/**
 * GET /trust-ledger/verify
 * Query: root, leaf
 */
router.get('/verify', (req, res) => {
  const { root, leaf } = req.query;
  // Verification stub (client can recompute root)
  res.json({ valid: Boolean(root && leaf) });
});

export default router;
