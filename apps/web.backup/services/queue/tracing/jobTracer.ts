import { createHash } from 'node:crypto';
import type { Span } from '@opentelemetry/api';
import { withJobSpan } from '@packages/queue-core';
import type { JobQueueRecord } from '../models/JobQueue.js';

type TraceContextCarrier = Record<string, string> | null | undefined;

export interface JobSpanHandler<T = void> {
  (span: Span): Promise<T>;
}

function getTraceContext(job: JobQueueRecord): TraceContextCarrier {
  return (job as JobQueueRecord & { traceContext?: TraceContextCarrier }).traceContext;
}

function hashPayload(payload: unknown): string | undefined {
  if (payload === null || payload === undefined) {
    return undefined;
  }

  try {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return createHash('sha256').update(serialized).digest('hex');
  } catch {
    return undefined;
  }
}

export class JobTracer {
  async runWithSpan<T>(
    job: JobQueueRecord,
    handler: JobSpanHandler<T>,
    traceContext: TraceContextCarrier = getTraceContext(job)
  ): Promise<T> {
    return withJobSpan(
      job,
      async (span) => {
        this.annotateSpan(span, job);
        return handler(span);
      },
      { traceContext }
    );
  }

  private annotateSpan(span: Span, job: JobQueueRecord): void {
    const payloadHash = hashPayload(job.payload);

    if (payloadHash) {
      span.setAttribute('queue.job.payload_hash', payloadHash);
    }

    span.setAttribute('queue.job.attempts', job.attempts);
    span.setAttribute('queue.job.max_attempts', job.maxAttempts);
    span.setAttribute('queue.job.status', job.status);
  }
}

export const jobTracer = new JobTracer();

export function traceQueueJob<T>(
  job: JobQueueRecord,
  handler: JobSpanHandler<T>,
  traceContext: TraceContextCarrier = getTraceContext(job)
): Promise<T> {
  return jobTracer.runWithSpan(job, handler, traceContext);
}


