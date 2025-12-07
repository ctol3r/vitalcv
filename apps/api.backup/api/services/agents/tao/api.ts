const log = getServiceLogger('agents/tao/api');
/**
 * B119C-TAO-022: TAO oversight API endpoints
 *
 * Exposes endpoints for routing agent actions and managing HITL checkpoints
 */

import express, { Request, Response } from 'express';
import { getTAOService, AgentAction, ComplexityTier } from './oversight';
import { getServiceLogger } from '../../logging/serviceLogger';

const router = express.Router();
const taoService = getTAOService();

/**
 * POST /tao/route
 * Route an agent action through appropriate oversight tier
 */
router.post('/route', (req: Request, res: Response) => {
  try {
    const { agentId, actionType, complexity, payload } = req.body;

    if (!agentId || !actionType || !complexity) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'agentId, actionType, and complexity are required',
      });
    }

    const action: AgentAction = {
      agentId,
      actionType,
      complexity: complexity as ComplexityTier,
      payload: payload || {},
      timestamp: new Date(),
    };

    const decision = taoService.routeAction(action);

    res.json({
      decision,
      message: decision.requiresHITL
        ? 'Action requires human review'
        : `Action routed to ${decision.level} oversight`,
    });
  } catch (error: any) {
    log.error('TAO routing error:', error);
    res.status(500).json({
      error: 'routing_failed',
      error_description: error.message,
    });
  }
});

/**
 * GET /tao/checkpoints
 * Get pending HITL checkpoints
 */
router.get('/checkpoints', (req: Request, res: Response) => {
  try {
    const { agentId, status } = req.query;

    let checkpoints;
    if (agentId) {
      checkpoints = taoService.getCheckpointsByAgent(agentId as string);
    } else {
      checkpoints = taoService.getPendingCheckpoints();
    }

    if (status) {
      checkpoints = checkpoints.filter(c => c.status === status);
    }

    res.json({
      checkpoints,
      count: checkpoints.length,
    });
  } catch (error: any) {
    log.error('Checkpoint query error:', error);
    res.status(500).json({
      error: 'query_failed',
      error_description: error.message,
    });
  }
});

/**
 * GET /tao/checkpoints/:checkpointId
 * Get specific checkpoint
 */
router.get('/checkpoints/:checkpointId', (req: Request, res: Response) => {
  try {
    const { checkpointId } = req.params;
    const checkpoint = taoService.getCheckpoint(checkpointId);

    if (!checkpoint) {
      return res.status(404).json({ error: 'Checkpoint not found' });
    }

    res.json({ checkpoint });
  } catch (error: any) {
    log.error('Checkpoint query error:', error);
    res.status(500).json({
      error: 'query_failed',
      error_description: error.message,
    });
  }
});

/**
 * POST /tao/checkpoints/:checkpointId/review
 * Review a checkpoint (HITL decision)
 */
router.post('/checkpoints/:checkpointId/review', (req: Request, res: Response) => {
  try {
    const { checkpointId } = req.params;
    const { reviewerId, decision, notes } = req.body;

    if (!reviewerId || !decision) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'reviewerId and decision are required',
      });
    }

    if (!['approved', 'rejected', 'escalated'].includes(decision)) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'decision must be approved, rejected, or escalated',
      });
    }

    const checkpoint = taoService.reviewCheckpoint(
      checkpointId,
      reviewerId,
      decision,
      notes
    );

    res.json({
      message: 'Checkpoint reviewed',
      checkpoint,
    });
  } catch (error: any) {
    log.error('Checkpoint review error:', error);
    res.status(500).json({
      error: 'review_failed',
      error_description: error.message,
    });
  }
});

/**
 * GET /tao/actions
 * Get action log
 */
router.get('/actions', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const actions = taoService.getActionLog(limit);

    res.json({
      actions,
      count: actions.length,
    });
  } catch (error: any) {
    log.error('Action log query error:', error);
    res.status(500).json({
      error: 'query_failed',
      error_description: error.message,
    });
  }
});

/**
 * GET /tao/statistics
 * Get oversight statistics
 */
router.get('/statistics', (req: Request, res: Response) => {
  try {
    const stats = taoService.getStatistics();

    res.json({
      statistics: stats,
    });
  } catch (error: any) {
    log.error('Statistics query error:', error);
    res.status(500).json({
      error: 'query_failed',
      error_description: error.message,
    });
  }
});

export default router;

