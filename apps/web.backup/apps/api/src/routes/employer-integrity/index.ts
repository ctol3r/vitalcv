import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Task 500.42 — /api/employer/behavioral-circuit
router.get('/behavioral-circuit/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    const circuitGraph = await prisma.behavioralCircuitGraph.findUnique({
      where: { orgId },
    });

    const behaviorFrequencies = await prisma.employerBehaviorFrequency.findMany({
      where: { orgId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    const ethicalCircuits = await prisma.ethicalCircuitActivation.findMany({
      where: { orgId },
      orderBy: { detectedAt: 'desc' },
      take: 10,
    });

    const biasRecurrences = await prisma.biasRecurrence.findMany({
      where: { orgId },
      orderBy: { lastOccurred: 'desc' },
      take: 10,
    });

    return res.json({
      orgId,
      circuit: circuitGraph ? {
        nodes: circuitGraph.nodes,
        edges: circuitGraph.edges,
        updatedAt: circuitGraph.updatedAt,
      } : null,
      behaviorFrequencies: behaviorFrequencies.map(bf => ({
        type: bf.behaviorType,
        frequency: bf.frequency,
        period: bf.period,
      })),
      ethicalCircuits: ethicalCircuits.map(ec => ({
        type: ec.circuitType,
        activated: ec.activated,
        confidence: ec.confidence,
        detectedAt: ec.detectedAt,
      })),
      biasRecurrences: biasRecurrences.map(br => ({
        type: br.biasType,
        occurrences: br.occurrences,
        severity: br.severity,
        lastOccurred: br.lastOccurred,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[employer/behavioral-circuit] error:', error);
    return res.status(500).json({
      error: 'circuit_fetch_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

// Task 500.25-500.30 — Drift Management endpoints
router.get('/drift/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    const driftRadar = await prisma.ethicalDriftRadar.findUnique({
      where: { orgId },
    });

    const fairnessForecast = await prisma.fairnessStabilityForecast.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });

    const quarantines = await prisma.behavioralQuarantine.findMany({
      where: { orgId, quarantined: true },
      orderBy: { quarantinedAt: 'desc' },
    });

    return res.json({
      orgId,
      drift: driftRadar ? {
        level: driftRadar.driftLevel,
        warningLevel: driftRadar.warningLevel,
        predictedDate: driftRadar.predictedDate,
      } : null,
      fairnessForecast: fairnessForecast ? {
        forecast: fairnessForecast.forecast,
        timeHorizon: fairnessForecast.timeHorizon,
        confidence: fairnessForecast.confidence,
      } : null,
      quarantinedBehaviors: quarantines.map(q => ({
        behaviorId: q.behaviorId,
        reason: q.reason,
        quarantinedAt: q.quarantinedAt,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[employer/drift] error:', error);
    return res.status(500).json({
      error: 'drift_fetch_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

// Task 500.13-500.18 — Regulatory Compliance endpoints
router.get('/compliance/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    const complianceChecks = await prisma.regulatorComplianceCheck.findMany({
      where: { orgId },
      orderBy: { checkedAt: 'desc' },
      take: 10,
    });

    const heatShocks = await prisma.complianceHeatShock.findMany({
      where: { orgId },
      orderBy: { detectedAt: 'desc' },
      take: 5,
    });

    return res.json({
      orgId,
      compliance: complianceChecks.map(cc => ({
        regulatorId: cc.regulatorId,
        score: cc.complianceScore,
        violations: cc.violations,
        checkedAt: cc.checkedAt,
      })),
      heatShocks: heatShocks.map(hs => ({
        type: hs.shockType,
        severity: hs.severity,
        predictedAt: hs.predictedAt,
        detectedAt: hs.detectedAt,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[employer/compliance] error:', error);
    return res.status(500).json({
      error: 'compliance_fetch_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;

