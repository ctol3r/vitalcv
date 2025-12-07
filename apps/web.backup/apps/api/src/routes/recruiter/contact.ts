import { Router, type Request, type Response } from 'express';
import {
  getLastRecruiterContact,
  listRecentContacts,
  recordRecruiterContact,
} from '../../services/recruiter/contact';

const router = Router();

router.get('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const [lastContact, recent] = await Promise.all([
      getLastRecruiterContact(req.params.clinicianId),
      listRecentContacts(5),
    ]);
    return res.json({
      clinicianId: req.params.clinicianId,
      lastContact,
      recent,
    });
  } catch (error) {
    console.error('[Recruiter][contact] lookup failed', error);
    return res.status(400).json({
      error: 'recruiter_contact_lookup_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const entry = await recordRecruiterContact({
      clinicianId: req.params.clinicianId,
      recruiterId: resolveRecruiterId(req),
      channel: typeof req.body?.channel === 'string' ? req.body.channel : undefined,
      metadata: typeof req.body?.metadata === 'object' ? req.body.metadata : undefined,
      contactedAt: req.body?.contactedAt ? new Date(req.body.contactedAt) : undefined,
    });
    return res.status(201).json(entry);
  } catch (error) {
    console.error('[Recruiter][contact] create failed', error);
    return res.status(400).json({
      error: 'recruiter_contact_create_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

function resolveRecruiterId(req: Request): string {
  const fromHeader = req.header('x-recruiter-id');
  if (fromHeader) return fromHeader;
  const fromBody = typeof req.body?.recruiterId === 'string' ? req.body.recruiterId : undefined;
  return fromBody ?? 'demo-recruiter';
}

export default router;










