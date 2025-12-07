import { Router, type Request, type Response } from 'express';
import { aggregateLatencyMetrics } from '../services/latency/aggregate';
import { computeThroughput } from '../services/latency/throughput';
import { checkSLACompliance } from '../services/latency/sla-check';
import { detectLatencyRegression } from '../services/latency/regression';

const router = Router();

/**
 * GET /api/latency/detail
 * Get detailed latency metrics
 */
router.get('/detail', async (req: Request, res: Response) => {
  try {
    const { credentialId, orgId, region, range } = req.query;

    if (!credentialId) {
      return res.status(400).json({ error: 'credentialId_required' });
    }

    const metrics = await aggregateLatencyMetrics(credentialId as string);
    if (!metrics) {
      return res.status(404).json({ error: 'metrics_not_found' });
    }

    const slaCheck = checkSLACompliance(metrics);
    const regressions = await detectLatencyRegression(credentialId as string);

    return res.json({
      metrics,
      slaCheck,
      regressions,
    });
  } catch (error) {
    console.error('[latency:detail] error', error);
    return res.status(500).json({ error: 'latency_check_failed' });
  }
});

/**
 * GET /api/latency/throughput
 * Get throughput metrics
 */
router.get('/throughput', async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const throughput = await computeThroughput(startDate, endDate);
    return res.json(throughput);
  } catch (error) {
    console.error('[latency:throughput] error', error);
    return res.status(500).json({ error: 'throughput_check_failed' });
  }
});

export default router;

