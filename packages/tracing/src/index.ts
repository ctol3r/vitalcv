/**
 * @chai-vc/tracing
 *
 * W3C Trace Context propagation and distributed tracing utilities
 * for chai-vc platform services.
 */

export type { TraceContext } from './traceContext';
export {
  parseTraceparent,
  generateTraceparent,
  generateTraceId,
  generateSpanId,
  generateTraceContext,
  createChildSpan,
} from './traceContext';

export {
  tracingMiddleware,
  getTraceContext,
  getTraceFields,
  type TracingMiddlewareOptions,
} from './middleware';
