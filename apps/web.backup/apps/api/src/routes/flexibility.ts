import { Router, type Request, type Response } from 'express';
import { getFlexibility, anchorFlexibility } from '../services/flexibility';

const router = Router();

router.get('/flexibility/:clinicianId', async (req: Request, res: Response) => {
  const clinicianId = req.params.clinicianId?.trim();
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_id_required',
      message: 'Provide a clinicianId parameter.',
    });
  }

  try {
    const flexibility = await getFlexibility(clinicianId);
    await anchorFlexibility(clinicianId, flexibility);
    return res.json(flexibility);
  } catch (error) {
    console.error('[flexibility] failed', error);
    return res.status(500).json({
      error: 'flexibility_analysis_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;








