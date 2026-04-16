/**
 * Canonical API response envelope.
 *
 * Every web-side API response MUST conform to this shape:
 *   { result, blockers, explanation, timestamp }
 *
 * Raw errors, debug artifacts, and internal fields are stripped before
 * reaching the client. Explanations are user-safe strings, never stack traces.
 */

import { NextResponse } from 'next/server';

export interface ApiResponse<T = unknown> {
  result: T | null;
  blockers: string[];
  explanation: string;
  timestamp: string;
}

/** Build a success envelope. */
export function ok<T>(result: T, explanation = 'OK'): ApiResponse<T> {
  return {
    result,
    blockers: [],
    explanation,
    timestamp: new Date().toISOString(),
  };
}

/** Build a failure envelope. Never include raw exception text. */
export function fail(
  explanation: string,
  opts: { blockers?: string[] } = {},
): ApiResponse<null> {
  return {
    result: null,
    blockers: opts.blockers ?? [],
    explanation,
    timestamp: new Date().toISOString(),
  };
}

/** NextResponse.json wrappers that guarantee envelope shape. */
export function respondOk<T>(result: T, explanation?: string, status = 200): NextResponse {
  return NextResponse.json(ok(result, explanation), { status });
}

export function respondFail(
  explanation: string,
  status: number,
  blockers?: string[],
): NextResponse {
  return NextResponse.json(fail(explanation, { blockers }), { status });
}

/**
 * Strip internal / debug / raw-error fields from a backend response
 * before it reaches the client. Applied recursively.
 */
const INTERNAL_FIELD_PATTERNS: RegExp[] = [
  /^_/,           // convention: leading underscore = internal
  /^debug/i,      // debug, debugInfo, debug_trace
  /^trace/i,      // trace, traceId, traceContext
  /^stack/i,      // stack, stackTrace
  /^internal/i,   // internal, internalId, internalState
  /^raw/i,        // raw, rawError, rawPayload
  /^__/,          // __proto__, __meta, etc.
];

export function sanitize<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (data instanceof Date) return data;
  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (INTERNAL_FIELD_PATTERNS.some((p) => p.test(key))) continue;
    out[key] = sanitize(value);
  }
  return out as T;
}

/**
 * Map a backend HTTP status + body to a user-safe explanation.
 * Never surfaces raw error fields from the backend.
 */
export function explainBackend(status: number): string {
  if (status >= 500) return 'The system is temporarily unavailable. Please retry.';
  if (status === 404) return 'Not found.';
  if (status === 403) return 'Access denied.';
  if (status === 401) return 'Authentication required.';
  if (status === 400) return 'Request could not be processed.';
  return 'OK';
}
