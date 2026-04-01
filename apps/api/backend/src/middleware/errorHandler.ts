import * as Sentry from "@sentry/node";
import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/httpError";
import { log } from '../obs/logger';
import type { OperationalEventType } from '../types/auditEventTypes';

function isPrismaSchemaCompatibilityError(error: unknown): error is { code: string } {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (
      (error as { code?: unknown }).code === 'P2021'
      || (error as { code?: unknown }).code === 'P2022'
    );
}

function resolveSchemaCompatibilityMessage(path: string): string {
  if (path.startsWith('/api/employer-review/')) {
    return 'Employer review actions are temporarily unavailable. Please try again shortly.';
  }

  return 'A required service dependency is temporarily unavailable. Please try again shortly.';
}

/**
 * Central API error handler.
 *
 * - MUST be last middleware registered.
 * - Never throws.
 * - Never leaks stack traces in production.
 * - Returns normalized structure: { error: { code, message } }
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let status = 500;
  let message = "Internal Server Error";
  let errorCode = "INTERNAL_ERROR";
  const requestPath = req.originalUrl || req.url;

  if (err instanceof HttpError) {
    status = err.status;
    message = err.message;
    errorCode = err.code;
  } else if (isPrismaSchemaCompatibilityError(err)) {
    status = 503;
    message = resolveSchemaCompatibilityMessage(requestPath);
    errorCode = 'SERVICE_UNAVAILABLE';
  } else if (err && typeof err === "object") {
    if ("status" in err && typeof (err as Record<string, unknown>).status === "number") {
      status = (err as Record<string, unknown>).status as number;
    }
    if ("message" in err && typeof (err as Record<string, unknown>).message === "string") {
      message = (err as Record<string, unknown>).message as string;
    }
    if ("code" in err && typeof (err as Record<string, unknown>).code === "string") {
      errorCode = (err as Record<string, unknown>).code as string;
    }
  }

  const requestId =
    typeof res.locals.request_id === "string" && res.locals.request_id.length > 0
      ? res.locals.request_id
      : "unknown";

  // Determine event type for structured logging (canonical enum)
  const eventType: OperationalEventType = status === 429 ? "RATE_LIMIT_HIT" : status >= 500 ? "API_ERROR" : "VALIDATION_ERROR";

  log('error', 'request_error', {
    eventType,
    request_id: requestId,
    method: req.method,
    path: requestPath,
    status_code: status,
    message,
    code: errorCode,
  });

  // Report 5xx errors to Sentry
  if (status >= 500 && err instanceof Error) {
    Sentry.captureException(err, {
      extra: {
        request_id: requestId,
        method: req.method,
        path: requestPath,
        code: errorCode,
      },
    });
  }

  res.status(status).json({
    error: {
      code: errorCode,
      message,
    },
  });
}
