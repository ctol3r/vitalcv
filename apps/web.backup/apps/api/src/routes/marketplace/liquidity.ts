import { Router, type Request, type Response } from 'express';
import {
  calculateMarketLiquidity,
  predictResponsiveness,
  calculateOfferCompetitiveness,
  scoreMarketplaceHealth,
  anchorLiquiditySnapshot,
} from '@/services/marketplace/liquidity';

const router = Router();

router.get('/market/:role/:region', async (req: Request, res: Response) => {
  try {
    const { role, region } = req.params;
    const result = await calculateMarketLiquidity(role, region);
    return res.json(result);
  } catch (error) {
    console.error('[Liquidity] Market calculation failed', error);
    return res.status(500).json({ error: 'market_calculation_failed' });
  }
});

router.get('/responsiveness/:clinicianId', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const result = await predictResponsiveness(clinicianId);
    return res.json(result);
  } catch (error) {
    console.error('[Liquidity] Responsiveness failed', error);
    return res.status(500).json({ error: 'responsiveness_failed' });
  }
});

router.get('/competitiveness/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const result = await calculateOfferCompetitiveness(jobId);
    return res.json(result);
  } catch (error) {
    console.error('[Liquidity] Competitiveness failed', error);
    return res.status(500).json({ error: 'competitiveness_failed' });
  }
});

router.get('/health/:region', async (req: Request, res: Response) => {
  try {
    const { region } = req.params;
    const result = await scoreMarketplaceHealth(region);
    return res.json(result);
  } catch (error) {
    console.error('[Liquidity] Health scoring failed', error);
    return res.status(500).json({ error: 'health_scoring_failed' });
  }
});

export default router;

