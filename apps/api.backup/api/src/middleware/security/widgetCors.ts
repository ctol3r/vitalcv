/**
 * B132A-WIDGET-003: CORS + rate-limit policy for Apply-with-VitalCV widget
 *
 * Allowlist partner origins; 429 on abusive clients; tests for allowed+denied
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

// In-memory store for partner origins (in production, fetch from database)
const partnerOrigins = new Map<string, string[]>([
  // Example partner configurations
  ['partner_1', ['https://partner1.example.com', 'https://app.partner1.example.com']],
  ['partner_2', ['https://partner2.example.com']],
]);

/**
 * CORS middleware for widget endpoints
 * Only allows requests from pre-approved partner origins
 */
export function widgetCorsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.get('origin');
  const referer = req.get('referer');

  // Extract partner ID from request (could be from JWT, API key, etc.)
  // For now, we'll check against all allowed origins
  const allAllowedOrigins = Array.from(partnerOrigins.values()).flat();

  // Check if origin is allowed
  if (origin && allAllowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, DPoP');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '3600');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    return next();
  }

  // Check referer as fallback (less secure but sometimes necessary)
  if (referer) {
    const refererOrigin = new URL(referer).origin;
    if (allAllowedOrigins.includes(refererOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', refererOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, DPoP');
      res.setHeader('Access-Control-Allow-Credentials', 'true');

      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }

      return next();
    }
  }

  // Origin not allowed
  console.warn('[widgetCors] Blocked request from unauthorized origin', {
    origin,
    referer,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  return res.status(403).json({
    error: 'forbidden',
    message: 'Origin not allowed',
  });
}

/**
 * Rate limiter for widget endpoints
 * Prevents abuse from malicious or misconfigured clients
 */
export const widgetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers

  // Custom key generator to rate limit by partner + IP
  keyGenerator: (req: Request) => {
    const partnerId = (req as any).auth?.sub || 'anonymous';
    return `${partnerId}:${req.ip}`;
  },

  // Custom handler for rate limit exceeded
  handler: (req: Request, res: Response) => {
    console.warn('[widgetRateLimit] Rate limit exceeded', {
      ip: req.ip,
      partnerId: (req as any).auth?.sub,
      userAgent: req.get('user-agent'),
    });

    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests, please try again later',
      retryAfter: res.getHeader('Retry-After'),
    });
  },

  // Skip rate limiting for certain conditions (e.g., internal requests)
  skip: (req: Request) => {
    // Skip if internal service token
    const isInternal = (req as any).auth?.iss === 'vitalcv:internal';
    return isInternal;
  },
});

/**
 * Aggressive rate limiter for suspicious clients
 */
export const widgetAggressiveRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Very strict limit
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req: Request) => {
    return req.ip || 'unknown';
  },

  handler: (req: Request, res: Response) => {
    console.error('[widgetAggressiveRateLimit] Aggressive rate limit exceeded - possible attack', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      path: req.path,
    });

    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests from your IP address',
    });
  },
});

/**
 * Add a partner origin to the allowlist
 */
export function addPartnerOrigin(partnerId: string, origin: string): void {
  const origins = partnerOrigins.get(partnerId) || [];
  if (!origins.includes(origin)) {
    origins.push(origin);
    partnerOrigins.set(partnerId, origins);
    console.log(`[widgetCors] Added origin for partner ${partnerId}: ${origin}`);
  }
}

/**
 * Remove a partner origin from the allowlist
 */
export function removePartnerOrigin(partnerId: string, origin: string): void {
  const origins = partnerOrigins.get(partnerId) || [];
  const filtered = origins.filter(o => o !== origin);
  partnerOrigins.set(partnerId, filtered);
  console.log(`[widgetCors] Removed origin for partner ${partnerId}: ${origin}`);
}

/**
 * Get all allowed origins for a partner
 */
export function getPartnerOrigins(partnerId: string): string[] {
  return partnerOrigins.get(partnerId) || [];
}

/**
 * Check if an origin is allowed for any partner
 */
export function isOriginAllowed(origin: string): boolean {
  return Array.from(partnerOrigins.values()).flat().includes(origin);
}

