/**
 * B143E-SPAM-003: Apply-with-VitalCV rate-limit middleware
 *
 * Wrap /apply-with-vc & /payer/enroll/submit.
 * Uses slidingWindowLimiter with strict per-IP/device caps.
 */

import { Request, Response, NextFunction } from 'express';
import { SlidingWindowLimiter } from '../../../../services/security/slidingWindowLimiter';
import { ApplyAbuseDetector } from '../../../../services/risk/applyAbuseDetector';

export interface RateLimitApplyConfig {
  /** Maximum requests per hour per IP */
  maxRequestsPerHour?: number;
  /** Maximum requests per day per identifier */
  maxSubmissionsPerDay?: number;
  /** Redis URL (optional) */
  redisUrl?: string;
  /** Whether to enable abuse detection */
  enableAbuseDetection?: boolean;
}

/**
 * Extract device ID from request
 */
function extractDeviceId(req: Request): string | undefined {
  // Check for device fingerprint header
  const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
  if (deviceFingerprint) {
    return deviceFingerprint;
  }

  // Check for user agent + IP combination as fallback
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  if (userAgent && ip !== 'unknown') {
    // Simple device ID based on UA + IP
    return `${userAgent.substring(0, 50)}:${ip}`;
  }

  return undefined;
}

/**
 * Extract email from request
 */
function extractEmail(req: Request): string | undefined {
  // Check request body for email
  const body = req.body || {};
  return body.email || body.applicantEmail || body.clinicianEmail;
}

/**
 * Extract IP address from request
 */
function extractIp(req: Request): string {
  // Check for forwarded IP from proxy/load balancer
  const forwardedFor = req.headers['x-forwarded-for'] as string;
  if (forwardedFor) {
    // Take first IP if multiple (original client IP)
    return forwardedFor.split(',')[0].trim();
  }

  // Check for real IP header
  const realIp = req.headers['x-real-ip'] as string;
  if (realIp) {
    return realIp;
  }

  // Fallback to socket IP
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Extract applicant DID from request
 */
function extractApplicantDid(req: Request): string | undefined {
  const body = req.body || {};
  return body.applicantDid || body.did || (req as any).auth?.sub;
}

/**
 * Create rate limit middleware for Apply-with-VitalCV endpoints
 */
export function createRateLimitApplyMiddleware(config: RateLimitApplyConfig = {}) {
  const maxRequestsPerHour = config.maxRequestsPerHour ?? 100;
  const maxSubmissionsPerDay = config.maxSubmissionsPerDay ?? 10;
  const enableAbuseDetection = config.enableAbuseDetection ?? true;

  // Rate limiter for hourly limits
  const hourlyLimiter = new SlidingWindowLimiter({
    limit: maxRequestsPerHour,
    windowSeconds: 60 * 60, // 1 hour
    redisUrl: config.redisUrl,
    keyPrefix: 'rate_limit_apply_hourly',
    failOpen: false,
  });

  // Abuse detector for daily submission limits
  const abuseDetector = enableAbuseDetection
    ? new ApplyAbuseDetector({
        maxSubmissionsPerDay,
        redisUrl: config.redisUrl,
        enableLogging: true,
        keyPrefix: 'apply_abuse',
      })
    : null;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = extractIp(req);

      // Step 1: Check hourly rate limit per IP
      const hourlyResult = await hourlyLimiter.check(`ip:${ip}`);

      if (!hourlyResult.allowed) {
        res.setHeader('X-RateLimit-Limit', maxRequestsPerHour);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', new Date(hourlyResult.resetAt * 1000).toISOString());
        res.setHeader('Retry-After', Math.ceil(hourlyResult.resetAt - Math.floor(Date.now() / 1000)));

        return res.status(429).json({
          error: 'rate_limit_exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: hourlyResult.resetAt - Math.floor(Date.now() / 1000),
          resetAt: new Date(hourlyResult.resetAt * 1000).toISOString(),
        });
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequestsPerHour);
      res.setHeader('X-RateLimit-Remaining', hourlyResult.remaining);
      res.setHeader('X-RateLimit-Reset', new Date(hourlyResult.resetAt * 1000).toISOString());

      // Step 2: Check abuse detection (daily submission limits)
      if (abuseDetector) {
        const deviceId = extractDeviceId(req);
        const email = extractEmail(req);
        const applicantDid = extractApplicantDid(req);

        const abuseResult = await abuseDetector.checkSubmission({
          ip,
          email,
          deviceId,
          applicantDid,
        });

        if (!abuseResult.allowed) {
          res.setHeader('X-RateLimit-Limit', maxSubmissionsPerDay);
          res.setHeader('X-RateLimit-Remaining', 0);
          res.setHeader('X-RateLimit-Reset', new Date(abuseResult.resetAt * 1000).toISOString());
          res.setHeader('Retry-After', Math.ceil(abuseResult.resetAt - Math.floor(Date.now() / 1000)));

          return res.status(429).json({
            error: 'submission_limit_exceeded',
            message: abuseResult.reason || 'Daily submission limit exceeded',
            reason: abuseResult.reason,
            retryAfter: abuseResult.resetAt - Math.floor(Date.now() / 1000),
            resetAt: new Date(abuseResult.resetAt * 1000).toISOString(),
          });
        }

        // Set abuse detection headers
        res.setHeader('X-Submission-Limit', maxSubmissionsPerDay);
        res.setHeader('X-Submission-Remaining', Math.max(0, maxSubmissionsPerDay - abuseResult.count));
        res.setHeader('X-Submission-Reset', new Date(abuseResult.resetAt * 1000).toISOString());
      }

      // Attach rate limit info to request for logging
      (req as any).rateLimitInfo = {
        hourly: {
          remaining: hourlyResult.remaining,
          resetAt: hourlyResult.resetAt,
        },
        ...(abuseDetector && {
          daily: {
            remaining: maxSubmissionsPerDay - (await abuseDetector.getSubmissionCount({
              ip: extractIp(req),
              email: extractEmail(req),
              deviceId: extractDeviceId(req),
              applicantDid: extractApplicantDid(req),
            })).count,
          },
        }),
      };

      next();
    } catch (error) {
      console.error('[rateLimitApply] Error:', error);

      // Fail closed: deny request if rate limit check fails
      return res.status(500).json({
        error: 'rate_limit_error',
        message: 'Failed to check rate limit. Please try again later.',
      });
    }
  };
}

/**
 * Default rate limit middleware for Apply-with-VitalCV
 * - 100 requests per hour per IP
 * - 10 submissions per day per device/email/IP
 */
export const rateLimitApply = createRateLimitApplyMiddleware({
  maxRequestsPerHour: parseInt(process.env.APPLY_RATE_LIMIT_HOURLY || '100', 10),
  maxSubmissionsPerDay: parseInt(process.env.APPLY_ABUSE_LIMIT_DAILY || '10', 10),
  enableAbuseDetection: process.env.APPLY_ABUSE_DETECTION_ENABLED !== 'false',
});

/**
 * Strict rate limit middleware (for high-risk endpoints)
 * - 20 requests per hour per IP
 * - 5 submissions per day per device/email/IP
 */
export const rateLimitApplyStrict = createRateLimitApplyMiddleware({
  maxRequestsPerHour: parseInt(process.env.APPLY_RATE_LIMIT_HOURLY_STRICT || '20', 10),
  maxSubmissionsPerDay: parseInt(process.env.APPLY_ABUSE_LIMIT_DAILY_STRICT || '5', 10),
  enableAbuseDetection: true,
});

