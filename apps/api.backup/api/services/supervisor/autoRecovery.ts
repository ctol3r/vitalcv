/**
 * SupervisorAutoRecoveryHandler
 *
 * When tasks repeatedly fail, Supervisor invokes remediation flows
 * (restart module, clear cache, failover).
 */

import { PrismaClient, SupervisorTaskStatus } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';
import { enqueueJob } from '../queue/producer.js';
import type { JobQueueType } from '../queue/models/JobQueue.js';
import { findTasksByTypeAndStatus } from './models/SupervisorTask.js';

const logger = createLogger({ service: 'supervisor-auto-recovery' });
const prisma = new PrismaClient();

/**
 * Remediation flow type
 */
export type RemediationFlow = 'restart_module' | 'clear_cache' | 'failover' | 'scale_up' | 'investigate';

/**
 * Recovery configuration
 */
export interface RecoveryConfig {
  failureThreshold: number; // Number of consecutive failures before triggering recovery
  failureWindowMs: number; // Time window to consider failures
  remediationFlows: RemediationFlowConfig[];
}

/**
 * Configuration for a specific remediation flow
 */
export interface RemediationFlowConfig {
  flow: RemediationFlow;
  triggerAfterFailures: number;
  priority: number;
  maxRetries: number;
  cooldownMs: number; // Time to wait before retrying same flow
}

/**
 * Default recovery configuration
 */
const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  failureThreshold: 3,
  failureWindowMs: 300000, // 5 minutes
  remediationFlows: [
    {
      flow: 'clear_cache',
      triggerAfterFailures: 3,
      priority: 5,
      maxRetries: 2,
      cooldownMs: 60000, // 1 minute
    },
    {
      flow: 'restart_module',
      triggerAfterFailures: 5,
      priority: 8,
      maxRetries: 1,
      cooldownMs: 300000, // 5 minutes
    },
    {
      flow: 'failover',
      triggerAfterFailures: 7,
      priority: 10,
      maxRetries: 1,
      cooldownMs: 600000, // 10 minutes
    },
    {
      flow: 'investigate',
      triggerAfterFailures: 10,
      priority: 9,
      maxRetries: 1,
      cooldownMs: 0,
    },
  ],
};

/**
 * Task failure record
 */
interface TaskFailureRecord {
  taskId: string;
  taskType: string;
  failureCount: number;
  firstFailureAt: Date;
  lastFailureAt: Date;
  lastRemediationFlow?: RemediationFlow;
  lastRemediationAt?: Date;
}

/**
 * SupervisorAutoRecoveryHandler
 *
 * Monitors task failures and triggers appropriate remediation flows.
 */
export class SupervisorAutoRecoveryHandler {
  private config: RecoveryConfig;
  private failureRecords: Map<string, TaskFailureRecord> = new Map();
  private isMonitoring = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(config?: Partial<RecoveryConfig>) {
    this.config = {
      ...DEFAULT_RECOVERY_CONFIG,
      ...config,
      remediationFlows: config?.remediationFlows ?? DEFAULT_RECOVERY_CONFIG.remediationFlows,
    };
  }

  /**
   * Start monitoring for task failures
   */
  start(): void {
    if (this.isMonitoring) {
      logger.warn('SupervisorAutoRecoveryHandler is already monitoring');
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting SupervisorAutoRecoveryHandler', {
      failureThreshold: this.config.failureThreshold,
      failureWindowMs: this.config.failureWindowMs,
    });

    // Check for failures immediately
    this.checkForFailures().catch((error) => {
      logger.error('Error in initial failure check', { error });
    });

