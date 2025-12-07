import type { Prisma } from '@prisma/client';
import {
  createJobQueueEntry,
  isJobType,
  JobQueueType,
} from './models/JobQueue.js';
import { createLogger } from '@chai-vc/logging-core';
import { deriveIdempotencyKey } from './idempotency.js';

export interface EnqueueJobOptions {
  maxAttempts?: number;
  idempotencyKey?: string | null;
}

const producerLogger = createLogger({ service: 'queue-producer' });

export async function enqueueJob(
  type: JobQueueType,
  payload: Prisma.JsonValue,
  options: EnqueueJobOptions = {}
): Promise<string> {
  if (!isJobType(type)) {
    throw new Error(`Unsupported job type: ${type}`);
  }

  const derivedKey = options.idempotencyKey ?? deriveIdempotencyKey(type, payload);
  const job = await createJobQueueEntry(type, payload, {
    ...options,
    idempotencyKey: derivedKey ?? null,
  });

  producerLogger.info('Enqueued job', {
    jobId: job.id,
    type,
    maxAttempts: job.maxAttempts,
    idempotencyKey: derivedKey ?? null,
  });

  return job.id;
}
