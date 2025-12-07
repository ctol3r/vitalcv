import { Router, type Request, type Response } from 'express';
import { ChainClient } from '../../services/chain/client';

const router = Router();
const chainClient = new ChainClient();

router.get('/chain/validators', async (_req: Request, res: Response) => {
  try {
    const overview = await chainClient.fetchValidatorHealth();
    return res.json(overview);
  } catch (error) {
    console.error('[chain][validators] failed', error);
    return res.status(500).json({
      error: 'validator_health_unavailable',
      message: error instanceof Error ? error.message : 'Unable to load validator health',
    });
  }
});

export default router;










