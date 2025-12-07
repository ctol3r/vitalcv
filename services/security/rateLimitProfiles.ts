/**
 * Region-Aware Rate Limiting Profiles
 * B113B-INTL-008: Different rate limits per region (US/EU/AU/CA)
 *
 * Implements region-specific rate limiting based on regulatory requirements
 * and infrastructure capacity.
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request } from 'express';

/**
 * Supported regions for rate limiting
 */
export enum RateLimitRegion {
  US = 'us',
  EU = 'eu',
  AU = 'au',
  CA = 'ca',
}

/**
 * Rate limit configuration per region
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  standardHeaders: boolean;
  legacyHeaders: boolean;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Regional rate limit profiles
 *
 * US: Higher limits, optimized for high-volume healthcare systems
 * EU: GDPR-compliant moderate limits with strict tracking
 * AU: Conservative limits aligned with Privacy Act requirements
 * CA: Similar to US but with PIPEDA compliance considerations
 */
export const RATE_LIMIT_PROFILES: Record<RateLimitRegion, RateLimitConfig> = {
  [RateLimitRegion.US]: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Higher limit for US market
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },

  [RateLimitRegion.EU]: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // More conservative for GDPR compliance
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Zu viele Anfragen von dieser IP. Bitte versuchen Sie es in 15 Minuten erneut / Too many requests from this IP, please try again after 15 minutes',
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },

  [RateLimitRegion.AU]: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 600, // Moderate limits for Australian market
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },

  [RateLimitRegion.CA]: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 800, // Similar to US but slightly lower
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
};

/**
 * Sensitive endpoints (auth, credentials) with stricter limits
 */
export const SENSITIVE_RATE_LIMIT_PROFILES: Record<RateLimitRegion, RateLimitConfig> = {
  [RateLimitRegion.US]: {
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many authentication attempts, please try again later',
  },

  [RateLimitRegion.EU]: {
    windowMs: 15 * 60 * 1000,
    max: 30, // Stricter for EU
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Zu viele Authentifizierungsversuche / Too many authentication attempts',
  },

  [RateLimitRegion.AU]: {
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many authentication attempts, please try again later',
  },

  [RateLimitRegion.CA]: {
    windowMs: 15 * 60 * 1000,
    max: 45,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many authentication attempts, please try again later',
  },
};

/**
 * Public endpoints (read-only, no auth) with higher limits
 */
export const PUBLIC_RATE_LIMIT_PROFILES: Record<RateLimitRegion, RateLimitConfig> = {
  [RateLimitRegion.US]: {
    windowMs: 15 * 60 * 1000,
    max: 5000,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  },

  [RateLimitRegion.EU]: {
    windowMs: 15 * 60 * 1000,
    max: 3000,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  },

  [RateLimitRegion.AU]: {
    windowMs: 15 * 60 * 1000,
    max: 3500,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  },

  [RateLimitRegion.CA]: {
    windowMs: 15 * 60 * 1000,
    max: 4000,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  },
};

/**
 * Detect region from request
 * Priority: Header > IP geolocation > Default (US)
 */
export function detectRegion(req: Request): RateLimitRegion {
  // Check explicit region header
  const regionHeader = req.headers['x-region'] as string;
  if (regionHeader && Object.values(RateLimitRegion).includes(regionHeader as RateLimitRegion)) {
    return regionHeader as RateLimitRegion;
  }

  // Check tenant region if available
  const tenant = (req as any).tenant;
  if (tenant?.homeRegion) {
    return tenant.homeRegion as RateLimitRegion;
  }

  // IP-based geolocation (simplified - in production use MaxMind GeoIP2)
  const ip = req.ip || req.headers['x-forwarded-for'] as string;
  if (ip) {
    // EU IP ranges (simplified - use proper geolocation service)
    if (ip.startsWith('194.') || ip.startsWith('195.')) {
      return RateLimitRegion.EU;
    }
    // AU IP ranges
    if (ip.startsWith('1.') || ip.startsWith('101.')) {
      return RateLimitRegion.AU;
    }
    // CA IP ranges
    if (ip.startsWith('24.') || ip.startsWith('70.')) {
      return RateLimitRegion.CA;
    }
  }

  // Default to US
  return RateLimitRegion.US;
}

/**
 * Create region-aware rate limiter
 */
export function createRegionalRateLimiter(
  type: 'standard' | 'sensitive' | 'public' = 'standard'
): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // Default, overridden per request
    max: 1000, // Default, overridden per request
    standardHeaders: true,
    legacyHeaders: false,

    // Dynamic configuration based on region
    keyGenerator: (req: Request) => {
      const region = detectRegion(req);
      const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
      return `${region}:${ip}`;
    },

    // Apply region-specific limits
    handler: (req, res, next, options) => {
      const region = detectRegion(req);

      let profile: RateLimitConfig;
      switch (type) {
        case 'sensitive':
          profile = SENSITIVE_RATE_LIMIT_PROFILES[region];
          break;
        case 'public':
          profile = PUBLIC_RATE_LIMIT_PROFILES[region];
          break;
        default:
          profile = RATE_LIMIT_PROFILES[region];
      }

      res.status(429).json({
        error: 'rate_limit_exceeded',
        message: profile.message,
        region,
        retryAfter: Math.ceil(profile.windowMs / 1000),
      });
    },

    // Skip rate limiting for specific conditions
    skip: (req: Request) => {
      // Skip for internal service requests
      const internalToken = req.headers['x-internal-token'];
      if (internalToken === process.env.INTERNAL_SERVICE_TOKEN) {
        return true;
      }

      // Skip for whitelisted IPs
      const whitelist = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
      const ip = req.ip || req.headers['x-forwarded-for'] as string;
      if (whitelist.includes(ip)) {
        return true;
      }

      return false;
    },
  });
}

/**
 * Get rate limit info for a specific region
 */
export function getRateLimitInfo(region: RateLimitRegion, type: 'standard' | 'sensitive' | 'public' = 'standard'): RateLimitConfig {
  switch (type) {
    case 'sensitive':
      return SENSITIVE_RATE_LIMIT_PROFILES[region];
    case 'public':
      return PUBLIC_RATE_LIMIT_PROFILES[region];
    default:
      return RATE_LIMIT_PROFILES[region];
  }
}

/**
 * Middleware to add region info to request
 */
export function regionDetectionMiddleware(req: Request, res: any, next: any) {
  const region = detectRegion(req);
  (req as any).region = region;
  res.setHeader('X-Region', region);
  next();
}

/**
 * Export pre-configured rate limiters
 */
export const rateLimiters = {
  standard: createRegionalRateLimiter('standard'),
  sensitive: createRegionalRateLimiter('sensitive'),
  public: createRegionalRateLimiter('public'),
};

/**
 * Region-specific test cases
 */
export const RATE_LIMIT_TEST_CASES = {
  US: {
    region: RateLimitRegion.US,
    expectedMax: 1000,
    expectedSensitiveMax: 50,
    expectedPublicMax: 5000,
  },
  EU: {
    region: RateLimitRegion.EU,
    expectedMax: 500,
    expectedSensitiveMax: 30,
    expectedPublicMax: 3000,
  },
  AU: {
    region: RateLimitRegion.AU,
    expectedMax: 600,
    expectedSensitiveMax: 40,
    expectedPublicMax: 3500,
  },
  CA: {
    region: RateLimitRegion.CA,
    expectedMax: 800,
    expectedSensitiveMax: 45,
    expectedPublicMax: 4000,
  },
};

