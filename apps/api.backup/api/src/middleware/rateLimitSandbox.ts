/**
 * B133B-LIMIT-008: Sandbox rate limit stricter than prod (per-key fairness)
 *
 * Rate limiting middleware for sandbox API keys.
 * More restrictive than production to ensure fair usage among partners.
 * Limits are per-key, not per-IP.
 */

import { Request, Response, NextFunction } from 'express';
import { isSandboxMode } from '../config/env';

interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
}

interface RateLimitEntry {
  key: string;
  minute: { count: number; resetAt: Date };
  hour: { count: number; resetAt: Date };
  day: { count: number; resetAt: Date };
}

// In-memory rate limit store (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Sandbox rate limits (stricter than production)
const SANDBOX_LIMITS: RateLimitConfig = {
  requestsPerMinute: parseInt(process.env.SANDBOX_RATE_LIMIT_PER_MINUTE || '10', 10),
  requestsPerHour: parseInt(process.env.SANDBOX_RATE_LIMIT_PER_HOUR || '100', 10),
  requestsPerDay: parseInt(process.env.SANDBOX_RATE_LIMIT_PER_DAY || '1000', 10),
};

// Production rate limits (more generous)
const PRODUCTION_LIMITS: RateLimitConfig = {
  requestsPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '60', 10),
  requestsPerHour: parseInt(process.env.RATE_LIMIT_PER_HOUR || '1000', 10),
  requestsPerDay: parseInt(process.env.RATE_LIMIT_PER_DAY || '10000', 10),
};

/**
 * Get rate limit configuration based on environment
 */
function getRateLimits(): RateLimitConfig {
  return isSandboxMode() ? SANDBOX_LIMITS : PRODUCTION_LIMITS;
}

/**
 * Extract API key from request
 */
function extractApiKey(req: Request): string | null {
  const apiKey = req.get('x-api-key') || req.get('authorization')?.replace('Bearer ', '');
  return apiKey || null;
}

/**
 * Initialize rate limit entry for a key
 */
function initRateLimitEntry(key: string): RateLimitEntry {
  const now = new Date();

  return {
    key,
    minute: {
      count: 0,
      resetAt: new Date(now.getTime() + 60 * 1000),
    },
    hour: {
      count: 0,
      resetAt: new Date(now.getTime() + 60 * 60 * 1000),
    },
    day: {
      count: 0,
      resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    },
  };
}

/**
 * Get or create rate limit entry
 */
function getRateLimitEntry(key: string): RateLimitEntry {
  let entry = rateLimitStore.get(key);

  if (!entry) {
    entry = initRateLimitEntry(key);
    rateLimitStore.set(key, entry);
  }

  return entry;
}

/**
 * Reset counters if time window has passed
 */
