/**
 * Structured Security Event Logger
 * Logs authentication, DPoP, policy, and security events with consistent structure
 * CRITICAL: Ensures no PHI is logged
 */

import { getCorrelationContext } from './correlation.js';

/**
 * Security event types
 */
export enum SecurityEventType {
  // Authentication events
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  AUTH_LOGOUT = 'auth_logout',
  AUTH_TOKEN_REFRESH = 'auth_token_refresh',
  AUTH_TOKEN_REVOKED = 'auth_token_revoked',

  // DPoP events
  DPOP_VERIFICATION_SUCCESS = 'dpop_verification_success',
  DPOP_VERIFICATION_FAILURE = 'dpop_verification_failure',
  DPOP_TOKEN_ISSUED = 'dpop_token_issued',
  DPOP_REPLAY_DETECTED = 'dpop_replay_detected',

  // Authorization/Policy events
  POLICY_VIOLATION = 'policy_violation',
  POLICY_UPDATED = 'policy_updated',
  POLICY_ACCEPTED = 'policy_accepted',
  PERMISSION_DENIED = 'permission_denied',
  PERMISSION_GRANTED = 'permission_granted',

  // Access events
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  PRIVILEGED_ACCESS = 'privileged_access',
  DATA_EXPORT = 'data_export',
  DATA_DELETE = 'data_delete',

  // Security incidents
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  BRUTE_FORCE_DETECTED = 'brute_force_detected',
  IP_BLOCKED = 'ip_blocked',

  // Compliance events
  GDPR_REQUEST = 'gdpr_request',
  AUDIT_LOG_ACCESS = 'audit_log_access',
  ENCRYPTION_KEY_ROTATED = 'encryption_key_rotated'
}

/**
 * Event outcome
 */
export enum EventOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  DENIED = 'denied',
  PARTIAL = 'partial'
}

/**
 * Security event interface
 * All fields are carefully chosen to avoid PHI
 */
export interface SecurityEvent {
  // Event metadata
  timestamp: string;
  eventType: SecurityEventType;
  outcome: EventOutcome;

  // Actor information (who)
  actorId?: string;          // User/service ID (not name or email)
  actorType?: 'user' | 'service' | 'system';
  orgId?: string;            // Organization ID (not name)

  // Action information (what)
  action?: string;           // Action attempted
  resource?: string;         // Resource accessed (ID, not content)
  resourceType?: string;     // Type of resource

  // Context information (how/where)
  ipAddress?: string;        // Source IP (may be hashed in production)
  userAgent?: string;        // User agent string
  service?: string;          // Service name
  endpoint?: string;         // API endpoint
  method?: string;           // HTTP method

  // Outcome details
  statusCode?: number;       // HTTP status code
  errorCode?: string;        // Application error code
  reason?: string;           // Reason for failure/denial

  // Correlation
  traceId?: string;          // Distributed trace ID
  spanId?: string;           // Span ID
  correlationId?: string;    // Correlation ID
  sessionId?: string;        // Session ID (hashed)

  // Risk/security metadata
  riskScore?: number;        // Calculated risk score
  requiresMFA?: boolean;     // Whether MFA was required
  mfaCompleted?: boolean;    // Whether MFA was completed

  // Additional context (free-form, but no PHI)
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Base logger interface (can be winston, pino, etc.)
 */
interface BaseLogger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}

/**
 * Security logger class
 */
export class SecurityLogger {
  private logger: BaseLogger;
  private service: string;

  constructor(logger: BaseLogger, service: string) {
    this.logger = logger;
    this.service = service;
  }

  /**
   * Log a security event
   */
  log(event: Partial<SecurityEvent>): void {
    // Ensure no PHI in logs - validate all fields
    this.validateNoPHI(event);

    // Get correlation context if available
    const correlation = getCorrelationContext();

    // Build complete security event
    const securityEvent: SecurityEvent = {
      timestamp: new Date().toISOString(),
      eventType: event.eventType || SecurityEventType.SUSPICIOUS_ACTIVITY,
      outcome: event.outcome || EventOutcome.FAILURE,
      actorId: event.actorId,
      actorType: event.actorType,
      orgId: event.orgId,
      action: event.action,
      resource: event.resource,
      resourceType: event.resourceType,
      ipAddress: this.hashIfProduction(event.ipAddress),
      userAgent: event.userAgent,
      service: event.service || this.service,
      endpoint: event.endpoint,
      method: event.method,
      statusCode: event.statusCode,
      errorCode: event.errorCode,
      reason: event.reason,
      traceId: event.traceId || correlation?.traceId,
      spanId: event.spanId || correlation?.spanId,
      correlationId: event.correlationId || correlation?.correlationId,
      sessionId: event.sessionId,
      riskScore: event.riskScore,
      requiresMFA: event.requiresMFA,
      mfaCompleted: event.mfaCompleted,
      metadata: event.metadata
    };

    // Log at appropriate level
    const logLevel = this.determineLogLevel(event.eventType, event.outcome);

    if (logLevel === 'error') {
      this.logger.error('Security Event', securityEvent);
    } else if (logLevel === 'warn') {
      this.logger.warn('Security Event', securityEvent);
    } else {
      this.logger.info('Security Event', securityEvent);
    }
  }

  /**
   * Log authentication success
   */
  authSuccess(actorId: string, orgId?: string, metadata?: Record<string, any>): void {
    this.log({
      eventType: SecurityEventType.AUTH_SUCCESS,
      outcome: EventOutcome.SUCCESS,
      actorId,
      orgId,
      actorType: 'user',
      metadata
    });
  }

