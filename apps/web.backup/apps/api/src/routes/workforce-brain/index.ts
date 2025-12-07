import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Task 501.30 — /api/routing/brain
router.get('/brain', async (req: Request, res: Response) => {
  try {
    const { region } = req.query;

    const brain = await prisma.workforceBrain.findFirst({
      where: region ? { region: region as string } : undefined,
      orderBy: { updatedAt: 'desc' },
    });

    if (!brain) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Workforce brain not found for the specified region',
      });
    }

    return res.json({
      id: brain.id,
      region: brain.region,
      nodes: brain.nodes,
      edges: brain.edges,
      weights: brain.weights,
      updatedAt: brain.updatedAt,
    });
  } catch (error) {
    console.error('[routing/brain] error:', error);
    return res.status(500).json({
      error: 'brain_fetch_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

// Task 501.11-501.17 — Predictive Mobility endpoints
router.get('/mobility/:clinicianId', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;

    const migrationProbabilities = await prisma.migrationProbability.findMany({
      where: { clinicianId },
      orderBy: { probability: 'desc' },
      take: 10,
    });

    const deploymentOracle = await prisma.deploymentOracle.findUnique({
      where: { clinicianId },
    });

    const routingMatrix = await prisma.readinessRoutingMatrix.findUnique({
      where: { clinicianId },
    });

    return res.json({
      clinicianId,
      migrationProbabilities: migrationProbabilities.map(mp => ({
        fromRegion: mp.fromRegion,
        toRegion: mp.toRegion,
        probability: mp.probability,
        factors: mp.factors,
      })),
      deploymentOracle: deploymentOracle ? {
        next90Days: deploymentOracle.next90Days,
        confidence: deploymentOracle.confidence,
      } : null,
      routingMatrix: routingMatrix ? routingMatrix.matrix : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[routing/mobility] error:', error);
    return res.status(500).json({
      error: 'mobility_fetch_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

// Task 501.18-501.23 — Compliance Immunity endpoints
router.get('/compliance-immunity/:region', async (req: Request, res: Response) => {
  try {
    const { region } = req.params;

    const shield = await prisma.adaptiveRegulatoryShield.findUnique({
      where: { region },
    });

    const anomalies = await prisma.ruleflowAnomaly.findMany({
      where: { ruleflowId: region },
      orderBy: { detectedAt: 'desc' },
      take: 10,
    });

    const susceptibility = await prisma.ruleDiffSusceptibility.findUnique({
      where: { region },
    });

    const flowImpact = await prisma.regulatoryFlowImpact.findUnique({
      where: { region },
    });

    return res.json({
      region,
      shield: shield ? {
        level: shield.shieldLevel,
        rules: shield.rules,
      } : null,
      anomalies: anomalies.map(a => ({
        type: a.anomalyType,
        severity: a.severity,
        detectedAt: a.detectedAt,
      })),
      susceptibility: susceptibility ? {
        score: susceptibility.susceptibility,
        factors: susceptibility.factors,
      } : null,
      flowImpact: flowImpact ? {
        impact: flowImpact.impact,
        predictedAt: flowImpact.predictedAt,
      } : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[routing/compliance-immunity] error:', error);
    return res.status(500).json({
      error: 'immunity_fetch_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

// Task 501.24-501.29 — System Convergence endpoints
router.get('/convergence', async (req: Request, res: Response) => {
  try {
    const { region, mapType } = req.query;

    const convergenceMaps = await prisma.convergenceMap.findMany({
      where: {
        ...(mapType ? { mapType: mapType as string } : {}),
      },
      orderBy: { convergence: 'desc' },
      take: 10,
    });

    const forecasts = await prisma.convergenceForecast.findMany({
      where: region ? { region: region as string } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const orchestration = await prisma.systemConvergenceOrchestration.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    return res.json({
      maps: convergenceMaps.map(cm => ({
        type: cm.mapType,
        convergence: cm.convergence,
        map: cm.map,
      })),
      forecasts: forecasts.map(cf => ({
        region: cf.region,
        forecast: cf.forecast,
        timeHorizon: cf.timeHorizon,
        confidence: cf.confidence,
      })),
      orchestration: orchestration ? {
        status: orchestration.status,
        orchestration: orchestration.orchestration,
      } : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[routing/convergence] error:', error);
    return res.status(500).json({
      error: 'convergence_fetch_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;

