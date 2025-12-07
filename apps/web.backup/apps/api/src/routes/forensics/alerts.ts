import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

import { listForensicsAlerts } from '../../services/forensics/score';

const router = Router();
const prisma = new PrismaClient();

router.get('/forensics/alerts', async (req: Request, res: Response) => {
  const limit = Number.parseInt(String(req.query.limit ?? '40'), 10);
  const minScore = Number.parseFloat(String(req.query.minScore ?? '65'));

  try {
    const records = await listForensicsAlerts({
      limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 40,
      minScore: Number.isFinite(minScore) ? minScore : 65,
      prisma,
    });
    return res.json({ records });
  } catch (error) {
    console.error('[forensics][alerts] failed', error);
    return res.status(500).json({
      error: 'forensics_alerts_failed',
      message: error instanceof Error ? error.message : 'Unable to load forensics alerts',
    });
  }
});

export default router;










