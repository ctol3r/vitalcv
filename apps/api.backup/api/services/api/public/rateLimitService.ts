/**
 * B235A-API-005: PublicAPIRateLimitService
 *
 * Tracks request counts per API key and enforces global & route-specific rate limits.
 * Uses Redis/counter and returns error when limits exceeded.
 * Configurable via environment variables.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiKeyInfo } from './authMiddleware';

export interface RateLimitConfig {
  /**
   * Global rate limit per API key (requests per minute)
   */
  globalRequestsPerMinute: number;

  /**
   * Global rate limit per API key (requests per hour)
   */
  globalRequestsPerHour: number;

  /**
   * Route-specific rate limits
   */
  routeLimits: Record<string, {
    requestsPerMinute: number;
    requestsPerHour: number;
  }>;

  /**
   * Redis connection URL (optional, falls back to in-memory)
   */
  redisUrl?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

/**
 * Default rate limit configuration
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  globalRequestsPerMinute: parseInt(
    process.env.PUBLIC_API_RATE_LIMIT_PER_MINUTE || '100',
    10
  ),
  globalRequestsPerHour: parseInt(
    process.env.PUBLIC_API_RATE_LIMIT_PER_HOUR || '1000',
    10
  ),
  routeLimits: {
    '/graphql': {
      requestsPerMinute: parseInt(
        process.env.PUBLIC_API_GRAPHQL_RATE_LIMIT_PER_MINUTE || '60',
        10
      ),
      requestsPerHour: parseInt(
        process.env.PUBLIC_API_GRAPHQL_RATE_LIMIT_PER_HOUR || '500',
        10
      ),
    },
    '/api/public/v1/credentials': {
      requestsPerMinute: 30,
      requestsPerHour: 200,
    },
    '/api/public/v1/organizations': {
      requestsPerMinute: 30,
      requestsPerHour: 200,
    },
  },
  redisUrl: process.env.REDIS_URL,
};

/**
 * In-memory rate limit store (fallback when Redis is not available)
 */
class InMemoryRateLimitStore {
  private store: Map<string, { count: number; resetAt: number }> = new Map();

  async get(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;

    if (Date.now() > entry.resetAt) {
      this.store.delete(key);
      return 0;
    }

    return entry.count;
  }

  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return 1;
    }

    entry.count++;
    return entry.count;
  }

  async getResetAt(key: string): Promise<Date | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    return new Date(entry.resetAt);
  }
}

/**
 * Redis-backed rate limit store
 */
class RedisRateLimitStore {
  private redis: any;
  private initialized: boolean = false;

  constructor(redisUrl: string) {
    this.initializeRedis(redisUrl).catch(err => {
      console.error('Failed to initialize Redis for rate limiting:', err);
      this.initialized = false;
    });
  }

  private async initializeRedis(redisUrl: string): Promise<void> {
    try {
      const Redis = require('ioredis');
      this.redis = new Redis(redisUrl);
      this.initialized = true;
    } catch (error) {
      console.error('Redis initialization failed, falling back to in-memory:', error);
      this.initialized = false;
    }
  }

  private getKey(identifier: string, window: string): string {
    return `rate_limit:${identifier}:${window}`;
  }

  async get(identifier: string, windowMs: number): Promise<number> {
    if (!this.initialized) return 0;

    try {
      const window = Math.floor(Date.now() / windowMs);
      const key = this.getKey(identifier, window.toString());
      const count = await this.redis.get(key);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      console.error('Redis get error:', error);
      return 0;
    }
  }

  async increment(identifier: string, windowMs: number): Promise<number> {
    if (!this.initialized) {
      throw new Error('Redis not initialized');
    }

    try {
      const window = Math.floor(Date.now() / windowMs);
      const key = this.getKey(identifier, window.toString());
      const count = await this.redis.incr(key);
      await this.redis.expire(key, Math.ceil(windowMs / 1000));
      return count;
    } catch (error) {
      console.error('Redis increment error:', error);
      throw error;
    }
  }

