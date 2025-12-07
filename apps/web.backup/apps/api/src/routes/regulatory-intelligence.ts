import { Router, type Request, type Response } from 'express';
import { getRegulatoryIntelligence, anchorRegulatoryIntelligence } from '../services/regulatory-intelligence';

const router = Router();

router.get('/regulatory-intelligence/:region', async (req: Request, res: Response) => {
  const region = req.params.region?.trim();
  if (!region) {
    return res.status(400).json({
      error: 'region_required',
      message: 'Provide a region parameter.',
    });
  }

  try {
    const intel = await getRegulatoryIntelligence(region);
    await anchorRegulatoryIntelligence(region, intel);
    return res.json(intel);
  } catch (error) {
    console.error('[regulatory-intelligence] failed', error);
    return res.status(500).json({
      error: 'regulatory_intelligence_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;








