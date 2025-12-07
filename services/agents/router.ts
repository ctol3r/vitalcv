/**
 * Agent Router - B140B-AGENT-018
 *
 * Policy-driven router for matching agents to tasks based on:
 * - Task specifications (required capabilities, scopes)
 * - Risk level requirements
 * - Agent capabilities and risk tier
 * - Load balancing and rate limits
 */

import { z } from 'zod';
import { registry, AgentScope, RiskTier, type AgentRecord } from './registry';

// ============================================================
// SCHEMAS & TYPES
// ============================================================

export const TaskSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  requiredCapabilities: z.array(z.string()),
  requiredScopes: z.array(z.nativeEnum(AgentScope)),
  riskLevel: z.nativeEnum(RiskTier),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  estimatedTokens: z.number().optional(),
  timeout: z.number().optional(), // milliseconds
  metadata: z.record(z.any()).optional(),
});

export type TaskSpec = z.infer<typeof TaskSpecSchema>;

export const RoutingResultSchema = z.object({
  taskId: z.string(),
  selectedAgent: z.string().optional(),
  selectedAgents: z.array(z.string()).optional(),
  reason: z.string(),
  score: z.number().optional(),
  alternatives: z.array(z.object({
    agentId: z.string(),
    score: z.number(),
    reason: z.string(),
  })).default([]),
  timestamp: z.date().default(() => new Date()),
});

export type RoutingResult = z.infer<typeof RoutingResultSchema>;

export interface RoutingPolicy {
  allowRiskEscalation: boolean;  // Allow routing to higher risk tier agents
  requireExactMatch: boolean;    // Require exact capability match
  maxCandidates: number;         // Max number of candidate agents to consider
  preferredProviders?: string[]; // Preferred agent providers
  excludedAgents?: string[];     // Agents to exclude from routing
}

// ============================================================
// SCORING CRITERIA
// ============================================================

interface ScoringWeights {
  capabilityMatch: number;
  riskAlignment: number;
  scopeMatch: number;
  availability: number;
  performance: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  capabilityMatch: 0.40,
  riskAlignment: 0.25,
  scopeMatch: 0.20,
  availability: 0.10,
  performance: 0.05,
};

// ============================================================
// AGENT ROUTER CLASS
// ============================================================

export class AgentRouter {
  private static instance: AgentRouter;
  private agentLoadMap: Map<string, number> = new Map();
  private routingHistory: RoutingResult[] = [];

  private constructor() {}

  static getInstance(): AgentRouter {
    if (!AgentRouter.instance) {
      AgentRouter.instance = new AgentRouter();
    }
    return AgentRouter.instance;
  }

  /**
   * Route a task to the most appropriate agent(s)
   */
  async route(
    taskSpec: TaskSpec,
    policy: Partial<RoutingPolicy> = {}
  ): Promise<RoutingResult> {
    const validated = TaskSpecSchema.parse(taskSpec);
    const fullPolicy = this.buildPolicy(policy);

    // Get candidate agents
    const candidates = this.getCandidateAgents(validated, fullPolicy);

    if (candidates.length === 0) {
      return {
        taskId: validated.id,
        reason: 'No agents found matching task requirements',
        timestamp: new Date(),
        alternatives: [],
      };
    }

    // Score candidates
    const scoredCandidates = candidates.map(agent => ({
      agent,
      score: this.scoreAgent(agent, validated, fullPolicy),
    }));

    // Sort by score (descending)
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Select best agent
    const bestCandidate = scoredCandidates[0];

    const result: RoutingResult = {
      taskId: validated.id,
      selectedAgent: bestCandidate.agent.id,
      reason: this.generateRoutingReason(bestCandidate.agent, validated),
      score: bestCandidate.score,
      alternatives: scoredCandidates.slice(1, fullPolicy.maxCandidates).map(c => ({
        agentId: c.agent.id,
        score: c.score,
        reason: this.generateRoutingReason(c.agent, validated),
      })),
      timestamp: new Date(),
    };

    this.recordRouting(result);
    return result;
  }

