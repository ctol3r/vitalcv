import { NextFunction, Request, Response } from 'express';
import { HttpProblemError, createProblemDetail, ProblemDetail } from '../lib/http/errors';
import { getRequestId } from './requestId';

export interface HttpError extends Error {
  status?: number;
  errors?: any;
}

/**
 * Error handler with RFC7807-like problem details
 * Tagged: cursor-batch-1105 (Task 0017)
 *
 * Includes request ID for debugging and support.
 */
export function errorHandler(err: HttpError | HttpProblemError, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(err);
  }

  // Get request ID for tracing
  const requestId = getRequestId(req) || res.locals?.requestId;

  let problemDetail: ProblemDetail;

  // Check if this is an HttpProblemError
  if (err instanceof HttpProblemError) {
    problemDetail = err.toProblemDetail(req.originalUrl);
  } else {
    // Legacy error format - convert to problem detail
    const status = err.status || 500;
    const code = (err as any).code || 'INTERNAL_ERROR';
    const title = err.message || 'Internal Server Error';

    problemDetail = createProblemDetail(status, code, title, undefined, {
      instance: req.originalUrl,
    });

    // Include legacy errors field if present
    if (err.errors) {
      problemDetail.errors = err.errors;
    }
  }

  // Add request ID to problem detail for debugging
  if (requestId) {
    (problemDetail as any).requestId = requestId;
  }

  // Log error with request ID
  console.error(`[Error] ${problemDetail.status} ${problemDetail.title}`, {
    requestId,
    code: (problemDetail as any).code,
    instance: problemDetail.instance,
    stack: err.stack,
  });

  res.set('Content-Type', 'application/problem+json; charset=utf-8');
  res.status(problemDetail.status).json(problemDetail);
}
