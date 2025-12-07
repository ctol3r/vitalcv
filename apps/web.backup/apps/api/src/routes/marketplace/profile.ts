import { Router, type Request, type Response } from 'express';
import {
  getMarketplaceProfile,
  upsertMarketplaceProfile,
} from '../../services/marketplace/profile';

const router = Router();

router.get('/:clinicianId', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_required',
      message: 'clinicianId path param is required',
    });
  }

  try {
    const profile = await getMarketplaceProfile(clinicianId);
    return res.json(profile);
  } catch (error) {
    console.error('[marketplace][profile:get] failed', error);
    return res.status(500).json({
      error: 'marketplace_profile_lookup_failed',
      message: error instanceof Error ? error.message : 'Unable to load marketplace profile',
    });
  }
});

router.put('/:clinicianId', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_required',
      message: 'clinicianId path param is required',
    });
  }

  const visibility =
    typeof req.body?.visibility === 'string' ? req.body.visibility : 'invite';
  const specialties = parseStringArray(req.body?.specialties);
  const regions = parseStringArray(req.body?.regions);

  try {
    const profile = await upsertMarketplaceProfile({
      clinicianId,
      visibility,
      specialties,
      regions,
      orgId: resolveOrgId(req),
    });
    return res.json(profile);
  } catch (error) {
    console.error('[marketplace][profile:put] failed', error);
    return res.status(500).json({
      error: 'marketplace_profile_update_failed',
      message: error instanceof Error ? error.message : 'Unable to update marketplace profile',
    });
  }
});

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

function resolveOrgId(req: Request): string {
  return req.header('x-org-id') ?? 'demo-org';
}

export default router;










