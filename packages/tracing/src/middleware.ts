/**
 * Express middleware for W3C Trace Context propagation
 *
 * Extracts or generates trace context and attaches it to request object.
 * Sets traceparent response header for downstream tracing.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import {
  TraceContext,
  parseTraceparent,
  generateTraceContext,
  generateTraceparent,
  createChildSpan,
} from './traceContext';

// Extend Express Request type to include traceContext
declare global {
  namespace Express {
    interface Request {
      traceContext?: TraceContext;
    }
  }
}

export interface TracingMiddlewareOptions {
  /**
   * Whether to create a new child span for each request (default: true)
   * If true, preserves incoming trace_id but generates new span_id
   * If false, preserves both trace_id and span_id from incoming header
   */
  createChildSpan?: boolean;

  /**
   * Custom header name to read trace context from (default: 'traceparent')
   */
  headerName?: string;
}

/**
 * Create Express middleware for trace context propagation
 *
 * Usage:
 * ```typescript
 * import { tracingMiddleware } from '@chai-vc/tracing';
 *
 * app.use(tracingMiddleware());
 * ```
 *
 * @param options - Middleware configuration options
 * @returns Express middleware function
 */
export function tracingMiddleware(options: TracingMiddlewareOptions = {}): RequestHandler {
  const { createChildSpan: shouldCreateChild = true, headerName = 'traceparent' } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    let traceContext: TraceContext;

    // Extract traceparent from incoming request
    const incomingHeader = req.headers[headerName.toLowerCase()];
    const headerValue = Array.isArray(incomingHeader) ? incomingHeader[0] : incomingHeader;

    if (headerValue && typeof headerValue === 'string') {
      const parsed = parseTraceparent(headerValue);

      if (parsed) {
        // Valid traceparent found - create child span or preserve as-is
        traceContext = shouldCreateChild ? createChildSpan(parsed) : parsed;
      } else {
        // Invalid traceparent - generate new context
        traceContext = generateTraceContext();
      }
    } else {
      // No traceparent header - generate new context
      traceContext = generateTraceContext();
    }

    // Attach trace context to request
    req.traceContext = traceContext;

    // Set traceparent response header for downstream services
    res.setHeader('traceparent', generateTraceparent(traceContext));

    // Also set trace-id and span-id as separate headers for easier debugging
    res.setHeader('x-trace-id', traceContext.trace_id);
    res.setHeader('x-span-id', traceContext.span_id);

    next();
  };
}

/**
 * Extract trace context from Express request
 *
 * Helper function to safely get trace context from request object.
 *
 * @param req - Express request object
 * @returns TraceContext if available, null otherwise
 */
export function getTraceContext(req: Request): TraceContext | null {
  return req.traceContext || null;
}

/**
 * Create a logging context object with trace fields
 *
 * Extracts trace_id and span_id from request for structured logging.
 *
 * @param req - Express request object
 * @returns Object with trace_id and span_id fields
 */
export function getTraceFields(req: Request): { trace_id?: string; span_id?: string } {
  const context = getTraceContext(req);
  if (!context) {
    return {};
  }

  return {
    trace_id: context.trace_id,
    span_id: context.span_id,
  };
}
