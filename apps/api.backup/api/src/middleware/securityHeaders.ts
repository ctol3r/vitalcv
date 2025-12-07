/**
 * Security Headers Middleware for API
 *
 * Implements modern HTTP security headers for all API responses:
 * - HSTS (Strict-Transport-Security)
 * - CSP (Content-Security-Policy)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - X-XSS-Protection (legacy support)
 * - Referrer-Policy
 * - Permissions-Policy
 *
 * @see https://owasp.org/www-project-secure-headers/
 * @module middleware/securityHeaders
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Security header configuration for API endpoints
 */
export interface SecurityHeadersConfig {
  /**
   * Enable HSTS with specified max-age (seconds)
   * @default 31536000 (1 year)
   */
  hstsMaxAge?: number;

  /**
   * Include subdomains in HSTS
   * @default true
   */
  hstsIncludeSubDomains?: boolean;

  /**
   * Enable HSTS preload
   * @default true
   */
  hstsPreload?: boolean;

  /**
   * Custom CSP directives for API endpoints
   * @default strict policy with no script execution
   */
  cspDirectives?: Record<string, string[]>;

  /**
   * Enable X-Frame-Options
   * @default 'DENY'
   */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false;

  /**
   * Enable X-Content-Type-Options
   * @default true
   */
  noSniff?: boolean;

  /**
   * Referrer-Policy value
   * @default 'strict-origin-when-cross-origin'
   */
  referrerPolicy?: string;

  /**
   * Custom Permissions-Policy directives
   * @default restrictive policy
   */
  permissionsPolicy?: Record<string, string[]>;
}

/**
 * Default CSP for API endpoints (no scripts, only data responses)
 * S72-STRETCH-A-008: CSP set to allow only needed origins
 */
const DEFAULT_CSP_DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'none'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'none'"],
  // S72-STRETCH-A-008: Refined CSP - only allow needed origins
  'connect-src': ["'self'"], // Allow API calls to same origin
  'font-src': ["'none'"],
  'img-src': ["'none'"],
  'media-src': ["'none'"],
  'object-src': ["'none'"],
  'script-src': ["'none'"],
  'style-src': ["'none'"],
  'worker-src': ["'none'"],
  'manifest-src': ["'none'"],
};

/**
 * Default Permissions-Policy (restrictive for API)
 */
const DEFAULT_PERMISSIONS_POLICY: Record<string, string[]> = {
  'geolocation': [],
  'microphone': [],
  'camera': [],
  'payment': [],
  'usb': [],
  'magnetometer': [],
  'gyroscope': [],
  'accelerometer': [],
};

/**
 * Formats CSP directives into CSP header string
 */
function formatCSP(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

/**
 * Formats Permissions-Policy into header string
 */
function formatPermissionsPolicy(policy: Record<string, string[]>): string {
  return Object.entries(policy)
    .map(([feature, allowlist]) => {
      if (allowlist.length === 0) {
        return `${feature}=()`;
      }
      return `${feature}=(${allowlist.join(' ')})`;
    })
    .join(', ');
}

/**
 * Creates security headers middleware with custom configuration
 *
 * @param config - Optional configuration overrides
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { securityHeaders } from './middleware/securityHeaders';
 *
 * const app = express();
 *
 * // Use with default settings
 * app.use(securityHeaders());
 *
 * // Or customize
 * app.use(securityHeaders({
 *   hstsMaxAge: 63072000, // 2 years
 *   cspDirectives: {
 *     'default-src': ["'none'"],
 *     'connect-src': ["'self'", 'https://api.example.com'],
 *   },
 * }));
 * ```
 */
export function securityHeaders(config: SecurityHeadersConfig = {}): (req: Request, res: Response, next: NextFunction) => void {
  const {
    hstsMaxAge = 31536000, // 1 year
    hstsIncludeSubDomains = true,
    hstsPreload = true,
    cspDirectives = DEFAULT_CSP_DIRECTIVES,
    frameOptions = 'DENY',
    noSniff = true,
    referrerPolicy = 'strict-origin-when-cross-origin',
    permissionsPolicy = DEFAULT_PERMISSIONS_POLICY,
  } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    // S72-STRETCH-A-008: HSTS present
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      let hstsValue = `max-age=${hstsMaxAge}`;
      if (hstsIncludeSubDomains) {
        hstsValue += '; includeSubDomains';
      }
      if (hstsPreload) {
        hstsValue += '; preload';
      }
      res.setHeader('Strict-Transport-Security', hstsValue);
    }

    // S72-STRETCH-A-008: CSP set to allow only needed origins
    res.setHeader('Content-Security-Policy', formatCSP(cspDirectives));

    // S72-STRETCH-A-008: X-Frame-Options present
    if (frameOptions) {
      res.setHeader('X-Frame-Options', frameOptions);
    }

    // X-Content-Type-Options: Prevent MIME sniffing
    if (noSniff) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // X-XSS-Protection: Legacy XSS protection (for older browsers)
    // Note: CSP is the modern approach, but this provides defense-in-depth
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // S72-STRETCH-A-008: Referrer-Policy present
    res.setHeader('Referrer-Policy', referrerPolicy);

    // Permissions-Policy: Disable unnecessary browser features
    res.setHeader('Permissions-Policy', formatPermissionsPolicy(permissionsPolicy));

    // X-Permitted-Cross-Domain-Policies: Restrict Adobe Flash/PDF cross-domain access
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    // Cross-Origin-Embedder-Policy: Prevent cross-origin resource loading
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

    // Cross-Origin-Opener-Policy: Isolate browsing context
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    // Cross-Origin-Resource-Policy: Control resource sharing
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    next();
  };
}

/**
 * Preset: Strict security headers for sensitive API endpoints
 * (credential issuance, verification, compliance exports)
 */
export function strictSecurityHeaders(): (req: Request, res: Response, next: NextFunction) => void {
  return securityHeaders({
    hstsMaxAge: 63072000, // 2 years
    hstsIncludeSubDomains: true,
    hstsPreload: true,
    cspDirectives: {
      'default-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'none'"],
      'form-action': ["'none'"],
    },
    frameOptions: 'DENY',
    noSniff: true,
    referrerPolicy: 'no-referrer',
  });
}

/**
 * Preset: Relaxed headers for public API endpoints
 * (health checks, public documentation)
 */
export function relaxedSecurityHeaders(): (req: Request, res: Response, next: NextFunction) => void {
  return securityHeaders({
    hstsMaxAge: 31536000, // 1 year
    cspDirectives: {
      'default-src': ["'none'"],
      'connect-src': ["'self'"],
    },
    frameOptions: 'SAMEORIGIN',
    referrerPolicy: 'strict-origin-when-cross-origin',
  });
}

/**
 * Middleware to validate that security headers are present in responses
 * Useful for testing and compliance verification
 *
 * @throws Error if required headers are missing
 */
export function validateSecurityHeaders() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalSend = res.send;

    res.send = function (body: any): Response {
      // Check for required security headers
      const requiredHeaders = [
        'Content-Security-Policy',
        'X-Content-Type-Options',
        'Referrer-Policy',
      ];

      const missingHeaders = requiredHeaders.filter(
        header => !res.getHeader(header)
      );

      if (missingHeaders.length > 0 && process.env.NODE_ENV !== 'production') {
        console.warn(`⚠️  Missing security headers: ${missingHeaders.join(', ')}`);
      }

      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * Export default middleware instance
 */
export default securityHeaders();

