import { context as otContext, propagation, Span, SpanStatusCode, trace } from '@opentelemetry/api';

export interface TraceableJob {
  id: string;
  type: string;
  attempts: number;
  maxAttempts: number;
  payload: unknown;
}

type TraceCarrier = Record<string, string>;

function sanitizeCarrier(input: unknown): TraceCarrier | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const carrier: TraceCarrier = {};

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === 'string') {
      carrier[key] = value;
    }
  }

  return Object.keys(carrier).length ? carrier : undefined;
}

function getPayloadSize(payload: unknown): number {
  try {
    if (payload === undefined || payload === null) {
      return 0;
    }

    const stringified = JSON.stringify(payload);
    return Buffer.byteLength(stringified, 'utf8');
  } catch {
    return 0;
  }
}

function annotateSpan(span: Span, job: TraceableJob, payloadSize: number, result: string) {
  span.setAttribute('queue.job.id', job.id);
  span.setAttribute('queue.job.type', job.type);
  span.setAttribute('queue.job.attempt', job.attempts);
  span.setAttribute('queue.job.max_attempts', job.maxAttempts);
  span.setAttribute('queue.job.payload_bytes', payloadSize);
  span.setAttribute('queue.job.result', result);
}

export async function withJobSpan<T>(
  job: TraceableJob,
  handler: (span: Span) => Promise<T>,
  options: { traceContext?: unknown } = {}
): Promise<T> {
  const tracer = trace.getTracer('queue-core');
  const carrier = sanitizeCarrier(options.traceContext);
  const parentContext = carrier ? propagation.extract(otContext.active(), carrier) : undefined;
  const payloadSize = getPayloadSize(job.payload);

  const span = tracer.startSpan(
    `queue.job.${job.type.toLowerCase()}`,
    {
      attributes: {
        'messaging.system': 'job-queue',
        'messaging.operation': 'process',
        'messaging.destination': job.type,
        'queue.job.payload_bytes': payloadSize,
      },
    },
    parentContext
  );

  const ctxWithSpan = trace.setSpan(parentContext ?? otContext.active(), span);

  try {
    const result = await otContext.with(
      ctxWithSpan,
      () => handler(span)
    );
    annotateSpan(span, job, payloadSize, 'success');
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    annotateSpan(span, job, payloadSize, 'error');
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Queue job failed',
    });
    throw error;
  } finally {
    span.end();
  }
}

