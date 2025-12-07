import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { computeHeatmapSnapshot, dedupeKineticsRecords } from '../../services/onboarding/simulate';

const router = Router();
const prisma = new PrismaClient();
const ONE_DAY_MS = 86_400_000;

router.get('/api/onboarding/heatmap', async (req: Request, res: Response) => {
  const windowDays = normalizeWindowDays(req.query.windowDays);
  const since = new Date(Date.now() - windowDays * ONE_DAY_MS);

  try {
    const records = await prisma.onboardingKinetics.findMany({
      where: {
        timestamp: {
          gte: since,
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 5_000,
    });

    const deduped = dedupeKineticsRecords(records);
    const summary = computeHeatmapSnapshot(deduped);

    return res.json({
      generatedAt: new Date().toISOString(),
      windowDays,
      ...summary,
    });
  } catch (error) {
    console.error('[onboarding][heatmap] failed to build snapshot', error);
    return res.status(500).json({
      error: 'onboarding_heatmap_failed',
      message: error instanceof Error ? error.message : 'Unable to load onboarding kinetics heatmap',
    });
  }
});

function normalizeWindowDays(value: unknown): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(Math.max(parsed, 7), 120);
  }
  return 30;
}

export default router;










