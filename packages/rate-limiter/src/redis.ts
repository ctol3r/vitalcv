/**
 * Redis Rate Limiter
 *
 * Sliding window rate limiter using Redis sorted sets.
 * Used in PROD mode.
 *
 * Algorithm: Sliding Window Log with Redis ZSET
 * - Stores request timestamps as scores in a sorted set
 * - Uses ZREMRANGEBYSCORE to remove old timestamps
 * - Uses ZCARD to count requests in window
 * - Uses ZADD to record new requests
 */

import type { RateLimiter, RateLimiterConfig, RateLimitResult } from './types';

// Redis client type (compatible with redis@4)
export interface RedisClientLike {
  zRemRangeByScore(key: string, min: number | string, max: number | string): Promise<number>;
  zCard(key: string): Promise<number>;
  zAdd(key: string, members: { score: number; value: string }[]): Promise<number>;
  zRange(key: string, start: number, stop: number): Promise<string[]>;
  del(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<boolean>;
}

export class RedisRateLimiter implements RateLimiter {
  private readonly config: RateLimiterConfig;
  private readonly redis: RedisClientLike;

  constructor(config: RateLimiterConfig, redis: RedisClientLike) {
    this.config = {
      keyPrefix: 'rl',
      ...config,
    };
    this.redis = redis;
  }

  async check(clientId: string): Promise<RateLimitResult> {
    const key = this.buildKey(clientId);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Remove timestamps outside the sliding window
    await this.redis.zRemRangeByScore(key, 0, windowStart);

    // Count requests in current window
    const currentCount = await this.redis.zCard(key);

    // Check if limit exceeded
    const allowed = currentCount < this.config.maxRequests;

    if (allowed) {
      // Record this request (use UUID to avoid score collisions)
      const requestId = `${now}-${Math.random().toString(36).substring(2, 9)}`;
      await this.redis.zAdd(key, [{ score: now, value: requestId }]);

      // Set expiry to window duration + buffer (for cleanup)
      const expirySeconds = Math.ceil(this.config.windowMs / 1000) + 60;
      await this.redis.expire(key, expirySeconds);
    }

    // Get oldest timestamp for reset calculation
    const oldestEntries = await this.redis.zRange(key, 0, 0);
    const oldestTimestamp = oldestEntries.length > 0
      ? parseFloat(oldestEntries[0].split('-')[0])
      : now;

    // Calculate reset time (end of current window)
    const reset = Math.ceil((oldestTimestamp + this.config.windowMs) / 1000);

    // Calculate retry after
    const retryAfter = allowed
      ? undefined
      : Math.ceil((oldestTimestamp + this.config.windowMs - now) / 1000);

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
    await this.redis.del(key);
  }

  getConfig(): RateLimiterConfig {
    return { ...this.config };
  }

  private buildKey(clientId: string): string {
    return `${this.config.keyPrefix}:${clientId}`;
  }
}
