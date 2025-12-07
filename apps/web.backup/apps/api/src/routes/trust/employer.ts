import { Router, type Request, type Response } from 'express';
import {
  calculateTrustScore,
  detectMisuse,
  getTrustHistory,
  enforceTrustRestrictions,
  anchorTrustSnapshot,
} from '@/services/trust/employerTrust';

const router = Router();

router.get('/:orgId/score', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const result = await calculateTrustScore(orgId);
    return res.json(result);
  } catch (error) {
    console.error('[EmployerTrust] Score calculation failed', error);
    return res.status(500).json({ error: 'score_calculation_failed' });
  }
});

router.get('/:orgId/misuse', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const result = await detectMisuse(orgId);
    return res.json(result);
  } catch (error) {
    console.error('[EmployerTrust] Misuse detection failed', error);
    return res.status(500).json({ error: 'misuse_detection_failed' });
  }
});

router.get('/:orgId/history', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const result = await getTrustHistory(orgId);
    return res.json(result);
  } catch (error) {
    console.error('[EmployerTrust] History failed', error);
    return res.status(500).json({ error: 'history_failed' });
  }
});

router.get('/:orgId/restrictions', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const result = await enforceTrustRestrictions(orgId);
    return res.json(result);
  } catch (error) {
    console.error('[EmployerTrust] Restrictions failed', error);
    return res.status(500).json({ error: 'restrictions_failed' });
  }
});

router.get('/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
    const trust = await prisma.employerTrust.findUnique({
      where: { orgId },
    });
    if (!trust) return res.status(404).json({ error: 'trust_not_found' });
    return res.json(trust);
  } catch (error) {
    console.error('[EmployerTrust] Get failed', error);
    return res.status(500).json({ error: 'get_failed' });
  }
});

export default router;

