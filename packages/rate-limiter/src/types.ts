/**
 * Rate Limiter Types and Interfaces
 *
 * Defines the contract for rate limiting implementations.
 */

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /**
   * Maximum number of requests allowed in the time window
   */
  maxRequests: number;

  /**
   * Time window in milliseconds
   */
  windowMs: number;

  /**
   * Optional key prefix for storage (useful for namespacing)
   */
  keyPrefix?: string;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  allowed: boolean;

  /**
   * Number of requests remaining in the current window
   */
  remaining: number;

  /**
   * Timestamp when the rate limit will reset (Unix time in seconds)
   */
  reset: number;

  /**
   * Number of seconds until retry is allowed (only set when allowed=false)
   */
  retryAfter?: number;

  /**
   * Total limit for the window
   */
  limit: number;
}

/**
 * Rate limiter interface
 *
 * MODE-AWARE:
 * - TEST/DEV: Use InMemoryRateLimiter
 * - PROD: Use RedisRateLimiter
 */
export interface RateLimiter {
  /**
   * Check if a request is allowed for the given client ID
   *
   * @param clientId - Unique identifier for the client (e.g., IP, API key, user ID)
   * @returns Rate limit result
   */
  check(clientId: string): Promise<RateLimitResult>;

  /**
   * Reset rate limit for a specific client (admin operation)
   *
   * @param clientId - Client identifier to reset
   */
  reset(clientId: string): Promise<void>;

  /**
   * Get current configuration
   */
  getConfig(): RateLimiterConfig;
}
