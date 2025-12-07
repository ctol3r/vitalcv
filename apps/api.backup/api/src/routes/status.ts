import { Router } from 'express';

export const statusRouter = Router();

// Asset Hub chain status
statusRouter.get('/status/chain', async (req, res) => {
  try {
    // In production, check actual Asset Hub connection
    // For now, return stub status
    res.json({
      ok: true,
      chain: 'asset-hub',
      status: 'connected',
      lastAnchor: new Date().toISOString(),
      note: 'Stub implementation - integrate polkadot.js',
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
