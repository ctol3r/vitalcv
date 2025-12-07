import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { collectObservabilitySnapshot } from '../../services/observability/grid';

const prisma = new PrismaClient();
const router = Router();

router.get('/observability/grid', async (req: Request, res: Response) => {
  try {
    const region = typeof req.query.region === 'string' ? req.query.region : 'global';
    const snapshot = await collectObservabilitySnapshot(region, { prisma });
    return res.json(snapshot);
  } catch (error) {
    console.error('[observability][grid] fetch failed', error);
    return res
      .status(500)
      .json({ error: 'observability_grid_failed', message: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/observability/grid/digest', async (req: Request, res: Response) => {
  try {
    const region = typeof req.body?.region === 'string' ? req.body.region : 'global';
    const snapshot = await collectObservabilitySnapshot(region, { prisma });
    // In a production setting this would enqueue an email; here we just return the digest text.
    return res.json({ region, digest: snapshot.digest, generatedAt: snapshot.generatedAt });
  } catch (error) {
    console.error('[observability][grid] digest failed', error);
    return res
      .status(500)
      .json({ error: 'observability_digest_failed', message: error instanceof Error ? error.message : String(error) });
  }
});

export default router;

