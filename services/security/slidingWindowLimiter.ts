const log = getServiceLogger('security/slidingWindowLimiter');
/**
 * B143E-SPAM-002: Generic sliding-window rate limiter utility
 *
 * Implements fixed + sliding window using Redis for distributed rate limiting.
 * Configurable limit/window; tests verify blocking & reset semantics.
 */

import { createClient, RedisClientType } from 'redis';
import { getServiceLogger } from '../logging/serviceLogger';

export interface SlidingWindowLimiterConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Redis connection URL (optional, falls back to env or in-memory) */
  redisUrl?: string;
  /** Key prefix for Redis keys */
  keyPrefix?: string;
  /** Whether to fail open if Redis is unavailable (default: false) */
  failOpen?: boolean;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in the current window */
  remaining: number;
  /** Time when the window resets (Unix timestamp in seconds) */
  resetAt: number;
  /** Number of requests made in the current window */
  current: number;
}

/**
 * In-memory fallback store (used when Redis is unavailable)
 */
class InMemoryStore {
  private windows: Map<string, { count: number; resetAt: number }> = new Map();

  async increment(key: string, windowSeconds: number): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const entry = this.windows.get(key);

    if (!entry || now >= entry.resetAt) {
      // New window
      this.windows.set(key, {
        count: 1,
        resetAt: now + windowSeconds,
      });
      return 1;
    }

    // Increment existing window
    entry.count++;
    return entry.count;
  }

  async get(key: string, windowSeconds: number): Promise<{ count: number; resetAt: number }> {
    const now = Math.floor(Date.now() / 1000);
    const entry = this.windows.get(key);

    if (!entry || now >= entry.resetAt) {
      // Window expired or doesn't exist
      return { count: 0, resetAt: now + windowSeconds };
    }

    return entry;
  }

  async reset(key: string): Promise<void> {
    this.windows.delete(key);
  }

  cleanup(): void {
    const now = Math.floor(Date.now() / 1000);
    for (const [key, entry] of this.windows.entries()) {
      if (now >= entry.resetAt) {
        this.windows.delete(key);
      }
    }
  }
}

/**
 * Sliding Window Rate Limiter using Redis with in-memory fallback
 *
 * Implements a sliding window algorithm using Redis sorted sets for distributed rate limiting.
 * Falls back to in-memory storage if Redis is unavailable (unless failOpen is false).
 */
