/**
 * B220C-GOV-012: GoalAlignmentEngine
 *
 * Ingests org objectives (quality, throughput, safety) and tunes scheduling
 * to maximize composite score. Aligns supervisor task priorities with
 * organizational goals.
 */

import { PrismaClient, SupervisorTaskType, SupervisorTaskStatus, JobQueueStatus } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';
import { adaptivePolicyManager, SupervisorPolicyV2 } from './adaptivePolicyManager.js';

const prisma = new PrismaClient();
const logger = createLogger({ service: 'goal-alignment-engine' });

/**
 * Organization objectives with weights
 */
export interface OrgObjectives {
  orgId: string;
  quality: {
    weight: number; // 0-1
    target: number; // Target quality score (0-1)
    current: number; // Current quality score (0-1)
  };
  throughput: {
    weight: number;
    target: number; // Target tasks per hour
    current: number; // Current tasks per hour
  };
  safety: {
    weight: number;
    target: number; // Target safety score (0-1)
    current: number; // Current safety score (0-1)
  };
  updatedAt: Date;
}

/**
 * Task contribution to objectives
 */
export interface TaskContribution {
  taskType: SupervisorTaskType;
  qualityImpact: number; // -1 to 1
  throughputImpact: number; // -1 to 1
  safetyImpact: number; // -1 to 1
}

/**
 * Default task contributions to objectives
 */
const DEFAULT_TASK_CONTRIBUTIONS: Record<SupervisorTaskType, TaskContribution> = {
  [SupervisorTaskType.RUN_DRIFT_SWEEP]: {
    taskType: SupervisorTaskType.RUN_DRIFT_SWEEP,
    qualityImpact: 0.3,
    throughputImpact: -0.2,
    safetyImpact: 0.4,
  },
  [SupervisorTaskType.RUN_SAFETY_SWEEP]: {
    taskType: SupervisorTaskType.RUN_SAFETY_SWEEP,
    qualityImpact: 0.2,
    throughputImpact: -0.3,
    safetyImpact: 0.8,
  },
  [SupervisorTaskType.RUN_COMPLIANCE]: {
    taskType: SupervisorTaskType.RUN_COMPLIANCE,
    qualityImpact: 0.4,
    throughputImpact: -0.1,
    safetyImpact: 0.3,
  },
  [SupervisorTaskType.RUN_PSV]: {
    taskType: SupervisorTaskType.RUN_PSV,
    qualityImpact: 0.5,
    throughputImpact: 0.1,
    safetyImpact: 0.2,
  },
  [SupervisorTaskType.RUN_FUSION]: {
    taskType: SupervisorTaskType.RUN_FUSION,
    qualityImpact: 0.6,
    throughputImpact: 0.2,
    safetyImpact: 0.1,
  },
  [SupervisorTaskType.RUN_MOBILITY]: {
    taskType: SupervisorTaskType.RUN_MOBILITY,
    qualityImpact: 0.1,
    throughputImpact: 0.3,
    safetyImpact: 0.0,
  },
  [SupervisorTaskType.RUN_EHR_SYNC]: {
    taskType: SupervisorTaskType.RUN_EHR_SYNC,
    qualityImpact: 0.2,
    throughputImpact: 0.4,
    safetyImpact: 0.1,
  },
  [SupervisorTaskType.RUN_NCI_PUBLISH]: {
    taskType: SupervisorTaskType.RUN_NCI_PUBLISH,
    qualityImpact: 0.3,
    throughputImpact: 0.2,
    safetyImpact: 0.0,
  },
  [SupervisorTaskType.RUN_PRIVILEGE_ISSUE]: {
    taskType: SupervisorTaskType.RUN_PRIVILEGE_ISSUE,
    qualityImpact: 0.4,
    throughputImpact: 0.5,
    safetyImpact: 0.2,
  },
};

/**
 * GoalAlignmentEngine tunes scheduling to maximize composite score
 */
export class GoalAlignmentEngine {
  private objectives: Map<string, OrgObjectives> = new Map();
  private taskContributions: Map<SupervisorTaskType, TaskContribution> = new Map(
    Object.entries(DEFAULT_TASK_CONTRIBUTIONS).map(([k, v]) => [k as SupervisorTaskType, v])
  );

