import {
  JobQueueStatus,
  Prisma,
  PrismaClient,
  type JobQueue,
} from '@prisma/client';
import { calculateBackoffDelay } from './backoff';
import { getJobConfig, getJobTypesForDomain } from './config';
import type { JobPayload, JobPayloadMap } from './schemas';
import { validateJobPayload } from './schemas';
import type { JobDomain, JobType } from './jobTypes';
import { JOB_TYPES } from './jobTypes';
import type { DeadLetterRecord, JobQueueRecord } from './types';

const prisma = new PrismaClient();
const MAX_ATTEMPTS_CAP = 10;
const CLAIM_MAX_RETRIES = 5;

export interface EnqueueJobOptions {
  maxAttempts?: number;
}

export async function enqueueJob<T extends JobType>(
  type: T,
  payload: JobPayload<T>,
  options: EnqueueJobOptions = {}
): Promise<string> {
  if (!isJobType(type)) {
    throw new Error(`Unsupported job type: ${type}`);
  }

  const validated = validateJobPayload(type, payload);
  const config = getJobConfig(type);
  const now = new Date();
  const maxAttempts = clampAttempts(
    options.maxAttempts ?? config.defaultMaxAttempts
  );

  const job = await prisma.jobQueue.create({
    data: {
      type,
      payload: validated as Prisma.JsonValue,
      status: JobQueueStatus.PENDING,
      maxAttempts,
      domain: config.domain,
      availableAt: now,
    },
  });

  return job.id;
}

export interface ClaimJobOptions {
  domain?: JobDomain;
  jobTypes?: JobType[];
  now?: Date;
}

