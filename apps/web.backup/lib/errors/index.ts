/**
 * Centralized Error Handling for VitalCV Frontend
 *
 * Provides consistent error handling, logging, and user-friendly messages
 */

import { ApiError } from '@/lib/swr/fetcher';

// ============================================
// Error Types
// ============================================

export type ErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'RATE_LIMITED'
  | 'MAINTENANCE'
  | 'UNKNOWN';

export interface ErrorContext {
  code: ErrorCode;
  message: string;
  userMessage: string;
  action?: ErrorAction;
  retryable: boolean;
  requestId?: string;
  originalError?: Error;
}

export type ErrorAction =
  | { type: 'retry' }
  | { type: 'login' }
  | { type: 'home' }
  | { type: 'support' }
  | { type: 'refresh' }
  | { type: 'wait'; seconds: number };

// ============================================
// User-Friendly Error Messages
// ============================================

const ERROR_MESSAGES: Record<ErrorCode, { title: string; description: string }> = {
  NETWORK_ERROR: {
    title: 'Connection Problem',
    description: 'Unable to connect to the server. Please check your internet connection.',
  },
  TIMEOUT: {
    title: 'Request Timeout',
    description: 'The request took too long to complete. Please try again.',
  },
  UNAUTHORIZED: {
    title: 'Session Expired',
    description: 'Your session has expired. Please sign in again.',
  },
  FORBIDDEN: {
    title: 'Access Denied',
    description: "You don't have permission to access this resource.",
  },
  NOT_FOUND: {
    title: 'Not Found',
    description: 'The requested resource could not be found.',
  },
  VALIDATION_ERROR: {
    title: 'Invalid Data',
    description: 'Please check your input and try again.',
  },
  SERVER_ERROR: {
    title: 'Server Error',
    description: 'Something went wrong on our end. Our team has been notified.',
  },
  RATE_LIMITED: {
    title: 'Too Many Requests',
    description: 'Please wait a moment before trying again.',
  },
  MAINTENANCE: {
    title: 'Under Maintenance',
    description: "We're performing scheduled maintenance. Please check back soon.",
  },
  UNKNOWN: {
    title: 'Something Went Wrong',
    description: 'An unexpected error occurred. Please try again.',
  },
};

// ============================================
// Error Classification
// ============================================

/**
 * Classify an error and return context for handling
 */
export function classifyError(error: unknown): ErrorContext {
  // Handle ApiError from SWR
  if (error instanceof ApiError) {
    return classifyApiError(error);
  }

  // Handle standard Error
  if (error instanceof Error) {
    return classifyStandardError(error);
  }

  // Handle unknown errors
  return {
    code: 'UNKNOWN',
    message: String(error),
    userMessage: ERROR_MESSAGES.UNKNOWN.description,
    retryable: true,
  };
}

function classifyApiError(error: ApiError): ErrorContext {
  let code: ErrorCode;
  let action: ErrorAction | undefined;
  let retryable = false;

  switch (error.status) {
    case 0:
      code = 'NETWORK_ERROR';
      retryable = true;
      action = { type: 'retry' };
      break;
    case 401:
      code = 'UNAUTHORIZED';
      action = { type: 'login' };
      break;
    case 403:
      code = 'FORBIDDEN';
      action = { type: 'home' };
      break;
    case 404:
      code = 'NOT_FOUND';
      break;
    case 408:
      code = 'TIMEOUT';
      retryable = true;
      action = { type: 'retry' };
      break;
    case 422:
      code = 'VALIDATION_ERROR';
      break;
    case 429:
      code = 'RATE_LIMITED';
      action = { type: 'wait', seconds: 60 };
      break;
    case 503:
      code = 'MAINTENANCE';
      action = { type: 'refresh' };
      break;
    default:
      if (error.status >= 500) {
        code = 'SERVER_ERROR';
        retryable = true;
        action = { type: 'retry' };
      } else {
        code = 'UNKNOWN';
        retryable = true;
      }
  }

  const messages = ERROR_MESSAGES[code];

  return {
    code,
    message: error.message,
    userMessage: error.info?.userMessage as string || messages.description,
    action,
    retryable,
    requestId: error.requestId,
    originalError: error,
  };
}

function classifyStandardError(error: Error): ErrorContext {
  // Check for network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return {
      code: 'NETWORK_ERROR',
      message: error.message,
      userMessage: ERROR_MESSAGES.NETWORK_ERROR.description,
      action: { type: 'retry' },
      retryable: true,
      originalError: error,
    };
  }

  // Check for abort/timeout
  if (error.name === 'AbortError') {
    return {
      code: 'TIMEOUT',
      message: error.message,
      userMessage: ERROR_MESSAGES.TIMEOUT.description,
      action: { type: 'retry' },
      retryable: true,
      originalError: error,
    };
  }

  return {
    code: 'UNKNOWN',
    message: error.message,
    userMessage: ERROR_MESSAGES.UNKNOWN.description,
    retryable: true,
    originalError: error,
  };
}

// ============================================
// Error Logging
// ============================================

interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an error with context
 */
export function logError(error: unknown, context?: LogContext): void {
  const classified = classifyError(error);

  const logData = {
    code: classified.code,
    message: classified.message,
    requestId: classified.requestId,
    ...context,
    timestamp: new Date().toISOString(),
  };

  // Console log in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[VitalCV Error]', logData, classified.originalError);
  } else {
    // In production, send to error tracking service
    console.error('[VitalCV Error]', logData);

    // Integrate with Sentry if available
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(classified.originalError || error, {
        tags: {
          errorCode: classified.code,
          component: context?.component,
        },
        extra: logData,
      });
    }
  }
}

// ============================================
// Error Display Utilities
// ============================================

/**
 * Get user-friendly error message
 */
export function getUserMessage(error: unknown): string {
  const classified = classifyError(error);
  return classified.userMessage;
}

/**
 * Get error title and description for display
 */
export function getErrorDisplay(error: unknown): { title: string; description: string } {
  const classified = classifyError(error);
  return ERROR_MESSAGES[classified.code];
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: unknown): boolean {
  const classified = classifyError(error);
  return classified.retryable;
}

/**
 * Check if error requires authentication
 */
export function requiresAuth(error: unknown): boolean {
  const classified = classifyError(error);
  return classified.code === 'UNAUTHORIZED';
}

// ============================================
// Toast/Notification Helpers
// ============================================

export interface ToastConfig {
  title: string;
  description: string;
  variant: 'default' | 'destructive';
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Get toast configuration for an error
 */
export function getErrorToast(error: unknown, onRetry?: () => void): ToastConfig {
  const classified = classifyError(error);
  const display = ERROR_MESSAGES[classified.code];

  const config: ToastConfig = {
    title: display.title,
    description: classified.userMessage,
    variant: 'destructive',
  };

  if (classified.retryable && onRetry) {
    config.action = {
      label: 'Retry',
      onClick: onRetry,
    };
  }

  return config;
}

// ============================================
// Re-exports
// ============================================

export { ApiError } from '@/lib/swr/fetcher';
