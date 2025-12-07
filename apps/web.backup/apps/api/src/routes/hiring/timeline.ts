import { Router, type Request, type Response } from 'express';
import { listHiringEvents } from '../../services/audit/hiring-ledger';

const router = Router();

router.get('/api/hiring/timeline/:clinicianId', async (req: Request, res: Response) => {
  try {
    const clinicianId = req.params.clinicianId;
    if (!clinicianId) {
      return res.status(400).json({
        error: 'missing_clinician_id',
        message: 'Clinician ID is required',
      });
    }

    const events = await listHiringEvents(clinicianId);
    return res.json({
      clinicianId,
      events,
    });
  } catch (error) {
    console.error('[hiring][timeline] failed to load events', error);
    return res.status(500).json({
      error: 'timeline_fetch_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

