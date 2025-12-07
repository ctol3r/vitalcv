import { createLogger } from '@chai-vc/logging-core';
import { getQueueHealthSnapshot } from '../../queue/models/JobQueue.js';

const logger = createLogger({ service: 'supervisor-rate-limiter' });

/**
 * Configuration for supervisor rate limiting.
 */
export interface SupervisorRateLimitConfig {
  /**
   * Maximum number of pending jobs allowed before rate limiting kicks in.
   */
  maxPendingJobs: number;
  /**
   * Maximum number of running jobs allowed before rate limiting kicks in.
   */
  maxRunningJobs: number;
  /**
   * Maximum number of jobs that can be enqueued per supervisor run.
   */
  maxJobsPerRun: number;
  /**
   * Maximum average latency (ms) before rate limiting kicks in.
   * If null, latency is not considered.
   */
  maxAvgLatencyMs: number | null;
}

const DEFAULT_CONFIG: SupervisorRateLimitConfig = {
  maxPendingJobs: 1000,
  maxRunningJobs: 100,
  maxJobsPerRun: 50,
  maxAvgLatencyMs: 300000, // 5 minutes
};

/**
 * Error thrown when rate limit is exceeded.
 */
export class SupervisorRateLimitError extends Error {
  constructor(
    public readonly reason: string,
    public readonly metrics: {
      pending: number;
      running: number;
      avgLatencyMs: number | null;
    }
  ) {
    super(`Supervisor rate limit exceeded: ${reason}`);
    this.name = 'SupervisorRateLimitError';
  }
}

/**
 * Supervisor rate limiter that prevents enqueueing too many tasks.
 * Integrates with queue metrics to make decisions.
 */
export class SupervisorRateLimiter {
  private config: SupervisorRateLimitConfig;

  constructor(config: Partial<SupervisorRateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if supervisor can enqueue more jobs.
   * Throws SupervisorRateLimitError if rate limit is exceeded.
   *
   * @param jobsToEnqueue - Number of jobs about to be enqueued
   */
  async checkRateLimit(jobsToEnqueue: number): Promise<void> {
    const snapshot = await getQueueHealthSnapshot({
      latencySampleSize: 20,
      errorLimit: 5,
    });

    // Check pending jobs limit
    if (snapshot.waiting >= this.config.maxPendingJobs) {
      throw new SupervisorRateLimitError(
        `Too many pending jobs: ${snapshot.waiting} >= ${this.config.maxPendingJobs}`,
        {
          pending: snapshot.waiting,
          running: snapshot.running,
          avgLatencyMs: snapshot.avgLatencyMs,
        }
      );
    }

    // Check running jobs limit
    if (snapshot.running >= this.config.maxRunningJobs) {
      throw new SupervisorRateLimitError(
        `Too many running jobs: ${snapshot.running} >= ${this.config.maxRunningJobs}`,
        {
          pending: snapshot.waiting,
          running: snapshot.running,
          avgLatencyMs: snapshot.avgLatencyMs,
        }
      );
    }

    // Check if adding new jobs would exceed pending limit
    if (snapshot.waiting + jobsToEnqueue > this.config.maxPendingJobs) {
      throw new SupervisorRateLimitError(
        `Would exceed pending jobs limit: ${snapshot.waiting} + ${jobsToEnqueue} > ${this.config.maxPendingJobs}`,
        {
          pending: snapshot.waiting,
          running: snapshot.running,
          avgLatencyMs: snapshot.avgLatencyMs,
        }
      );
    }

    // Check jobs per run limit
    if (jobsToEnqueue > this.config.maxJobsPerRun) {
      throw new SupervisorRateLimitError(
        `Too many jobs per run: ${jobsToEnqueue} > ${this.config.maxJobsPerRun}`,
        {
          pending: snapshot.waiting,
          running: snapshot.running,
          avgLatencyMs: snapshot.avgLatencyMs,
        }
      );
    }

    // Check average latency
    if (
      this.config.maxAvgLatencyMs !== null &&
      snapshot.avgLatencyMs !== null &&
      snapshot.avgLatencyMs > this.config.maxAvgLatencyMs
    ) {
      logger.warn('High average latency detected, but not blocking', {
        avgLatencyMs: snapshot.avgLatencyMs,
        maxAvgLatencyMs: this.config.maxAvgLatencyMs,
      });
      // Note: We warn but don't block on latency alone, as it might be transient
    }

    logger.debug('Rate limit check passed', {
      jobsToEnqueue,
      pending: snapshot.waiting,
      running: snapshot.running,
      avgLatencyMs: snapshot.avgLatencyMs,
    });
  }

  /**
   * Get current queue metrics snapshot.
   */
  async getMetrics() {
    return getQueueHealthSnapshot({
      latencySampleSize: 20,
      errorLimit: 5,
    });
  }

  /**
   * Update rate limit configuration.
   */
  updateConfig(config: Partial<SupervisorRateLimitConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Updated rate limit configuration', { config: this.config });
  }
}

