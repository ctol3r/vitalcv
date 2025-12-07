import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { runMonitoringScan, buildMonitoringGridSnapshot } from '../../services/monitoring/scan';

const router = Router();
const prisma = new PrismaClient();
const DEFAULT_CLINICIAN_ID =
  process.env.NEXT_PUBLIC_WALLET_CLINICIAN_ID ?? process.env.DEFAULT_CLINICIAN_ID ?? null;

router.get('/monitoring/clinician/:clinicianId?', async (req: Request, res: Response) => {
  const resolvedId = resolveClinicianId(req.params.clinicianId);
  if (!resolvedId) {
    return res.status(400).json({
      error: 'clinician_id_required',
      message: 'Provide a clinicianId path parameter or configure DEFAULT_CLINICIAN_ID.',
    });
  }

  try {
    const anchor = String(req.query.anchor ?? 'true').toLowerCase() !== 'false';
    const result = await runMonitoringScan(resolvedId, {
      prisma,
      anchor,
    });
    return res.json(result);
  } catch (error) {
    console.error('[monitoring][clinician] failed', error);
    return res.status(500).json({
      error: 'monitoring_scan_failed',
      message: error instanceof Error ? error.message : 'Unexpected monitoring failure',
    });
  }
});

router.get('/monitoring/grid', async (req: Request, res: Response) => {
  const limit = Number.parseInt(String(req.query.limit ?? '25'), 10);
  const status =
    typeof req.query.status === 'string' && req.query.status.trim().length
      ? (req.query.status.trim().toLowerCase() as any)
      : undefined;

  try {
    const snapshot = await buildMonitoringGridSnapshot({
      prisma,
      limit: Number.isFinite(limit) ? Math.max(5, Math.min(limit, 100)) : 25,
      status,
    });
    return res.json(snapshot);
  } catch (error) {
    console.error('[monitoring][grid] failed', error);
    return res.status(500).json({
      error: 'monitoring_grid_failed',
      message: error instanceof Error ? error.message : 'Unexpected error building grid',
    });
  }
});

function resolveClinicianId(raw?: string) {
  if (!raw || raw === 'self') {
    return DEFAULT_CLINICIAN_ID;
  }
  return raw;
}

export default router;