  /**
   * Log authentication failure
   */
  authFailure(reason: string, ipAddress?: string, metadata?: Record<string, any>): void {
    this.log({
      eventType: SecurityEventType.AUTH_FAILURE,
      outcome: EventOutcome.FAILURE,
      reason,
      ipAddress,
      actorType: 'user',
      metadata
    });
  }

  /**
   * Log DPoP verification success
   */
  dpopSuccess(actorId: string, orgId?: string): void {
    this.log({
      eventType: SecurityEventType.DPOP_VERIFICATION_SUCCESS,
      outcome: EventOutcome.SUCCESS,
      actorId,
      orgId,
      actorType: 'user'
    });
  }

  /**
   * Log DPoP verification failure
   */
  dpopFailure(reason: string, ipAddress?: string): void {
    this.log({
      eventType: SecurityEventType.DPOP_VERIFICATION_FAILURE,
      outcome: EventOutcome.FAILURE,
      reason,
      ipAddress,
      actorType: 'user'
    });
  }

  /**
   * Log policy violation
   */
  policyViolation(actorId: string, policyType: string, reason: string): void {
    this.log({
      eventType: SecurityEventType.POLICY_VIOLATION,
      outcome: EventOutcome.DENIED,
      actorId,
      actorType: 'user',
      action: 'policy_check',
      resourceType: policyType,
      reason
    });
  }

  /**
   * Log permission denied
   */
  permissionDenied(actorId: string, resource: string, action: string): void {
    this.log({
      eventType: SecurityEventType.PERMISSION_DENIED,
      outcome: EventOutcome.DENIED,
      actorId,
      actorType: 'user',
      action,
      resource,
      statusCode: 403
    });
  }

  /**
   * Log suspicious activity
   */
  suspiciousActivity(reason: string, ipAddress?: string, riskScore?: number): void {
    this.log({
      eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
      outcome: EventOutcome.FAILURE,
      reason,
      ipAddress,
      riskScore,
      actorType: 'user'
    });
  }

  /**
   * Log data export (for compliance)
   */
  dataExport(actorId: string, orgId: string, resourceType: string, recordCount: number): void {
    this.log({
      eventType: SecurityEventType.DATA_EXPORT,
      outcome: EventOutcome.SUCCESS,
      actorId,
      orgId,
      actorType: 'user',
      action: 'export',
      resourceType,
      metadata: { recordCount }
    });
  }

  /**
   * Validate that no PHI is in the event
   * This is a defense-in-depth measure
   */
  private validateNoPHI(event: Partial<SecurityEvent>): void {
    // List of fields that might contain PHI (reject if present)
    const prohibitedFields = ['name', 'email', 'ssn', 'dob', 'phone', 'address'];

    const eventKeys = Object.keys(event);
    for (const key of prohibitedFields) {
      if (eventKeys.includes(key)) {
        throw new Error(`PHI field '${key}' detected in security log - this is prohibited`);
      }
    }

    // Check metadata for prohibited fields
    if (event.metadata) {
      for (const key of Object.keys(event.metadata)) {
        const lowerKey = key.toLowerCase();
        for (const prohibited of prohibitedFields) {
          if (lowerKey.includes(prohibited)) {
            throw new Error(`Potential PHI field '${key}' in metadata - please use IDs only`);
          }
        }
      }
    }
  }

  /**
   * Hash IP addresses in production
   */
  private hashIfProduction(ipAddress?: string): string | undefined {
    if (!ipAddress) return undefined;

    // In production, hash IP addresses for privacy
    if (process.env.NODE_ENV === 'production') {
      // Simple hash (in real implementation, use proper hashing)
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(ipAddress).digest('hex').substring(0, 16);
    }

    return ipAddress;
  }

  /**
   * Determine appropriate log level
   */
  private determineLogLevel(eventType: SecurityEventType, outcome?: EventOutcome): 'info' | 'warn' | 'error' {
    // Security incidents and failures are errors
    const errorEvents = [
      SecurityEventType.SUSPICIOUS_ACTIVITY,
      SecurityEventType.BRUTE_FORCE_DETECTED,
      SecurityEventType.UNAUTHORIZED_ACCESS,
      SecurityEventType.POLICY_VIOLATION
    ];

    if (errorEvents.includes(eventType)) {
      return 'error';
    }

    // Failures are warnings
    if (outcome === EventOutcome.FAILURE || outcome === EventOutcome.DENIED) {
      return 'warn';
    }

    // Everything else is info
    return 'info';
  }
}

/**
 * Create a security logger instance
 */
export function createSecurityLogger(baseLogger: BaseLogger, service: string): SecurityLogger {
  return new SecurityLogger(baseLogger, service);
}

/**
 * Mock logger for testing
 */
export function createMockLogger(): BaseLogger {
  const logs: any[] = [];
  return {
    info: (msg: string, meta?: any) => logs.push({ level: 'info', msg, meta }),
    warn: (msg: string, meta?: any) => logs.push({ level: 'warn', msg, meta }),
    error: (msg: string, meta?: any) => logs.push({ level: 'error', msg, meta }),
    getLogs: () => logs
  } as any;
}

export default {
  SecurityEventType,
  EventOutcome,
  SecurityLogger,
  createSecurityLogger,
  createMockLogger
};

