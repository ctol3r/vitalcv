const log = getServiceLogger('security/loginAbuseGuard');
/**
 * B143E-SPAM-004: Signup/login abuse guard (failed-login counter + lockout)
 *
 * Tracks failed logins per account/device/IP.
 * After N failures, require cooldown or additional verification.
 */

import { SlidingWindowLimiter } from './slidingWindowLimiter';
import { createHash } from 'crypto';
import { getServiceLogger } from '../logging/serviceLogger';

export interface LoginAbuseGuardConfig {
  /** Maximum failed login attempts before lockout */
  maxFailedAttempts: number;
  /** Lockout duration in seconds */
  lockoutDurationSeconds: number;
  /** Time window for tracking failures in seconds */
  failureWindowSeconds: number;
  /** Redis URL (optional) */
  redisUrl?: string;
  /** Key prefix for Redis keys */
  keyPrefix?: string;
  /** Whether to enable logging */
  enableLogging?: boolean;
}

export interface LoginAttemptContext {
  /** Account identifier (email, username, user ID) */
  accountId?: string;
  /** IP address */
  ip?: string;
  /** Device fingerprint or ID */
  deviceId?: string;
  /** Whether the login attempt was successful */
  success: boolean;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface LoginCheckResult {
  /** Whether login is allowed */
  allowed: boolean;
  /** Reason if blocked */
  reason?: string;
  /** Number of failed attempts */
  failedAttempts: number;
  /** When the lockout expires (Unix timestamp in seconds, 0 if not locked) */
  lockoutExpiresAt: number;
  /** Time remaining in lockout (seconds, 0 if not locked) */
  lockoutRemainingSeconds: number;
  /** Identifiers checked */
  identifiers: string[];
}

/**
 * Login abuse guard for signup/login endpoints
 *
 * Tracks failed login attempts per account/device/IP and implements lockout
 * after N failures within a time window.
 */
export class LoginAbuseGuard {
  private failureLimiters: Map<string, SlidingWindowLimiter> = new Map();
  private lockoutLimiters: Map<string, SlidingWindowLimiter> = new Map();
  private config: Required<LoginAbuseGuardConfig>;

  constructor(config: LoginAbuseGuardConfig) {
    this.config = {
      maxFailedAttempts: config.maxFailedAttempts,
      lockoutDurationSeconds: config.lockoutDurationSeconds,
      failureWindowSeconds: config.failureWindowSeconds,
      redisUrl: config.redisUrl || process.env.REDIS_URL,
      keyPrefix: config.keyPrefix || 'login_abuse',
      enableLogging: config.enableLogging ?? true,
    };
  }

  /**
   * Get or create failure limiter for a specific identifier type
   */
  private getFailureLimiter(identifierType: string): SlidingWindowLimiter {
    const key = `${identifierType}:${this.config.maxFailedAttempts}`;

    if (!this.failureLimiters.has(key)) {
      const limiter = new SlidingWindowLimiter({
        limit: this.config.maxFailedAttempts,
        windowSeconds: this.config.failureWindowSeconds,
        redisUrl: this.config.redisUrl,
        keyPrefix: `${this.config.keyPrefix}:failure:${identifierType}`,
        failOpen: false, // Fail closed for security
      });
      this.failureLimiters.set(key, limiter);
    }

    return this.failureLimiters.get(key)!;
  }

  /**
   * Get or create lockout limiter for a specific identifier
   */
  private getLockoutLimiter(): SlidingWindowLimiter {
    const key = `lockout:${this.config.lockoutDurationSeconds}`;

    if (!this.lockoutLimiters.has(key)) {
      const limiter = new SlidingWindowLimiter({
        limit: 1, // Only one lockout per identifier
        windowSeconds: this.config.lockoutDurationSeconds,
        redisUrl: this.config.redisUrl,
        keyPrefix: `${this.config.keyPrefix}:lockout`,
        failOpen: false,
      });
      this.lockoutLimiters.set(key, limiter);
    }

    return this.lockoutLimiters.get(key)!;
  }

  /**
   * Hash sensitive identifier for storage
   */
  private hashIdentifier(identifier: string): string {
    return createHash('sha256').update(identifier).digest('hex');
  }

  /**
   * Normalize account identifier (lowercase, trim)
   */
  private normalizeAccountId(accountId: string): string {
    return accountId.toLowerCase().trim();
  }

