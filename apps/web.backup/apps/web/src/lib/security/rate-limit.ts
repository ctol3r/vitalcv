/**
 * Rate limiting utilities for API routes
 *
 * Provides in-memory rate limiting for API endpoints to prevent abuse.
 * For production, consider using Redis or a dedicated rate limiting service.
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

// In-memory store (use Redis in production)
const store: RateLimitStore = {};

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
};

/**
 * Generates a rate limit key from a request
 *
 * @param request - The request object
 * @returns Rate limit key
 */
function generateKey(request: Request, customGenerator?: (req: Request) => string): string {
  if (customGenerator) {
    return customGenerator(request);
  }

  // Default: use IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() :
             request.headers.get('x-real-ip') ||
             'unknown';

  return `rate-limit:${ip}`;
}

/**
 * Checks if a request should be rate limited
 *
 * @param request - The request to check
 * @param config - Rate limit configuration
 * @returns Object with allowed status and rate limit headers
 */
export function checkRateLimit(
  request: Request,
  config: Partial<RateLimitConfig> = {}
): {
  allowed: boolean;
  remaining: number;
  reset: number;
  retryAfter?: number;
} {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const key = generateKey(request, finalConfig.keyGenerator);
  const now = Date.now();

  let entry = store[key];

  // Clean up expired entries periodically
  if (Math.random() < 0.01) { // 1% chance to cleanup
    for (const [k, v] of Object.entries(store)) {
      if (v.resetAt < now) {
        delete store[k];
      }
    }
  }

  // Initialize or reset entry if expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + finalConfig.windowMs,
    };
    store[key] = entry;
  }

  // Check if limit exceeded
  const allowed = entry.count < finalConfig.maxRequests;

  if (allowed) {
    entry.count++;
  }

  const remaining = Math.max(0, finalConfig.maxRequests - entry.count);
  const reset = Math.ceil((entry.resetAt - now) / 1000); // seconds until reset
  const retryAfter = !allowed ? reset : undefined;

  return {
    allowed,
    remaining,
    reset,
    retryAfter,
  };
}

/**
 * Creates rate limit headers for a response
 *
 * @param result - Result from checkRateLimit
 * @returns Headers object with rate limit information
 */
export function createRateLimitHeaders(result: {
  remaining: number;
  reset: number;
  retryAfter?: number;
}): HeadersInit {
  const headers: HeadersInit = {
    'X-RateLimit-Limit': String(DEFAULT_CONFIG.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  };

  if (result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}

/**
 * Rate limit configuration for different endpoint types
 */
export const RATE_LIMITS = {
  // Authentication endpoints - stricter limits
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },

  // OID4VCI/OID4VP endpoints - moderate limits
  oidc: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 20,
  },

  // Verification endpoints - moderate limits
  verify: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 30,
  },

  // General API endpoints - standard limits
  default: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
} as const;