  /**
   * Set organization objectives
   */
  setObjectives(orgId: string, objectives: Partial<OrgObjectives>): void {
    const existing = this.objectives.get(orgId) || this.createDefaultObjectives(orgId);
    const updated: OrgObjectives = {
      ...existing,
      ...objectives,
      quality: { ...existing.quality, ...objectives.quality },
      throughput: { ...existing.throughput, ...objectives.throughput },
      safety: { ...existing.safety, ...objectives.safety },
      updatedAt: new Date(),
    };
    this.objectives.set(orgId, updated);
    logger.info('Updated org objectives', { orgId, objectives: updated });
  }

  /**
   * Get organization objectives
   */
  getObjectives(orgId: string): OrgObjectives | null {
    return this.objectives.get(orgId) || null;
  }

  /**
   * Calculate composite score for current objectives
   */
  calculateCompositeScore(orgId: string): number {
    const obj = this.objectives.get(orgId);
    if (!obj) return 0;

    // Normalize each dimension (current / target)
    const qualityScore = obj.quality.target > 0 ? obj.quality.current / obj.quality.target : 0;
    const throughputScore =
      obj.throughput.target > 0 ? obj.throughput.current / obj.throughput.target : 0;
    const safetyScore = obj.safety.target > 0 ? obj.safety.current / obj.safety.target : 0;

    // Weighted composite score
    const composite =
      qualityScore * obj.quality.weight +
      throughputScore * obj.throughput.weight +
      safetyScore * obj.safety.weight;

    return Math.min(1.0, composite); // Cap at 1.0
  }

  /**
   * Tune scheduling priorities based on objectives
   */
  async tuneScheduling(orgId: string): Promise<SupervisorPolicyV2> {
    const obj = this.objectives.get(orgId);
    if (!obj) {
      logger.warn('No objectives found for org', { orgId });
      return adaptivePolicyManager.getPolicy();
    }

    const currentPolicy = adaptivePolicyManager.getPolicy();
    const adjustedPriorities: Record<SupervisorTaskType, number> = { ...currentPolicy.taskPriorities };

    // Calculate gaps for each objective
    const qualityGap = obj.quality.target - obj.quality.current;
    const throughputGap = obj.throughput.target - obj.throughput.current;
    const safetyGap = obj.safety.target - obj.safety.current;

    // Adjust priorities based on gaps and task contributions
    for (const [taskType, contribution] of this.taskContributions.entries()) {
      let priorityAdjustment = 0;

      // Quality adjustment
      if (qualityGap > 0) {
        priorityAdjustment += contribution.qualityImpact * qualityGap * obj.quality.weight * 20;
      }

      // Throughput adjustment
      if (throughputGap > 0) {
        priorityAdjustment +=
          contribution.throughputImpact * (throughputGap / obj.throughput.target) *
          obj.throughput.weight *
          20;
      }

      // Safety adjustment
      if (safetyGap > 0) {
        priorityAdjustment += contribution.safetyImpact * safetyGap * obj.safety.weight * 20;
      }

      // Apply adjustment
      const currentPriority = adjustedPriorities[taskType];
      adjustedPriorities[taskType] = Math.max(
        0,
        Math.min(200, currentPriority + priorityAdjustment)
      );
    }

    // Update policy
    adaptivePolicyManager.updatePolicy({ taskPriorities: adjustedPriorities });

    logger.info('Tuned scheduling for org objectives', {
      orgId,
      compositeScore: this.calculateCompositeScore(orgId),
      qualityGap,
      throughputGap,
      safetyGap,
    });

    return adaptivePolicyManager.getPolicy();
  }

  /**
   * Update current metrics for objectives (should be called periodically)
   */
  async updateCurrentMetrics(orgId: string): Promise<void> {
    const obj = this.objectives.get(orgId);
    if (!obj) return;

    // Calculate current quality score from recent task outcomes
    const qualityScore = await this.calculateCurrentQuality(orgId);

    // Calculate current throughput (tasks per hour)
    const throughput = await this.calculateCurrentThroughput(orgId);

    // Calculate current safety score
    const safetyScore = await this.calculateCurrentSafety(orgId);

    const updated: OrgObjectives = {
      ...obj,
      quality: { ...obj.quality, current: qualityScore },
      throughput: { ...obj.throughput, current: throughput },
      safety: { ...obj.safety, current: safetyScore },
      updatedAt: new Date(),
    };

    this.objectives.set(orgId, updated);
    logger.debug('Updated current metrics', { orgId, qualityScore, throughput, safetyScore });
  }

