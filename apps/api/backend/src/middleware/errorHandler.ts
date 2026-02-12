import * as Sentry from "@sentry/node";
import { Request, Response, NextFunction } from "express";

/**
 * Central API error handler.
 *
 * - MUST be last middleware registered.
 * - Never throws.
 * - Never leaks stack traces in production.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Default safe response
  let status = 500;
  let message = "Internal Server Error";

  // Domain / application errors
  if (err && typeof err === "object") {
    if ("status" in err && typeof (err as any).status === "number") {
      status = (err as any).status;
    }

    if ("message" in err && typeof (err as any).message === "string") {
      message = (err as any).message;
    }
  }

  const requestId =
    typeof res.locals.request_id === "string" && res.locals.request_id.length > 0
      ? res.locals.request_id
      : "unknown";

  const errorCode =
    err && typeof err === "object" && "code" in err && typeof (err as any).code === "string"
      ? (err as any).code
      : null;

  console.error(
    JSON.stringify({
      event: "request_error",
      request_id: requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      status_code: status,
      message,
      code: errorCode,
      timestamp: new Date().toISOString(),
    })
  );

  // Report 5xx errors to Sentry
  if (status >= 500 && err instanceof Error) {
    Sentry.captureException(err, {
      extra: {
        request_id: requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        code: errorCode,
      },
    });
  }

  res.status(status).json({
    error: message,
  });
}
