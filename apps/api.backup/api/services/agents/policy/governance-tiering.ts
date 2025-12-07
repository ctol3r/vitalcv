/**
 * B119A-AGOV-005: Agent governance tiering (TAO-style)
 *
 * Implements tiered governance system with four tiers (A-D):
 * - Tier A: Highest privileges, minimal restrictions
 * - Tier B: Standard privileges, moderate restrictions
 * - Tier C: Limited privileges, enhanced restrictions
 * - Tier D: Restricted privileges, maximum oversight
 *
 * HITL (Human-In-The-Loop) triggers on high-impact operations
 */

import { TAOOversightService, AgentAction, ComplexityTier, OversightLevel } from '../../tao/oversight';

export type GovernanceTier = 'A' | 'B' | 'C' | 'D';

export interface TierPrivileges {
  tier: GovernanceTier;
  allowedActions: string[];
  restrictedActions: string[];
  requiresHITL: string[];
  maxComplexity: ComplexityTier;
  auditLevel: 'minimal' | 'standard' | 'enhanced' | 'maximum';
  reviewFrequency: 'monthly' | 'weekly' | 'daily' | 'real-time';
}

export interface AgentTierAssignment {
  agentId: string;
  tier: GovernanceTier;
  assignedAt: Date;
  assignedBy: string;
  reason: string;
  privileges: TierPrivileges;
}

export interface HITLTrigger {
  agentId: string;
  actionType: string;
  tier: GovernanceTier;
  reason: string;
  checkpointId: string;
  timestamp: Date;
}

/**
 * Tier privilege definitions
 * B119A-AGOV-005: Tier A-D privileges with HITL triggers
 */
const TIER_PRIVILEGES: Record<GovernanceTier, TierPrivileges> = {
  A: {
    tier: 'A',
    allowedActions: [
      'data_read',
      'data_write',
      'external_api',
      'credential_use',
      'file_read',
      'file_write',
      'agent_delegate',
      'tool_execute',
    ],
    restrictedActions: [],
    requiresHITL: [
      'credential_use', // Always require HITL for credential operations
      'external_api', // External API calls need approval
    ],
    maxComplexity: 'critical',
    auditLevel: 'minimal',
    reviewFrequency: 'monthly',
  },
  B: {
    tier: 'B',
    allowedActions: [
      'data_read',
      'data_write',
      'external_api',
      'file_read',
      'file_write',
      'tool_execute',
    ],
    restrictedActions: [
      'credential_use', // Requires escalation
      'agent_delegate', // Requires escalation
    ],
    requiresHITL: [
      'credential_use',
      'external_api',
      'data_write', // Data writes need review
    ],
    maxComplexity: 'high',
    auditLevel: 'standard',
    reviewFrequency: 'weekly',
  },
  C: {
    tier: 'C',
    allowedActions: [
      'data_read',
      'file_read',
      'tool_execute',
    ],
    restrictedActions: [
      'credential_use',
      'agent_delegate',
      'external_api',
      'data_write',
      'file_write',
    ],
    requiresHITL: [
      'credential_use',
      'external_api',
      'data_write',
      'file_write',
      'tool_execute', // All tool executions need review
    ],
    maxComplexity: 'medium',
    auditLevel: 'enhanced',
    reviewFrequency: 'daily',
  },
  D: {
    tier: 'D',
    allowedActions: [
      'data_read', // Read-only access
    ],
    restrictedActions: [
      'credential_use',
      'agent_delegate',
      'external_api',
      'data_write',
      'file_write',
      'file_read', // Even reads are restricted
      'tool_execute',
    ],
    requiresHITL: [
      'credential_use',
      'external_api',
      'data_write',
      'file_write',
      'tool_execute',
      'data_read', // Even reads require HITL
    ],
    maxComplexity: 'low',
    auditLevel: 'maximum',
    reviewFrequency: 'real-time',
  },
};

/**
 * Agent Governance Tiering Service
 * B119A-AGOV-005: Enforces tier A-D privileges with HITL triggers
 */
export class AgentGovernanceTiering {
  private assignments: Map<string, AgentTierAssignment> = new Map();
  private hitlTriggers: HITLTrigger[] = [];
  private taoService: TAOOversightService;

  constructor(taoService: TAOOversightService) {
    this.taoService = taoService;
  }

  /**
   * Assign agent to governance tier
   */
  assignTier(
    agentId: string,
    tier: GovernanceTier,
    assignedBy: string,
    reason: string
  ): AgentTierAssignment {
    const assignment: AgentTierAssignment = {
      agentId,
      tier,
      assignedAt: new Date(),
      assignedBy,
      reason,
      privileges: TIER_PRIVILEGES[tier],
    };

    this.assignments.set(agentId, assignment);
    return assignment;
  }

  /**
   * Get agent tier assignment
   */
  getTier(agentId: string): GovernanceTier | null {
    const assignment = this.assignments.get(agentId);
    return assignment?.tier || null;
  }

  /**
   * Get agent privileges
   */
  getPrivileges(agentId: string): TierPrivileges | null {
    const assignment = this.assignments.get(agentId);
    return assignment?.privileges || null;
  }

