import { Router, type Request, type Response } from 'express';
import { browseMarketplaceProfiles } from '../../services/marketplace/profile';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const filters = {
      specialty: typeof req.query.specialty === 'string' ? req.query.specialty : undefined,
      region: typeof req.query.region === 'string' ? req.query.region : undefined,
      readinessScore: parseFloat(String(req.query.readinessScore ?? '')),
      compactEligible: String(req.query.compact ?? '').toLowerCase() === 'true',
      limit: parseInt(String(req.query.limit ?? ''), 10),
    };

    if (Number.isNaN(filters.readinessScore)) {
      filters.readinessScore = undefined;
    }
    if (Number.isNaN(filters.limit)) {
      filters.limit = undefined;
    }

    const result = await browseMarketplaceProfiles(filters);
    return res.json(result);
  } catch (error) {
    console.error('[marketplace][browse] failed', error);
    return res.status(500).json({
      error: 'marketplace_browse_failed',
      message: error instanceof Error ? error.message : 'Unable to browse marketplace',
    });
  }
});

export default router;










