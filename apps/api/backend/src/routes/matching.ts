import express from 'express';
import { logAuditEvent } from '../logging/auditLog';
import { matchJobsForClinician } from '../services/matcha';

export const matchingRouter = express.Router();

matchingRouter.get('/matches', async (req, res) => {
  const clinicianIdRaw = req.query.clinicianId;
  const clinicianId = Array.isArray(clinicianIdRaw) ? clinicianIdRaw[0] : clinicianIdRaw;

  if (!clinicianId) {
    return res.status(400).json({ error: 'Missing clinicianId' });
  }

  const matches = await matchJobsForClinician(clinicianId.toString());

  await logAuditEvent({
    eventType: 'MATCH_COMPUTED',
    actor: (req as any).user?.id,
    subjectId: clinicianId.toString(),
    metadata: { matchCount: matches.length },
  });

  return res.json(matches);
});
