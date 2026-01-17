/**
 * DistributedTracingMiddleware
 * Adds trace IDs and spans to all incoming/outgoing requests
 * Correlates logs with traces and supports W3C Trace Context
 */

import { context, propagation, Span, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { NextFunction, Request, Response } from 'express';

export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
  traceState?: string;
}

/**
 * Extract trace context from request headers (W3C Trace Context)
 */
export function extractTraceContext(req: Request): TraceContext | null {
  const traceParent = req.headers['traceparent'] as string;
  const traceState = req.headers['tracestate'] as string;

  if (!traceParent) {
    return null;
  }

  // Parse W3C Trace Context format: version-trace-id-parent-id-trace-flags
  // Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
  const parts = traceParent.split('-');
  if (parts.length !== 4) {
    return null;
  }

  const [, traceId, spanId, traceFlags] = parts;

  return {
    traceId,
    spanId,
    traceFlags: parseInt(traceFlags, 16),
    traceState: traceState || undefined,
  };
}

/**
 * Inject trace context into request headers (W3C Trace Context)
 */
export function injectTraceContext(
  headers: Record<string, string>,
  traceContext: TraceContext,
): void {
  const traceFlags = traceContext.traceFlags.toString(16).padStart(2, '0');
  headers['traceparent'] = `00-${traceContext.traceId}-${traceContext.spanId}-${traceFlags}`;

  if (traceContext.traceState) {
    headers['tracestate'] = traceContext.traceState;
  }
}

/**
 * Get current trace context
 */
export function getCurrentTraceContext(): TraceContext | null {
  const span = trace.getActiveSpan();
  if (!span) {
    return null;
  }

  const spanContext = span.spanContext();
  if (!spanContext.traceId || !spanContext.spanId) {
    return null;
  }

  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: spanContext.traceFlags,
    traceState: spanContext.traceState?.serialize(),
  };
}

/**
 * Express middleware for distributed tracing
 * Creates spans for incoming requests and correlates logs
 */
export function distributedTracingMiddleware(serviceName: string) {
  const tracer = trace.getTracer(serviceName);

  // Set W3C Trace Context as the default propagator
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  return (req: Request, res: Response, next: NextFunction) => {
    // Extract trace context from incoming headers
    const extractedContext = extractTraceContext(req);

    // Create span for this request
    const span = tracer.startSpan(`${req.method} ${req.path}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.target': req.path,
        'http.host': req.hostname,
        'http.scheme': req.protocol,
        'http.user_agent': req.get('user-agent') || 'unknown',
        'http.route': req.route?.path || req.path,
        'service.name': serviceName,
      },
    });

    // Set span as active in context
    const ctx = trace.setSpan(context.active(), span);

    // Store trace context on request for log correlation
    const traceContext = getCurrentTraceContext();
    if (traceContext) {
      (req as any).traceId = traceContext.traceId;
      (req as any).spanId = traceContext.spanId;
      (req as any).traceContext = traceContext;
    }

    // Store span on request for later access
    (req as any).span = span;

    // Add trace headers to response
    res.setHeader('X-Trace-Id', traceContext?.traceId || '');
    res.setHeader('X-Span-Id', traceContext?.spanId || '');

    // Override res.end to finish span
    const originalEnd = res.end;
    res.end = function (this: Response, ...args: any[]): Response {
      const statusCode = res.statusCode;

      // Set span attributes based on response
      span.setAttribute('http.status_code', statusCode);
      span.setAttribute('http.status_text', res.statusMessage || '');

      // Set span status based on status code
      if (statusCode >= 500) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${statusCode}`,
        });
      } else if (statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${statusCode}`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      // Record response size if available
      const contentLength = res.getHeader('content-length');
      if (contentLength) {
        span.setAttribute('http.response.size', Number(contentLength));
      }

      // End span
      span.end();

      // Call original end
      return originalEnd.apply(this, args as any);
    };

    // Run handler in span context
    context.with(ctx, () => {
      next();
    });
  };
}

/**
 * Create a child span for a specific operation
 */
export function createChildSpan(
  name: string,
  attributes?: Record<string, string | number | boolean>,
): Span {
  const span = trace.getActiveSpan();
  if (!span) {
    const tracer = trace.getTracer('vitalcv');
    return tracer.startSpan(name, { attributes });
  }

  const tracer = trace.getTracer('vitalcv');
  const ctx = trace.setSpan(context.active(), span);

  return tracer.startSpan(
    name,
    {
      attributes,
      kind: SpanKind.INTERNAL,
    },
    ctx,
  );
}

/**
 * Wrapper to automatically trace async functions
 */
export async function withTrace<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  const span = createChildSpan(name, attributes);
  const ctx = trace.setSpan(context.active(), span);

  try {
    const result = await context.with(ctx, () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Wrapper to trace synchronous functions
 */
export function withTraceSync<T>(
  name: string,
  fn: (span: Span) => T,
  attributes?: Record<string, string | number | boolean>,
): T {
  const span = createChildSpan(name, attributes);
  const ctx = trace.setSpan(context.active(), span);

  try {
    const result = context.with(ctx, () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add event to current span
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Set attribute on current span
 */
export function setSpanAttribute(key: string, value: string | number | boolean): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute(key, value);
  }
}

/**
 * Record exception on current span
 */
export function recordSpanException(error: Error): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }
}

/**
 * Get current span
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Trace HTTP client calls
 */
export async function traceHttpCall<T>(
  method: string,
  url: string,
  fn: () => Promise<T>,
): Promise<T> {
  return withTrace(`http.client.${method}`, async (span) => {
    span.setAttribute('http.method', method);
    span.setAttribute('http.url', url);

    // Inject trace context into outgoing request headers
    const headers: Record<string, string> = {};
    const traceContext = getCurrentTraceContext();
    if (traceContext) {
      injectTraceContext(headers, traceContext);
    }

    span.setAttribute('http.request.headers', JSON.stringify(headers));

    return fn();
  });
}

/**
 * Trace database queries
 */
export async function traceDatabaseQuery<T>(
  queryName: string,
  query: string,
  fn: () => Promise<T>,
): Promise<T> {
  return withTrace(`db.query.${queryName}`, async (span) => {
    span.setAttribute('db.statement', query.substring(0, 500)); // Limit query length
    span.setAttribute('db.operation', queryName);
    return fn();
  });
}

/**
 * Trace Kafka message processing
 */
export async function traceKafkaMessage<T>(
  topic: string,
  partition: number,
  offset: string,
  fn: () => Promise<T>,
): Promise<T> {
  return withTrace(`kafka.process.${topic}`, async (span) => {
    span.setAttribute('messaging.system', 'kafka');
    span.setAttribute('messaging.destination', topic);
    span.setAttribute('messaging.kafka.partition', partition);
    span.setAttribute('messaging.kafka.offset', offset);
    return fn();
  });
}

export default {
  distributedTracingMiddleware,
  extractTraceContext,
  injectTraceContext,
  getCurrentTraceContext,
  createChildSpan,
  withTrace,
  withTraceSync,
  addSpanEvent,
  setSpanAttribute,
  recordSpanException,
  getCurrentSpan,
  traceHttpCall,
  traceDatabaseQuery,
  traceKafkaMessage,
};