    // Schedule periodic checks (every 30 seconds)
    this.intervalId = setInterval(() => {
      this.checkForFailures().catch((error) => {
        logger.error('Error in periodic failure check', { error });
      });
    }, 30000);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('Stopped SupervisorAutoRecoveryHandler');
  }

  /**
   * Check for failed tasks and trigger recovery
   */
  private async checkForFailures(): Promise<void> {
    try {
      // Get all failed tasks
      // Note: In production, we'd check all task types, not just SUPERVISOR_RUN
      // For now, we'll query directly from Prisma

      // Also check for tasks that have failed multiple times
      const allFailedTasks = await prisma.supervisorTask.findMany({
        where: {
          status: {
            in: ['FAILED', 'FAILED_FINAL'] as any,
          },
          updatedAt: {
            gte: new Date(Date.now() - this.config.failureWindowMs),
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      // Group failures by task type
      const failuresByType = new Map<string, typeof allFailedTasks>();
      for (const task of allFailedTasks) {
        const taskType = task.taskType;
        if (!failuresByType.has(taskType)) {
          failuresByType.set(taskType, []);
        }
        failuresByType.get(taskType)!.push(task);
      }

      // Process failures for each task type
      for (const [taskType, tasks] of failuresByType) {
        await this.processFailures(taskType, tasks);
      }
    } catch (error) {
      logger.error('Error checking for failures', { error });
    }
  }

  /**
   * Process failures for a specific task type
   */
  private async processFailures(
    taskType: string,
    failedTasks: Array<{ id: string; error: string | null; updatedAt: Date }>
  ): Promise<void> {
    const failureCount = failedTasks.length;
    const recordKey = `taskType:${taskType}`;

    // Get or create failure record
    let record = this.failureRecords.get(recordKey);
    if (!record) {
      record = {
        taskId: recordKey,
        taskType,
        failureCount: 0,
        firstFailureAt: new Date(),
        lastFailureAt: new Date(),
      };
      this.failureRecords.set(recordKey, record);
    }

    // Update failure record
    record.failureCount = failureCount;
    record.lastFailureAt = new Date();

    // Check if we need to trigger remediation
    if (failureCount >= this.config.failureThreshold) {
      await this.triggerRemediation(record, failedTasks);
    } else {
      // Reset if below threshold
      record.firstFailureAt = new Date();
    }
  }

  /**
   * Trigger appropriate remediation flow
   */
  private async triggerRemediation(
    record: TaskFailureRecord,
    failedTasks: Array<{ id: string; error: string | null }>
  ): Promise<void> {
    const failureCount = record.failureCount;

    // Find applicable remediation flows
    const applicableFlows = this.config.remediationFlows
      .filter((flowConfig) => failureCount >= flowConfig.triggerAfterFailures)
      .sort((a, b) => b.priority - a.priority); // Sort by priority (highest first)

    if (applicableFlows.length === 0) {
      logger.warn('No remediation flow applicable', {
        taskType: record.taskType,
        failureCount,
      });
      return;
    }

    // Check cooldown periods
    const now = new Date();
    for (const flowConfig of applicableFlows) {
      // Skip if we just ran this flow and it's still in cooldown
      if (
        record.lastRemediationFlow === flowConfig.flow &&
        record.lastRemediationAt &&
        now.getTime() - record.lastRemediationAt.getTime() < flowConfig.cooldownMs
      ) {
        logger.debug('Remediation flow in cooldown', {
          flow: flowConfig.flow,
          taskType: record.taskType,
          cooldownRemainingMs:
            flowConfig.cooldownMs - (now.getTime() - record.lastRemediationAt.getTime()),
        });
        continue;
      }

      // Check if we've exceeded max retries for this flow
      const flowRetryCount = this.getFlowRetryCount(record.taskType, flowConfig.flow);
      if (flowRetryCount >= flowConfig.maxRetries) {
        logger.warn('Remediation flow exceeded max retries', {
          flow: flowConfig.flow,
          taskType: record.taskType,
          retryCount: flowRetryCount,
          maxRetries: flowConfig.maxRetries,
        });
        continue;
      }

      // Execute remediation flow
      try {
        await this.executeRemediationFlow(flowConfig.flow, record, failedTasks);
        record.lastRemediationFlow = flowConfig.flow;
        record.lastRemediationAt = now;
        this.failureRecords.set(record.taskId, record);
        break; // Only execute one flow at a time
      } catch (error) {
        logger.error('Error executing remediation flow', {
          flow: flowConfig.flow,
          taskType: record.taskType,
          error,
        });
      }
    }
  }

  /**
   * Execute a specific remediation flow
   */
  private async executeRemediationFlow(
    flow: RemediationFlow,
    record: TaskFailureRecord,
    failedTasks: Array<{ id: string; error: string | null }>
  ): Promise<void> {
    logger.info('Executing remediation flow', {
      flow,
      taskType: record.taskType,
      failureCount: record.failureCount,
    });

    switch (flow) {
      case 'restart_module':
        await this.restartModule(record.taskType, failedTasks);
        break;

      case 'clear_cache':
        await this.clearCache(record.taskType, failedTasks);
        break;

      case 'failover':
        await this.failover(record.taskType, failedTasks);
        break;

      case 'scale_up':
        await this.scaleUp(record.taskType, failedTasks);
        break;

      case 'investigate':
        await this.investigate(record.taskType, failedTasks);
        break;

      default:
        logger.warn('Unknown remediation flow', { flow });
    }
  }

  /**
   * Restart module remediation
   */
  private async restartModule(
    taskType: string,
    failedTasks: Array<{ id: string; error: string | null }>
  ): Promise<void> {
    logger.warn('Restarting module due to repeated failures', {
      taskType,
      failureCount: failedTasks.length,
    });

    // Enqueue a supervisor task to restart the module
    await enqueueJob('SUPERVISOR_RUN', {
      action: 'restart_module',
      moduleId: taskType,
      reason: 'auto_recovery',
      failureCount: failedTasks.length,
      failedTaskIds: failedTasks.map((t) => t.id),
    } as any);
  }

  /**
   * Clear cache remediation
   */
  private async clearCache(
    taskType: string,
    failedTasks: Array<{ id: string; error: string | null }>
  ): Promise<void> {
    logger.info('Clearing cache due to repeated failures', {
      taskType,
      failureCount: failedTasks.length,
    });

    // Enqueue a supervisor task to clear cache
    await enqueueJob('SUPERVISOR_RUN', {
      action: 'clear_cache',
      moduleId: taskType,
      reason: 'auto_recovery',
      failureCount: failedTasks.length,
    } as any);
  }

  /**
   * Failover remediation
   */
  private async failover(
    taskType: string,
    failedTasks: Array<{ id: string; error: string | null }>
  ): Promise<void> {
    logger.error('Triggering failover due to repeated failures', {
      taskType,
      failureCount: failedTasks.length,
    });

    // Enqueue a supervisor task to trigger failover
    await enqueueJob('SUPERVISOR_RUN', {
      action: 'failover',
      moduleId: taskType,
      reason: 'auto_recovery',
      failureCount: failedTasks.length,
      failedTaskIds: failedTasks.map((t) => t.id),
    } as any);
  }

  /**
   * Scale up remediation
   */
  private async scaleUp(
    taskType: string,
    failedTasks: Array<{ id: string; error: string | null }>
  ): Promise<void> {
    logger.info('Scaling up due to repeated failures', {
      taskType,
      failureCount: failedTasks.length,
    });

    // Enqueue a supervisor task to scale up
    await enqueueJob('SUPERVISOR_RUN', {
      action: 'scale_up',
      moduleId: taskType,
      reason: 'auto_recovery',
      failureCount: failedTasks.length,
    } as any);
  }

  /**
   * Investigate remediation
   */
  private async investigate(
    taskType: string,
    failedTasks: Array<{ id: string; error: string | null }>
  ): Promise<void> {
    logger.error('Triggering investigation due to repeated failures', {
      taskType,
      failureCount: failedTasks.length,
      errors: failedTasks.map((t) => t.error).filter(Boolean),
    });

    // Enqueue a supervisor task to investigate
    await enqueueJob('SUPERVISOR_RUN', {
      action: 'investigate',
      moduleId: taskType,
      reason: 'auto_recovery',
      failureCount: failedTasks.length,
      failedTaskIds: failedTasks.map((t) => t.id),
      errors: failedTasks.map((t) => t.error).filter(Boolean),
    } as any);
  }

  /**
   * Get retry count for a specific flow (simplified - in production would track in DB)
   */
  private getFlowRetryCount(taskType: string, flow: RemediationFlow): number {
    // In production, this would query a database to track retry counts
    // For now, return 0 to allow flows to execute
    return 0;
  }

  /**
   * Record a task failure (called externally when a task fails)
   */
  async recordTaskFailure(taskId: string, taskType: string, error: string): Promise<void> {
    const recordKey = `task:${taskId}`;
    let record = this.failureRecords.get(recordKey);

    if (!record) {
      record = {
        taskId,
        taskType,
        failureCount: 0,
        firstFailureAt: new Date(),
        lastFailureAt: new Date(),
      };
    }

    record.failureCount += 1;
    record.lastFailureAt = new Date();
    this.failureRecords.set(recordKey, record);

    // Check if we need to trigger recovery for this specific task
    if (record.failureCount >= this.config.failureThreshold) {
      await this.triggerRemediation(record, [{ id: taskId, error }]);
    }
  }

  /**
   * Get failure statistics
   */
  getFailureStats(): Map<string, TaskFailureRecord> {
    return new Map(this.failureRecords);
  }

  /**
   * Reset failure record (for testing)
   */
  resetFailureRecord(taskId: string): void {
    this.failureRecords.delete(taskId);
  }
}

