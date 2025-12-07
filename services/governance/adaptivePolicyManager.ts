/**
 * B220C-GOV-011: AdaptivePolicyManager
 *
 * Learns from outcomes and adjusts weights and thresholds in SupervisorPolicyV2
 * based on feedback loops. Uses reinforcement learning principles to optimize
 * policy parameters over time.
 */

import { PrismaClient, SupervisorTaskType, SupervisorTaskStatus } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';
import { getTaskPriority } from '../supervisor/policies/policyEngine.js';

const prisma = new PrismaClient();
const logger = createLogger({ service: 'adaptive-policy-manager' });

/**
 * Policy weights that can be adjusted based on outcomes
 */
export interface SupervisorPolicyV2 {
  taskPriorities: Record<SupervisorTaskType, number>;
  thresholds: {
    maxConcurrentTasks: number;
    maxPendingTasks: number;
    minSuccessRate: number;
    maxFailureRate: number;
  };
  blockingRules: Array<{
    blockedTask: SupervisorTaskType;
    blockingTasks: SupervisorTaskType[];
    weight: number; // How strictly to enforce (0-1)
  }>;
}

/**
 * Outcome metrics for learning
 */
export interface PolicyOutcome {
  taskType: SupervisorTaskType;
  success: boolean;
  duration: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    queueTime: number;
  };
  timestamp: Date;
}

/**
 * Feedback signal for policy adjustment
 */
export interface PolicyFeedback {
  taskType: SupervisorTaskType;
  outcome: 'success' | 'failure' | 'timeout' | 'resource_exhausted';
  impact: number; // -1 to 1, negative = bad, positive = good
  context: {
    concurrentTasks: number;
    queueDepth: number;
    systemLoad: number;
  };
}

/**
 * Learning configuration
 */
export interface LearningConfig {
  learningRate: number; // How fast to adapt (0-1)
  explorationRate: number; // Probability of trying different priorities (0-1)
  minSamples: number; // Minimum samples before adjusting
  decayRate: number; // How quickly old outcomes lose weight (0-1)
}

const DEFAULT_LEARNING_CONFIG: LearningConfig = {
  learningRate: 0.1,
  explorationRate: 0.05,
  minSamples: 10,
  decayRate: 0.95,
};

/**
 * Default policy configuration
 */
const DEFAULT_POLICY: SupervisorPolicyV2 = {
  taskPriorities: {
    [SupervisorTaskType.RUN_DRIFT_SWEEP]: 100,
    [SupervisorTaskType.RUN_SAFETY_SWEEP]: 80,
    [SupervisorTaskType.RUN_COMPLIANCE]: 60,
    [SupervisorTaskType.RUN_PSV]: 40,
    [SupervisorTaskType.RUN_FUSION]: 30,
    [SupervisorTaskType.RUN_MOBILITY]: 20,
    [SupervisorTaskType.RUN_EHR_SYNC]: 15,
    [SupervisorTaskType.RUN_NCI_PUBLISH]: 10,
    [SupervisorTaskType.RUN_PRIVILEGE_ISSUE]: 5,
  },
  thresholds: {
    maxConcurrentTasks: 10,
    maxPendingTasks: 100,
    minSuccessRate: 0.95,
    maxFailureRate: 0.05,
  },
  blockingRules: [
    {
      blockedTask: SupervisorTaskType.RUN_FUSION,
      blockingTasks: [SupervisorTaskType.RUN_SAFETY_SWEEP],
      weight: 1.0,
    },
  ],
};

/**
 * AdaptivePolicyManager learns from outcomes and adjusts policy parameters
 */
export class AdaptivePolicyManager {
  private policy: SupervisorPolicyV2;
  private config: LearningConfig;
  private outcomeHistory: PolicyOutcome[] = [];
  private feedbackHistory: PolicyFeedback[] = [];

  constructor(
    initialPolicy?: Partial<SupervisorPolicyV2>,
    learningConfig?: Partial<LearningConfig>
  ) {
    this.policy = {
      ...DEFAULT_POLICY,
      ...initialPolicy,
      taskPriorities: {
        ...DEFAULT_POLICY.taskPriorities,
        ...initialPolicy?.taskPriorities,
      },
      thresholds: {
        ...DEFAULT_POLICY.thresholds,
        ...initialPolicy?.thresholds,
      },
    };
    this.config = { ...DEFAULT_LEARNING_CONFIG, ...learningConfig };
  }

