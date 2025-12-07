/**
 * B235B-API-017: RateLimitingMiddleware
 *
 * Middleware that applies request rate limits.
 * Reads limits from APIQuotaService and returns 429 errors when exceeded.
 */

import { Request, Response, NextFunction } from 'express';
import { APIQuotaService } from './apiQuotaService';
import { AuthenticatedRequest } from './authMiddleware';

export interface RateLimitConfig {
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
}

const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  requestsPerMinute: 60,
  requestsPerHour: 1000,
  requestsPerDay: 10000,
};

/**
 * In-memory rate limit store (use Redis in production)
 */
class RateLimitStore {
  private store: Map<
    string,
    {
      minute: number[];
      hour: number[];
      day: number[];
    }
  > = new Map();

  record(apiKeyId: string): void {
    const now = Date.now();
    const key = this.store.get(apiKeyId) || {
      minute: [],
      hour: [],
      day: [],
    };

    // Clean old entries
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    key.minute = key.minute.filter((t) => t > oneMinuteAgo);
    key.hour = key.hour.filter((t) => t > oneHourAgo);
    key.day = key.day.filter((t) => t > oneDayAgo);

    // Add current request
    key.minute.push(now);
    key.hour.push(now);
    key.day.push(now);

    this.store.set(apiKeyId, key);
  }

  getCounts(apiKeyId: string): { minute: number; hour: number; day: number } {
    const key = this.store.get(apiKeyId);
    if (!key) {
      return { minute: 0, hour: 0, day: 0 };
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    return {
      minute: key.minute.filter((t) => t > oneMinuteAgo).length,
      hour: key.hour.filter((t) => t > oneHourAgo).length,
      day: key.day.filter((t) => t > oneDayAgo).length,
    };
  }
}

const rateLimitStore = new RateLimitStore();

/**
 * Create rate limiting middleware
 */
export function createRateLimitingMiddleware(
  quotaService: APIQuotaService,
  customLimits?: RateLimitConfig
) {
  const limits = { ...DEFAULT_RATE_LIMITS, ...customLimits };

  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // Skip rate limiting if no API key
      if (!req.apiKey) {
        return next();
      }

      const apiKeyId = req.apiKey.id;

      // Check quota-based limits first
      const quotaCheck = await quotaService.checkQuota(
        apiKeyId,
        'requests',
        1
      );

      if (!quotaCheck.allowed) {
        return res.status(429).json({
          error: 'Quota exceeded',
          message: `API quota exceeded. Limit: ${quotaCheck.status.limit}, Used: ${quotaCheck.status.currentUsage}`,
          retryAfter: Math.ceil(
            (quotaCheck.status.resetAt.getTime() - Date.now()) / 1000
          ),
          quotaStatus: quotaCheck.status,
        });
      }

      // Check time-based rate limits
      const counts = rateLimitStore.getCounts(apiKeyId);

      // Check per-minute limit
      if (limits.requestsPerMinute && counts.minute >= limits.requestsPerMinute) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Too many requests. Limit: ${limits.requestsPerMinute} requests per minute`,
          retryAfter: 60,
          limit: limits.requestsPerMinute,
          window: '1 minute',
        });
      }

      // Check per-hour limit
      if (limits.requestsPerHour && counts.hour >= limits.requestsPerHour) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Too many requests. Limit: ${limits.requestsPerHour} requests per hour`,
          retryAfter: 3600,
          limit: limits.requestsPerHour,
          window: '1 hour',
        });
      }

      // Check per-day limit
      if (limits.requestsPerDay && counts.day >= limits.requestsPerDay) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Too many requests. Limit: ${limits.requestsPerDay} requests per day`,
          retryAfter: 86400,
          limit: limits.requestsPerDay,
          window: '1 day',
        });
      }

      // Record request
      rateLimitStore.record(apiKeyId);

      // Record quota usage (async, don't await)
      quotaService.recordUsage(apiKeyId, 'requests', 1).catch((err) => {
        console.error('Failed to record quota usage:', err);
      });

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit-Minute', String(limits.requestsPerMinute || 0));
      res.setHeader('X-RateLimit-Limit-Hour', String(limits.requestsPerHour || 0));
      res.setHeader('X-RateLimit-Limit-Day', String(limits.requestsPerDay || 0));
      res.setHeader('X-RateLimit-Remaining-Minute', String(Math.max(0, (limits.requestsPerMinute || 0) - counts.minute - 1)));
      res.setHeader('X-RateLimit-Remaining-Hour', String(Math.max(0, (limits.requestsPerHour || 0) - counts.hour - 1)));
      res.setHeader('X-RateLimit-Remaining-Day', String(Math.max(0, (limits.requestsPerDay || 0) - counts.day - 1)));

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // On error, allow request to proceed (fail open)
      next();
    }
  };
}

/**
 * Middleware for data transfer rate limiting
 */
export function createDataTransferRateLimitMiddleware(
  quotaService: APIQuotaService
) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.apiKey) {
        return next();
      }

      // Estimate request size (headers + body)
      const contentLength = parseInt(
        req.headers['content-length'] || '0',
        10
      );
      const estimatedSize = contentLength || 0;

      if (estimatedSize > 0) {
        const quotaCheck = await quotaService.checkQuota(
          req.apiKey.id,
          'dataTransfer',
          estimatedSize
        );

        if (!quotaCheck.allowed) {
          return res.status(429).json({
            error: 'Data transfer quota exceeded',
            message: `Data transfer quota exceeded. Limit: ${quotaCheck.status.limit} bytes, Used: ${quotaCheck.status.currentUsage}`,
            quotaStatus: quotaCheck.status,
          });
        }
      }

      next();
    } catch (error) {
      console.error('Data transfer rate limiting error:', error);
      next();
    }
  };
}

