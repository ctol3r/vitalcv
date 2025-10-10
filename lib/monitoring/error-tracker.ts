/**
 * Error Tracking Utilities
 *
 * Centralized error tracking with Sentry integration
 */

import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

export interface ErrorContext {
  userId?: string
  credentialId?: string
  issuerId?: string
  url?: string
  method?: string
  statusCode?: number
  metadata?: Record<string, unknown>
}

/**
 * Track error with Sentry and local database
 */
export async function trackError(
  error: Error | string,
  context?: ErrorContext,
  severity: ErrorSeverity = 'error'
) {
  const errorMessage = typeof error === 'string' ? error : error.message
  const errorStack = typeof error === 'string' ? undefined : error.stack

  // Send to Sentry
  Sentry.withScope((scope) => {
    // Set severity level
    scope.setLevel(severity as Sentry.SeverityLevel)

    // Add user context
    if (context?.userId) {
      scope.setUser({ id: context.userId })
    }

    // Add tags for filtering
    if (context?.credentialId) {
      scope.setTag('credential_id', context.credentialId)
    }
    if (context?.issuerId) {
      scope.setTag('issuer_id', context.issuerId)
    }
    if (context?.method) {
      scope.setTag('method', context.method)
    }
    if (context?.statusCode) {
      scope.setTag('status_code', context.statusCode.toString())
    }

    // Add extra context
    if (context?.metadata) {
      scope.setContext('metadata', context.metadata)
    }

    // Capture exception
    if (typeof error === 'string') {
      Sentry.captureMessage(error, severity as Sentry.SeverityLevel)
    } else {
      Sentry.captureException(error)
    }
  })

  // Log to database for analysis
  try {
    await prisma.errorLog.create({
      data: {
        userId: context?.userId,
        errorType: severity === 'fatal' || severity === 'error' ? 'server' : 'client',
        message: errorMessage,
        stack: errorStack,
        url: context?.url,
        method: context?.method,
        statusCode: context?.statusCode,
        metadata: context?.metadata as any,
      },
    })
  } catch (dbError) {
    // If database logging fails, at least log to console
    console.error('Failed to log error to database:', dbError)
  }
}

/**
 * Track API error
 */
export async function trackAPIError(
  error: Error | string,
  request: Request,
  statusCode: number = 500
) {
  const url = new URL(request.url)
  await trackError(error, {
    url: url.pathname,
    method: request.method,
    statusCode,
    metadata: {
      headers: Object.fromEntries(request.headers.entries()),
    },
  })
}

/**
 * Track authentication error
 */
export async function trackAuthError(
  error: Error | string,
  userId?: string,
  context?: ErrorContext
) {
  await trackError(error, {
    ...context,
    userId,
    metadata: {
      ...context?.metadata,
      errorType: 'authentication',
    },
  }, 'warning')
}

/**
 * Track validation error
 */
export async function trackValidationError(
  error: Error | string,
  context?: ErrorContext
) {
  await trackError(error, {
    ...context,
    metadata: {
      ...context?.metadata,
      errorType: 'validation',
    },
  }, 'warning')
}

/**
 * Track performance issue
 */
export async function trackPerformanceIssue(
  metric: string,
  value: number,
  threshold: number,
  context?: ErrorContext
) {
  if (value > threshold) {
    await trackError(
      `Performance threshold exceeded: ${metric} (${value}ms > ${threshold}ms)`,
      {
        ...context,
        metadata: {
          ...context?.metadata,
          metric,
          value,
          threshold,
        },
      },
      'warning'
    )
  }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: string, email?: string, name?: string) {
  Sentry.setUser({
    id: userId,
    email,
    username: name,
  })
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearUserContext() {
  Sentry.setUser(null)
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: ErrorSeverity = 'info',
  data?: Record<string, unknown>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level: level as Sentry.SeverityLevel,
    data,
  })
}
