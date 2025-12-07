/**
 * Shared error classes and error-handling utilities
 *
 * Provides consistent error handling across the monorepo
 */

/**
 * Base error class for application errors
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'APP_ERROR',
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, true, details);
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', details?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_ERROR', 401, true, details);
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', details?: Record<string, unknown>) {
    super(message, 'AUTHORIZATION_ERROR', 403, true, details);
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, true, { resource, identifier });
  }
}

/**
 * Conflict error (e.g., duplicate resource)
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, true, details);
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 'RATE_LIMIT', 429, true, { retryAfter });
  }
}

/**
 * Internal server error
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: Record<string, unknown>) {
    super(message, 'INTERNAL_ERROR', 500, false, details);
  }
}

/**
 * Service unavailable error
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string, details?: Record<string, unknown>) {
    super(`Service '${service}' is unavailable`, 'SERVICE_UNAVAILABLE', 503, true, {
      service,
      ...details,
    });
  }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
  /**
   * Check if error is an operational error
   */
  static isOperational(error: unknown): boolean {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    return false;
  }

  /**
   * Convert error to safe response format
   */
  static toSafeError(error: unknown): {
    message: string;
    code: string;
    statusCode: number;
    details?: Record<string, unknown>;
  } {
    if (error instanceof AppError) {
      return {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
      };
    }

    if (error instanceof Error) {
      return {
        message: process.env.NODE_ENV === 'production'
          ? 'An error occurred'
          : error.message,
        code: 'UNKNOWN_ERROR',
        statusCode: 500,
      };
    }

    return {
      message: 'An unknown error occurred',
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
    };
  }

  /**
   * Log error appropriately
   */
  static logError(error: unknown, context?: Record<string, unknown>): void {
    if (error instanceof AppError && error.isOperational) {
      // Log operational errors at info level
      console.info('[Operational Error]', {
        name: error.name,
        message: error.message,
        code: error.code,
        details: error.details,
        context,
      });
    } else {
      // Log programming errors at error level
      console.error('[Programming Error]', {
        error,
        context,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }
}

