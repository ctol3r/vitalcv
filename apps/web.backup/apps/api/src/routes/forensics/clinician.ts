import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

import {
  evaluateIdentityForensics,
  listForensicsHistory,
} from '../../services/forensics/score';

const router = Router();
const prisma = new PrismaClient();

router.get('/forensics/clinicians/:clinicianId', async (req: Request, res: Response) => {
  const clinicianId = req.params.clinicianId;
  const limit = Number.parseInt(String(req.query.limit ?? '20'), 10);
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_id_required',
      message: 'Provide clinicianId as a path parameter.',
    });
  }

  try {
    const records = await listForensicsHistory(clinicianId, {
      limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 20,
      prisma,
    });
    return res.json({ clinicianId, records });
  } catch (error) {
    console.error('[forensics][history] failed', error);
    return res.status(500).json({
      error: 'forensics_history_failed',
      message: error instanceof Error ? error.message : 'Unable to load forensics history',
    });
  }
});

router.post('/forensics/clinicians/:clinicianId/evaluate', async (req: Request, res: Response) => {
  const clinicianId = req.params.clinicianId;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_id_required',
      message: 'Provide clinicianId as a path parameter.',
    });
  }

  try {
    const evaluation = await evaluateIdentityForensics(clinicianId, {
      prisma,
      fingerprintId: typeof req.body?.fingerprintId === 'string' ? req.body.fingerprintId : undefined,
    });
    return res.json(evaluation);
  } catch (error) {
    console.error('[forensics][evaluate] failed', error);
    return res.status(500).json({
      error: 'forensics_evaluation_failed',
      message: error instanceof Error ? error.message : 'Unable to evaluate forensics signals',
    });
  }
});

export default router;