  /**
   * Route a task to multiple agents (for multi-agent workflows)
   */
  async routeMulti(
    taskSpec: TaskSpec,
    count: number,
    policy: Partial<RoutingPolicy> = {}
  ): Promise<RoutingResult> {
    const validated = TaskSpecSchema.parse(taskSpec);
    const fullPolicy = this.buildPolicy(policy);

    const candidates = this.getCandidateAgents(validated, fullPolicy);

    if (candidates.length === 0) {
      return {
        taskId: validated.id,
        reason: 'No agents found matching task requirements',
        timestamp: new Date(),
        alternatives: [],
      };
    }

    // Score and sort candidates
    const scoredCandidates = candidates
      .map(agent => ({
        agent,
        score: this.scoreAgent(agent, validated, fullPolicy),
      }))
      .sort((a, b) => b.score - a.score);

    // Select top N agents
    const selected = scoredCandidates.slice(0, Math.min(count, candidates.length));

    const result: RoutingResult = {
      taskId: validated.id,
      selectedAgents: selected.map(c => c.agent.id),
      reason: `Selected ${selected.length} agents for multi-agent task`,
      score: selected.reduce((sum, c) => sum + c.score, 0) / selected.length,
      alternatives: scoredCandidates.slice(count).map(c => ({
        agentId: c.agent.id,
        score: c.score,
        reason: this.generateRoutingReason(c.agent, validated),
      })),
      timestamp: new Date(),
    };

    this.recordRouting(result);
    return result;
  }

  /**
   * Get candidate agents matching task requirements
   */
  private getCandidateAgents(taskSpec: TaskSpec, policy: RoutingPolicy): AgentRecord[] {
    let candidates = registry.getEnabled();

    // Filter by excluded agents
    if (policy.excludedAgents && policy.excludedAgents.length > 0) {
      candidates = candidates.filter(a => !policy.excludedAgents!.includes(a.id));
    }

    // Filter by preferred providers
    if (policy.preferredProviders && policy.preferredProviders.length > 0) {
      const preferred = candidates.filter(a => policy.preferredProviders!.includes(a.provider));
      if (preferred.length > 0) {
        candidates = preferred;
      }
    }

    // Filter by risk tier
    candidates = candidates.filter(agent => {
      if (policy.allowRiskEscalation) {
        return this.compareRiskTier(agent.riskTier, taskSpec.riskLevel) >= 0;
      } else {
        return agent.riskTier === taskSpec.riskLevel;
      }
    });

    // Filter by required scopes
    candidates = candidates.filter(agent =>
      taskSpec.requiredScopes.every(scope => agent.scopes.includes(scope))
    );

    // Filter by required capabilities
    if (policy.requireExactMatch) {
      candidates = candidates.filter(agent =>
        taskSpec.requiredCapabilities.every(cap => agent.capabilities.includes(cap))
      );
    } else {
      candidates = candidates.filter(agent =>
        taskSpec.requiredCapabilities.some(cap => agent.capabilities.includes(cap))
      );
    }

    return candidates;
  }

  /**
   * Score an agent for a given task
   */
  private scoreAgent(
    agent: AgentRecord,
    taskSpec: TaskSpec,
    policy: RoutingPolicy
  ): number {
    const weights = DEFAULT_WEIGHTS;
    let score = 0;

    // Capability match score
    const capabilityScore = this.scoreCapabilityMatch(agent, taskSpec);
    score += capabilityScore * weights.capabilityMatch;

    // Risk alignment score
    const riskScore = this.scoreRiskAlignment(agent, taskSpec);
    score += riskScore * weights.riskAlignment;

    // Scope match score
    const scopeScore = this.scoreScopeMatch(agent, taskSpec);
    score += scopeScore * weights.scopeMatch;

    // Availability score (based on current load)
    const availabilityScore = this.scoreAvailability(agent);
    score += availabilityScore * weights.availability;

    // Performance score (historical success rate)
    const performanceScore = this.scorePerformance(agent);
    score += performanceScore * weights.performance;

    return score;
  }

  /**
   * Score capability match
   */
  private scoreCapabilityMatch(agent: AgentRecord, taskSpec: TaskSpec): number {
    const matchedCapabilities = taskSpec.requiredCapabilities.filter(cap =>
      agent.capabilities.includes(cap)
    );

    if (taskSpec.requiredCapabilities.length === 0) return 1.0;

    return matchedCapabilities.length / taskSpec.requiredCapabilities.length;
  }

