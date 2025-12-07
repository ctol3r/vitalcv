import { Router, type Request, type Response } from 'express';
import {
  getGlobalMobilityIntelligence,
  anchorGlobalMobilityIntelligence,
} from '../../services/mobility/intelligence';

const router = Router();

router.get('/intelligence/:clinicianId', async (req: Request, res: Response) => {
  const clinicianId = req.params.clinicianId?.trim();
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_id_required',
      message: 'Provide a clinicianId parameter.',
    });
  }

  try {
    const intelligence = await getGlobalMobilityIntelligence(clinicianId);
    return res.json(intelligence);
  } catch (error) {
    console.error('[mobility][intelligence] failed', error);
    return res.status(500).json({
      error: 'mobility_intelligence_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.post('/intelligence/:clinicianId/anchor', async (req: Request, res: Response) => {
  const clinicianId = req.params.clinicianId?.trim();
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_id_required',
      message: 'Provide a clinicianId parameter.',
    });
  }

  try {
    const anchor = await anchorGlobalMobilityIntelligence(clinicianId);
    return res.json(anchor);
  } catch (error) {
    console.error('[mobility][intelligence][anchor] failed', error);
    return res.status(500).json({
      error: 'mobility_intelligence_anchor_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;