  /**
   * Record an outcome for learning
   */
  recordOutcome(outcome: PolicyOutcome): void {
    this.outcomeHistory.push(outcome);
    // Keep only recent outcomes (last 1000)
    if (this.outcomeHistory.length > 1000) {
      this.outcomeHistory = this.outcomeHistory.slice(-1000);
    }
    logger.debug('Recorded outcome', { taskType: outcome.taskType, success: outcome.success });
  }

  /**
   * Record feedback signal
   */
  recordFeedback(feedback: PolicyFeedback): void {
    this.feedbackHistory.push(feedback);
    // Keep only recent feedback (last 500)
    if (this.feedbackHistory.length > 500) {
      this.feedbackHistory = this.feedbackHistory.slice(-500);
    }
    logger.debug('Recorded feedback', { taskType: feedback.taskType, impact: feedback.impact });
  }

  /**
   * Learn from outcomes and adjust policy
   */
  async learnAndAdjust(): Promise<SupervisorPolicyV2> {
    // Get recent outcomes for each task type
    const taskOutcomes = this.groupOutcomesByTaskType();
    const taskFeedback = this.groupFeedbackByTaskType();

    // Adjust priorities based on success rates and feedback
    for (const [taskType, outcomes] of Object.entries(taskOutcomes)) {
      if (outcomes.length < this.config.minSamples) {
        continue; // Not enough data
      }

      const successRate = this.calculateSuccessRate(outcomes);
      const avgDuration = this.calculateAvgDuration(outcomes);
      const feedback = taskFeedback[taskType as SupervisorTaskType] || [];

      // Calculate adjustment factor
      let adjustment = 0;

      // Success rate adjustment
      if (successRate < this.policy.thresholds.minSuccessRate) {
        adjustment -= (this.policy.thresholds.minSuccessRate - successRate) * 2;
      } else if (successRate > this.policy.thresholds.minSuccessRate + 0.05) {
        adjustment += (successRate - this.policy.thresholds.minSuccessRate) * 0.5;
      }

      // Duration adjustment (faster = better)
      const normalizedDuration = avgDuration / (1000 * 60 * 60); // Normalize to hours
      if (normalizedDuration > 1) {
        adjustment -= 0.1; // Penalize slow tasks
      } else if (normalizedDuration < 0.5) {
        adjustment += 0.1; // Reward fast tasks
      }

      // Feedback adjustment
      const avgFeedback = feedback.length
        ? feedback.reduce((sum, f) => sum + f.impact, 0) / feedback.length
        : 0;
      adjustment += avgFeedback * 0.5;

      // Apply adjustment with learning rate
      const currentPriority = this.policy.taskPriorities[taskType as SupervisorTaskType];
      const newPriority = Math.max(
        0,
        Math.min(200, currentPriority + adjustment * this.config.learningRate * 10)
      );

      if (Math.abs(newPriority - currentPriority) > 0.1) {
        this.policy.taskPriorities[taskType as SupervisorTaskType] = newPriority;
        logger.info('Adjusted task priority', {
          taskType,
          oldPriority: currentPriority,
          newPriority,
          successRate,
          avgDuration,
        });
      }
    }

    // Adjust thresholds based on system performance
    await this.adjustThresholds();

    // Adjust blocking rule weights based on violations
    await this.adjustBlockingRules();

    return this.policy;
  }

  /**
   * Get current policy
   */
  getPolicy(): SupervisorPolicyV2 {
    return { ...this.policy };
  }

  /**
   * Update policy manually (for admin overrides)
   */
  updatePolicy(updates: Partial<SupervisorPolicyV2>): void {
    this.policy = {
      ...this.policy,
      ...updates,
      taskPriorities: {
        ...this.policy.taskPriorities,
        ...updates.taskPriorities,
      },
      thresholds: {
        ...this.policy.thresholds,
        ...updates.thresholds,
      },
    };
    logger.info('Policy updated manually', { updates });
  }

  /**
   * Get statistics about policy performance
   */
  getPolicyStats(): {
    taskStats: Record<string, { successRate: number; avgDuration: number; sampleCount: number }>;
    overallSuccessRate: number;
    policyVersion: string;
  } {
    const taskOutcomes = this.groupOutcomesByTaskType();
    const taskStats: Record<string, any> = {};

    let totalSuccesses = 0;
    let totalOutcomes = 0;

    for (const [taskType, outcomes] of Object.entries(taskOutcomes)) {
      const successRate = this.calculateSuccessRate(outcomes);
      const avgDuration = this.calculateAvgDuration(outcomes);
      taskStats[taskType] = {
        successRate,
        avgDuration,
        sampleCount: outcomes.length,
      };
      totalSuccesses += outcomes.filter((o) => o.success).length;
      totalOutcomes += outcomes.length;
    }

    return {
      taskStats,
      overallSuccessRate: totalOutcomes > 0 ? totalSuccesses / totalOutcomes : 0,
      policyVersion: 'v2',
    };
  }

