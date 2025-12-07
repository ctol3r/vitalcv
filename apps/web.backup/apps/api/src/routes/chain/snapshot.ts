import { Router, type Request, type Response } from 'express';
import { ChainClient } from '../../services/chain/client';

const router = Router();
const chainClient = new ChainClient();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [credentialStates, revocationPages, auditEvents] = await Promise.all([
      chainClient.fetchCredentialStates(),
      chainClient.fetchRevocationSnapshot(),
      chainClient.fetchRecentAuditEvents(since),
    ]);

    return res.json({
      generatedAt: new Date().toISOString(),
      credentialStates,
      revocationPages,
      auditEvents,
    });
  } catch (error) {
    console.error('[ChainSnapshot] Failed to build snapshot', error);
    return res.status(500).json({
      error: 'chain_snapshot_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;