function resetExpiredWindows(entry: RateLimitEntry): void {
  const now = new Date();

  if (now >= entry.minute.resetAt) {
    entry.minute.count = 0;
    entry.minute.resetAt = new Date(now.getTime() + 60 * 1000);
  }

  if (now >= entry.hour.resetAt) {
    entry.hour.count = 0;
    entry.hour.resetAt = new Date(now.getTime() + 60 * 60 * 1000);
  }

  if (now >= entry.day.resetAt) {
    entry.day.count = 0;
    entry.day.resetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

/**
 * Check if request is within rate limits
 */
function checkRateLimit(entry: RateLimitEntry, limits: RateLimitConfig): {
  allowed: boolean;
  limitType?: 'minute' | 'hour' | 'day';
  limit?: number;
  remaining?: number;
  resetAt?: Date;
} {
  resetExpiredWindows(entry);

  // Check minute limit
  if (entry.minute.count >= limits.requestsPerMinute) {
    return {
      allowed: false,
      limitType: 'minute',
      limit: limits.requestsPerMinute,
      remaining: 0,
      resetAt: entry.minute.resetAt,
    };
  }

  // Check hour limit
  if (entry.hour.count >= limits.requestsPerHour) {
    return {
      allowed: false,
      limitType: 'hour',
      limit: limits.requestsPerHour,
      remaining: 0,
      resetAt: entry.hour.resetAt,
    };
  }

  // Check day limit
  if (entry.day.count >= limits.requestsPerDay) {
    return {
      allowed: false,
      limitType: 'day',
      limit: limits.requestsPerDay,
      remaining: 0,
      resetAt: entry.day.resetAt,
    };
  }

  return {
    allowed: true,
    limit: limits.requestsPerMinute,
    remaining: limits.requestsPerMinute - entry.minute.count,
  };
}

/**
 * Increment rate limit counters
 */
function incrementCounters(entry: RateLimitEntry): void {
  entry.minute.count++;
  entry.hour.count++;
  entry.day.count++;
}

/**
 * Set rate limit headers on response
 */
function setRateLimitHeaders(
  res: Response,
  limits: RateLimitConfig,
  entry: RateLimitEntry,
  result: ReturnType<typeof checkRateLimit>
): void {
  // Standard rate limit headers
  res.setHeader('X-RateLimit-Limit-Minute', limits.requestsPerMinute);
  res.setHeader('X-RateLimit-Limit-Hour', limits.requestsPerHour);
  res.setHeader('X-RateLimit-Limit-Day', limits.requestsPerDay);

  res.setHeader('X-RateLimit-Remaining-Minute', Math.max(0, limits.requestsPerMinute - entry.minute.count));
  res.setHeader('X-RateLimit-Remaining-Hour', Math.max(0, limits.requestsPerHour - entry.hour.count));
  res.setHeader('X-RateLimit-Remaining-Day', Math.max(0, limits.requestsPerDay - entry.day.count));

  res.setHeader('X-RateLimit-Reset-Minute', Math.ceil(entry.minute.resetAt.getTime() / 1000));
  res.setHeader('X-RateLimit-Reset-Hour', Math.ceil(entry.hour.resetAt.getTime() / 1000));
  res.setHeader('X-RateLimit-Reset-Day', Math.ceil(entry.day.resetAt.getTime() / 1000));

  // Add sandbox indicator if in sandbox mode
  if (isSandboxMode()) {
    res.setHeader('X-Sandbox-Mode', 'true');
  }

  // Add retry-after header if rate limited
  if (!result.allowed && result.resetAt) {
    const retryAfterSeconds = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
    res.setHeader('Retry-After', retryAfterSeconds);
  }
}

/**
 * Rate limiting middleware for sandbox API
 */
export function rateLimitSandbox(req: Request, res: Response, next: NextFunction) {
  try {
    // Skip rate limiting for health checks
    if (req.path === '/health' || req.path === '/healthz') {
      return next();
    }

    // Extract API key
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      // If no API key, use IP-based limiting as fallback
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const rateLimitKey = `ip:${ip}`;

      const entry = getRateLimitEntry(rateLimitKey);
      const limits = getRateLimits();
      const result = checkRateLimit(entry, limits);

      setRateLimitHeaders(res, limits, entry, result);

      if (!result.allowed) {
        return res.status(429).json({
          error: 'rate_limit_exceeded',
          message: `Rate limit exceeded for IP. Limit: ${result.limit} requests per ${result.limitType}`,
          limitType: result.limitType,
          limit: result.limit,
          retryAfter: result.resetAt ? Math.ceil((result.resetAt.getTime() - Date.now()) / 1000) : undefined,
        });
      }

      incrementCounters(entry);
      return next();
    }

    // Key-based rate limiting
    const rateLimitKey = `key:${apiKey.substring(0, 20)}`; // Use prefix to avoid storing full keys

    const entry = getRateLimitEntry(rateLimitKey);
    const limits = getRateLimits();
    const result = checkRateLimit(entry, limits);

    setRateLimitHeaders(res, limits, entry, result);

    if (!result.allowed) {
      console.warn(`⚠️  Rate limit exceeded for key: ${apiKey.substring(0, 15)}... (${result.limitType})`);

      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: `Rate limit exceeded. Limit: ${result.limit} requests per ${result.limitType}`,
        limitType: result.limitType,
        limit: result.limit,
        remaining: 0,
        retryAfter: result.resetAt ? Math.ceil((result.resetAt.getTime() - Date.now()) / 1000) : undefined,
        documentation: isSandboxMode()
          ? 'https://docs.vitalcv.com/sandbox/rate-limits'
          : 'https://docs.vitalcv.com/api/rate-limits',
      });
    }

    // Increment counters and allow request
    incrementCounters(entry);

    // Log in sandbox mode for debugging
    if (isSandboxMode() && process.env.SANDBOX_DETAILED_LOGGING === 'true') {
      console.log(`[sandbox] Request: ${req.method} ${req.path} | Key: ${apiKey.substring(0, 15)}... | Remaining: ${result.remaining}/${result.limit}`);
    }

    next();
  } catch (error) {
    console.error('[rateLimitSandbox] Error:', error);
    // Don't block requests on rate limit errors
    next();
  }
}

/**
 * Clear rate limit for a specific key (for testing/admin)
 */
export function clearRateLimit(key: string): boolean {
  return rateLimitStore.delete(key);
}

/**
 * Get current rate limit status for a key
 */
export function getRateLimitStatus(key: string): RateLimitEntry | null {
  const entry = rateLimitStore.get(key);
  if (!entry) {
    return null;
  }

  resetExpiredWindows(entry);
  return entry;
}

/**
 * Get all rate limit stats (for admin/monitoring)
 */
export function getAllRateLimitStats(): Array<{
  key: string;
  minute: number;
  hour: number;
  day: number;
}> {
  const stats: Array<{
    key: string;
    minute: number;
    hour: number;
    day: number;
  }> = [];

  for (const [key, entry] of rateLimitStore.entries()) {
    resetExpiredWindows(entry);
    stats.push({
      key: key.substring(0, 20) + '...', // Don't expose full keys
      minute: entry.minute.count,
      hour: entry.hour.count,
      day: entry.day.count,
    });
  }

  return stats;
}

export default rateLimitSandbox;

