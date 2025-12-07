import { Router, type Request, type Response } from 'express';
import { ChainClient } from '../../services/chain/client';
import { listAnchorEvents } from '../../services/audit/anchor';
import { listTrustedIssuers } from '../../services/trust/registry';

const router = Router();
const chainClient = new ChainClient();

router.get('/chain/recovery/dump', async (_req: Request, res: Response) => {
  try {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const anchors = listAnchorEvents({ limit: 500 }).filter((record) => {
      const timestamp = Date.parse(record.payload?.timestamp ?? '');
      return Number.isFinite(timestamp) && timestamp >= since;
    });

    const [statusList, trustRegistry] = await Promise.all([
      chainClient.fetchRevocationSnapshot(),
      listTrustedIssuers(),
    ]);

    return res.json({
      generatedAt: new Date().toISOString(),
      anchors,
      statusList,
      trustRegistry,
    });
  } catch (error) {
    console.error('[chain][recoveryDump] failed', error);
    return res.status(500).json({
      error: 'chain_recovery_failed',
      message: error instanceof Error ? error.message : 'Unable to export recovery snapshot',
    });
  }
});

export default router;










