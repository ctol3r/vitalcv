/**
 * Next.js Instrumentation
 *
 * This file is automatically loaded by Next.js to set up monitoring and tracing
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side instrumentation
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime instrumentation
    await import('./sentry.edge.config')
  }
}
