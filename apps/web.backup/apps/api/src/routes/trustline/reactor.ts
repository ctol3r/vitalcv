import { Router, type Request, type Response } from 'express';
import {
  getTrustlineGraphReactor,
  anchorTrustlineGraphReactor,
} from '../../services/trustline/reactor';

const router = Router();

router.get('/reactor/:orgId', async (req: Request, res: Response) => {
  const orgId = req.params.orgId?.trim();
  if (!orgId) {
    return res.status(400).json({
      error: 'org_id_required',
      message: 'Provide an orgId parameter.',
    });
  }

  try {
    const reactor = await getTrustlineGraphReactor(orgId);
    return res.json(reactor);
  } catch (error) {
    console.error('[trustline][reactor] failed', error);
    return res.status(500).json({
      error: 'trustline_reactor_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.post('/reactor/:orgId/anchor', async (req: Request, res: Response) => {
  const orgId = req.params.orgId?.trim();
  if (!orgId) {
    return res.status(400).json({
      error: 'org_id_required',
      message: 'Provide an orgId parameter.',
    });
  }

  try {
    const anchor = await anchorTrustlineGraphReactor(orgId);
    return res.json(anchor);
  } catch (error) {
    console.error('[trustline][reactor][anchor] failed', error);
    return res.status(500).json({
      error: 'trustline_reactor_anchor_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;








