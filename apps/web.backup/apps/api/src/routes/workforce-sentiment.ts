import { Router, type Request, type Response } from 'express';
import { getWorkforceSentiment, anchorWorkforceSentiment } from '../services/workforce-sentiment';

const router = Router();

router.get('/workforce-sentiment/:region', async (req: Request, res: Response) => {
  const region = req.params.region?.trim();
  if (!region) {
    return res.status(400).json({
      error: 'region_required',
      message: 'Provide a region parameter.',
    });
  }

  try {
    const sentiment = await getWorkforceSentiment(region);
    await anchorWorkforceSentiment(region, sentiment);
    return res.json(sentiment);
  } catch (error) {
    console.error('[workforce-sentiment] failed', error);
    return res.status(500).json({
      error: 'workforce_sentiment_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;








