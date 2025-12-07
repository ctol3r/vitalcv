/**
 * B143E-SPAM-005: Simple CAPTCHA hook for high-risk flows (pluggable)
 *
 * Middleware checks for captchaToken in request.
 * Call verifyCaptcha stub; on fail→403.
 * Integrated on signup & high-risk Apply-with-VitalCV flows.
 */

import { Request, Response, NextFunction } from 'express';

export interface CaptchaGateConfig {
  /** Whether CAPTCHA verification is enabled */
  enabled?: boolean;
  /** CAPTCHA verification function */
  verifyCaptcha?: (token: string, remoteIp?: string) => Promise<boolean>;
  /** Custom error message */
  errorMessage?: string;
}

/**
 * Verify CAPTCHA token (stub implementation)
 *
 * In production, integrate with hCaptcha, reCAPTCHA v3, or similar service.
 *
 * @param token - CAPTCHA token from client
 * @param remoteIp - Client IP address
 * @returns Whether CAPTCHA is valid
 */
async function verifyCaptchaStub(token: string, remoteIp?: string): Promise<boolean> {
  // Stub implementation - replace with real CAPTCHA service
  // Example for hCaptcha:
  // const response = await fetch('https://hcaptcha.com/siteverify', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  //   body: new URLSearchParams({
  //     secret: process.env.HCAPTCHA_SECRET_KEY!,
  //     response: token,
  //     remoteip: remoteIp || '',
  //   }),
  // });
  // const data = await response.json();
  // return data.success === true;

  // Stub: accept any non-empty token for development
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return token && token.length > 0;
  }

  // Production: require valid token
  // TODO: Integrate with real CAPTCHA service
  console.warn('[captchaGate] CAPTCHA verification not implemented, denying request');
  return false;
}

/**
 * Extract IP address from request
 */
function extractIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'] as string;
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'] as string;
  if (realIp) {
    return realIp;
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Create CAPTCHA gate middleware
 */
export function createCaptchaGateMiddleware(config: CaptchaGateConfig = {}) {
  const enabled = config.enabled ?? (process.env.CAPTCHA_ENABLED === 'true');
  const verifyCaptcha = config.verifyCaptcha || verifyCaptchaStub;
  const errorMessage = config.errorMessage || 'CAPTCHA verification failed';

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if CAPTCHA is disabled
    if (!enabled) {
      return next();
    }

    try {
      // Extract CAPTCHA token from request
      const captchaToken = req.body?.captchaToken ||
                          req.headers['x-captcha-token'] as string ||
                          req.query?.captchaToken as string;

      if (!captchaToken) {
        return res.status(403).json({
          error: 'captcha_required',
          message: 'CAPTCHA token is required',
        });
      }

      // Verify CAPTCHA token
      const remoteIp = extractIp(req);
      const isValid = await verifyCaptcha(captchaToken, remoteIp);

      if (!isValid) {
        return res.status(403).json({
          error: 'captcha_verification_failed',
          message: errorMessage,
        });
      }

      // CAPTCHA verified - attach verification result to request
      (req as any).captchaVerified = true;
      (req as any).captchaToken = captchaToken;

      next();
    } catch (error) {
      console.error('[captchaGate] Error verifying CAPTCHA:', error);

      // Fail closed: deny request if verification fails
      return res.status(403).json({
        error: 'captcha_verification_error',
        message: 'Failed to verify CAPTCHA. Please try again.',
      });
    }
  };
}

/**
 * Default CAPTCHA gate middleware
 */
export const captchaGate = createCaptchaGateMiddleware({
  enabled: process.env.CAPTCHA_ENABLED === 'true',
});

/**
 * CAPTCHA gate middleware for high-risk flows (strict)
 */
export const captchaGateStrict = createCaptchaGateMiddleware({
  enabled: true, // Always enabled for high-risk flows
});

