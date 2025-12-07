import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

import { getMobilityPassportSnapshot } from '../../services/mobility/passport';

const prisma = new PrismaClient();
const router = Router();

router.get('/mobility/passport/:clinicianId', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'clinicianId path parameter is required',
    });
  }

  try {
    const refresh = String(req.query.refresh ?? 'false').toLowerCase() === 'true';
    const snapshot = await getMobilityPassportSnapshot(clinicianId, { refresh, prisma });
    return res.json(snapshot);
  } catch (error) {
    console.error('[mobility][passport:get] failed', error);
    return res.status(500).json({
      error: 'mobility_passport_failed',
      message: error instanceof Error ? error.message : 'Unable to build mobility passport',
    });
  }
});

router.post('/mobility/passport/:clinicianId/refresh', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'clinicianId path parameter is required',
    });
  }

  try {
    const snapshot = await getMobilityPassportSnapshot(clinicianId, { refresh: true, prisma });
    return res.json(snapshot);
  } catch (error) {
    console.error('[mobility][passport:refresh] failed', error);
    return res.status(500).json({
      error: 'mobility_passport_failed',
      message: error instanceof Error ? error.message : 'Unable to refresh mobility passport',
    });
  }
});

export default router;









