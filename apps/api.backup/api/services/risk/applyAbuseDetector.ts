const log = getServiceLogger('risk/applyAbuseDetector');
/**
 * B143E-SPAM-001: Abuse detection for Apply-with-VitalCV (per device/email/IP)
 *
 * Blocks repeated submissions >N/day per device/email/IP.
 * Logs when threshold exceeded.
 */

import { SlidingWindowLimiter, SlidingWindowLimiterConfig } from '../security/slidingWindowLimiter';
import { createHash } from 'crypto';
import { getServiceLogger } from '../logging/serviceLogger';

export interface AbuseDetectionConfig {
  /** Maximum submissions per day per identifier */
  maxSubmissionsPerDay: number;
  /** Redis URL (optional) */
  redisUrl?: string;
  /** Whether to log threshold violations */
  enableLogging?: boolean;
  /** Key prefix for Redis keys */
  keyPrefix?: string;
}

export interface AbuseCheckResult {
  /** Whether submission is allowed */
  allowed: boolean;
  /** Reason if blocked */
  reason?: string;
  /** Number of submissions today */
  count: number;
  /** When the limit resets (Unix timestamp in seconds) */
  resetAt: number;
  /** Identifiers checked */
  identifiers: string[];
}

export interface SubmissionContext {
  /** IP address */
  ip?: string;
  /** Email address */
  email?: string;
  /** Device fingerprint or ID */
  deviceId?: string;
  /** Applicant DID */
  applicantDid?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Abuse detector for Apply-with-VitalCV submissions
 *
 * Tracks submissions per device/email/IP and blocks repeated submissions exceeding daily threshold.
 */
export class ApplyAbuseDetector {
  private limiters: Map<string, SlidingWindowLimiter> = new Map();
  private config: Required<AbuseDetectionConfig>;

  constructor(config: AbuseDetectionConfig) {
    this.config = {
      maxSubmissionsPerDay: config.maxSubmissionsPerDay,
      redisUrl: config.redisUrl || process.env.REDIS_URL,
      enableLogging: config.enableLogging ?? true,
      keyPrefix: config.keyPrefix || 'apply_abuse',
    };
  }

  /**
   * Get or create limiter for a specific identifier type
   */
  private getLimiter(identifierType: string): SlidingWindowLimiter {
    const key = `${identifierType}:${this.config.maxSubmissionsPerDay}`;

    if (!this.limiters.has(key)) {
      const limiter = new SlidingWindowLimiter({
        limit: this.config.maxSubmissionsPerDay,
        windowSeconds: 24 * 60 * 60, // 24 hours
        redisUrl: this.config.redisUrl,
        keyPrefix: `${this.config.keyPrefix}:${identifierType}`,
        failOpen: false, // Fail closed for abuse detection
      });
      this.limiters.set(key, limiter);
    }

    return this.limiters.get(key)!;
  }

  /**
   * Normalize email address (lowercase, trim)
   */
  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  /**
   * Hash sensitive identifier for storage (one-way hash)
   */
  private hashIdentifier(identifier: string): string {
    return createHash('sha256').update(identifier).digest('hex');
  }

  /**
   * Extract identifiers from submission context
   */
  private extractIdentifiers(context: SubmissionContext): string[] {
    const identifiers: string[] = [];

    if (context.ip) {
      identifiers.push(`ip:${context.ip}`);
    }

    if (context.email) {
      const normalizedEmail = this.normalizeEmail(context.email);
      identifiers.push(`email:${this.hashIdentifier(normalizedEmail)}`);
    }

    if (context.deviceId) {
      identifiers.push(`device:${this.hashIdentifier(context.deviceId)}`);
    }

    if (context.applicantDid) {
      identifiers.push(`did:${context.applicantDid}`);
    }

    return identifiers;
  }