  /**
   * Check if action is allowed for agent
   * B119A-AGOV-005: Enforces tier-based action restrictions
   */
  isActionAllowed(agentId: string, actionType: string): {
    allowed: boolean;
    reason: string;
    requiresHITL: boolean;
  } {
    const privileges = this.getPrivileges(agentId);

    if (!privileges) {
      return {
        allowed: false,
        reason: 'Agent not assigned to a governance tier',
        requiresHITL: true,
      };
    }

    // Check if action is restricted
    if (privileges.restrictedActions.includes(actionType)) {
      return {
        allowed: false,
        reason: `Action '${actionType}' is restricted for tier ${privileges.tier}`,
        requiresHITL: true,
      };
    }

    // Check if action is allowed
    if (!privileges.allowedActions.includes(actionType)) {
      return {
        allowed: false,
        reason: `Action '${actionType}' is not allowed for tier ${privileges.tier}`,
        requiresHITL: true,
      };
    }

    // Check if HITL is required
    const requiresHITL = privileges.requiresHITL.includes(actionType);

    return {
      allowed: true,
      reason: `Action allowed for tier ${privileges.tier}`,
      requiresHITL,
    };
  }

  /**
   * Route agent action through governance tiering
   * B119A-AGOV-005: Triggers HITL on high-impact operations
   */
  routeAction(agentId: string, action: AgentAction): {
    allowed: boolean;
    oversightLevel: OversightLevel;
    checkpointId?: string;
    reason: string;
    hitlTriggered: boolean;
  } {
    const privileges = this.getPrivileges(agentId);

    if (!privileges) {
      return {
        allowed: false,
        oversightLevel: 'blocked',
        reason: 'Agent not assigned to a governance tier',
        hitlTriggered: false,
      };
    }

    // Check complexity limit
    const complexityOrder: ComplexityTier[] = ['low', 'medium', 'high', 'critical'];
    const actionComplexityIndex = complexityOrder.indexOf(action.complexity);
    const maxComplexityIndex = complexityOrder.indexOf(privileges.maxComplexity);

    if (actionComplexityIndex > maxComplexityIndex) {
      return {
        allowed: false,
        oversightLevel: 'blocked',
        reason: `Action complexity '${action.complexity}' exceeds tier ${privileges.tier} limit of '${privileges.maxComplexity}'`,
        hitlTriggered: true,
      };
    }

    // Check if action is allowed
    const actionCheck = this.isActionAllowed(agentId, action.actionType);
    if (!actionCheck.allowed) {
      return {
        allowed: false,
        oversightLevel: 'blocked',
        reason: actionCheck.reason,
        hitlTriggered: actionCheck.requiresHITL,
      };
    }

    // Route through TAO service
    const taoDecision = this.taoService.routeAction(action);

    // Check if HITL is required
    const hitlRequired = actionCheck.requiresHITL || taoDecision.requiresHITL;

    if (hitlRequired && taoDecision.checkpointId) {
      // Record HITL trigger
      const trigger: HITLTrigger = {
        agentId,
        actionType: action.actionType,
        tier: privileges.tier,
        reason: `Tier ${privileges.tier} requires HITL for ${action.actionType}`,
        checkpointId: taoDecision.checkpointId,
        timestamp: new Date(),
      };
      this.hitlTriggers.push(trigger);
    }

    return {
      allowed: true,
      oversightLevel: taoDecision.level,
      checkpointId: taoDecision.checkpointId,
      reason: taoDecision.reason,
      hitlTriggered: hitlRequired,
    };
  }

  /**
   * Get HITL triggers for agent
   */
  getHITLTriggers(agentId?: string): HITLTrigger[] {
    if (agentId) {
      return this.hitlTriggers.filter(t => t.agentId === agentId);
    }
    return [...this.hitlTriggers];
  }

  /**
   * Get all tier assignments
   */
  getAllAssignments(): AgentTierAssignment[] {
    return Array.from(this.assignments.values());
  }

  /**
   * Get tier statistics
   */
  getTierStatistics(): Record<GovernanceTier, number> {
    const stats: Record<GovernanceTier, number> = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
    };

    for (const assignment of this.assignments.values()) {
      stats[assignment.tier]++;
    }

    return stats;
  }

  /**
   * Upgrade agent tier (requires approval)
   */
  upgradeTier(
    agentId: string,
    newTier: GovernanceTier,
    approvedBy: string,
    reason: string
  ): AgentTierAssignment {
    const current = this.assignments.get(agentId);
    const tierOrder: GovernanceTier[] = ['D', 'C', 'B', 'A'];
    const currentIndex = current ? tierOrder.indexOf(current.tier) : -1;
    const newIndex = tierOrder.indexOf(newTier);

    if (newIndex <= currentIndex) {
      throw new Error(`Cannot downgrade agent from tier ${current?.tier || 'unassigned'} to ${newTier}`);
    }

    return this.assignTier(agentId, newTier, approvedBy, reason);
  }

  /**
   * Downgrade agent tier (can be done automatically based on risk)
   */
  downgradeTier(
    agentId: string,
    newTier: GovernanceTier,
    reason: string
  ): AgentTierAssignment {
    return this.assignTier(agentId, newTier, 'system', reason);
  }
}

// Singleton instance
let governanceTiering: AgentGovernanceTiering | null = null;

export function getGovernanceTiering(): AgentGovernanceTiering {
  if (!governanceTiering) {
    const { getTAOService } = require('../../tao/oversight');
    governanceTiering = new AgentGovernanceTiering(getTAOService());
  }
  return governanceTiering;
}

