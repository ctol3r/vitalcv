import { Router, type Request, type Response } from 'express';
import {
  getOrCreateIdentityContinuity,
  detectContinuityBreaches,
  predictContinuityIssues,
  exportContinuityPack,
} from '../../services/identity/continuity';
import { anchorEvent } from '../../services/audit/anchor';
import { createHash } from 'crypto';

const router = Router();

router.get('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const continuity = await getOrCreateIdentityContinuity(clinicianId);
    return res.json(continuity);
  } catch (error) {
    console.error('[identity:continuity] failed', error);
    return res.status(500).json({
      error: 'identity_continuity_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/:clinicianId/breaches', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const breaches = await detectContinuityBreaches(clinicianId);
    return res.json({ breaches });
  } catch (error) {
    console.error('[identity:breaches] failed', error);
    return res.status(500).json({
      error: 'breach_detection_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/:clinicianId/predictions', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const predictions = await predictContinuityIssues(clinicianId);
    return res.json({ predictions });
  } catch (error) {
    console.error('[identity:predictions] failed', error);
    return res.status(500).json({
      error: 'prediction_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/:clinicianId/export', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const pack = await exportContinuityPack(clinicianId);

    // Anchor the continuity snapshot
    const continuityHash = createHash('sha256')
      .update(JSON.stringify(pack.continuity))
      .digest('hex');

    anchorEvent('identityContinuityAnchored', {
      clinicianId,
      continuityHash,
      overallContinuity: pack.summary.overallContinuity,
      breachCount: pack.breaches.length,
    });

    return res.json(pack);
  } catch (error) {
    console.error('[identity:export] failed', error);
    return res.status(500).json({
      error: 'continuity_export_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;

