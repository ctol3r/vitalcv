import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { calculateTrustAnchors, getTrustAnchors } from '../../services/trust/anchorEngine';

const prisma = new PrismaClient();
const router = Router();

router.get('/trust/anchors', async (req: Request, res: Response) => {
  try {
    const refresh = String(req.query.refresh ?? 'false').toLowerCase() === 'true';
    if (refresh) {
      const snapshot = await calculateTrustAnchors({ prisma });
      return res.json(snapshot);
    }
    const anchors = await getTrustAnchors({ prisma });
    return res.json({ anchors, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[trust][anchors] list failed', error);
    return res.status(500).json({ error: 'trust_anchor_list_failed', message: extractMessage(error) });
  }
});

router.post('/trust/anchors/recalculate', async (_req: Request, res: Response) => {
  try {
    const snapshot = await calculateTrustAnchors({ prisma });
    return res.json(snapshot);
  } catch (error) {
    console.error('[trust][anchors] recalc failed', error);
    return res.status(500).json({ error: 'trust_anchor_recalc_failed', message: extractMessage(error) });
  }
});

function extractMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export default router;

