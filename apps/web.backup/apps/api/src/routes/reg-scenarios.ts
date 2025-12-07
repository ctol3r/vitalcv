import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { simulateScenarioImpact } from '../services/reg-scenarios/impact';
import { forecastScenarioOutcomes } from '../services/reg-scenarios/forecast';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/reg-scenarios
 * Create scenario
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, region, ruleChanges, timeframe } = req.body;

    const scenario = await prisma.regScenario.create({
      data: {
        name,
        region,
        rules: {
          changes: ruleChanges || [],
          timeframe,
        },
        impact: {},
      },
    });

    return res.json(scenario);
  } catch (error) {
    console.error('[reg-scenarios:create] error', error);
    return res.status(500).json({ error: 'scenario_creation_failed' });
  }
});

/**
 * GET /api/reg-scenarios/:id
 * Get scenario with impact
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const scenario = await prisma.regScenario.findUnique({
      where: { id },
    });

    if (!scenario) {
      return res.status(404).json({ error: 'scenario_not_found' });
    }

    const impact = await simulateScenarioImpact(id);
    const forecast = forecastScenarioOutcomes(impact);

    return res.json({
      scenario,
      impact,
      forecast,
    });
  } catch (error) {
    console.error('[reg-scenarios:get] error', error);
    return res.status(500).json({ error: 'scenario_fetch_failed' });
  }
});

/**
 * GET /api/reg-scenarios/:id/export
 * Export scenario
 */
router.get('/:id/export', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const scenario = await prisma.regScenario.findUnique({
      where: { id },
    });

    if (!scenario) {
      return res.status(404).json({ error: 'scenario_not_found' });
    }

    const impact = await simulateScenarioImpact(id);
    const forecast = forecastScenarioOutcomes(impact);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="scenario-${id}.json"`);
    return res.json({ scenario, impact, forecast });
  } catch (error) {
    console.error('[reg-scenarios:export] error', error);
    return res.status(500).json({ error: 'export_failed' });
  }
});

export default router;

