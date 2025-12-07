import express, { Request, Response } from 'express';
import { getTelemetryService, AgentMaturityMetrics } from '../telemetry';

const router = express.Router();
const telemetryService = getTelemetryService();

/**
 * GET /metrics/agents
 * Expose agent maturity telemetry
 */
router.get('/metrics/agents', (req: Request, res: Response) => {
  const allMetrics = telemetryService.getAllMetrics();

  const response = {
    agents: allMetrics.map((m: AgentMaturityMetrics) => ({
      agentId: m.agentId,
      level: m.level,
      readinessScore: m.readinessScore,
      breaches: m.breaches,
      lastUpdated: m.lastUpdated,
    })),
    summary: {
      total: allMetrics.length,
      proactive: allMetrics.filter(m => m.level === 'Proactive').length,
      managed: allMetrics.filter(m => m.level === 'Managed').length,
      reactive: allMetrics.filter(m => m.level === 'Reactive').length,
      totalBreaches: allMetrics.reduce((sum, m) =>
        sum + m.breaches.injection + m.breaches.leak + m.breaches.supplyChain + m.breaches.tool + m.breaches.llm, 0
      ),
      breachesByType: {
        injection: allMetrics.reduce((sum, m) => sum + m.breaches.injection, 0),
        leak: allMetrics.reduce((sum, m) => sum + m.breaches.leak, 0),
        supplyChain: allMetrics.reduce((sum, m) => sum + m.breaches.supplyChain, 0),
        tool: allMetrics.reduce((sum, m) => sum + m.breaches.tool, 0),
        llm: allMetrics.reduce((sum, m) => sum + m.breaches.llm, 0),
      },
    },
  };

  res.json(response);
});

/**
 * GET /metrics/agents/:agentId
 * Get metrics for specific agent
 */
router.get('/metrics/agents/:agentId', (req: Request, res: Response) => {
  const metrics = telemetryService.getMetrics(req.params.agentId);

  if (!metrics) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  res.json(metrics);
});

export default router;

