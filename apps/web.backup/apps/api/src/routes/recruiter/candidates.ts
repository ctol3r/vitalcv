import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: Request, res: Response) => {
  try {
    const readyOnly = String(req.query.ready ?? '').toLowerCase() === 'true';
    const baseQuery = {
      orderBy: { updatedAt: 'desc' as const },
      take: readyOnly ? 100 : 200,
    };

    const readiness = await prisma.clinicianReadinessScore.findMany(baseQuery);
    const candidates = readiness
      .map((record) => {
        const factors =
          (record.factors as Record<string, unknown> | null | undefined) ?? {};
        const sanctionsMeta = (factors as { sanctions?: { hasActive?: boolean } }).sanctions;
        const sanctionsClear = !(sanctionsMeta?.hasActive ?? false);
        const psvDays = Number(
          (factors as { licenseFreshnessDays?: number }).licenseFreshnessDays ?? 0
        );
        const psvCurrent = Number.isFinite(psvDays) ? psvDays <= 90 : true;
        const psvHours = Number.isFinite(psvDays) ? psvDays * 24 : undefined;
        const npdbActions = Number(
          (factors as { npdbHistory?: { adverseActions?: number } }).npdbHistory?.adverseActions ??
            0
        );

        return {
          clinicianId: record.clinicianId,
          readinessScore: record.score,
          sanctionsClear,
          psvCurrent,
          npdbClear: npdbActions === 0,
          psvFreshWithin48h: typeof psvHours === 'number' ? psvHours <= 48 : false,
          psvFreshnessHours: typeof psvHours === 'number' ? Number(psvHours.toFixed(1)) : null,
          compactEligibility: (factors as { compactEligibility?: string }).compactEligibility ?? 'UNKNOWN',
          updatedAt: record.updatedAt,
          rationale: {
            components: (factors as { readinessComponents?: Record<string, number> }).readinessComponents ?? {},
            notes: (factors as { notes?: string[] }).notes ?? [],
          },
        };
      })
      .filter((candidate) => {
        if (!readyOnly) return true;
        return (
          candidate.readinessScore >= 0.85 &&
          candidate.sanctionsClear &&
          candidate.psvCurrent &&
          candidate.npdbClear &&
          candidate.psvFreshWithin48h
        );
      });

    return res.json({
      filters: {
        readyOnly,
        minimumScore: readyOnly ? 0.85 : undefined,
      },
      total: candidates.length,
      candidates,
    });
  } catch (error) {
    console.error('[Recruiter] candidates listing failed', error);
    return res.status(500).json({
      error: 'candidates_list_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


