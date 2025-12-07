/**
 * Login-specific rate limiting middleware
 * - Per-minute guard to blunt credential-stuffing bursts
 * - Per-hour guard to cap longer brute-force attempts
 */

import { Request, Response, NextFunction } from 'express';
import { SlidingWindowLimiter } from '../../../../services/security/slidingWindowLimiter';

export interface RateLimitLoginConfig {
  /** Maximum login attempts per minute per IP/device */
  maxAttemptsPerMinute?: number;
  /** Maximum login attempts per hour per IP/device */
  maxAttemptsPerHour?: number;
  /** Optional Redis URL override */
  redisUrl?: string;
}

function extractIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'] as string;
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'] as string;
  if (realIp) {
    return realIp;
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function createLoginRateLimiter(config: RateLimitLoginConfig = {}) {
  const maxPerMinute = config.maxAttemptsPerMinute ?? 12;
  const maxPerHour = config.maxAttemptsPerHour ?? 60;

  const perMinuteLimiter = new SlidingWindowLimiter({
    limit: maxPerMinute,
    windowSeconds: 60,
    redisUrl: config.redisUrl,
    keyPrefix: 'login_minute',
    failOpen: false,
  });

  const perHourLimiter = new SlidingWindowLimiter({
    limit: maxPerHour,
    windowSeconds: 60 * 60,
    redisUrl: config.redisUrl,
    keyPrefix: 'login_hour',
    failOpen: false,
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = extractIp(req);
      const deviceId = (req.headers['x-device-id'] as string) || (req.body?.deviceId as string);
      const identifier = deviceId ? `${ip}:${deviceId}` : ip;

      const [minuteResult, hourResult] = await Promise.all([
        perMinuteLimiter.check(`min:${identifier}`),
        perHourLimiter.check(`hour:${identifier}`),
      ]);

      res.setHeader('X-LoginRateLimit-Limit-Minute', maxPerMinute.toString());
      res.setHeader('X-LoginRateLimit-Remaining-Minute', Math.max(0, minuteResult.remaining).toString());
      res.setHeader('X-LoginRateLimit-Reset-Minute', new Date(minuteResult.resetAt * 1000).toISOString());

      res.setHeader('X-LoginRateLimit-Limit-Hour', maxPerHour.toString());
      res.setHeader('X-LoginRateLimit-Remaining-Hour', Math.max(0, hourResult.remaining).toString());
      res.setHeader('X-LoginRateLimit-Reset-Hour', new Date(hourResult.resetAt * 1000).toISOString());

      if (!minuteResult.allowed || !hourResult.allowed) {
        const resetAt = !minuteResult.allowed ? minuteResult.resetAt : hourResult.resetAt;
        return res.status(429).json({
          error: 'login_rate_limit_exceeded',
          message: 'Too many login attempts. Please try again later.',
          retryAfter: Math.max(1, resetAt - Math.floor(Date.now() / 1000)),
          resetAt: new Date(resetAt * 1000).toISOString(),
        });
      }

      next();
    } catch (error) {
      console.error('[rateLimitLogin] Error enforcing login rate limits', error);
      return res.status(503).json({
        error: 'login_rate_limit_unavailable',
        message: 'Unable to verify login rate limit. Please try again shortly.',
      });
    }
  };
}

export const rateLimitLogin = createLoginRateLimiter({
  maxAttemptsPerMinute: parseInt(process.env.LOGIN_RATE_LIMIT_PER_MINUTE || '12', 10),
  maxAttemptsPerHour: parseInt(process.env.LOGIN_RATE_LIMIT_PER_HOUR || '60', 10),
  redisUrl: process.env.REDIS_URL,
});


