import helmet from 'helmet';
import type { Express, Request, Response, NextFunction } from 'express';

/**
 * CSP enforcement configuration
 *
 * SECURITY: CSP is now enforced by default in production.
 * Set CSP_REPORT_ONLY=true to enable report-only mode for testing.
 */
const isReportOnly = process.env.CSP_REPORT_ONLY === 'true';
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Build CSP directives based on environment
 */
function buildCspDirectives() {
  const baseDirectives = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"], // Required for Tailwind
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'connect-src': [
      "'self'",
      process.env.PUBLIC_ISSUER_URL || '',
      process.env.BACKEND_BASE_URL || '',
    ].filter(Boolean),
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'object-src': ["'none'"],
    'media-src': ["'self'"],
    'frame-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'upgrade-insecure-requests': [],
  };

  // Add report-uri if configured
  if (process.env.CSP_REPORT_URI) {
    (baseDirectives as any)['report-uri'] = [process.env.CSP_REPORT_URI];
  }

  // Relax script-src in development for HMR
  if (isDevelopment) {
    baseDirectives['script-src'].push("'unsafe-inline'", "'unsafe-eval'");
    // Allow websocket connections for HMR
    baseDirectives['connect-src'].push('ws:', 'wss:');
  }

  return baseDirectives;
}

export function useHelmet(app: Express) {
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginEmbedderPolicy: false, // Disabled for external image loading
      contentSecurityPolicy: {
        useDefaults: false,
        directives: buildCspDirectives(),
        reportOnly: isReportOnly,
      },
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      xssFilter: true,
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    })
  );

  // Log CSP mode on startup
  if (!isReportOnly) {
    console.log('🔒 CSP enforcement ENABLED');
  } else {
    console.log('⚠️  CSP in report-only mode (set CSP_REPORT_ONLY=false to enforce)');
  }
}

/**
 * CSP violation report handler
 * Mount at the CSP_REPORT_URI endpoint
 */
export function cspReportHandler(req: Request, res: Response, _next: NextFunction) {
  if (req.body) {
    console.warn('[CSP Violation]', JSON.stringify(req.body, null, 2));

    // In production, you might want to send this to a logging service
    // Example: await logService.logCspViolation(req.body);
  }

  res.status(204).end();
}

