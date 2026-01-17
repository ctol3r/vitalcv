/**
 * @vitalcv/runtime-mode
 *
 * Runtime mode detection and enforcement for test/dev/prod environments.
 * See docs/execution-modes.md for policy.
 */

export type RuntimeMode = 'test' | 'dev' | 'prod';

/**
 * Detect current runtime mode from NODE_ENV
 *
 * @returns 'test' | 'dev' | 'prod'
 *
 * @example
 * ```typescript
 * const mode = detectRuntimeMode();
 * if (mode === 'test') {
 *   // Use in-memory adapter
 * }
 * ```
 */
export function detectRuntimeMode(): RuntimeMode {
  const nodeEnv = process.env.NODE_ENV || 'development';

  switch (nodeEnv) {
    case 'test':
      return 'test';
    case 'production':
      return 'prod';
    case 'development':
    case 'dev':
    default:
      return 'dev';
  }
}

/**
 * Check if running in test mode
 *
 * @returns true if NODE_ENV === 'test'
 *
 * @example
 * ```typescript
 * if (isTestMode()) {
 *   return inMemoryAdapter.allocate(id);
 * }
 * ```
 */
export function isTestMode(): boolean {
  return detectRuntimeMode() === 'test';
}

/**
 * Check if running in production mode
 *
 * @returns true if NODE_ENV === 'production'
 *
 * @example
 * ```typescript
 * if (isProdMode()) {
 *   // Enforce strict validation
 * }
 * ```
 */
export function isProdMode(): boolean {
  return detectRuntimeMode() === 'prod';
}

/**
 * Check if running in development mode
 *
 * @returns true if NODE_ENV === 'development' or 'dev'
 */
export function isDevMode(): boolean {
  return detectRuntimeMode() === 'dev';
}

/**
 * Assert that network calls are not allowed in current mode
 *
 * Throws in test mode to enforce hermetic testing.
 * Use this before making outbound HTTP/HTTPS requests.
 *
 * @param operationName - Name of the operation attempting network access
 * @throws Error if in test mode
 *
 * @example
 * ```typescript
 * async function fetchData() {
 *   assertNoNetwork('fetchData');
 *   return await fetch('https://api.example.com');
 * }
 * ```
 */
export function assertNoNetwork(operationName: string): void {
  if (isTestMode()) {
    throw new Error(
      `Network calls forbidden in test mode: ${operationName}\n` +
      `See docs/execution-modes.md for guidance on implementing in-memory adapters.\n` +
      `Current NODE_ENV: ${process.env.NODE_ENV}`
    );
  }
}

/**
 * Get mode-appropriate timeout for network operations
 *
 * @returns Timeout in milliseconds
 * - test: N/A (should not be called)
 * - dev: 30000ms (30s)
 * - prod: 10000ms (10s)
 */
export function getNetworkTimeout(): number {
  const mode = detectRuntimeMode();

  switch (mode) {
    case 'test':
      throw new Error('Network operations not allowed in test mode');
    case 'dev':
      return 30000; // 30s for dev (slower local services)
    case 'prod':
      return 10000; // 10s for prod (fail fast)
  }
}
