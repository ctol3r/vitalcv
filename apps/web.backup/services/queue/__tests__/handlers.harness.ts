import { JobQueueStatus } from '@prisma/client';
import type { JobHandler } from '../handlers/index.js';
import { getJobHandler } from '../handlers/index.js';
import type { JobQueueRecord, JobQueueType } from '../models/JobQueue.js';

export interface HandlerRunResult {
  ok: boolean;
  error?: unknown;
  finalAttempt: boolean;
  job: JobQueueRecord;
}

export interface HandlerHarness {
  buildJob(overrides?: Partial<JobQueueRecord>): JobQueueRecord;
  run(overrides?: Partial<JobQueueRecord>): Promise<HandlerRunResult>;
  runWithRetries(attempts: number, overrides?: Partial<JobQueueRecord>): Promise<HandlerRunResult[]>;
}

function baseJobFactory(type: JobQueueType): JobQueueRecord {
  const now = new Date();
  return {
    id: `job-${type.toLowerCase()}-${now.getTime()}`,
    type,
    payload: {},
    status: JobQueueStatus.RUNNING,
    attempts: 1,
    maxAttempts: 5,
    lastError: null,
    startedAt: now,
    completedAt: null,
    lastRunAt: now,
    createdAt: now,
    updatedAt: now,
  } as JobQueueRecord;
}

function isFinalAttempt(job: JobQueueRecord): boolean {
  return job.attempts >= job.maxAttempts;
}

export function createHandlerHarness(
  type: JobQueueType,
  defaults: Partial<JobQueueRecord> = {}
): HandlerHarness {
  const handler = getJobHandler(type);

  if (!handler) {
    throw new Error(`Handler for ${type} is not registered`);
  }

  const buildJob = (overrides: Partial<JobQueueRecord> = {}): JobQueueRecord => {
    return {
      ...baseJobFactory(type),
      ...defaults,
      ...overrides,
    };
  };

  const run = async (overrides: Partial<JobQueueRecord> = {}): Promise<HandlerRunResult> => {
    const job = buildJob(overrides);
    try {
      await handler(job);
      return {
        ok: true,
        finalAttempt: isFinalAttempt(job),
        job,
      };
    } catch (error) {
      return {
        ok: false,
        error,
        finalAttempt: isFinalAttempt(job),
        job,
      };
    }
  };

  const runWithRetries = async (
    attempts: number,
    overrides: Partial<JobQueueRecord> = {}
  ): Promise<HandlerRunResult[]> => {
    const results: HandlerRunResult[] = [];

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const result = await run({
        attempts: attempt,
        maxAttempts: attempts,
        ...overrides,
      });
      results.push(result);
      if (result.ok) {
        break;
      }
    }

    return results;
  };

  return {
    buildJob,
    run,
    runWithRetries,
  };
}


