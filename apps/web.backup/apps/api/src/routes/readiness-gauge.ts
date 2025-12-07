import { Router, type Request, type Response } from 'express';
import { aggregateReadinessGauge } from '../services/readiness/gauge';
import { identifyReadinessBlockers } from '../services/readiness/blockers';

const router = Router();

/**
 * GET /api/readiness/gauge
 * Get readiness gauge
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const scope = (req.query.scope as string) || 'system';
    const gauge = await aggregateReadinessGauge(scope);
    const blockers = identifyReadinessBlockers(scope);

    return res.json({
      gauge,
      blockers,
    });
  } catch (error) {
    console.error('[readiness:gauge] error', error);
    return res.status(500).json({ error: 'gauge_computation_failed' });
  }
});

export default router;

