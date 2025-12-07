import { Router, type Request, type Response } from 'express';

import {
  recordOnboardingCheckpoint,
  listOnboardingCheckpointSummary,
  summarizeOnboardingBlockers,
} from '../../services/onboarding/checkpoints';

const router = Router();

router.get(
  '/api/onboarding/checkpoints/:clinicianId',
  async (req: Request<{ clinicianId: string }>, res: Response) => {
    try {
      const clinicianId = req.params.clinicianId;
      if (!clinicianId) {
        return res.status(400).json({
          error: 'clinician_id_required',
          message: 'Provide clinicianId in the path parameter.',
        });
      }

      const summary = await listOnboardingCheckpointSummary(clinicianId);
      return res.json(summary);
    } catch (error) {
      console.error('[onboarding][checkpoints] fetch failed', error);
      return res.status(500).json({
        error: 'onboarding_checkpoints_failed',
        message: error instanceof Error ? error.message : 'Unable to load checkpoints',
      });
    }
  },
);

router.post('/api/onboarding/checkpoints', async (req: Request, res: Response) => {
  try {
    const clinicianId = typeof req.body?.clinicianId === 'string' ? req.body.clinicianId : null;
    const step = typeof req.body?.step === 'string' ? req.body.step : null;
    const status = typeof req.body?.status === 'string' ? req.body.status : null;
    if (!clinicianId || !step || !status) {
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'clinicianId, step, and status are required fields.',
      });
    }

    const checkpoint = await recordOnboardingCheckpoint({
      clinicianId,
      step,
      status,
      blockerCode:
        typeof req.body?.blockerCode === 'string' && req.body.blockerCode.length
          ? req.body.blockerCode
          : undefined,
      metadata: req.body?.metadata ?? null,
    });

    return res.status(201).json(checkpoint);
  } catch (error) {
    console.error('[onboarding][checkpoints] create failed', error);
    return res.status(500).json({
      error: 'onboarding_checkpoint_create_failed',
      message: error instanceof Error ? error.message : 'Unable to record checkpoint',
    });
  }
});

router.get('/api/onboarding/blockers', async (req: Request, res: Response) => {
  try {
    const windowDays =
      typeof req.query.windowDays === 'string' ? Number.parseInt(req.query.windowDays, 10) : null;

    const analytics = await summarizeOnboardingBlockers({
      windowDays: Number.isFinite(windowDays) ? Number(windowDays) : undefined,
    });

    return res.json(analytics);
  } catch (error) {
    console.error('[onboarding][blockers] analytics failed', error);
    return res.status(500).json({
      error: 'onboarding_blockers_failed',
      message: error instanceof Error ? error.message : 'Unable to compute blocker analytics',
    });
  }
});

export default router;

