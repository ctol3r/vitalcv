/**
 * Express Error Handling Middleware
 * Tagged: cursor-batch-1107 (Task 0014)
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Centralized error handler that converts exceptions to RFC7807 ProblemDetail responses
 * Automatically includes requestId and doc_url
 */

import { Request, Response, NextFunction } from 'express';
import { HttpProblemError, createProblemDetail } from './errors';
import { log } from '../logging';

/**
 * Express error handling middleware
 * Catches all errors and converts them to RFC7807 format
 */
export function errorHandlerMiddleware(
  error: Error | HttpProblemError,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const requestId = req.id || 'unknown';

  // Log error with context
  log.error('Request error', {
    requestId,
    method: req.method,
    path: req.path,
    error: error.message,
    stack: error.stack,
    code: (error as HttpProblemError).code,
  });

  // Handle HttpProblemError
  if (error instanceof HttpProblemError) {
    const problemDetail = error.toProblemDetail(requestId);
    return res.status(error.status).json(problemDetail);
  }

  // Handle validation errors (express-validator, Zod, etc.)
  if (error.name === 'ValidationError') {
    return res.status(400).json(
      createProblemDetail(
        400,
        'E_VALIDATION_FAILED',
        'Validation Error',
        error.message,
        { requestId },
      ),
    );
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json(
      createProblemDetail(
        401,
        'E_JWT_INVALID',
        'Invalid Token',
        error.message,
        { requestId },
      ),
    );
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json(
      createProblemDetail(
        401,
        'E_JWT_EXPIRED',
        'Token Expired',
        'The authentication token has expired',
        { requestId },
      ),
    );
  }

  // Handle Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    return res.status(400).json(
      createProblemDetail(
        400,
        'E_DATABASE_ERROR',
        'Database Error',
        'A database error occurred',
        { requestId },
      ),
    );
  }

  // Generic internal server error
  return res.status(500).json(
    createProblemDetail(
      500,
      'E_INTERNAL_SERVER_ERROR',
      'Internal Server Error',
      'An unexpected error occurred',
      { requestId },
    ),
  );
}

/**
 * 404 Not Found handler
 * Should be registered after all routes
 */
export function notFoundHandler(req: Request, res: Response) {
  const requestId = req.id || 'unknown';

  res.status(404).json(
    createProblemDetail(
      404,
      'E_NOT_FOUND',
      'Resource Not Found',
      `The requested resource '${req.method} ${req.path}' was not found`,
      { requestId },
    ),
  );
}

export default errorHandlerMiddleware;

