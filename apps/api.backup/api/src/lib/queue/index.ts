/**
 * Background Jobs Queue System
 * Tagged: cursor-batch-1105 (Task 0025)
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Idempotent job queue with retry policy
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface JobPayload {
  [key: string]: any;
}

export interface JobOptions {
  /**
   * Maximum number of retry attempts
   */
  maxAttempts?: number;

  /**
   * Exponential backoff multiplier
   */
  backoffMultiplier?: number;

  /**
   * Base delay in milliseconds
   */
  baseDelay?: number;
}

export type JobType = 'anchor' | 'recompute-status' | 'webhook-delivery' | 'credential-revocation';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Background job queue manager
 */
export class JobQueue {
  private processingJobs: Set<string> = new Set();

  /**
   * Enqueue a new job (idempotent)
   */
  async enqueue(
    type: JobType,
    payload: JobPayload,
    idempotencyKey: string,
    options: JobOptions = {},
  ): Promise<string> {
    const { maxAttempts = 3 } = options;

    // Check if job already exists (idempotency)
    const existing = await prisma.backgroundJob.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      return existing.id;
    }

    // Create new job
    const job = await prisma.backgroundJob.create({
      data: {
        type,
        payload,
        idempotencyKey,
        maxAttempts,
        status: 'pending',
      },
    });

    return job.id;
  }

  /**
   * Process pending jobs
   */
  async processPendingJobs(type?: JobType): Promise<number> {
    const where: any = {
      status: 'pending',
    };

    if (type) {
      where.type = type;
    }

    const pendingJobs = await prisma.backgroundJob.findMany({
      where,
      take: 10,
      orderBy: {
        createdAt: 'asc',
      },
    });

    let processedCount = 0;

    for (const job of pendingJobs) {
      // Skip if already being processed
      if (this.processingJobs.has(job.id)) {
        continue;
      }

      this.processingJobs.add(job.id);

      try {
        await this.processJob(job.id);
        processedCount++;
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
      } finally {
        this.processingJobs.delete(job.id);
      }
    }

    return processedCount;
  }

  /**
   * Process a single job
   */
  async processJob(jobId: string): Promise<void> {
    const job = await prisma.backgroundJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Update status to running
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: 'running',
        lastAttemptAt: new Date(),
      },
    });

    try {
      // Execute job based on type
      await this.executeJob(job.type, job.payload);

      // Mark as completed
      await prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });
    } catch (error: any) {
      const attempts = job.attempts + 1;

      if (attempts >= job.maxAttempts) {
        // Max retries exceeded - mark as failed
        await prisma.backgroundJob.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            attempts,
            error: error.message || 'Unknown error',
          },
        });
      } else {
        // Retry - back to pending with exponential backoff
        const backoffDelay = this.calculateBackoff(attempts);

        await prisma.backgroundJob.update({
          where: { id: jobId },
          data: {
            status: 'pending',
            attempts,
            error: error.message || 'Unknown error',
          },
        });

        // Schedule retry after backoff
        setTimeout(() => {
          this.processJob(jobId).catch((err) => {
            console.error(`Retry failed for job ${jobId}:`, err);
          });
        }, backoffDelay);
      }

      throw error;
    }
  }

  /**
   * Execute job logic based on type
   */
  private async executeJob(type: string, payload: JobPayload): Promise<void> {
    switch (type) {
      case 'anchor':
        await this.executeAnchorJob(payload);
        break;

      case 'recompute-status':
        await this.executeRecomputeStatusJob(payload);
        break;

      case 'webhook-delivery':
        await this.executeWebhookDeliveryJob(payload);
        break;

      case 'credential-revocation':
        await this.executeCredentialRevocationJob(payload);
        break;

      default:
        throw new Error(`Unknown job type: ${type}`);
    }
  }

  /**
   * Anchor credential to blockchain
   */
  private async executeAnchorJob(payload: JobPayload): Promise<void> {
    const { credentialId, hash } = payload;

    // TODO: Implement blockchain anchoring
    console.log(`Anchoring credential ${credentialId} with hash ${hash}`);

    // Simulate async work
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Recompute credential status
   */
  private async executeRecomputeStatusJob(payload: JobPayload): Promise<void> {
    const { credentialId } = payload;

    // TODO: Implement status recomputation
    console.log(`Recomputing status for credential ${credentialId}`);

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Deliver webhook
   */
  private async executeWebhookDeliveryJob(payload: JobPayload): Promise<void> {
    const { url, data } = payload;

    // TODO: Implement webhook delivery
    console.log(`Delivering webhook to ${url}`);

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Process credential revocation
   */
  private async executeCredentialRevocationJob(payload: JobPayload): Promise<void> {
    const { credentialId } = payload;

    // TODO: Implement revocation logic
    console.log(`Revoking credential ${credentialId}`);

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number, baseDelay = 1000, multiplier = 2): number {
    return baseDelay * Math.pow(multiplier, attempt - 1);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    status: JobStatus;
    attempts: number;
    error?: string | null;
  } | null> {
    const job = await prisma.backgroundJob.findUnique({
      where: { id: jobId },
      select: {
        status: true,
        attempts: true,
        error: true,
      },
    });

    if (!job) {
      return null;
    }

    return {
      status: job.status as JobStatus,
      attempts: job.attempts,
      error: job.error,
    };
  }

  /**
   * Retry failed jobs
   */
  async retryFailedJobs(type?: JobType): Promise<number> {
    const where: any = {
      status: 'failed',
      attempts: {
        lt: prisma.backgroundJob.fields.maxAttempts,
      },
    };

    if (type) {
      where.type = type;
    }

    const result = await prisma.backgroundJob.updateMany({
      where,
      data: {
        status: 'pending',
      },
    });

    return result.count;
  }

  /**
   * Clean up completed jobs older than a certain date
   */
  async cleanupOldJobs(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.backgroundJob.deleteMany({
      where: {
        status: 'completed',
        completedAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}

// Global queue instance
const globalQueue = new JobQueue();

/**
 * Get the global job queue
 */
export function getJobQueue(): JobQueue {
  return globalQueue;
}

