import type { DLQJobQueue, Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import type { JobQueueRecord } from './JobQueue.js';
import type { FormattedQueueError } from '../errorFormatter.js';

const prisma = new PrismaClient();

export type DLQJobQueueRecord = DLQJobQueue;

type JobWithMeta = JobQueueRecord & {
  traceContext?: Prisma.JsonValue | null;
  idempotencyKey?: string | null;
};

export interface PersistDLQJobInput {
  job: JobQueueRecord;
  error: FormattedQueueError;
}

function buildDlqPayload(job: JobWithMeta, error: FormattedQueueError): Prisma.DLQJobQueueCreateInput {
  return {
    jobId: job.id,
    type: job.type,
    payload: job.payload as Prisma.InputJsonValue,
    traceContext: (job.traceContext ?? null) as Prisma.InputJsonValue | null,
    idempotencyKey: job.idempotencyKey ?? null,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    error: error as unknown as Prisma.InputJsonValue,
    lastError: error.message,
  };
}

export async function persistDLQJob(input: PersistDLQJobInput): Promise<DLQJobQueueRecord> {
  const job = input.job as JobWithMeta;
  const payload = buildDlqPayload(job, input.error);

  return prisma.dLQJobQueue.upsert({
    where: { jobId: job.id },
    create: payload,
    update: {
      ...payload,
      movedAt: new Date(),
    },
  });
}

export async function getDLQJob(jobId: string): Promise<DLQJobQueueRecord | null> {
  return prisma.dLQJobQueue.findUnique({ where: { jobId } });
}

