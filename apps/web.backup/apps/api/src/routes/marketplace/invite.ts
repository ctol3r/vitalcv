import { Router, type Request, type Response } from 'express';
import { recordMarketplaceInvite } from '../../services/marketplace/invite';

const router = Router();

router.post('/:clinicianId', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;
  const jobId = typeof req.body?.jobId === 'string' ? req.body.jobId : undefined;
  if (!clinicianId || !jobId) {
    return res.status(400).json({
      error: 'missing_parameters',
      message: 'clinicianId path param and jobId payload are required',
    });
  }

  try {
    const payload = await recordMarketplaceInvite({
      clinicianId,
      jobId,
      orgId: resolveOrgId(req),
      recruiterId: resolveRecruiterId(req),
      specialtyFilters: parseStringArray(req.body?.specialtyFilters),
    });
    return res.status(201).json(payload);
  } catch (error) {
    console.error('[marketplace][invite] failed', error);
    return res.status(500).json({
      error: 'marketplace_invite_failed',
      message: error instanceof Error ? error.message : 'Unable to send invite',
    });
  }
});

function resolveOrgId(req: Request): string {
  return req.header('x-org-id') ?? (typeof req.body?.orgId === 'string' ? req.body.orgId : 'demo-org');
}

function resolveRecruiterId(req: Request): string {
  return (
    req.header('x-recruiter-id') ??
    (typeof req.body?.recruiterId === 'string' ? req.body.recruiterId : 'demo-recruiter')
  );
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

export default router;










