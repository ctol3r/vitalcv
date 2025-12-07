import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/compacts/eligibility/:clinicianId', async (req: Request<{ clinicianId: string }>, res: Response) => {
  const { clinicianId } = req.params;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_id_required',
      message: 'Clinician identifier is required',
    });
  }

  try {
    const eligibility = await prisma.compactEligibility.findMany({
      where: { clinicianId },
      orderBy: { compact: 'asc' },
    });
    return res.json({
      clinicianId,
      total: eligibility.length,
      entries: eligibility,
    });
  } catch (error) {
    console.error('[Compacts] eligibility fetch failed', error);
    return res.status(500).json({
      error: 'compact_eligibility_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;











