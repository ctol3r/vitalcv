import { PrismaClient, Prisma, JobQueueStatus, JobQueue } from '@prisma/client';
import { context as otContext, propagation } from '@opentelemetry/api';

export const JOB_QUEUE_TYPES = [
  'PSV_RUN',
  'SEND_EMAIL',
  'RUN_PILOT_SMOKE',
  'SYNC_METRICS',
  'PRIVILEGE_ISSUE',
  'CREDENTIAL_AGENT_TASK',
  'EHR_SYNC',
  'FHIR_SUBSCRIPTION_DELIVER',
  'DRIFT_SWEEP',
  'FUSION_UPDATE',
  'SAFETY_SWEEP',
  'MOBILITY_EVALUATE_ORG',
  'NCI_PUBLISH_PROOFS',
  'SUPERVISOR_RUN',
] as const;

export type JobQueueType = (typeof JOB_QUEUE_TYPES)[number];
export type JobQueueRecord = JobQueue;

const prisma = new PrismaClient();

export function isJobType(type: string): type is JobQueueType {
  return (JOB_QUEUE_TYPES as readonly string[]).includes(type);
}

export interface CreateJobOptions {
  maxAttempts?: number;
  idempotencyKey?: string | null;
}

export async function createJobQueueEntry(
  type: JobQueueType,
  payload: Prisma.JsonValue,
  options: CreateJobOptions = {}
): Promise<JobQueueRecord> {
  if (payload === undefined) {
    throw new Error('Job payload must be JSON-serializable');
  }

  const maxAttempts = Math.min(Math.max(options.maxAttempts ?? 5, 1), 10);

  const traceCarrier: Record<string, string> = {};
  propagation.inject(otContext.active(), traceCarrier);
  const traceContext = Object.keys(traceCarrier).length ? traceCarrier : null;

  try {
    return await prisma.jobQueue.create({
      data: {
        type,
        payload,
        traceContext,
        status: JobQueueStatus.PENDING,
        maxAttempts,
        idempotencyKey: options.idempotencyKey ?? null,
      },
    });
  } catch (error) {
    if (
      options.idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await prisma.jobQueue.findFirst({
        where: {
          type,
          idempotencyKey: options.idempotencyKey,
        },
      });
      if (existing) {
        return existing;
      }
    }
    throw error;
  }
}

export async function claimNextPendingJob(): Promise<JobQueueRecord | null> {
  const maxClaimAttempts = 5;

  for (let i = 0; i < maxClaimAttempts; i += 1) {
    const job = await prisma.jobQueue.findFirst({
      where: { status: JobQueueStatus.PENDING },
      orderBy: { createdAt: 'asc' },
    });

    if (!job) {
      return null;
    }

    const now = new Date();
    const updated = await prisma.jobQueue.updateMany({
      where: {
        id: job.id,
        status: JobQueueStatus.PENDING,
      },
      data: {
        status: JobQueueStatus.RUNNING,
        attempts: job.attempts + 1,
        startedAt: now,
        lastRunAt: now,
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
  const completedAt = new Date();
  return prisma.jobQueue.update({
    where: { id: jobId },
    data: {
      status: JobQueueStatus.COMPLETED,
      completedAt,
      lastError: null,
    },
  });
}

export interface FailureResult {
  job: JobQueueRecord;
  final: boolean;
}

export async function markJobFailure(
  job: JobQueueRecord,
  error: unknown,
  options: { forceFinal?: boolean } = {}
): Promise<FailureResult> {
  const message = error instanceof Error ? error.message : String(error);
  const isFinal = options.forceFinal ?? job.attempts >= job.maxAttempts;
  const nextStatus = isFinal ? JobQueueStatus.FAILED : JobQueueStatus.PENDING;

  const updated = await prisma.jobQueue.update({
    where: { id: job.id },
    data: {
      status: nextStatus,
      lastError: message,
      completedAt: isFinal ? new Date() : null,
      startedAt: isFinal ? job.startedAt : null,
    },
  });

  return { job: updated, final: isFinal };
}

export async function getJobById(jobId: string): Promise<JobQueueRecord | null> {
  return prisma.jobQueue.findUnique({ where: { id: jobId } });
}

export async function getOldestPendingJob(): Promise<JobQueueRecord | null> {
  return prisma.jobQueue.findFirst({
    where: { status: JobQueueStatus.PENDING },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getJobCountsByStatus(): Promise<Record<JobQueueStatus, number>> {
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

export async function resetJobToPending(jobId: string): Promise<JobQueueRecord> {
  return prisma.jobQueue.update({
    where: { id: jobId },
    data: {
      status: JobQueueStatus.PENDING,
      attempts: { increment: 1 },
      lastError: null,
      startedAt: null,
      completedAt: null,
    },
  });
}

export async function markJobFailedFinal(
  jobId: string,
  lastError?: string
): Promise<JobQueueRecord> {
  return prisma.jobQueue.update({
    where: { id: jobId },
    data: {
      status: JobQueueStatus.FAILED_FINAL,
      lastError: lastError ?? null,
      completedAt: new Date(),
    },
  });
}

export interface QueueErrorEntry {
  id: string;
  type: string;
  lastError: string;
  attempts: number;
  updatedAt: Date;
}

export interface QueueHealthSnapshot {
  running: number;
  waiting: number;
  deadLetter: number;
  avgLatencyMs: number | null;
  latencySampleSize: number;
  lastErrors: QueueErrorEntry[];
}

export async function getQueueHealthSnapshot(
  options: { latencySampleSize?: number; errorLimit?: number } = {}
): Promise<QueueHealthSnapshot> {
  const latencySampleSize = Math.max(1, options.latencySampleSize ?? 20);
  const errorLimit = Math.max(1, options.errorLimit ?? 5);

  const [counts, completedJobs, recentErrors] = await Promise.all([
    getJobCountsByStatus(),
    prisma.jobQueue.findMany({
      where: {
        status: JobQueueStatus.COMPLETED,
        startedAt: { not: null },
        completedAt: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      take: latencySampleSize,
      select: {
        id: true,
        startedAt: true,
        completedAt: true,
      },
    }),
    prisma.jobQueue.findMany({
      where: {
        lastError: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      take: errorLimit,
      select: {
        id: true,
        type: true,
        lastError: true,
        attempts: true,
        updatedAt: true,
      },
    }),
  ]);

  const latencies = completedJobs
    .map((job) =>
      job.startedAt && job.completedAt ? job.completedAt.getTime() - job.startedAt.getTime() : undefined
    )
    .filter((value): value is number => typeof value === 'number');

  const avgLatencyMs = latencies.length
    ? latencies.reduce((total, value) => total + value, 0) / latencies.length
    : null;

  return {
    running: counts.RUNNING,
    waiting: counts.PENDING,
    deadLetter: counts.FAILED_FINAL,
    avgLatencyMs,
    latencySampleSize: latencies.length,
    lastErrors: recentErrors.map((job) => ({
      id: job.id,
      type: job.type,
      lastError: job.lastError ?? '',
      attempts: job.attempts,
      updatedAt: job.updatedAt,
    })),
  };
}