  private groupOutcomesByTaskType(): Record<string, PolicyOutcome[]> {
    const grouped: Record<string, PolicyOutcome[]> = {};
    for (const outcome of this.outcomeHistory) {
      if (!grouped[outcome.taskType]) {
        grouped[outcome.taskType] = [];
      }
      grouped[outcome.taskType].push(outcome);
    }
    return grouped;
  }

  private groupFeedbackByTaskType(): Record<SupervisorTaskType, PolicyFeedback[]> {
    const grouped: Record<string, PolicyFeedback[]> = {};
    for (const feedback of this.feedbackHistory) {
      if (!grouped[feedback.taskType]) {
        grouped[feedback.taskType] = [];
      }
      grouped[feedback.taskType].push(feedback);
    }
    return grouped as Record<SupervisorTaskType, PolicyFeedback[]>;
  }

  private calculateSuccessRate(outcomes: PolicyOutcome[]): number {
    if (outcomes.length === 0) return 0;
    return outcomes.filter((o) => o.success).length / outcomes.length;
  }

  private calculateAvgDuration(outcomes: PolicyOutcome[]): number {
    if (outcomes.length === 0) return 0;
    return outcomes.reduce((sum, o) => sum + o.duration, 0) / outcomes.length;
  }

  private async adjustThresholds(): Promise<void> {
    // Get current system metrics
    const runningTasks = await prisma.supervisorTask.count({
      where: { status: SupervisorTaskStatus.RUNNING },
    });
    const pendingTasks = await prisma.supervisorTask.count({
      where: { status: SupervisorTaskStatus.PENDING },
    });

    // Adjust max concurrent tasks based on success rate
    const recentOutcomes = this.outcomeHistory.slice(-100);
    if (recentOutcomes.length >= 10) {
      const successRate = this.calculateSuccessRate(recentOutcomes);
      if (successRate < 0.9 && runningTasks >= this.policy.thresholds.maxConcurrentTasks * 0.9) {
        // Reduce max concurrent if we're failing
        this.policy.thresholds.maxConcurrentTasks = Math.max(
          1,
          Math.floor(this.policy.thresholds.maxConcurrentTasks * 0.95)
        );
        logger.info('Reduced max concurrent tasks', {
          newMax: this.policy.thresholds.maxConcurrentTasks,
        });
      } else if (
        successRate > 0.98 &&
        runningTasks < this.policy.thresholds.maxConcurrentTasks * 0.7
      ) {
        // Increase max concurrent if we're doing well
        this.policy.thresholds.maxConcurrentTasks = Math.min(
          20,
          Math.ceil(this.policy.thresholds.maxConcurrentTasks * 1.05)
        );
        logger.info('Increased max concurrent tasks', {
          newMax: this.policy.thresholds.maxConcurrentTasks,
        });
      }
    }
  }

  private async adjustBlockingRules(): Promise<void> {
    // Adjust blocking rule weights based on violations and outcomes
    for (const rule of this.policy.blockingRules) {
      // Check if blocking this task improved outcomes
      const blockedOutcomes = this.outcomeHistory.filter(
        (o) => o.taskType === rule.blockedTask
      );
      const blockingOutcomes = this.outcomeHistory.filter((o) =>
        rule.blockingTasks.includes(o.taskType)
      );

      if (blockedOutcomes.length >= 5 && blockingOutcomes.length >= 5) {
        const blockedSuccessRate = this.calculateSuccessRate(blockedOutcomes);
        const blockingSuccessRate = this.calculateSuccessRate(blockingOutcomes);

        // If blocking improves outcomes, increase weight
        if (blockingSuccessRate > blockedSuccessRate + 0.1) {
          rule.weight = Math.min(1.0, rule.weight + 0.05);
        } else if (blockingSuccessRate < blockedSuccessRate - 0.1) {
          // If blocking hurts outcomes, decrease weight
          rule.weight = Math.max(0.0, rule.weight - 0.05);
        }
      }
    }
  }
}

// Export singleton instance
export const adaptivePolicyManager = new AdaptivePolicyManager();

