import { Router, type Request, type Response } from 'express';

import { matchClinicianToJob, type JobSkillRequirements } from '../../services/skills/match';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const clinicianId = typeof req.body?.clinicianId === 'string' ? req.body.clinicianId : undefined;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_id_required',
      message: 'Provide clinicianId to score skill fit.',
    });
  }

  const requirements: JobSkillRequirements = {
    requiredSkills: safeArray(req.body?.requiredSkills),
    requiredCertifications: safeArray(req.body?.requiredCertifications),
    privilegedProcedures: safeArray(req.body?.privilegedProcedures),
  };

  try {
    const result = await matchClinicianToJob(clinicianId, requirements);
    return res.json({ match: result });
  } catch (error) {
    console.error('[skills:match] failed', error);
    return res.status(500).json({
      error: 'skill_match_failed',
      message: error instanceof Error ? error.message : 'Unable to compute skill match',
    });
  }
});

function safeArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

export default router;

