import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

import { NpiValidationError, runNpiValidation } from '../../services/npi/validator';

const prisma = new PrismaClient();
const router = Router();

const DEFAULT_SELF_ID =
  process.env.NEXT_PUBLIC_WALLET_CLINICIAN_ID ??
  process.env.DEFAULT_CLINICIAN_ID ??
  null;

router.get('/npi/validation/:clinicianId', async (req: Request, res: Response) => {
  const clinicianId = resolveClinicianId(req.params.clinicianId);
  if (!clinicianId) {
    return res.status(400).json({
      error: 'invalid_clinician_id',
      message:
        'Provide a clinicianId path parameter or configure NEXT_PUBLIC_WALLET_CLINICIAN_ID.',
    });
  }

  const refresh = toBoolean(req.query.refresh ?? req.query.force);
  const historyLimit = Number.parseInt(String(req.query.history ?? ''), 10);
  const npi =
    typeof req.query.npi === 'string' && req.query.npi.trim().length === 10
      ? req.query.npi.trim()
      : undefined;

  try {
    const result = await runNpiValidation({
      clinicianId,
      npi,
      prisma,
      refresh,
      historyLimit: Number.isFinite(historyLimit) && historyLimit > 0 ? historyLimit : undefined,
    });
    return res.json(result);
  } catch (error) {
    if (error instanceof NpiValidationError) {
      return res.status(error.status).json({
        error: error.code,
        message: error.message,
      });
    }

    console.error('[api][npi-validation] failed', error);
    return res.status(500).json({
      error: 'npi_validation_failed',
      message: 'Unable to evaluate NPI validation workflow.',
    });
  }
});

function resolveClinicianId(rawId?: string): string | null {
  if (!rawId) return null;
  if (rawId === 'self') {
    return DEFAULT_SELF_ID;
  }
  return rawId;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return Boolean(value);
}

export default router;









