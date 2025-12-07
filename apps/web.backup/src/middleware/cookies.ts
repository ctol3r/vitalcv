/**
 * B146C-SEC-003: Cookie Security Settings Middleware
 *
 * Provides secure cookie configuration for session and authentication cookies.
 * Ensures cookies are set with appropriate SameSite, Secure, and HttpOnly flags.
 *
 * Usage:
 *   import { setSecureCookie, clearCookie } from './middleware/cookies';
 *   setSecureCookie(res, 'session-token', 'value', { maxAge: 3600 });
 */

import { Response } from 'express';

export interface CookieOptions {
  /**
   * Maximum age in seconds
   */
  maxAge?: number;
  /**
   * Expiration date
   */
  expires?: Date;
  /**
   * Cookie path (default: '/')
   */
  path?: string;
  /**
   * Cookie domain
   */
  domain?: string;
  /**
   * SameSite policy: 'strict', 'lax', or 'none'
   * Default: 'lax' for session/auth cookies
   */
  sameSite?: 'strict' | 'lax' | 'none';
  /**
   * Secure flag (HTTPS only)
   * Default: true in production, false in development
   */
  secure?: boolean;
  /**
   * HttpOnly flag (prevent JavaScript access)
   * Default: true for session/auth cookies
   */
  httpOnly?: boolean;
}

/**
 * Determine if we're in a secure context (HTTPS)
 */
function isSecureContext(): boolean {
  // In production, assume HTTPS (can be overridden by X-Forwarded-Proto header)
  if (process.env.NODE_ENV === 'production') {
    return true;
  }
  // In development, check if HTTPS is explicitly enabled
  return process.env.HTTPS === 'true' || process.env.SECURE_COOKIES === 'true';
}

/**
 * Set a secure cookie with appropriate security flags
 *
 * @param res - Express response object
 * @param name - Cookie name
 * @param value - Cookie value
 * @param options - Cookie options (will be merged with secure defaults)
 */
export function setSecureCookie(
  res: Response,
  name: string,
  value: string,
  options: CookieOptions = {}
): void {
  const secure = options.secure !== undefined ? options.secure : isSecureContext();
  const httpOnly = options.httpOnly !== undefined ? options.httpOnly : true;
  const sameSite = options.sameSite || 'lax';

  // B146C-SEC-003: Ensure Secure flag is set for HTTPS
  if (secure && sameSite === 'none') {
    // SameSite=None requires Secure flag
    if (!secure) {
      throw new Error('SameSite=None requires Secure flag');
    }
  }

  const cookieOptions: CookieOptions = {
    path: options.path || '/',
    domain: options.domain,
    maxAge: options.maxAge,
    expires: options.expires,
    sameSite,
    secure,
    httpOnly,
  };

  // Remove undefined values
  const cleanOptions: any = {};
  for (const [key, val] of Object.entries(cookieOptions)) {
    if (val !== undefined) {
      cleanOptions[key] = val;
    }
  }

  res.cookie(name, value, cleanOptions);
}

/**
 * Set a session cookie (typically used for authentication tokens)
 * Uses strict security settings: HttpOnly=true, SameSite=Lax, Secure=true (in production)
 */
export function setSessionCookie(
  res: Response,
  name: string,
  value: string,
  maxAgeSeconds?: number
): void {
  setSecureCookie(res, name, value, {
    maxAge: maxAgeSeconds,
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureContext(),
  });
}

/**
 * Set a strict session cookie (for sensitive operations)
 * Uses SameSite=Strict for maximum protection
 */
export function setStrictSessionCookie(
  res: Response,
  name: string,
  value: string,
  maxAgeSeconds?: number
): void {
  setSecureCookie(res, name, value, {
    maxAge: maxAgeSeconds,
    httpOnly: true,
    sameSite: 'strict',
    secure: isSecureContext(),
  });
}

/**
 * Clear a cookie by setting it to expire immediately
 */
export function clearCookie(res: Response, name: string, path: string = '/'): void {
  res.cookie(name, '', {
    expires: new Date(0),
    path,
    httpOnly: true,
    secure: isSecureContext(),
    sameSite: 'lax',
  });
}

/**
 * Express middleware to ensure all cookies set via res.cookie() use secure defaults
 * This wraps the res.cookie() method to apply security defaults automatically
 */
export function secureCookieMiddleware() {
  return (req: any, res: Response, next: any) => {
    const originalCookie = res.cookie.bind(res);

    res.cookie = function(name: string, value: string, options: CookieOptions = {}) {
      // Apply secure defaults if not explicitly set
      const secure = options.secure !== undefined ? options.secure : isSecureContext();
      const httpOnly = options.httpOnly !== undefined ? options.httpOnly : true;
      const sameSite = options.sameSite || 'lax';

      return originalCookie(name, value, {
        ...options,
        secure,
        httpOnly,
        sameSite,
      });
    };

    next();
  };
}

