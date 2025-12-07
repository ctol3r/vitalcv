/**
 * B146A-QA-007: Log unhandled promise rejections & process-level errors once
 *
 * Sets up process-level error handlers to:
 * - Log unhandled promise rejections
 * - Log uncaught exceptions
 * - Prevent double-logging
 * - Optionally exit gracefully
 */

let hasLoggedUnhandledRejection = false;
let hasLoggedUncaughtException = false;

/**
 * Setup process-level error handlers
 * Should be called once during application bootstrap
 */
export function setupErrorHooks(options: {
  exitOnUnhandledRejection?: boolean;
  exitOnUncaughtException?: boolean;
} = {}) {
  const {
    exitOnUnhandledRejection = false,
    exitOnUncaughtException = true,
  } = options;

  // B146A-QA-007: Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    // Prevent double-logging
    if (hasLoggedUnhandledRejection) {
      return;
    }
    hasLoggedUnhandledRejection = true;

    const errorMessage = reason instanceof Error
      ? reason.message
      : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;

    console.error('[ERROR HOOK] Unhandled Promise Rejection:', {
      error: errorMessage,
      stack,
      promise: promise.toString(),
      timestamp: new Date().toISOString(),
    });

    // Log to error tracking service if available
    if (process.env.SENTRY_DSN) {
      // TODO: Integrate with Sentry or other error tracking
      console.warn('[ERROR HOOK] Error tracking service not configured');
    }

    // Optionally exit process
    if (exitOnUnhandledRejection) {
      console.error('[ERROR HOOK] Exiting process due to unhandled rejection');
      process.exit(1);
    }
  });

  // B146A-QA-007: Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    // Prevent double-logging
    if (hasLoggedUncaughtException) {
      return;
    }
    hasLoggedUncaughtException = true;

    console.error('[ERROR HOOK] Uncaught Exception:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString(),
    });

    // Log to error tracking service if available
    if (process.env.SENTRY_DSN) {
      // TODO: Integrate with Sentry or other error tracking
      console.warn('[ERROR HOOK] Error tracking service not configured');
    }

    // Optionally exit process (default: true for uncaught exceptions)
    if (exitOnUncaughtException) {
      console.error('[ERROR HOOK] Exiting process due to uncaught exception');
      process.exit(1);
    }
  });

  // Reset flags on successful shutdown (for testing)
  process.on('SIGTERM', () => {
    hasLoggedUnhandledRejection = false;
    hasLoggedUncaughtException = false;
  });

  process.on('SIGINT', () => {
    hasLoggedUnhandledRejection = false;
    hasLoggedUncaughtException = false;
  });

  console.log('[ERROR HOOK] Process error handlers initialized');
}

/**
 * Reset error hook flags (for testing)
 */
export function resetErrorHookFlags() {
  hasLoggedUnhandledRejection = false;
  hasLoggedUncaughtException = false;
}

