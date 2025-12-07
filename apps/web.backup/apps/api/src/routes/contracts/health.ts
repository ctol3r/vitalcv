import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { classifyContractClauses } from '../../services/contracts/classify';
import { scoreContractRisk } from '../../services/contracts/risk-score';
import { analyzeContractFairness } from '../../services/contracts/fairness';
import { suggestRenegotiations } from '../../services/contracts/renegotiate';
import { getUpcomingRenewals, getExpiringContracts } from '../../services/contracts/lifecycle';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/contracts/health/:clinicianId/:employerId
 * Get contract health
 */
router.get('/:clinicianId/:employerId', async (req: Request, res: Response) => {
  try {
    const { clinicianId, employerId } = req.params;

    const contract = await prisma.contractHealth.findUnique({
      where: {
        clinicianId_employerId: {
          clinicianId,
          employerId,
        },
      },
    });

    if (!contract) {
      return res.status(404).json({
        error: 'contract_not_found',
        message: 'Contract health record not found',
      });
    }

    const health = contract.health as Record<string, unknown>;
    const contractText = (health.contractText as string) || '';

    // Classify and analyze
    const classified = contractText ? classifyContractClauses(contractText) : null;
    const riskScore = classified ? scoreContractRisk(classified) : null;
    const fairness = classified ? analyzeContractFairness(health, 'physician', 'us') : null;
    const suggestions = riskScore && fairness ? suggestRenegotiations(riskScore, fairness) : [];

    // Determine health status
    const overallHealth = riskScore && fairness
      ? riskScore.overall < 0.3 && fairness.score > 0.8 ? 'healthy' :
        riskScore.overall < 0.5 && fairness.score > 0.7 ? 'moderate' : 'unhealthy'
      : 'unknown';

    return res.json({
      contract,
      health: {
        overall: overallHealth,
        riskScore,
        fairness,
        suggestions,
        classified,
      },
    });
  } catch (error) {
    console.error('[contracts:health] error', error);
    return res.status(500).json({
      error: 'health_check_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

/**
 * GET /api/contracts/health/export/:clinicianId/:employerId
 * Export contract health
 */
router.get('/export/:clinicianId/:employerId', async (req: Request, res: Response) => {
  try {
    const { clinicianId, employerId } = req.params;

    const contract = await prisma.contractHealth.findUnique({
      where: {
        clinicianId_employerId: {
          clinicianId,
          employerId,
        },
      },
    });

    if (!contract) {
      return res.status(404).json({ error: 'contract_not_found' });
    }

    const format = (req.query.format as string) || 'json';

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="contract-health-${clinicianId}-${employerId}.json"`);
      return res.json(contract);
    }

    return res.status(400).json({ error: 'unsupported_format' });
  } catch (error) {
    console.error('[contracts:health:export] error', error);
    return res.status(500).json({ error: 'export_failed' });
  }
});

/**
 * GET /api/contracts/health/lifecycle/renewals
 * Get upcoming renewals
 */
router.get('/lifecycle/renewals', async (req: Request, res: Response) => {
  try {
    const daysAhead = req.query.daysAhead ? parseInt(req.query.daysAhead as string, 10) : 30;
    const renewals = await getUpcomingRenewals(daysAhead);
    return res.json(renewals);
  } catch (error) {
    console.error('[contracts:health:lifecycle] error', error);
    return res.status(500).json({ error: 'lifecycle_check_failed' });
  }
});

/**
 * GET /api/contracts/health/lifecycle/expiring
 * Get expiring contracts
 */
router.get('/lifecycle/expiring', async (req: Request, res: Response) => {
  try {
    const daysAhead = req.query.daysAhead ? parseInt(req.query.daysAhead as string, 10) : 30;
    const expiring = await getExpiringContracts(daysAhead);
    return res.json(expiring);
  } catch (error) {
    console.error('[contracts:health:lifecycle] error', error);
    return res.status(500).json({ error: 'lifecycle_check_failed' });
  }
});

export default router;

