import express from 'express';
import { getEmployerReadiness } from './service';

const router = express.Router();

router.get('/readiness/:clinicianId/:jobId', async (req, res, next) => {
  try {
    const { clinicianId, jobId } = req.params;
    const summary = await getEmployerReadiness(clinicianId, jobId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

export default router;