  /**
   * Score risk alignment
   */
  private scoreRiskAlignment(agent: AgentRecord, taskSpec: TaskSpec): number {
    const comparison = this.compareRiskTier(agent.riskTier, taskSpec.riskLevel);

    if (comparison === 0) return 1.0;  // Perfect match
    if (comparison > 0) return 0.8;    // Agent can handle higher risk
    return 0.4;                         // Agent below required risk level
  }

  /**
   * Score scope match
   */
  private scoreScopeMatch(agent: AgentRecord, taskSpec: TaskSpec): number {
    const matchedScopes = taskSpec.requiredScopes.filter(scope =>
      agent.scopes.includes(scope)
    );

    if (taskSpec.requiredScopes.length === 0) return 1.0;

    return matchedScopes.length / taskSpec.requiredScopes.length;
  }

  /**
   * Score availability (inverse of current load)
   */
  private scoreAvailability(agent: AgentRecord): number {
    const load = this.agentLoadMap.get(agent.id) || 0;
    const maxLoad = agent.rateLimit?.requestsPerMinute || 100;

    return 1.0 - (load / maxLoad);
  }

  /**
   * Score performance (placeholder for historical metrics)
   */
  private scorePerformance(agent: AgentRecord): number {
    // TODO: Implement based on historical success rate
    return 0.8;
  }

  /**
   * Compare risk tiers
   */
  private compareRiskTier(agentTier: RiskTier, taskTier: RiskTier): number {
    const tierOrder = {
      [RiskTier.LOW]: 0,
      [RiskTier.MEDIUM]: 1,
      [RiskTier.HIGH]: 2,
      [RiskTier.CRITICAL]: 3,
    };

    return tierOrder[agentTier] - tierOrder[taskTier];
  }

  /**
   * Generate routing reason
   */
  private generateRoutingReason(agent: AgentRecord, taskSpec: TaskSpec): string {
    return `Selected ${agent.name} (${agent.provider}) - Risk: ${agent.riskTier}, Capabilities: ${agent.capabilities.join(', ')}`;
  }

  /**
   * Build full policy from partial
   */
  private buildPolicy(partial: Partial<RoutingPolicy>): RoutingPolicy {
    return {
      allowRiskEscalation: partial.allowRiskEscalation ?? true,
      requireExactMatch: partial.requireExactMatch ?? false,
      maxCandidates: partial.maxCandidates ?? 5,
      preferredProviders: partial.preferredProviders,
      excludedAgents: partial.excludedAgents,
    };
  }

  /**
   * Record routing decision
   */
  private recordRouting(result: RoutingResult): void {
    this.routingHistory.push(result);

    // Update load map
    if (result.selectedAgent) {
      const currentLoad = this.agentLoadMap.get(result.selectedAgent) || 0;
      this.agentLoadMap.set(result.selectedAgent, currentLoad + 1);
    }

    if (result.selectedAgents) {
      result.selectedAgents.forEach(agentId => {
        const currentLoad = this.agentLoadMap.get(agentId) || 0;
        this.agentLoadMap.set(agentId, currentLoad + 1);
      });
    }

    // Keep only recent history (last 1000 routings)
    if (this.routingHistory.length > 1000) {
      this.routingHistory = this.routingHistory.slice(-1000);
    }
  }

  /**
   * Get routing history
   */
  getHistory(limit?: number): RoutingResult[] {
    if (limit) {
      return this.routingHistory.slice(-limit);
    }
    return [...this.routingHistory];
  }

  /**
   * Get agent load
   */
  getAgentLoad(agentId: string): number {
    return this.agentLoadMap.get(agentId) || 0;
  }

  /**
   * Reset agent load (for testing or periodic reset)
   */
  resetLoad(agentId?: string): void {
    if (agentId) {
      this.agentLoadMap.delete(agentId);
    } else {
      this.agentLoadMap.clear();
    }
  }

  /**
   * Clear history (for testing)
   */
  clearHistory(): void {
    this.routingHistory = [];
  }
}

// ============================================================
// EXPORTS
// ============================================================

export const router = AgentRouter.getInstance();
export default router;

