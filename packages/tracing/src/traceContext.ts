/**
 * W3C Trace Context Implementation
 *
 * Implements parsing and generation of W3C Trace Context headers (traceparent).
 * Format: 00-{trace-id}-{span-id}-{trace-flags}
 *
 * Spec: https://www.w3.org/TR/trace-context/
 */

import { randomBytes } from 'crypto';

export interface TraceContext {
  trace_id: string;      // 32 hex characters (16 bytes)
  span_id: string;       // 16 hex characters (8 bytes)
  trace_flags: string;   // 2 hex characters (1 byte)
}

/**
 * Parse a W3C traceparent header
 *
 * Format: version-trace_id-parent_id-trace_flags
 * Example: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
 *
 * @param header - The traceparent header value
 * @returns Parsed TraceContext or null if invalid
 */
export function parseTraceparent(header: string): TraceContext | null {
  if (!header || typeof header !== 'string') {
    return null;
  }

  const parts = header.trim().split('-');

  // Must have exactly 4 parts: version-trace_id-span_id-flags
  if (parts.length !== 4) {
    return null;
  }

  const [version, traceId, spanId, traceFlags] = parts;

  // Version must be 00 (currently only supported version)
  if (version !== '00') {
    return null;
  }

  // Trace ID must be 32 hex characters (16 bytes)
  if (!/^[0-9a-f]{32}$/.test(traceId)) {
    return null;
  }

  // Trace ID must not be all zeros
  if (traceId === '00000000000000000000000000000000') {
    return null;
  }

  // Span ID must be 16 hex characters (8 bytes)
  if (!/^[0-9a-f]{16}$/.test(spanId)) {
    return null;
  }

  // Span ID must not be all zeros
  if (spanId === '0000000000000000') {
    return null;
  }

  // Trace flags must be 2 hex characters (1 byte)
  if (!/^[0-9a-f]{2}$/.test(traceFlags)) {
    return null;
  }

  return {
    trace_id: traceId,
    span_id: spanId,
    trace_flags: traceFlags,
  };
}

/**
 * Generate a W3C traceparent header from a TraceContext
 *
 * @param context - The trace context to serialize
 * @returns W3C traceparent header string
 */
export function generateTraceparent(context: TraceContext): string {
  return `00-${context.trace_id}-${context.span_id}-${context.trace_flags}`;
}

/**
 * Generate a new trace ID (16 bytes = 32 hex characters)
 *
 * @returns Random trace ID
 */
export function generateTraceId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Generate a new span ID (8 bytes = 16 hex characters)
 *
 * @returns Random span ID
 */
export function generateSpanId(): string {
  return randomBytes(8).toString('hex');
}

/**
 * Generate a new trace context with random IDs
 *
 * @param sampled - Whether this trace should be sampled (default: true)
 * @returns New TraceContext
 */
export function generateTraceContext(sampled: boolean = true): TraceContext {
  return {
    trace_id: generateTraceId(),
    span_id: generateSpanId(),
    trace_flags: sampled ? '01' : '00',
  };
}

/**
 * Create a child span context from a parent context
 * Preserves trace_id and trace_flags, generates new span_id
 *
 * @param parent - Parent trace context
 * @returns Child trace context
 */
export function createChildSpan(parent: TraceContext): TraceContext {
  return {
    trace_id: parent.trace_id,
    span_id: generateSpanId(),
    trace_flags: parent.trace_flags,
  };
}