  async getResetAt(identifier: string, windowMs: number): Promise<Date | null> {
    if (!this.initialized) return null;

    try {
      const window = Math.floor(Date.now() / windowMs);
      const nextWindow = (window + 1) * windowMs;
      return new Date(nextWindow);
    } catch (error) {
      return null;
    }
  }
}

/**
 * Public API Rate Limit Service
 */
export class PublicAPIRateLimitService {
  private config: RateLimitConfig;
  private store: InMemoryRateLimitStore | RedisRateLimitStore;

  constructor(config: RateLimitConfig = DEFAULT_CONFIG) {
    this.config = config;

    if (config.redisUrl) {
      try {
        this.store = new RedisRateLimitStore(config.redisUrl);
      } catch (error) {
        console.warn('Redis initialization failed, using in-memory store:', error);
        this.store = new InMemoryRateLimitStore();
      }
    } else {
      this.store = new InMemoryRateLimitStore();
    }
  }

  /**
   * Get rate limit identifier from request
   */
  private getIdentifier(req: AuthenticatedRequest): string {
    // Use API key ID if available, otherwise use IP address
    if (req.apiKey) {
      return `api_key:${req.apiKey.id}`;
    }
    if (req.oauthToken) {
      return `oauth:${req.oauthToken.clientId}`;
    }
    return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
  }

  /**
   * Check rate limit for a request
   */
  async checkRateLimit(
    req: AuthenticatedRequest,
    route?: string
  ): Promise<RateLimitResult> {
    const identifier = this.getIdentifier(req);

    // Get route-specific limits or use global limits
    const routeLimit = route && this.config.routeLimits[route]
      ? this.config.routeLimits[route]
      : null;

    const limitPerMinute = routeLimit
      ? routeLimit.requestsPerMinute
      : this.config.globalRequestsPerMinute;

    const limitPerHour = routeLimit
      ? routeLimit.requestsPerHour
      : this.config.globalRequestsPerHour;

    // Check per-minute limit
    const minuteWindowMs = 60 * 1000;
    const minuteKey = `${identifier}:minute`;
    const minuteCount = await this.store.increment(minuteKey, minuteWindowMs);
    const minuteResetAt = await this.store.getResetAt(minuteKey, minuteWindowMs) || new Date(Date.now() + minuteWindowMs);

    if (minuteCount > limitPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: minuteResetAt,
        limit: limitPerMinute,
      };
    }

    // Check per-hour limit
    const hourWindowMs = 60 * 60 * 1000;
    const hourKey = `${identifier}:hour`;
    const hourCount = await this.store.increment(hourKey, hourWindowMs);
    const hourResetAt = await this.store.getResetAt(hourKey, hourWindowMs) || new Date(Date.now() + hourWindowMs);

    if (hourCount > limitPerHour) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: hourResetAt,
        limit: limitPerHour,
      };
    }

    // Calculate remaining requests (use the more restrictive limit)
    const remaining = Math.min(
      limitPerMinute - minuteCount,
      limitPerHour - hourCount
    );

    return {
      allowed: true,
      remaining,
      resetAt: minuteResetAt, // Use minute reset time for headers
      limit: limitPerMinute,
    };
  }

  /**
   * Express middleware for rate limiting
   */
  middleware(route?: string) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const result = await this.checkRateLimit(req, route);

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', result.limit.toString());
        res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
        res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt.getTime() / 1000).toString());

        if (!result.allowed) {
          const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
          res.setHeader('Retry-After', retryAfter.toString());

          return res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded',
            retryAfter,
            resetAt: result.resetAt.toISOString(),
          });
        }

        next();
      } catch (error) {
        console.error('Rate limit error:', error);
        // On error, allow the request but log it
        next();
      }
    };
  }
}

/**
 * Singleton instance
 */
export const rateLimitService = new PublicAPIRateLimitService();