  /**
   * Extract identifiers from login context
   */
  private extractIdentifiers(context: LoginAttemptContext): string[] {
    const identifiers: string[] = [];

    if (context.accountId) {
      const normalized = this.normalizeAccountId(context.accountId);
      identifiers.push(`account:${this.hashIdentifier(normalized)}`);
    }

    if (context.ip) {
      identifiers.push(`ip:${context.ip}`);
    }

    if (context.deviceId) {
      identifiers.push(`device:${this.hashIdentifier(context.deviceId)}`);
    }

    return identifiers;
  }

  /**
   * Record a login attempt
   *
   * @param context - Login attempt context
   * @returns Login check result
   */
  async recordAttempt(context: LoginAttemptContext): Promise<LoginCheckResult> {
    const identifiers = this.extractIdentifiers(context);

    if (identifiers.length === 0) {
      // No identifiers provided - deny by default
      if (this.config.enableLogging) {
        log.warn('[LoginAbuseGuard] No identifiers provided in context');
      }
      return {
        allowed: false,
        reason: 'No identifiers provided',
        failedAttempts: 0,
        lockoutExpiresAt: 0,
        lockoutRemainingSeconds: 0,
        identifiers: [],
      };
    }

    // Check for active lockouts first
    const lockoutLimiter = this.getLockoutLimiter();
    const now = Math.floor(Date.now() / 1000);

    for (const identifier of identifiers) {
      const lockoutStatus = await lockoutLimiter.getStatus(identifier);

      if (!lockoutStatus.allowed) {
        // Currently locked out
        const lockoutExpiresAt = lockoutStatus.resetAt;
        const remainingSeconds = Math.max(0, lockoutExpiresAt - now);

        if (this.config.enableLogging) {
          log.warn('[LoginAbuseGuard] Login blocked - account locked:', {
            identifier,
            lockoutExpiresAt: new Date(lockoutExpiresAt * 1000).toISOString(),
            remainingSeconds,
          });
        }

        return {
          allowed: false,
          reason: `Account locked. Please try again after ${Math.ceil(remainingSeconds / 60)} minutes.`,
          failedAttempts: this.config.maxFailedAttempts,
          lockoutExpiresAt,
          lockoutRemainingSeconds: remainingSeconds,
          identifiers,
        };
      }
    }

    // Record attempt
    if (context.success) {
      // Successful login - reset failure counts
      await Promise.all(
        identifiers.map(async (id) => {
          const [type] = id.split(':');
          const limiter = this.getFailureLimiter(type);
          await limiter.reset(id);
        })
      );

      return {
        allowed: true,
        failedAttempts: 0,
        lockoutExpiresAt: 0,
        lockoutRemainingSeconds: 0,
        identifiers,
      };
    }

    // Failed login - increment failure count
    const failureResults = await Promise.all(
      identifiers.map(async (id) => {
        const [type] = id.split(':');
        const limiter = this.getFailureLimiter(type);
        return {
          identifier: id,
          type,
          result: await limiter.check(id),
        };
      })
    );

    // Check if any identifier exceeded failure limit
    const exceededResult = failureResults.find((r) => !r.result.allowed);

    if (exceededResult) {
      // Trigger lockout for all identifiers
      const lockoutPromises = identifiers.map((id) => lockoutLimiter.check(id));
      await Promise.all(lockoutPromises);

      if (this.config.enableLogging) {
        log.warn('[LoginAbuseGuard] Account locked due to excessive failures:', {
          identifier: exceededResult.identifier,
          failedAttempts: exceededResult.result.current,
          lockoutDuration: this.config.lockoutDurationSeconds,
          context: {
            accountId: context.accountId ? '***' : undefined,
            ip: context.ip,
            deviceId: context.deviceId ? '***' : undefined,
          },
        });
      }

      const lockoutExpiresAt = now + this.config.lockoutDurationSeconds;

      return {
        allowed: false,
        reason: `Too many failed login attempts. Account locked for ${Math.ceil(this.config.lockoutDurationSeconds / 60)} minutes.`,
        failedAttempts: exceededResult.result.current,
        lockoutExpiresAt,
        lockoutRemainingSeconds: this.config.lockoutDurationSeconds,
        identifiers,
      };
    }

    // Still within failure limit
    const maxFailures = Math.max(...failureResults.map((r) => r.result.current));
    const remainingAttempts = this.config.maxFailedAttempts - maxFailures;

    if (this.config.enableLogging && remainingAttempts <= 3) {
      log.warn('[LoginAbuseGuard] Approaching failure limit:', {
        failedAttempts: maxFailures,
        remainingAttempts,
        limit: this.config.maxFailedAttempts,
        identifiers: identifiers.map((id) => id.split(':')[0]),
      });
    }

    return {
      allowed: true,
      failedAttempts: maxFailures,
      lockoutExpiresAt: 0,
      lockoutRemainingSeconds: 0,
      identifiers,
    };
  }

