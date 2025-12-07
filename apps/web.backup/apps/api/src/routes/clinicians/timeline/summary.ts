import { Router, Request, Response } from 'express';
import {
  loadUserSession,
  requireAuth,
  AuthenticatedRequest,
} from '../../../../../../backend/src/middleware/accessGuards';
import { getTimelineSummary, loadClinicianWithUser } from '../../../../../../services/timeline/getClinicianTimeline';
import { canAccessTimeline } from './access';

const router = Router();
router.use(loadUserSession, requireAuth);

router.get('/:clinicianId/timeline/summary', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    if (!clinicianId) {
      return res.status(400).json({
        success: false,
        error: 'clinician_id_required',
      });
    }

    const clinician = await loadClinicianWithUser(clinicianId);
    if (!clinician) {
      return res.status(404).json({
        success: false,
        error: 'clinician_not_found',
      });
    }

    const authReq = req as AuthenticatedRequest;
    if (!canAccessTimeline(authReq.user, clinician.userId)) {
      return res.status(403).json({
        success: false,
        error: 'forbidden',
        message: 'Only the clinician or an authorized admin can view this summary.',
      });
    }

    const summary = await getTimelineSummary(clinician);

    return res.status(200).json({
      success: true,
      clinicianId: clinician.id,
      npi: clinician.npi,
      summary,
    });
  } catch (error) {
    console.error('Failed to load clinician timeline summary', error);
    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


