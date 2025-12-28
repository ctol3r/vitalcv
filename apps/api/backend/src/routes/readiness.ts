import express from 'express';
import { getReadinessScore } from '../services/readiness';

export const readinessRouter = express.Router();

readinessRouter.get('/readiness', async (req, res) => {
  const clinicianId = String(req.query.clinicianId || '').trim();
  if (!clinicianId) return res.status(400).json({ error: 'Missing clinicianId' });

  try {
    const report = await getReadinessScore(clinicianId);
    return res.status(200).json(report);
  } catch (error) {
    // Avoid leaking internals; surface a generic error
    return res.status(500).json({ error: 'Unable to compute readiness' });
  }
});