  /**
   * Get alignment metrics for an organization
   */
  getAlignmentMetrics(orgId: string): {
    compositeScore: number;
    qualityAlignment: number;
    throughputAlignment: number;
    safetyAlignment: number;
    recommendations: string[];
  } {
    const obj = this.objectives.get(orgId);
    if (!obj) {
      return {
        compositeScore: 0,
        qualityAlignment: 0,
        throughputAlignment: 0,
        safetyAlignment: 0,
        recommendations: ['Set organization objectives'],
      };
    }

    const qualityAlignment = obj.quality.target > 0 ? obj.quality.current / obj.quality.target : 0;
    const throughputAlignment =
      obj.throughput.target > 0 ? obj.throughput.current / obj.throughput.target : 0;
    const safetyAlignment = obj.safety.target > 0 ? obj.safety.current / obj.safety.target : 0;

    const recommendations: string[] = [];
    if (qualityAlignment < 0.9) {
      recommendations.push('Increase quality-focused task priorities');
    }
    if (throughputAlignment < 0.9) {
      recommendations.push('Increase throughput-focused task priorities');
    }
    if (safetyAlignment < 0.9) {
      recommendations.push('Increase safety-focused task priorities');
    }

    return {
      compositeScore: this.calculateCompositeScore(orgId),
      qualityAlignment,
      throughputAlignment,
      safetyAlignment,
      recommendations,
    };
  }

  /**
   * Update task contribution mapping
   */
  updateTaskContribution(taskType: SupervisorTaskType, contribution: Partial<TaskContribution>): void {
    const existing = this.taskContributions.get(taskType) || {
      taskType,
      qualityImpact: 0,
      throughputImpact: 0,
      safetyImpact: 0,
    };
    this.taskContributions.set(taskType, { ...existing, ...contribution });
    logger.info('Updated task contribution', { taskType, contribution });
  }

  private createDefaultObjectives(orgId: string): OrgObjectives {
    return {
      orgId,
      quality: { weight: 0.4, target: 0.95, current: 0.9 },
      throughput: { weight: 0.3, target: 100, current: 80 },
      safety: { weight: 0.3, target: 0.98, current: 0.95 },
      updatedAt: new Date(),
    };
  }

  private async calculateCurrentQuality(orgId: string): Promise<number> {
    // Calculate quality score from recent successful task completions
    const recentTasks = await prisma.supervisorTask.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
      },
      take: 100,
    });

    if (recentTasks.length === 0) return 0.9; // Default

    const completed = recentTasks.filter(
      (t) => t.status === SupervisorTaskStatus.COMPLETED && !t.error
    ).length;
    return completed / recentTasks.length;
  }

  private async calculateCurrentThroughput(orgId: string): Promise<number> {
    // Calculate tasks per hour from recent completions
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const completedTasks = await prisma.supervisorTask.count({
      where: {
        status: SupervisorTaskStatus.COMPLETED,
        completedAt: { gte: oneHourAgo },
      },
    });

    return completedTasks; // Tasks per hour
  }

  private async calculateCurrentSafety(orgId: string): Promise<number> {
    // Calculate safety score from safety-related task outcomes
    const recentSafetyTasks = await prisma.supervisorTask.findMany({
      where: {
        taskType: SupervisorTaskType.RUN_SAFETY_SWEEP,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      take: 50,
    });

    if (recentSafetyTasks.length === 0) return 0.95; // Default

    const successful = recentSafetyTasks.filter(
      (t) => t.status === SupervisorTaskStatus.COMPLETED && !t.error
    ).length;
    return successful / recentSafetyTasks.length;
  }
}

// Export singleton instance
export const goalAlignmentEngine = new GoalAlignmentEngine();

