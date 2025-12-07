/**
 * B146C-SEC-004: Origin Check Middleware for Demo Widget Apply Endpoint
 *
 * Validates that requests to /demo/widget/apply come from allowed origins.
 * Checks the Origin and Referer headers against configured DEMO_WIDGET_ORIGINS.
 * Returns 403 Forbidden for non-matching origins.
 *
 * Usage:
 *   import { checkDemoOrigin } from './middleware/checkDemoOrigin';
 *   router.post('/demo/widget/apply', checkDemoOrigin(), handler);
 */

import { Request, Response, NextFunction } from 'express';

export interface DemoOriginConfig {
  /**
   * List of allowed origins (e.g., ['https://demo.example.com', 'https://partner.com'])
   * If not provided, reads from DEMO_WIDGET_ORIGINS environment variable
   */
  allowedOrigins?: string[];
  /**
   * Whether to allow requests with no Origin/Referer (default: false)
   * Set to true only for testing/development
   */
  allowMissingOrigin?: boolean;
}

/**
 * Normalize origin URL for comparison
 * Removes trailing slashes and converts to lowercase
 */
function normalizeOrigin(origin: string): string {
  return origin.toLowerCase().replace(/\/$/, '');
}

/**
 * Extract origin from request headers
 * Checks both Origin and Referer headers
 */
function extractOrigin(req: Request): string | null {
  // Prefer Origin header (more reliable for CORS)
  const origin = req.headers.origin;
  if (origin) {
    return normalizeOrigin(origin);
  }

  // Fall back to Referer header
  const referer = req.headers.referer || req.headers.referrer;
  if (referer) {
    try {
      const url = new URL(referer);
      return normalizeOrigin(url.origin);
    } catch {
      // Invalid URL, ignore
    }
  }

  return null;
}

/**
 * Check if origin is in the allowed list
 */
function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  const normalizedOrigin = normalizeOrigin(origin);
  return allowedOrigins.some(allowed => normalizeOrigin(allowed) === normalizedOrigin);
}

/**
 * Create middleware to check demo widget origin
 *
 * @param config - Configuration options
 * @returns Express middleware function
 */
export function checkDemoOrigin(config: DemoOriginConfig = {}) {
  // Get allowed origins from config or environment variable
  const allowedOrigins = config.allowedOrigins ||
    (process.env.DEMO_WIDGET_ORIGINS
      ? process.env.DEMO_WIDGET_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
      : []);

  const allowMissingOrigin = config.allowMissingOrigin || false;

  return (req: Request, res: Response, next: NextFunction): void => {
    // If no origins configured, skip check (for development/testing)
    if (allowedOrigins.length === 0) {
      // In production, log a warning
      if (process.env.NODE_ENV === 'production') {
        console.warn('[checkDemoOrigin] No DEMO_WIDGET_ORIGINS configured - origin check disabled');
      }
      return next();
    }

    // Extract origin from request
    const origin = extractOrigin(req);

    // Handle missing origin
    if (!origin) {
      if (allowMissingOrigin) {
        // Allow through but log for monitoring
        console.warn('[checkDemoOrigin] Request with no Origin/Referer header allowed', {
          path: req.path,
          ip: req.ip,
        });
        return next();
      } else {
        return res.status(403).json({
          error: 'origin_required',
          message: 'Origin or Referer header is required for this endpoint',
        });
      }
    }

    // Check if origin is allowed
    if (!isOriginAllowed(origin, allowedOrigins)) {
      // Log blocked request for security monitoring
      console.warn('[checkDemoOrigin] Origin not allowed', {
        origin,
        path: req.path,
        ip: req.ip,
        allowedOrigins,
      });

      return res.status(403).json({
        error: 'origin_not_allowed',
        message: 'Request origin is not allowed for this endpoint',
        // Don't expose allowed origins in error message
      });
    }

    // Origin is allowed, proceed
    next();
  };
}

/**
 * Middleware that only checks origin if DEMO_WIDGET_ORIGINS is configured
 * Useful for optional origin checking
 */
export function checkDemoOriginIfConfigured() {
  return checkDemoOrigin({
    allowMissingOrigin: process.env.NODE_ENV !== 'production',
  });
}