  /**
   * Check if login is allowed without recording attempt
   */
  async checkAllowed(context: LoginAttemptContext): Promise<LoginCheckResult> {
    const identifiers = this.extractIdentifiers(context);

    if (identifiers.length === 0) {
      return {
        allowed: false,
        reason: 'No identifiers provided',
        failedAttempts: 0,
        lockoutExpiresAt: 0,
        lockoutRemainingSeconds: 0,
        identifiers: [],
      };
    }

    // Check for active lockouts
    const lockoutLimiter = this.getLockoutLimiter();
    const now = Math.floor(Date.now() / 1000);

    for (const identifier of identifiers) {
      const lockoutStatus = await lockoutLimiter.getStatus(identifier);

      if (!lockoutStatus.allowed) {
        const lockoutExpiresAt = lockoutStatus.resetAt;
        const remainingSeconds = Math.max(0, lockoutExpiresAt - now);

        return {
          allowed: false,
          reason: `Account locked. Please try again after ${Math.ceil(remainingSeconds / 60)} minutes.`,
          failedAttempts: this.config.maxFailedAttempts,
          lockoutExpiresAt,
          lockoutRemainingSeconds: remainingSeconds,
          identifiers,
        };
      }
    }

    // Check failure counts
    const failureResults = await Promise.all(
      identifiers.map(async (id) => {
        const [type] = id.split(':');
        const limiter = this.getFailureLimiter(type);
        return {
          identifier: id,
          type,
          result: await limiter.getStatus(id),
        };
      })
    );

    const maxFailures = Math.max(...failureResults.map((r) => r.result.current));
    const remainingAttempts = this.config.maxFailedAttempts - maxFailures;

    return {
      allowed: true,
      failedAttempts: maxFailures,
      lockoutExpiresAt: 0,
      lockoutRemainingSeconds: 0,
      identifiers,
    };
  }

  /**
   * Reset failure count and lockout for an identifier
   */
  async reset(accountId: string, ip?: string, deviceId?: string): Promise<void> {
    const identifiers: string[] = [];

    if (accountId) {
      const normalized = this.normalizeAccountId(accountId);
      identifiers.push(`account:${this.hashIdentifier(normalized)}`);
    }

    if (ip) {
      identifiers.push(`ip:${ip}`);
    }

    if (deviceId) {
      identifiers.push(`device:${this.hashIdentifier(deviceId)}`);
    }

    const lockoutLimiter = this.getLockoutLimiter();

    await Promise.all([
      // Reset failure counts
      ...identifiers.map(async (id) => {
        const [type] = id.split(':');
        const limiter = this.getFailureLimiter(type);
        await limiter.reset(id);
      }),
      // Reset lockouts
      ...identifiers.map((id) => lockoutLimiter.reset(id)),
    ]);
  }

  /**
   * Close all limiters
   */
  async close(): Promise<void> {
    await Promise.all([
      ...Array.from(this.failureLimiters.values()).map((limiter) => limiter.close()),
      ...Array.from(this.lockoutLimiters.values()).map((limiter) => limiter.close()),
    ]);
    this.failureLimiters.clear();
    this.lockoutLimiters.clear();
  }
}

/**
 * Create a pre-configured login abuse guard
 */
export function createLoginAbuseGuard(
  maxFailedAttempts: number = 5,
  lockoutDurationSeconds: number = 15 * 60, // 15 minutes
  options?: Partial<LoginAbuseGuardConfig>
): LoginAbuseGuard {
  return new LoginAbuseGuard({
    maxFailedAttempts,
    lockoutDurationSeconds,
    failureWindowSeconds: 15 * 60, // 15 minutes
    ...options,
  });
}

