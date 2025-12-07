/**
 * Log Correlation IDs
 * Propagates traceId and spanId across services for distributed tracing
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Correlation ID headers
 */
export const CORRELATION_HEADERS = {
  TRACE_ID: 'x-trace-id',
  SPAN_ID: 'x-span-id',
  PARENT_SPAN_ID: 'x-parent-span-id',
  CORRELATION_ID: 'x-correlation-id'
} as const;

/**
 * Correlation context interface
 */
export interface CorrelationContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  correlationId: string;
  userId?: string;
  orgId?: string;
  requestPath?: string;
  requestMethod?: string;
}

/**
 * Storage for correlation context (AsyncLocalStorage)
 */
import { AsyncLocalStorage } from 'async_hooks';

const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Generate a new span ID
 */
function generateSpanId(): string {
  return randomUUID().replace(/-/g, '').substring(0, 16);
}

/**
 * Get current correlation context
 */
export function getCorrelationContext(): CorrelationContext | undefined {
  return correlationStorage.getStore();
}

/**
 * Set correlation context
 */
export function setCorrelationContext(context: CorrelationContext): void {
  // This is only used internally, actual setting happens via middleware
}

/**
 * Express middleware to extract/generate correlation IDs
 */
export function correlationMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Extract or generate trace ID
    const traceId = (req.headers[CORRELATION_HEADERS.TRACE_ID] as string) || randomUUID();

    // Extract or generate span ID
    const spanId = (req.headers[CORRELATION_HEADERS.SPAN_ID] as string) || generateSpanId();

    // Extract parent span ID if present
    const parentSpanId = req.headers[CORRELATION_HEADERS.PARENT_SPAN_ID] as string | undefined;

    // Generate correlation ID (or use trace ID)
    const correlationId = (req.headers[CORRELATION_HEADERS.CORRELATION_ID] as string) || traceId;

    // Extract user/org context if available from auth
    const userId = (req as any).user?.id;
    const orgId = (req as any).user?.orgId;

    // Create correlation context
    const context: CorrelationContext = {
      traceId,
      spanId,
      parentSpanId,
      correlationId,
      userId,
      orgId,
      requestPath: req.path,
      requestMethod: req.method
    };

    // Add correlation headers to response
    res.setHeader(CORRELATION_HEADERS.TRACE_ID, traceId);
    res.setHeader(CORRELATION_HEADERS.SPAN_ID, spanId);
    res.setHeader(CORRELATION_HEADERS.CORRELATION_ID, correlationId);

    // Run the rest of the request in correlation context
    correlationStorage.run(context, () => {
      next();
    });
  };
}

/**
 * Get correlation headers for outgoing HTTP requests
 */
export function getCorrelationHeaders(): Record<string, string> {
  const context = getCorrelationContext();
  if (!context) {
    // Generate new context if not in middleware
    return {
      [CORRELATION_HEADERS.TRACE_ID]: randomUUID(),
      [CORRELATION_HEADERS.SPAN_ID]: generateSpanId(),
      [CORRELATION_HEADERS.CORRELATION_ID]: randomUUID()
    };
  }

  // Create new span for child request
  const childSpanId = generateSpanId();

  return {
    [CORRELATION_HEADERS.TRACE_ID]: context.traceId,
    [CORRELATION_HEADERS.SPAN_ID]: childSpanId,
    [CORRELATION_HEADERS.PARENT_SPAN_ID]: context.spanId,
    [CORRELATION_HEADERS.CORRELATION_ID]: context.correlationId
  };
}

/**
 * Logger wrapper that includes correlation IDs
 */
export function createCorrelatedLogger(baseLogger: any) {
  return {
    info: (message: string, meta?: any) => {
      const context = getCorrelationContext();
      baseLogger.info(message, { ...meta, ...context });
    },
    warn: (message: string, meta?: any) => {
      const context = getCorrelationContext();
      baseLogger.warn(message, { ...meta, ...context });
    },
    error: (message: string, meta?: any) => {
      const context = getCorrelationContext();
      baseLogger.error(message, { ...meta, ...context });
    },
    debug: (message: string, meta?: any) => {
      const context = getCorrelationContext();
      baseLogger.debug(message, { ...meta, ...context });
    }
  };
}

/**
 * Fetch wrapper that propagates correlation headers
 */
export async function correlatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const correlationHeaders = getCorrelationHeaders();

  const headers = {
    ...options.headers,
    ...correlationHeaders
  };

  return fetch(url, {
    ...options,
    headers
  });
}

/**
 * Axios interceptor for correlation headers
 */
export function createAxiosCorrelationInterceptor() {
  return {
    request: (config: any) => {
      const correlationHeaders = getCorrelationHeaders();
      config.headers = {
        ...config.headers,
        ...correlationHeaders
      };
      return config;
    }
  };
}

/**
 * Helper to extract correlation context from incoming message (e.g., Kafka)
 */
export function extractCorrelationFromMessage(headers: Record<string, any>): CorrelationContext {
  return {
    traceId: headers[CORRELATION_HEADERS.TRACE_ID] || randomUUID(),
    spanId: headers[CORRELATION_HEADERS.SPAN_ID] || generateSpanId(),
    parentSpanId: headers[CORRELATION_HEADERS.PARENT_SPAN_ID],
    correlationId: headers[CORRELATION_HEADERS.CORRELATION_ID] || randomUUID()
  };
}

/**
 * Helper to inject correlation context into outgoing message (e.g., Kafka)
 */
export function injectCorrelationIntoMessage(): Record<string, string> {
  return getCorrelationHeaders();
}

/**
 * Run a function within a correlation context
 */
export async function withCorrelationContext<T>(
  context: Partial<CorrelationContext>,
  fn: () => Promise<T>
): Promise<T> {
  const fullContext: CorrelationContext = {
    traceId: context.traceId || randomUUID(),
    spanId: context.spanId || generateSpanId(),
    parentSpanId: context.parentSpanId,
    correlationId: context.correlationId || context.traceId || randomUUID(),
    userId: context.userId,
    orgId: context.orgId,
    requestPath: context.requestPath,
    requestMethod: context.requestMethod
  };

  return correlationStorage.run(fullContext, fn);
}

export default {
  CORRELATION_HEADERS,
  getCorrelationContext,
  correlationMiddleware,
  getCorrelationHeaders,
  createCorrelatedLogger,
  correlatedFetch,
  createAxiosCorrelationInterceptor,
  extractCorrelationFromMessage,
  injectCorrelationIntoMessage,
  withCorrelationContext
};