export class SlidingWindowLimiter {
  private redisClient: RedisClientType | null = null;
  private memoryStore: InMemoryStore;
  private config: Required<SlidingWindowLimiterConfig>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: SlidingWindowLimiterConfig) {
    this.config = {
      limit: config.limit,
      windowSeconds: config.windowSeconds,
      redisUrl: config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
      keyPrefix: config.keyPrefix || 'rate_limit',
      failOpen: config.failOpen ?? true,
    };

    this.memoryStore = new InMemoryStore();

    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.memoryStore.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Get or create Redis client
   */
  private async getRedisClient(): Promise<RedisClientType | null> {
    if (this.redisClient) {
      try {
        if (this.redisClient.isOpen) {
          await this.redisClient.ping();
          return this.redisClient;
        }
      } catch {
        this.redisClient = null;
      }
    }

    try {
      this.redisClient = createClient({ url: this.config.redisUrl });

      this.redisClient.on('error', (err) => {
        log.warn('[SlidingWindowLimiter] Redis error:', err);
        this.redisClient = null;
      });

      await this.redisClient.connect();
      return this.redisClient;
    } catch (err) {
      log.warn('[SlidingWindowLimiter] Redis unavailable, using in-memory fallback:', err);
      this.redisClient = null;
      return null;
    }
  }

  /**
   * Build Redis key
   */
  private buildKey(identifier: string): string {
    return `${this.config.keyPrefix}:${identifier}`;
  }

  /**
   * Check if a request is allowed and record it
   *
   * @param identifier - Unique identifier (e.g., IP address, user ID, email)
   * @returns Rate limit result
   */
  async check(identifier: string): Promise<RateLimitResult> {
    const client = await this.getRedisClient();
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - this.config.windowSeconds;
    const key = this.buildKey(identifier);

    if (client) {
      try {
        // Use Redis sorted set for sliding window
        const pipeline = client.multi();

        // Remove expired entries (outside the window)
        pipeline.zRemRangeByScore(key, '-inf', windowStart.toString());

        // Count current entries in the window
        pipeline.zCard(key);

        // Add current request timestamp
        pipeline.zAdd(key, { score: now, value: now.toString() });

        // Set expiration on the key (window + 1 second buffer)
        pipeline.expire(key, this.config.windowSeconds + 1);

        // Execute pipeline
        const results = await pipeline.exec();

        if (!results || results.length < 2) {
          throw new Error('Pipeline execution failed');
        }

        const currentCount = results[1] as number;
        const newCount = currentCount + 1;
        const resetAt = now + this.config.windowSeconds;
        const allowed = newCount <= this.config.limit;

        return {
          allowed,
          remaining: Math.max(0, this.config.limit - newCount),
          resetAt,
          current: newCount,
        };
      } catch (err) {
        log.warn('[SlidingWindowLimiter] Redis error, falling back to memory:', err);
        if (!this.config.failOpen) {
          // Fail closed: deny request if Redis fails
          return {
            allowed: false,
            remaining: 0,
            resetAt: now + this.config.windowSeconds,
            current: this.config.limit + 1,
          };
        }
        // Fall through to memory store
      }
    }

    // Fallback to in-memory store
    if (!this.config.failOpen && !client) {
      // Fail closed: deny if Redis unavailable and failOpen is false
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + this.config.windowSeconds,
        current: this.config.limit + 1,
      };
    }

    const count = await this.memoryStore.increment(identifier, this.config.windowSeconds);
    const entry = await this.memoryStore.get(identifier, this.config.windowSeconds);

    return {
      allowed: count <= this.config.limit,
      remaining: Math.max(0, this.config.limit - count),
      resetAt: entry.resetAt,
      current: count,
    };
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getStatus(identifier: string): Promise<RateLimitResult> {
    const client = await this.getRedisClient();
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - this.config.windowSeconds;
    const key = this.buildKey(identifier);

    if (client) {
      try {
        // Remove expired entries
        await client.zRemRangeByScore(key, '-inf', windowStart.toString());

        // Count current entries
        const count = await client.zCard(key);
        const resetAt = now + this.config.windowSeconds;

        return {
          allowed: count < this.config.limit,
          remaining: Math.max(0, this.config.limit - count),
          resetAt,
          current: count,
        };
      } catch (err) {
        log.warn('[SlidingWindowLimiter] Redis error:', err);
        // Fall through to memory store
      }
    }

    // Fallback to in-memory store
    const entry = await this.memoryStore.get(identifier, this.config.windowSeconds);
    return {
      allowed: entry.count < this.config.limit,
      remaining: Math.max(0, this.config.limit - entry.count),
      resetAt: entry.resetAt,
      current: entry.count,
    };
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string): Promise<void> {
    const client = await this.getRedisClient();
    const key = this.buildKey(identifier);

    if (client) {
      try {
        await client.del(key);
      } catch (err) {
        log.warn('[SlidingWindowLimiter] Redis reset error:', err);
      }
    }

    await this.memoryStore.reset(identifier);
  }

  /**
   * Close Redis connection and cleanup
   */
  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.redisClient) {
      try {
        if (this.redisClient.isOpen) {
          await this.redisClient.quit();
        }
      } catch (err) {
        log.error('[SlidingWindowLimiter] Error closing Redis:', err);
      }
      this.redisClient = null;
    }
  }
}

/**
 * Create a pre-configured rate limiter instance
 */
export function createRateLimiter(
  limit: number,
  windowSeconds: number,
  options?: Partial<SlidingWindowLimiterConfig>
): SlidingWindowLimiter {
  return new SlidingWindowLimiter({
    limit,
    windowSeconds,
    ...options,
  });
}

