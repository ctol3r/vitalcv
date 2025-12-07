import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { filterCliniciansForShift } from '../../services/scheduling/filter';

const router = Router();
const prisma = new PrismaClient();

router.get('/scheduling/recommend', async (req: Request, res: Response) => {
  const shiftId = typeof req.query.shiftId === 'string' ? req.query.shiftId : undefined;
  const limit =
    typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined;

  if (!shiftId) {
    return res.status(400).json({
      error: 'shift_id_required',
      message: 'Provide shiftId query parameter',
    });
  }

  try {
    const result = await filterCliniciansForShift({
      shiftId,
      limit,
      prisma,
    });

    const eligible = result.clinicians.filter((clinician) => clinician.eligible);
    const nearMisses = result.clinicians
      .filter((clinician) => !clinician.eligible)
      .slice(0, 10);

    const privilegeReasons = [
      ...eligible.flatMap((clinician) => clinician.privilegeReasons),
      ...nearMisses.flatMap((clinician) => clinician.privilegeReasons),
    ].slice(0, 10);

    return res.json({
      shiftId,
      requirement: result.requirement,
      readinessThreshold: result.readinessThreshold,
      totalConsidered: result.totalConsidered,
      clinicians: eligible,
      nearMisses,
      missingItems: result.missingSummary,
      privilegeReasons,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[scheduling][recommend] failed', error);
    return res.status(500).json({
      error: 'scheduling_recommend_failed',
      message: error instanceof Error ? error.message : 'Unable to build recommendations',
    });
  }
});

export default router;










