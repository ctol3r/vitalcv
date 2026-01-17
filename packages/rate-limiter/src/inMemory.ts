/**
 * In-Memory Rate Limiter
 *
 * Sliding window rate limiter using Map-based storage.
 * Used in TEST and DEV modes (no network calls).
 *
 * Algorithm: Sliding Window Log
 * - Stores timestamps of all requests in a sorted array
 * - On each check, removes timestamps outside the window
 * - Counts remaining timestamps against limit
 */

import type { RateLimiter, RateLimiterConfig, RateLimitResult } from './types';

interface RequestLog {
  timestamps: number[]; // Sorted array of request timestamps (ms)
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly storage = new Map<string, RequestLog>();
  private readonly config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = {
      keyPrefix: 'rl',
      ...config,
    };
  }

  async check(clientId: string): Promise<RateLimitResult> {
    const key = this.buildKey(clientId);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get or create request log
    let log = this.storage.get(key);
    if (!log) {
      log = { timestamps: [] };
      this.storage.set(key, log);
    }

    // Remove timestamps outside the sliding window
    log.timestamps = log.timestamps.filter((ts) => ts > windowStart);

    // Check if limit exceeded
    const currentCount = log.timestamps.length;
    const allowed = currentCount < this.config.maxRequests;

    if (allowed) {
      // Record this request
      log.timestamps.push(now);
    }

    // Calculate reset time (end of current window)
    const oldestTimestamp = log.timestamps[0] || now;
    const reset = Math.ceil((oldestTimestamp + this.config.windowMs) / 1000);

    // Calculate retry after (seconds until oldest request expires)
    const retryAfter = allowed ? undefined : Math.ceil((oldestTimestamp + this.config.windowMs - now) / 1000);

    return {
      allowed,
      remaining: Math.max(0, this.config.maxRequests - currentCount - (allowed ? 1 : 0)),
      reset,
      retryAfter,
      limit: this.config.maxRequests,
    };
  }

  async reset(clientId: string): Promise<void> {
    const key = this.buildKey(clientId);
    this.storage.delete(key);
  }

  getConfig(): RateLimiterConfig {
    return { ...this.config };
  }

  /**
   * Clear all rate limit data (for testing)
   */
  clear(): void {
    this.storage.clear();
  }

  /**
   * Get current storage size (for debugging/testing)
   */
  size(): number {
    return this.storage.size;
  }

  private buildKey(clientId: string): string {
    return `${this.config.keyPrefix}:${clientId}`;
  }
}