  /**
   * Check if submission is allowed
   *
   * @param context - Submission context (IP, email, device, DID)
   * @returns Abuse check result
   */
  async checkSubmission(context: SubmissionContext): Promise<AbuseCheckResult> {
    const identifiers = this.extractIdentifiers(context);

    if (identifiers.length === 0) {
      // No identifiers provided - deny by default for security
      if (this.config.enableLogging) {
        log.warn('[ApplyAbuseDetector] No identifiers provided in context');
      }
      return {
        allowed: false,
        reason: 'No identifiers provided',
        count: 0,
        resetAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        identifiers: [],
      };
    }

    // Check each identifier type separately
    const results = await Promise.all(
      identifiers.map(async (id) => {
        const [type] = id.split(':');
        const limiter = this.getLimiter(type);
        return {
          identifier: id,
          type,
          result: await limiter.check(id),
        };
      })
    );

    // Block if any identifier exceeds limit
    const blockedResult = results.find((r) => !r.result.allowed);

    if (blockedResult) {
      const result = blockedResult.result;

      if (this.config.enableLogging) {
        log.warn('[ApplyAbuseDetector] Submission blocked:', {
          identifier: blockedResult.identifier,
          count: result.current,
          limit: this.config.maxSubmissionsPerDay,
          resetAt: new Date(result.resetAt * 1000).toISOString(),
          context: {
            ip: context.ip,
            email: context.email ? '***' : undefined,
            deviceId: context.deviceId ? '***' : undefined,
            applicantDid: context.applicantDid,
          },
        });
      }

      return {
        allowed: false,
        reason: `Exceeded daily submission limit for ${blockedResult.type}`,
        count: result.current,
        resetAt: result.resetAt,
        identifiers,
      };
    }

    // All identifiers within limit
    const maxCount = Math.max(...results.map((r) => r.result.current));
    const maxResetAt = Math.max(...results.map((r) => r.result.resetAt));

    if (this.config.enableLogging && maxCount >= this.config.maxSubmissionsPerDay * 0.8) {
      // Log warning at 80% of limit
      log.warn('[ApplyAbuseDetector] Approaching daily limit:', {
        count: maxCount,
        limit: this.config.maxSubmissionsPerDay,
        identifiers: identifiers.map((id) => id.split(':')[0]),
      });
    }

    return {
      allowed: true,
      count: maxCount,
      resetAt: maxResetAt,
      identifiers,
    };
  }

  /**
   * Get current submission count for a context
   */
  async getSubmissionCount(context: SubmissionContext): Promise<AbuseCheckResult> {
    const identifiers = this.extractIdentifiers(context);

    if (identifiers.length === 0) {
      return {
        allowed: true,
        count: 0,
        resetAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        identifiers: [],
      };
    }

    const results = await Promise.all(
      identifiers.map(async (id) => {
        const [type] = id.split(':');
        const limiter = this.getLimiter(type);
        return {
          identifier: id,
          type,
          result: await limiter.getStatus(id),
        };
      })
    );

    const maxCount = Math.max(...results.map((r) => r.result.current));
    const maxResetAt = Math.max(...results.map((r) => r.result.resetAt));
    const blockedResult = results.find((r) => !r.result.allowed);

    return {
      allowed: !blockedResult,
      reason: blockedResult ? `Exceeded daily submission limit for ${blockedResult.type}` : undefined,
      count: maxCount,
      resetAt: maxResetAt,
      identifiers,
    };
  }

  /**
   * Reset submission count for a context
   */
  async resetSubmissionCount(context: SubmissionContext): Promise<void> {
    const identifiers = this.extractIdentifiers(context);

    await Promise.all(
      identifiers.map(async (id) => {
        const [type] = id.split(':');
        const limiter = this.getLimiter(type);
        await limiter.reset(id);
      })
    );
  }

  /**
   * Close all limiters
   */
  async close(): Promise<void> {
    await Promise.all(
      Array.from(this.limiters.values()).map((limiter) => limiter.close())
    );
    this.limiters.clear();
  }
}

/**
 * Create a pre-configured abuse detector
 */
export function createApplyAbuseDetector(
  maxSubmissionsPerDay: number = 10,
  options?: Partial<AbuseDetectionConfig>
): ApplyAbuseDetector {
  return new ApplyAbuseDetector({
    maxSubmissionsPerDay,
    ...options,
  });
}

