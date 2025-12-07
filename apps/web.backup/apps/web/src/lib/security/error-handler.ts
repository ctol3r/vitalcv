/**
 * Secure error handling utilities for API routes
 *
 * Ensures that internal errors are logged server-side but only
 * generic error messages are returned to clients to prevent
 * information leakage.
 */

import { NextResponse } from 'next/server';

/**
 * Opaque error codes for client-facing errors
 * These codes can be referenced in client-side error handling
 * without exposing internal implementation details
 */
export enum ErrorCode {
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_INPUT = 'INVALID_INPUT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

interface ErrorResponse {
  error: ErrorCode;
  message: string;
  requestId?: string;
}

/**
 * Creates a safe error response that doesn't leak internal details
 *
 * @param errorCode - Opaque error code
 * @param userMessage - User-friendly error message
 * @param statusCode - HTTP status code
 * @param requestId - Optional request ID for correlation
 * @returns NextResponse with error
 */
export function createErrorResponse(
  errorCode: ErrorCode,
  userMessage: string,
  statusCode: number = 500,
  requestId?: string
): NextResponse<ErrorResponse> {
  // Log the full error server-side (in production, this should go to a logging service)
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${errorCode}] ${userMessage}`, { requestId });
  }

  return NextResponse.json(
    {
      error: errorCode,
      message: userMessage,
      ...(requestId && { requestId }),
    },
    { status: statusCode }
  );
}

/**
 * Handles errors in API routes with secure error responses
 *
 * @param error - The error that occurred
 * @param context - Additional context for logging
 * @returns NextResponse with safe error message
 */
export function handleApiError(
  error: unknown,
  context?: {
    endpoint?: string;
    requestId?: string;
    userId?: string;
  }
): NextResponse<ErrorResponse> {
  const { endpoint, requestId, userId } = context || {};

  // Log full error details server-side
  const errorDetails = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    endpoint,
    requestId,
    userId,
    timestamp: new Date().toISOString(),
  };

  // In production, send to logging service (e.g., Sentry, CloudWatch)
  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with logging service
    console.error('API Error:', JSON.stringify(errorDetails, null, 2));
  } else {
    console.error('API Error:', errorDetails);
  }

  // Return generic error to client
  if (error instanceof Error) {
    // Check for known error types
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid input provided',
        400,
        requestId
      );
    }

    if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
      return createErrorResponse(
        ErrorCode.AUTHENTICATION_ERROR,
        'Authentication required',
        401,
        requestId
      );
    }

    if (error.message.includes('forbidden') || error.message.includes('authorization')) {
      return createErrorResponse(
        ErrorCode.AUTHORIZATION_ERROR,
        'Insufficient permissions',
        403,
        requestId
      );
    }

    if (error.message.includes('not found')) {
      return createErrorResponse(
        ErrorCode.NOT_FOUND,
        'Resource not found',
        404,
        requestId
      );
    }

    if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
      return createErrorResponse(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        'Too many requests. Please try again later.',
        429,
        requestId
      );
    }
  }

  // Default to generic internal error
  return createErrorResponse(
    ErrorCode.INTERNAL_ERROR,
    'An internal error occurred',
    500,
    requestId
  );
}

/**
 * Wraps an API route handler with error handling
 *
 * @param handler - The API route handler function
 * @returns Wrapped handler with error handling
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      const request = args[0] as { nextUrl?: { pathname: string } };
      const requestId = args[0]?.headers?.get?.('x-request-id') || undefined;

      return handleApiError(error, {
        endpoint: request?.nextUrl?.pathname,
        requestId,
      });
    }
  }) as T;
}

/**
 * Validates that an error response doesn't contain sensitive information
 *
 * @param response - The response to validate
 * @returns True if response is safe
 */
export function isSafeErrorResponse(response: unknown): boolean {
  if (typeof response !== 'object' || response === null) {
    return false;
  }

  const obj = response as Record<string, unknown>;

  // Check for common sensitive fields
  const sensitiveFields = ['stack', 'stackTrace', 'internal', 'path', 'module', 'code'];
  for (const field of sensitiveFields) {
    if (field in obj) {
      return false;
    }
  }

  // Check message doesn't contain file paths or internal details
  const message = String(obj.message || '');
  if (
    message.includes('/node_modules/') ||
    message.includes('at ') ||
    message.includes('Error:') ||
    message.includes('TypeError:') ||
    message.includes('ReferenceError:')
  ) {
    return false;
  }

  return true;
}

