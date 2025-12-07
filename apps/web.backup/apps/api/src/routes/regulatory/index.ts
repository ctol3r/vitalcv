import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

import { getRegulatoryRules } from '../../services/regulatory';

const router = Router();
const prisma = new PrismaClient();

router.get('/regulatory/:authorityCode', async (req: Request, res: Response) => {
  const authorityCode = req.params.authorityCode?.trim();
  if (!authorityCode) {
    return res.status(400).json({
      error: 'authority_code_required',
      message: 'Provide an authority code such as FSMB or NCSBN.',
    });
  }

  const refreshRequested = String(req.query.refresh ?? 'false').toLowerCase() === 'true';
  const includeTimeline = req.query.timeline !== 'false';

  try {
    const payload = await getRegulatoryRules({
      authorityCode,
      prisma,
      refresh: refreshRequested,
      includeTimeline,
    });
    return res.json(payload);
  } catch (error) {
    console.error('[regulatory][rules] failed', error);
    return res.status(500).json({
      error: 'regulatory_rules_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;









