/**
 * B119C-TAO-022: Tiered agentic oversight stack (TAO integration)
 *
 * Implements tiered routing by complexity with Human-In-The-Loop (HITL) checkpoints.
 * Routes agent actions through appropriate oversight tiers based on complexity and risk.
 */

export type ComplexityTier = 'low' | 'medium' | 'high' | 'critical';
export type OversightLevel = 'automated' | 'review' | 'approval' | 'blocked';

export interface AgentAction {
  agentId: string;
  actionType: string;
  complexity: ComplexityTier;
  payload: Record<string, unknown>;
  timestamp: Date;
}

export interface HITLCheckpoint {
  checkpointId: string;
  agentId: string;
  actionId: string;
  tier: ComplexityTier;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  reviewerId?: string;
  reviewedAt?: Date;
  evidence: string[];
  decision: string;
  createdAt: Date;
}

export interface OversightDecision {
  actionId: string;
  level: OversightLevel;
  checkpointId?: string;
  reason: string;
  requiresHITL: boolean;
}

/**
 * TAO (Tiered Agentic Oversight) service
 * Routes agent actions through appropriate oversight tiers
 */
export class TAOOversightService {
  private checkpoints: Map<string, HITLCheckpoint> = new Map();
  private actionLog: AgentAction[] = [];

  /**
   * Route action through appropriate oversight tier
   */
  routeAction(action: AgentAction): OversightDecision {
    // Determine oversight level based on complexity
    const level = this.determineOversightLevel(action.complexity, action.actionType);

    // Check if HITL checkpoint is required
    const requiresHITL = this.requiresHITL(action.complexity, action.actionType);

    let checkpointId: string | undefined;
    if (requiresHITL) {
      checkpointId = this.createCheckpoint(action);
    }

    // Log action
    this.actionLog.push(action);

    return {
      actionId: `${action.agentId}-${Date.now()}`,
      level,
      checkpointId,
      reason: this.getReason(action.complexity, action.actionType),
      requiresHITL,
    };
  }

  /**
   * Determine oversight level based on complexity and action type
   */
  private determineOversightLevel(
    complexity: ComplexityTier,
    actionType: string
  ): OversightLevel {
    // Critical complexity always requires approval
    if (complexity === 'critical') {
      return 'approval';
    }

    // High complexity requires review
    if (complexity === 'high') {
      return 'review';
    }

    // Sensitive action types require review regardless of complexity
    const sensitiveActions = ['data_access', 'external_api', 'file_write', 'credential_use'];
    if (sensitiveActions.includes(actionType)) {
      return complexity === 'medium' ? 'review' : 'approval';
    }

    // Medium complexity may require review
    if (complexity === 'medium') {
      return 'review';
    }

    // Low complexity can be automated
    return 'automated';
  }

  /**
   * Check if HITL checkpoint is required
   */
  private requiresHITL(complexity: ComplexityTier, actionType: string): boolean {
    // Always require HITL for critical
    if (complexity === 'critical') {
      return true;
    }

    // Require HITL for high complexity sensitive actions
    if (complexity === 'high') {
      const sensitiveActions = ['data_access', 'external_api', 'file_write', 'credential_use'];
      return sensitiveActions.includes(actionType);
    }

    // Require HITL for certain action types regardless of complexity
    const alwaysHITL = ['credential_use', 'external_api'];
    return alwaysHITL.includes(actionType);
  }

  /**
   * Create HITL checkpoint
   */
  private createCheckpoint(action: AgentAction): string {
    const checkpointId = `checkpoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const checkpoint: HITLCheckpoint = {
      checkpointId,
      agentId: action.agentId,
      actionId: `${action.agentId}-${Date.now()}`,
      tier: action.complexity,
      status: 'pending',
      evidence: this.collectEvidence(action),
      decision: '',
      createdAt: new Date(),
    };

    this.checkpoints.set(checkpointId, checkpoint);
    return checkpointId;
  }

  /**
   * Collect evidence for checkpoint
   */
  private collectEvidence(action: AgentAction): string[] {
    const evidence: string[] = [];

    evidence.push(`Action type: ${action.actionType}`);
    evidence.push(`Complexity tier: ${action.complexity}`);
    evidence.push(`Agent ID: ${action.agentId}`);
    evidence.push(`Timestamp: ${action.timestamp.toISOString()}`);

    // Add payload summary
    if (action.payload) {
      const payloadKeys = Object.keys(action.payload);
      evidence.push(`Payload keys: ${payloadKeys.join(', ')}`);
    }

    return evidence;
  }

  /**
   * Get reason for oversight level
   */
  private getReason(complexity: ComplexityTier, actionType: string): string {
    if (complexity === 'critical') {
      return 'Critical complexity requires approval';
    }
    if (complexity === 'high') {
      return 'High complexity requires review';
    }
    const sensitiveActions = ['data_access', 'external_api', 'file_write', 'credential_use'];
    if (sensitiveActions.includes(actionType)) {
      return `Sensitive action type (${actionType}) requires oversight`;
    }
    if (complexity === 'medium') {
      return 'Medium complexity may require review';
    }
    return 'Low complexity, automated processing';
  }

  /**
   * Review checkpoint (HITL decision)
   */
  reviewCheckpoint(
    checkpointId: string,
    reviewerId: string,
    decision: 'approved' | 'rejected' | 'escalated',
    notes?: string
  ): HITLCheckpoint {
    const checkpoint = this.checkpoints.get(checkpointId);

    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    checkpoint.status = decision;
    checkpoint.reviewerId = reviewerId;
    checkpoint.reviewedAt = new Date();
    checkpoint.decision = notes || decision;

    this.checkpoints.set(checkpointId, checkpoint);
    return checkpoint;
  }

  /**
   * Get checkpoint by ID
   */
  getCheckpoint(checkpointId: string): HITLCheckpoint | null {
    return this.checkpoints.get(checkpointId) || null;
  }

  /**
   * Get pending checkpoints
   */
  getPendingCheckpoints(): HITLCheckpoint[] {
    return Array.from(this.checkpoints.values())
      .filter(c => c.status === 'pending')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Get checkpoints by agent
   */
  getCheckpointsByAgent(agentId: string): HITLCheckpoint[] {
    return Array.from(this.checkpoints.values())
      .filter(c => c.agentId === agentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get action log
   */
  getActionLog(limit: number = 100): AgentAction[] {
    return this.actionLog
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get oversight statistics
   */
  getStatistics(): {
    totalActions: number;
    byLevel: Record<OversightLevel, number>;
    byComplexity: Record<ComplexityTier, number>;
    pendingCheckpoints: number;
    approvedCheckpoints: number;
    rejectedCheckpoints: number;
  } {
    const byLevel: Record<OversightLevel, number> = {
      automated: 0,
      review: 0,
      approval: 0,
      blocked: 0,
    };

    const byComplexity: Record<ComplexityTier, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const action of this.actionLog) {
      const decision = this.routeAction(action);
      byLevel[decision.level]++;
      byComplexity[action.complexity]++;
    }

    const checkpoints = Array.from(this.checkpoints.values());

    return {
      totalActions: this.actionLog.length,
      byLevel,
      byComplexity,
      pendingCheckpoints: checkpoints.filter(c => c.status === 'pending').length,
      approvedCheckpoints: checkpoints.filter(c => c.status === 'approved').length,
      rejectedCheckpoints: checkpoints.filter(c => c.status === 'rejected').length,
    };
  }
}

// Singleton instance
let taoService: TAOOversightService | null = null;

export function getTAOService(): TAOOversightService {
  if (!taoService) {
    taoService = new TAOOversightService();
  }
  return taoService;
}

