import { createLogger } from '@chai-vc/logging-core';
import type { JobQueueType } from '../../queue/models/JobQueue.js';
import { enqueueJob } from '../../queue/producer.js';
import { getJobPriority } from '../policies/priorityRules.js';
import { SupervisorRateLimiter, SupervisorRateLimitError } from '../limits/rateLimiter.js';
import type { Prisma } from '@prisma/client';

const logger = createLogger({ service: 'supervisor-dispatcher' });

/**
 * Supervisor task definition.
 * Represents a task that the supervisor needs to dispatch to the queue.
 */
export interface SupervisorTask {
  /**
   * The job type to enqueue.
   */
  jobType: JobQueueType;
  /**
   * Payload for the job.
   */
  payload: Prisma.JsonValue;
  /**
   * Optional concurrency key for jobs that should not run concurrently.
   * Jobs with the same concurrency key will be serialized.
   */
  concurrencyKey?: string;
  /**
   * Optional priority override (defaults to job type priority).
   */
  priority?: number;
  /**
   * Optional max attempts override.
   */
  maxAttempts?: number;
  /**
   * Optional idempotency key.
   */
  idempotencyKey?: string | null;
}

/**
 * Concurrency rules for job types.
 * Defines which job types should not run concurrently.
 */
const CONCURRENCY_RULES: Record<JobQueueType, { key?: string; limit?: number }> = {
  PSV_RUN: {}, // No special concurrency rules
  PRIVILEGE_ISSUE: {}, // No special concurrency rules
  SAFETY_SWEEP: { limit: 1 }, // Only one safety sweep at a time globally
  DRIFT_SWEEP: { limit: 1 }, // Only one drift sweep at a time globally
  EHR_SYNC: { key: 'syncId' }, // Keyed by syncId (handled by ehrSyncLock)
  MOBILITY_EVALUATE_ORG: {}, // No special concurrency rules
  SEND_EMAIL: {},
  RUN_PILOT_SMOKE: {},
  SYNC_METRICS: {},
  CREDENTIAL_AGENT_TASK: {},
  FHIR_SUBSCRIPTION_DELIVER: {},
  FUSION_UPDATE: {},
  NCI_PUBLISH_PROOFS: {},
  SUPERVISOR_RUN: { limit: 1 }, // Only one supervisor run per org (handled by supervisorLock)
};

/**
 * Supervisor dispatcher that maps SupervisorTask to queue job types.
 * Honors concurrency and ordering rules.
 */
export class SupervisorDispatcher {
  private rateLimiter: SupervisorRateLimiter;

  constructor(rateLimiter?: SupervisorRateLimiter) {
    this.rateLimiter = rateLimiter ?? new SupervisorRateLimiter();
  }

  /**
   * Dispatch a single supervisor task to the queue.
   *
   * @param task - Supervisor task to dispatch
   * @returns Job ID
   */
  async dispatchTask(task: SupervisorTask): Promise<string> {
    // Check rate limit before enqueueing
    await this.rateLimiter.checkRateLimit(1);

    // Validate job type
    if (!task.jobType) {
      throw new Error('Task must have a jobType');
    }

    // Check concurrency rules
    const concurrencyRule = CONCURRENCY_RULES[task.jobType];
    if (concurrencyRule?.limit === 1 && !task.concurrencyKey) {
      logger.warn('Job type requires concurrency key but none provided', {
        jobType: task.jobType,
      });
    }

    // Enqueue the job
    const jobId = await enqueueJob(task.jobType, task.payload, {
      maxAttempts: task.maxAttempts,
      idempotencyKey: task.idempotencyKey,
    });

    logger.info('Dispatched supervisor task', {
      jobId,
      jobType: task.jobType,
      hasConcurrencyKey: !!task.concurrencyKey,
    });

    return jobId;
  }

  /**
   * Dispatch multiple supervisor tasks to the queue.
   * Tasks are sorted by priority before enqueueing.
   *
   * @param tasks - Array of supervisor tasks to dispatch
   * @returns Array of job IDs (in priority order)
   */
  async dispatchTasks(tasks: SupervisorTask[]): Promise<string[]> {
    if (tasks.length === 0) {
      return [];
    }

    // Check rate limit
    await this.rateLimiter.checkRateLimit(tasks.length);

    // Sort tasks by priority (highest first)
    const sortedTasks = [...tasks].sort((a, b) => {
      // Use explicit priority if provided, otherwise use job type priority
      const priorityA = a.priority ?? getJobPriority(a.jobType);
      const priorityB = b.priority ?? getJobPriority(b.jobType);
      return priorityB - priorityA; // Descending order
    });

    // Dispatch tasks in priority order
    const jobIds: string[] = [];
    for (const task of sortedTasks) {
      try {
        const jobId = await this.dispatchTask(task);
        jobIds.push(jobId);
      } catch (error) {
        if (error instanceof SupervisorRateLimitError) {
          logger.warn('Rate limit hit during batch dispatch, stopping', {
            dispatched: jobIds.length,
            total: tasks.length,
            error: error.message,
          });
          break; // Stop dispatching if rate limit is hit
        }
        throw error;
      }
    }

    logger.info('Dispatched supervisor tasks', {
      total: tasks.length,
      dispatched: jobIds.length,
      jobTypes: sortedTasks.map((t) => t.jobType),
    });

    return jobIds;
  }


  /**
   * Get concurrency rule for a job type.
   */
  getConcurrencyRule(jobType: JobQueueType): { key?: string; limit?: number } {
    return CONCURRENCY_RULES[jobType] ?? {};
  }
}

