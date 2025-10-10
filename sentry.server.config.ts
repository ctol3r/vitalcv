/**
 * Sentry Server-Side Configuration
 *
 * Captures server errors, API errors, and backend performance metrics
 */

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN

Sentry.init({
  dsn: SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Tracing
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Profiling
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Enable Node.js specific integrations
  integrations: [
    Sentry.httpIntegration(),
    Sentry.prismaIntegration(),
  ],

  // Ignore common errors
  ignoreErrors: [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
  ],

  // Filter out PII
  beforeSend(event, hint) {
    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEV_ENABLED) {
      return null
    }

    // Remove sensitive data from context
    if (event.contexts?.runtime) {
      delete event.contexts.runtime
    }

    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['cookie']
      delete event.request.headers['x-api-key']
    }

    // Remove sensitive query params
    if (event.request?.query_string) {
      const sensitiveParams = ['token', 'apiKey', 'password', 'secret']
      for (const param of sensitiveParams) {
        event.request.query_string = event.request.query_string?.replace(
          new RegExp(`${param}=[^&]*`, 'gi'),
          `${param}=[REDACTED]`
        )
      }
    }

    return event
  },
})
