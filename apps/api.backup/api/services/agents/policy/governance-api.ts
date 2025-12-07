const log = getServiceLogger('agents/policy/governance-api');
/**
 * B119A-AGOV-005: Agent governance tiering API endpoints
 *
 * Exposes endpoints for managing agent tier assignments and HITL triggers
 */

import express, { Request, Response } from 'express';
import { getGovernanceTiering, GovernanceTier } from './governance-tiering';
import { getServiceLogger } from '../../logging/serviceLogger';

const router = express.Router();
const governance = getGovernanceTiering();

/**
 * GET /policy/governance/tiers
 * Get all tier assignments and statistics
 */
router.get('/tiers', (req: Request, res: Response) => {
  try {
    const assignments = governance.getAllAssignments();
    const statistics = governance.getTierStatistics();

    res.json({
      assignments: assignments.map(a => ({
        agentId: a.agentId,
        tier: a.tier,
        assignedAt: a.assignedAt,
        assignedBy: a.assignedBy,
        reason: a.reason,
        privileges: {
          tier: a.privileges.tier,
          allowedActions: a.privileges.allowedActions,
          restrictedActions: a.privileges.restrictedActions,
          requiresHITL: a.privileges.requiresHITL,
          maxComplexity: a.privileges.maxComplexity,
          auditLevel: a.privileges.auditLevel,
          reviewFrequency: a.privileges.reviewFrequency,
        },
      })),
      statistics,
    });
  } catch (error: any) {
    log.error('Governance tier query error:', error);
    res.status(500).json({
      error: 'query_failed',
      error_description: error.message,
    });
  }
});

/**
 * GET /policy/governance/tiers/:agentId
 * Get tier assignment for specific agent
 */
router.get('/tiers/:agentId', (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const tier = governance.getTier(agentId);
    const privileges = governance.getPrivileges(agentId);

    if (!tier || !privileges) {
      return res.status(404).json({ error: 'Agent not assigned to a tier' });
    }

    res.json({
      agentId,
      tier,
      privileges,
    });
  } catch (error: any) {
    log.error('Tier query error:', error);
    res.status(500).json({
      error: 'query_failed',
      error_description: error.message,
    });
  }
});

/**
 * POST /policy/governance/tiers/:agentId/assign
 * Assign agent to governance tier
 */
router.post('/tiers/:agentId/assign', (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { tier, reason } = req.body;
    const assignedBy = (req as any).user?.id || 'system';

    if (!tier || !['A', 'B', 'C', 'D'].includes(tier)) {
      return res.status(400).json({
        error: 'invalid_tier',
        error_description: 'Tier must be A, B, C, or D',
      });
    }

    const assignment = governance.assignTier(agentId, tier as GovernanceTier, assignedBy, reason || 'Manual assignment');

    res.json({
      message: 'Agent assigned to tier',
      assignment: {
        agentId: assignment.agentId,
        tier: assignment.tier,
        assignedAt: assignment.assignedAt,
        assignedBy: assignment.assignedBy,
        reason: assignment.reason,
      },
    });
  } catch (error: any) {
    log.error('Tier assignment error:', error);
    res.status(500).json({
      error: 'assignment_failed',
      error_description: error.message,
    });
  }
});

/**
 * POST /policy/governance/tiers/:agentId/upgrade
 * Upgrade agent tier (requires approval)
 */
router.post('/tiers/:agentId/upgrade', (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { tier, reason } = req.body;
    const approvedBy = (req as any).user?.id || 'system';

    if (!tier || !['A', 'B', 'C', 'D'].includes(tier)) {
      return res.status(400).json({
        error: 'invalid_tier',
        error_description: 'Tier must be A, B, C, or D',
      });
    }

    const assignment = governance.upgradeTier(agentId, tier as GovernanceTier, approvedBy, reason || 'Tier upgrade');

    res.json({
      message: 'Agent tier upgraded',
      assignment: {
        agentId: assignment.agentId,
        tier: assignment.tier,
        assignedAt: assignment.assignedAt,
        assignedBy: assignment.assignedBy,
        reason: assignment.reason,
      },
    });
  } catch (error: any) {
    log.error('Tier upgrade error:', error);
    res.status(500).json({
      error: 'upgrade_failed',
      error_description: error.message,
    });
  }
});

/**
 * POST /policy/governance/tiers/:agentId/downgrade
 * Downgrade agent tier (can be automatic)
 */
router.post('/tiers/:agentId/downgrade', (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { tier, reason } = req.body;

    if (!tier || !['A', 'B', 'C', 'D'].includes(tier)) {
      return res.status(400).json({
        error: 'invalid_tier',
        error_description: 'Tier must be A, B, C, or D',
      });
    }

    const assignment = governance.downgradeTier(agentId, tier as GovernanceTier, reason || 'Risk-based downgrade');

    res.json({
      message: 'Agent tier downgraded',
      assignment: {
        agentId: assignment.agentId,
        tier: assignment.tier,
        assignedAt: assignment.assignedAt,
        assignedBy: assignment.assignedBy,
        reason: assignment.reason,
      },
    });
  } catch (error: any) {
    log.error('Tier downgrade error:', error);
    res.status(500).json({
      error: 'downgrade_failed',
      error_description: error.message,
    });
  }
});

/**
 * POST /policy/governance/actions/check
 * Check if action is allowed for agent
 */
router.post('/actions/check', (req: Request, res: Response) => {
  try {
    const { agentId, actionType } = req.body;

    if (!agentId || !actionType) {
      return res.status(400).json({
        error: 'missing_parameters',
        error_description: 'agentId and actionType are required',
      });
    }

    const check = governance.isActionAllowed(agentId, actionType);

    res.json({
      allowed: check.allowed,
      reason: check.reason,
      requiresHITL: check.requiresHITL,
    });
  } catch (error: any) {
    log.error('Action check error:', error);
    res.status(500).json({
      error: 'check_failed',
      error_description: error.message,
    });
  }
});

/**
 * GET /policy/governance/hitl-triggers
 * Get HITL triggers (optionally filtered by agent)
 */
router.get('/hitl-triggers', (req: Request, res: Response) => {
  try {
    const { agentId } = req.query;
    const triggers = governance.getHITLTriggers(agentId as string | undefined);

    res.json({
      triggers: triggers.map(t => ({
        agentId: t.agentId,
        actionType: t.actionType,
        tier: t.tier,
        reason: t.reason,
        checkpointId: t.checkpointId,
        timestamp: t.timestamp,
      })),
      count: triggers.length,
    });
  } catch (error: any) {
    log.error('HITL triggers query error:', error);
    res.status(500).json({
      error: 'query_failed',
      error_description: error.message,
    });
  }
});

export default router;

