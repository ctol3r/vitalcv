import express, { type Request } from 'express';
import { logAuditEvent } from '../obs/auditLog';
import { submitApplication } from '../services/applications';

type RequestWithUser = Request & { user?: { id?: string | null } };

export const applicationsRouter = express.Router();

applicationsRouter.post('/apply', async (req: RequestWithUser, res) => {
  const { clinicianId, jobId } = req.body ?? {};
  if (!clinicianId || !jobId) return res.status(400).json({ error: 'Missing params' });

  const application = await submitApplication(clinicianId, jobId);

  await logAuditEvent({
    eventType: 'JOB_ACTION',
    actor: req.user?.id ?? null,
    subjectId: clinicianId,
    metadata: {
      jobId,
      applicationId: application.id,
      action: 'application_created',
    },
  });

  return res.status(201).json(application);
});
