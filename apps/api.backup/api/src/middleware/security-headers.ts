/**
 * Security Headers Middleware
 * Tagged: cursor-batch-1107 (Task 0013)
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Sets HSTS, COEP, CORP, COOP, and strict CORS headers
 * Hardens HTTP surface against common attacks
 */

import { Request, Response, NextFunction } from 'express';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface SecurityHeadersOptions {
  /**
   * Enable HSTS (HTTP Strict Transport Security)
   * Only enable in production with HTTPS
   */
  hsts?: {
    enabled: boolean;
    maxAge?: number; // in seconds, default: 1 year
    includeSubDomains?: boolean;
    preload?: boolean;
  };

  /**
   * Cross-Origin Embedder Policy (COEP)
   * Controls embedding resources from other origins
   */
  coep?: {
    enabled: boolean;
    policy?: 'require-corp' | 'credentialless' | 'unsafe-none';
  };

  /**
   * Cross-Origin Resource Policy (CORP)
   * Protects resources from being loaded by other origins
   */
  corp?: {
    enabled: boolean;
    policy?: 'same-origin' | 'same-site' | 'cross-origin';
  };

  /**
   * Cross-Origin Opener Policy (COOP)
   * Isolates browsing context from cross-origin windows
   */
  coop?: {
    enabled: boolean;
    policy?: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none';
  };

  /**
   * CORS (Cross-Origin Resource Sharing)
   * Strict allowlist for API access
   */
  cors?: {
    enabled: boolean;
    allowedOrigins?: string[]; // Explicit allowlist
    allowCredentials?: boolean;
    maxAge?: number; // Preflight cache duration
  };

  /**
   * Additional security headers
   */
  additionalHeaders?: {
    'X-Content-Type-Options'?: string;
    'X-Frame-Options'?: string;
    'X-XSS-Protection'?: string;
    'Referrer-Policy'?: string;
  };
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_OPTIONS: SecurityHeadersOptions = {
  hsts: {
    enabled: process.env.NODE_ENV === 'production',
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: false, // Set to true only after testing
  },
  coep: {
    enabled: true,
    policy: 'credentialless', // Less strict than require-corp
  },
  corp: {
    enabled: true,
    policy: 'same-site', // Allow same-site embedding
  },
  coop: {
    enabled: true,
    policy: 'same-origin-allow-popups', // Balance security and UX
  },
  cors: {
    enabled: true,
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://app.chai.vc',
      'https://wallet.chai.vc',
    ],
    allowCredentials: true,
    maxAge: 7200, // 2 hours
  },
  additionalHeaders: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  },
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Security headers middleware factory
 * Creates middleware with custom configuration
 */
export function createSecurityHeadersMiddleware(
  options: SecurityHeadersOptions = DEFAULT_OPTIONS,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 1. HSTS (HTTP Strict Transport Security)
    if (options.hsts?.enabled) {
      let hstsValue = `max-age=${options.hsts.maxAge || 31536000}`;
      if (options.hsts.includeSubDomains) {
        hstsValue += '; includeSubDomains';
      }
      if (options.hsts.preload) {
        hstsValue += '; preload';
      }
      res.setHeader('Strict-Transport-Security', hstsValue);
    }

    // 2. COEP (Cross-Origin Embedder Policy)
    if (options.coep?.enabled) {
      res.setHeader('Cross-Origin-Embedder-Policy', options.coep.policy || 'credentialless');
    }

    // 3. CORP (Cross-Origin Resource Policy)
    if (options.corp?.enabled) {
      res.setHeader('Cross-Origin-Resource-Policy', options.corp.policy || 'same-site');
    }

    // 4. COOP (Cross-Origin Opener Policy)
    if (options.coop?.enabled) {
      res.setHeader(
        'Cross-Origin-Opener-Policy',
        options.coop.policy || 'same-origin-allow-popups',
      );
    }

    // 5. CORS (handled separately, but set preflight headers)
    if (options.cors?.enabled) {
      const origin = req.headers.origin;
      const allowedOrigins = options.cors.allowedOrigins || [];

      // Check if origin is in allowlist
      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin'); // Important for caching
      } else if (allowedOrigins.includes('*')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }

      // Set credentials flag
      if (options.cors.allowCredentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      // Handle preflight
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, X-Request-ID, X-API-Key',
        );
        res.setHeader('Access-Control-Max-Age', String(options.cors.maxAge || 7200));
        return res.status(204).end();
      }
    }

    // 6. Additional security headers
    if (options.additionalHeaders) {
      Object.entries(options.additionalHeaders).forEach(([header, value]) => {
        if (value) {
          res.setHeader(header, value);
        }
      });
    }

    next();
  };
}

/**
 * Default security headers middleware
 * Uses default configuration
 */
export const securityHeadersMiddleware = createSecurityHeadersMiddleware(DEFAULT_OPTIONS);

// ============================================================================
// STRICT CORS MIDDLEWARE
// ============================================================================

/**
 * Strict CORS middleware for API routes
 * Enforces allowlist and rejects unauthorized origins
 */
export function strictCorsMiddleware(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (!origin) {
      // No origin header (same-origin request or non-browser client)
      return next();
    }

    if (!allowedOrigins.includes(origin)) {
      return res.status(403).json({
        code: 'E_CORS_FORBIDDEN',
        title: 'CORS Policy Violation',
        status: 403,
        detail: `Origin '${origin}' is not allowed to access this resource`,
        instance: req.id,
      });
    }

    // Set CORS headers for allowed origin
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Request-ID, X-API-Key',
      );
      res.setHeader('Access-Control-Max-Age', '7200');
      return res.status(204).end();
    }

    next();
  };
}

export default securityHeadersMiddleware;

