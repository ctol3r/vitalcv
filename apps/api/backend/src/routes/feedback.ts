import express from 'express';
import { logAuditEvent } from '../services/audit';

export const feedbackRouter = express.Router();

feedbackRouter.post('/feedback', async (req, res) => {
  const { clinicianId, screenId, type, text } = req.body ?? {};
  if (!clinicianId || !type || !text) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  await logAuditEvent({
    eventType: 'FEEDBACK_SUBMITTED',
    subjectId: clinicianId,
    metadata: {
      screenId: screenId || null,
      type,
      text,
    },
  });

  return res.status(201).json({ ok: true });
});
