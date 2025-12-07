import { NextFunction, Request, Response } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Simple in-memory rate limiter middleware.
 * In production, use Redis-backed rate limiter like express-rate-limit with Redis store.
 */
export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Create middleware function for rate limiting.
   */
  middleware(keyFn?: (req: Request) => string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = keyFn ? keyFn(req) : this.getDefaultKey(req);
      const now = Date.now();

      let entry = this.limits.get(key);

      // Reset if window has passed
      if (!entry || now > entry.resetTime) {
        entry = {
          count: 0,
          resetTime: now + this.windowMs,
        };
        this.limits.set(key, entry);
      }

      entry.count++;

      if (entry.count > this.maxRequests) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
        res.setHeader('Retry-After', retryAfter);
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: retryAfter,
        });
      }

      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - entry.count));
      res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());

      next();
    };
  }

  /**
   * Get default rate limit key (IP address).
   */
  private getDefaultKey(req: Request): string {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  /**
   * Clean up expired entries.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }

  /**
   * Clear all rate limit entries (useful for testing).
   */
  clear(): void {
    this.limits.clear();
  }
}

// Export singleton instances with different limits
export const generalLimiter = new RateLimiter(60000, 60); // 60 requests per minute
export const strictLimiter = new RateLimiter(60000, 10); // 10 requests per minute
export const claimLimiter = new RateLimiter(300000, 5); // 5 requests per 5 minutes
