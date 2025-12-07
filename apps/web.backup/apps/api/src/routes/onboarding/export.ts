import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  buildBulkExportFromKinetics,
  dedupeKineticsRecords,
  serializeAggregatedRowsToCsv,
} from '../../services/onboarding/simulate';

const router = Router();
const prisma = new PrismaClient();
const ONE_DAY_MS = 86_400_000;

router.get('/api/onboarding/export', async (req: Request, res: Response) => {
  const windowDays = normalizeWindowDays(req.query.windowDays);
  const format = typeof req.query.format === 'string' ? req.query.format.toLowerCase() : 'json';
  const since = new Date(Date.now() - windowDays * ONE_DAY_MS);

  try {
    const records = await prisma.onboardingKinetics.findMany({
      where: {
        timestamp: {
          gte: since,
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 10_000,
    });

    const deduped = dedupeKineticsRecords(records);
    const rows = buildBulkExportFromKinetics(deduped);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="onboarding-kinetics-${windowDays}d.csv"`);
      return res.send(serializeAggregatedRowsToCsv(rows));
    }

    return res.json({
      generatedAt: new Date().toISOString(),
      windowDays,
      totalClinicians: rows.length,
      rows,
    });
  } catch (error) {
    console.error('[onboarding][export] failed', error);
    return res.status(500).json({
      error: 'onboarding_export_failed',
      message: error instanceof Error ? error.message : 'Unable to export onboarding kinetics data',
    });
  }
});

function normalizeWindowDays(value: unknown): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(Math.max(parsed, 7), 180);
  }
  return 60;
}

export default router;










