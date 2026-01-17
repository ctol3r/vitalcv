/**
 * Rate Limiting Express Middleware
 *
 * Applies rate limiting to Express routes with standard headers.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import type { RateLimiter } from './types';

/**
 * Default client ID extractor - uses IP address
 */
export function defaultClientIdExtractor(req: Request): string {
  // Try multiple headers for real IP (behind proxies)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Client ID extractor based on API key
 */
export function apiKeyClientIdExtractor(req: Request): string {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
  if (apiKey) {
    const key = Array.isArray(apiKey) ? apiKey[0] : apiKey;
    // Hash the API key for privacy
    return `apikey:${key.substring(0, 8)}`;
  }
  return defaultClientIdExtractor(req);
}

/**
 * Client ID extractor based on user ID (requires authentication middleware)
 */
export function userIdClientIdExtractor(req: Request): string {
  const user = (req as any).user;
  if (user && user.id) {
    return `user:${user.id}`;
  }
  return defaultClientIdExtractor(req);
}

export interface RateLimitMiddlewareOptions {
  /**
   * Rate limiter instance
   */
  limiter: RateLimiter;

  /**
   * Function to extract client ID from request
   * Default: IP address
   */
  extractClientId?: (req: Request) => string;

  /**
   * Custom handler for rate limit exceeded
   * Default: Returns 429 with JSON error
   */
  onRateLimitExceeded?: (req: Request, res: Response) => void;

  /**
   * Whether to skip rate limiting for certain requests
   * Default: never skip
   */
  skip?: (req: Request) => boolean;
}

/**
 * Create rate limiting middleware
 *
 * Usage:
 * ```typescript
 * const limiter = new InMemoryRateLimiter({
 *   maxRequests: 100,
 *   windowMs: 60000, // 1 minute
 * });
 *
 * app.use('/api', rateLimitMiddleware({ limiter }));
 * ```
 *
 * @param options - Middleware options
 * @returns Express middleware
 */
export function rateLimitMiddleware(options: RateLimitMiddlewareOptions): RequestHandler {
  const {
    limiter,
    extractClientId = defaultClientIdExtractor,
    onRateLimitExceeded,
    skip,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if should skip
      if (skip && skip(req)) {
        return next();
      }

      // Extract client identifier
      const clientId = extractClientId(req);

      // Check rate limit
      const result = await limiter.check(clientId);

      // Set rate limit headers (standard headers from IETF draft)
      res.setHeader('X-RateLimit-Limit', result.limit.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', result.reset.toString());

      if (!result.allowed) {
        // Rate limit exceeded
        if (result.retryAfter) {
          res.setHeader('Retry-After', result.retryAfter.toString());
        }

        if (onRateLimitExceeded) {
          onRateLimitExceeded(req, res);
        } else {
          res.status(429).json({
            error: 'rate_limit_exceeded',
            message: 'Too many requests. Please try again later.',
            retry_after: result.retryAfter,
            limit: result.limit,
            reset: result.reset,
          });
        }
        return;
      }

      // Request allowed - proceed
      next();
    } catch (error) {
      // On rate limiter error, fail open (allow request)
      console.error('[RateLimiter] Error checking rate limit:', error);
      next();
    }
  };
}

/**
 * Create per-endpoint rate limit middleware with different limits per route
 *
 * Usage:
 * ```typescript
 * const limiters = {
 *   '/api/auth/login': new InMemoryRateLimiter({ maxRequests: 5, windowMs: 60000 }),
 *   '/api/data': new InMemoryRateLimiter({ maxRequests: 100, windowMs: 60000 }),
 * };
 *
 * app.use(perEndpointRateLimitMiddleware(limiters));
 * ```
 */
export function perEndpointRateLimitMiddleware(
  limiters: Record<string, RateLimiter>,
  extractClientId: (req: Request) => string = defaultClientIdExtractor,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const limiter = limiters[req.path];

    if (!limiter) {
      // No rate limit configured for this endpoint
      return next();
    }

    return rateLimitMiddleware({
      limiter,
      extractClientId,
    })(req, res, next);
  };
}
