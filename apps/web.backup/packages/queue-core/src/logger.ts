import { createHash } from 'node:crypto';
import { createLogger, Logger } from '@chai-vc/logging-core';

export interface QueueJobLike {
  id: string;
  type: string;
  attempts: number;
  payload?: unknown;
}

export interface JobLoggerOptions {
  service?: string;
  baseLogger?: Logger;
}

function computePayloadHash(payload: unknown): string | undefined {
  if (payload === undefined || payload === null) {
    return undefined;
  }
  try {
    const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return createHash('sha256').update(json).digest('hex');
  } catch {
    return undefined;
  }
}

export function createJobLogger(job: QueueJobLike, options: JobLoggerOptions = {}): Logger {
  const baseLogger = options.baseLogger ?? createLogger({ service: options.service || 'queue-worker' });

  return baseLogger.child({
    defaultFields: {
      jobId: job.id,
      jobType: job.type,
      attempts: job.attempts,
      payloadHash: computePayloadHash(job.payload),
    },
  });
}

