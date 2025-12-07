/**
 * B146C-SEC-006: Basic Helmet-like Middleware Settings for API
 *
 * Sets essential HTTP security headers:
 * - X-XSS-Protection
 * - X-Content-Type-Options
 * - X-Frame-Options
 *
 * This is a simplified version focused on the core security headers.
 * For more comprehensive security headers, see securityHeaders.ts
 *
 * Usage:
 *   import { basicHelmet } from './middleware/basicHelmet';
 *   app.use(basicHelmet());
 */

import { Request, Response, NextFunction } from 'express';

export interface BasicHelmetConfig {
  /**
   * X-Frame-Options value
   * @default 'DENY'
   */
  frameOptions?: 'DENY' | 'SAMEORIGIN';

  /**
   * Enable X-Content-Type-Options
   * @default true
   */
  noSniff?: boolean;

  /**
   * Enable X-XSS-Protection
   * @default true
   */
  xssProtection?: boolean;
}

/**
 * Basic helmet middleware that sets essential security headers
 *
 * @param config - Optional configuration
 * @returns Express middleware function
 */
export function basicHelmet(config: BasicHelmetConfig = {}): (req: Request, res: Response, next: NextFunction) => void {
  const {
    frameOptions = 'DENY',
    noSniff = true,
    xssProtection = true,
  } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    // B146C-SEC-006: X-Frame-Options - Prevent clickjacking
    if (frameOptions) {
      res.setHeader('X-Frame-Options', frameOptions);
    }

    // B146C-SEC-006: X-Content-Type-Options - Prevent MIME sniffing
    if (noSniff) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // B146C-SEC-006: X-XSS-Protection - Legacy XSS protection
    // Note: CSP is the modern approach, but this provides defense-in-depth for older browsers
    if (xssProtection) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    next();
  };
}

/**
 * Export default middleware instance
 */
export default basicHelmet();