export async function claimNextPendingJob(
  options: ClaimJobOptions = {}
): Promise<JobQueueRecord | null> {
  const now = options.now ?? new Date();
  const eligibleTypes = resolveEligibleTypes(options);

  for (let attempt = 0; attempt < CLAIM_MAX_RETRIES; attempt += 1) {
    const job = await prisma.jobQueue.findFirst({
      where: {
        status: JobQueueStatus.PENDING,
        availableAt: { lte: now },
        ...(options.domain ? { domain: options.domain } : {}),
        ...(eligibleTypes ? { type: { in: eligibleTypes } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!job) {
      return null;
    }

    const startedAt = new Date();
    const updated = await prisma.jobQueue.updateMany({
      where: { id: job.id, status: JobQueueStatus.PENDING },
      data: {
        status: JobQueueStatus.RUNNING,
        attempts: job.attempts + 1,
        startedAt,
        lastRunAt: startedAt,
        lastError: null,
      },
    });

    if (updated.count === 0) {
      continue;
    }

    const claimed = await prisma.jobQueue.findUnique({ where: { id: job.id } });
    if (claimed) {
      return claimed;
    }
  }

  return null;
}

export async function markJobCompleted(jobId: string): Promise<JobQueueRecord> {
  return prisma.jobQueue.update({
    where: { id: jobId },
    data: {
      status: JobQueueStatus.COMPLETED,
      completedAt: new Date(),
      lastError: null,
      startedAt: null,
    },
  });
}

export interface FailureResult {
  job: JobQueueRecord;
  final: boolean;
  nextAvailableAt?: Date;
}

export async function markJobFailure(
  job: JobQueueRecord,
  error: unknown,
  options: { forceFinal?: boolean } = {}
): Promise<FailureResult> {
  const message = toErrorMessage(error);
  const jobType = job.type as JobType;
  const config = getJobConfig(jobType);
  const isFinal = options.forceFinal ?? job.attempts >= job.maxAttempts;

  if (isFinal) {
    const failed = await prisma.jobQueue.update({
      where: { id: job.id },
      data: {
        status: JobQueueStatus.FAILED_FINAL,
        lastError: message,
        completedAt: new Date(),
      },
    });
    await prisma.jobQueueDeadLetter.create({
      data: {
        jobId: job.id,
        type: job.type,
        payload: job.payload,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        lastError: message,
        failedAt: new Date(),
      },
    });
    return { job: failed, final: true };
  }

  const delay = calculateBackoffDelay(job.attempts + 1, config.backoff);
  const availableAt = new Date(Date.now() + delay);

  const pending = await prisma.jobQueue.update({
    where: { id: job.id },
    data: {
      status: JobQueueStatus.PENDING,
      lastError: message,
      startedAt: null,
      availableAt,
    },
  });

  return { job: pending, final: false, nextAvailableAt: availableAt };
}

export async function getJobById(jobId: string): Promise<JobQueueRecord | null> {
  return prisma.jobQueue.findUnique({ where: { id: jobId } });
}

export async function getOldestPendingJob(): Promise<JobQueueRecord | null> {
  return prisma.jobQueue.findFirst({
    where: {
      status: JobQueueStatus.PENDING,
      availableAt: { lte: new Date() },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getJobCountsByStatus(): Promise<
  Record<JobQueueStatus, number>
> {
  const baseCounts: Record<JobQueueStatus, number> = {
    [JobQueueStatus.PENDING]: 0,
    [JobQueueStatus.RUNNING]: 0,
    [JobQueueStatus.FAILED]: 0,
    [JobQueueStatus.FAILED_FINAL]: 0,
    [JobQueueStatus.COMPLETED]: 0,
  };

  const grouped = await prisma.jobQueue.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  for (const entry of grouped) {
    baseCounts[entry.status as JobQueueStatus] = entry._count._all;
  }
  return baseCounts;
}

export async function resetJobToPending(
  jobId: string
): Promise<JobQueueRecord> {
  return prisma.jobQueue.update({
    where: { id: jobId },
    data: {
      status: JobQueueStatus.PENDING,
      attempts: { increment: 1 },
      lastError: null,
      startedAt: null,
      completedAt: null,
      availableAt: new Date(),
    },
  });
}

export async function markJobFailedFinal(
  jobId: string,
  reason?: string
): Promise<JobQueueRecord> {
  const job = await prisma.jobQueue.update({
    where: { id: jobId },
    data: {
      status: JobQueueStatus.FAILED_FINAL,
      completedAt: new Date(),
      lastError: reason ?? 'Marked failed',
    },
  });

  await prisma.jobQueueDeadLetter.create({
    data: {
      jobId,
      type: job.type,
      payload: job.payload,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      lastError: job.lastError,
      failedAt: new Date(),
    },
  });

  return job;
}

export async function listDeadLetterJobs(limit = 20): Promise<DeadLetterRecord[]> {
  return prisma.jobQueueDeadLetter.findMany({
    orderBy: { failedAt: 'desc' },
    take: limit,
  });
}

export async function getDeadLetterJob(id: string): Promise<DeadLetterRecord | null> {
  return prisma.jobQueueDeadLetter.findUnique({ where: { id } });
}

export async function replayDeadLetterJob(
  id: string
): Promise<{ newJobId: string; deadLetter: DeadLetterRecord }> {
  const entry = await getDeadLetterJob(id);
  if (!entry) {
    throw new Error(`Dead-letter entry ${id} not found`);
  }

  const jobType = entry.type as JobType;
  if (!isJobType(jobType)) {
    throw new Error(`Cannot replay unknown job type ${entry.type}`);
  }

  const payload = validateJobPayload(jobType, entry.payload);
  const newJobId = await enqueueJob(jobType, payload as JobPayload<JobType>, {
    maxAttempts: entry.maxAttempts,
  });

  const updated = await prisma.jobQueueDeadLetter.update({
    where: { id },
    data: {
      replayedAt: new Date(),
      replayJobId: newJobId,
    },
  });

  return { newJobId, deadLetter: updated };
}

function resolveEligibleTypes(options: ClaimJobOptions): JobType[] | undefined {
  if (options.jobTypes && options.jobTypes.length > 0) {
    return options.jobTypes;
  }
  if (options.domain) {
    return getJobTypesForDomain(options.domain);
  }
  return undefined;
}

function clampAttempts(input: number): number {
  return Math.min(Math.max(input, 1), MAX_ATTEMPTS_CAP);
}

function isJobType(value: string): value is JobType {
  return (JOB_TYPES as readonly string[]).includes(value);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

export type { JobQueue, JobPayloadMap };

