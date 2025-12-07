const log = getServiceLogger('agents/policy/api');
/**
 * B119C-AI-021: Agent risk matrix API endpoints
 *
 * Exposes endpoints for querying agent risk assessments and NeuralTrust metrics
 */

import express, { Request, Response } from 'express';
import { getRiskMatrix, RiskAssessment } from './risk-matrix';
import { getServiceLogger } from '../../logging/serviceLogger';

const router = express.Router();
const riskMatrix = getRiskMatrix();

/**
 * GET /policy/risk-matrix
 * Get all agent risk assessments with tier summary
 */
router.get('/risk-matrix', (req: Request, res: Response) => {
  try {
    const assessments = riskMatrix.getAllAssessments();
    const tierSummary = riskMatrix.getTierSummary();

    res.json({
      assessments: assessments.map(a => ({
        agentId: a.agentId,
        tier: a.tier,
        concernScore: a.concernScore,
        riskFactorCount: a.riskFactors.length,
        lastAssessed: a.lastAssessed,
      })),
      tierSummary,
      summary: {
        total: assessments.length,
        reactive: assessments.filter(a => a.tier === 'Reactive').length,
        managed: assessments.filter(a => a.tier === 'Managed').length,
        proactive: assessments.filter(a => a.tier === 'Proactive').length,
        avgConcernScore: assessments.length > 0
          ? assessments.reduce((sum, a) => sum + a.concernScore, 0) / assessments.length
          : 0,
      },
    });
  } catch (error: any) {
    log.error('Risk matrix query error:', error);
    res.status(500).json({
      error: 'query_failed',
      error_description: error.message,
    });
  }
});

/**
 * GET /policy/risk-matrix/:agentId
 * Get detailed risk assessment for a specific agent
 */
router.get('/risk-matrix/:agentId', (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const assessment = riskMatrix.getAssessment(agentId);
    const neuralTrust = riskMatrix.getNeuralTrustMetrics(agentId);

    if (!assessment) {
      return res.status(404).json({ error: 'Agent assessment not found' });
    }

    res.json({
      assessment,
      neuralTrust,
    });
  } catch (error: any) {
    log.error('Risk assessment query error:', error);
    res.status(500).json({
      error: 'query_failed',
      error_description: error.message,
    });
  }
});

/**
 * POST /policy/risk-matrix/:agentId/assess
 * Trigger risk assessment for an agent
 */
router.post('/risk-matrix/:agentId/assess', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const telemetry = req.body.telemetry || {};

    const assessment = riskMatrix.assessAgent(agentId, telemetry);
    const neuralTrust = riskMatrix.getNeuralTrustMetrics(agentId);

    res.json({
      message: 'Risk assessment completed',
      assessment,
      neuralTrust,
    });
  } catch (error: any) {
    log.error('Risk assessment error:', error);
    res.status(500).json({
      error: 'assessment_failed',
      error_description: error.message,
    });
  }
});

export default router;

