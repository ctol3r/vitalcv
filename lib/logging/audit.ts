/**
 * Audit Logging System
 *
 * Structured JSON logging for security events and operational monitoring.
 * Designed for integration with CloudWatch, DataDog, Splunk, or stdout.
 */

import { type NextRequest } from 'next/server'

export type AuditEventType =
  | 'offer.created'
  | 'offer.retrieved'
  | 'offer.expired'
  | 'token.issued'
  | 'token.rejected'
  | 'credential.issued'
  | 'credential.rejected'
  | 'verification.requested'
  | 'verification.success'
  | 'verification.failed'
  | 'nonce.generated'
  | 'nonce.validated'
  | 'nonce.expired'
  | 'auth.failed'
  | 'rate_limit.exceeded'
  | 'pkce.failed'
  | 'jwt.signed'
  | 'jwt.verified'
  | 'jwt.rejected'
  | 'error.internal'
  | 'health.check'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical'

export interface AuditEvent {
  // Core fields
  timestamp: string
  level: LogLevel
  event: AuditEventType
  message: string

  // Request context
  request_id?: string
  ip_address?: string
  user_agent?: string
  method?: string
  path?: string

  // Performance metrics
  duration_ms?: number
  latency_ms?: number

  // Security context
  credential_type?: string
  issuer_id?: string
  subject_id?: string
  did?: string

  // Outcome
  outcome: 'success' | 'failure' | 'error'
  status_code?: number
  error_code?: string
  error_message?: string

  // Additional metadata
  metadata?: Record<string, unknown>
}

/**
 * Get log level from environment or default to 'info'
 */
function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase() || 'info'
  if (['debug', 'info', 'warn', 'error', 'critical'].includes(level)) {
    return level as LogLevel
  }
  return 'info'
}

/**
 * Check if log level should be emitted
 */
function shouldLog(level: LogLevel): boolean {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'critical']
  const currentLevel = getLogLevel()
  return levels.indexOf(level) >= levels.indexOf(currentLevel)
}

/**
 * Extract client IP from request
 */
function extractIP(request?: NextRequest): string {
  if (!request) return 'unknown'

  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  return 'unknown'
}

/**
 * Generate a request ID (simple timestamp-based)
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Format audit event as JSON log line
 */
function formatLogLine(event: AuditEvent): string {
  const logLine = {
    ...event,
    app: 'vitalcv-issuer',
    environment: process.env.NODE_ENV || 'development',
  }

  return JSON.stringify(logLine)
}

/**
 * Write log to output (stdout or external service)
 */
function writeLog(event: AuditEvent): void {
  if (!shouldLog(event.level)) {
    return
  }

  const logLine = formatLogLine(event)

  // Write to stdout (Docker/CloudWatch/etc will capture)
  if (event.level === 'error' || event.level === 'critical') {
    console.error(logLine)
  } else {
    console.log(logLine)
  }

  // TODO: Integrate with external logging service
  // - CloudWatch Logs
  // - DataDog
  // - Splunk
  // - Elasticsearch
}

/**
 * Create audit logger instance
 */
export class AuditLogger {
  private requestId: string
  private request?: NextRequest
  private startTime: number

  constructor(request?: NextRequest) {
    this.request = request
    this.requestId = generateRequestId()
    this.startTime = Date.now()
  }

  /**
   * Log an audit event
   */
  log(params: {
    event: AuditEventType
    level?: LogLevel
    message: string
    outcome: 'success' | 'failure' | 'error'
    status_code?: number
    error_code?: string
    error_message?: string
    credential_type?: string
    issuer_id?: string
    subject_id?: string
    did?: string
    metadata?: Record<string, unknown>
  }): void {
    const duration = Date.now() - this.startTime

    const auditEvent: AuditEvent = {
      timestamp: new Date().toISOString(),
      level: params.level || 'info',
      event: params.event,
      message: params.message,
      request_id: this.requestId,
      ip_address: extractIP(this.request),
      user_agent: this.request?.headers.get('user-agent') || undefined,
      method: this.request?.method,
      path: this.request ? new URL(this.request.url).pathname : undefined,
      duration_ms: duration,
      outcome: params.outcome,
      status_code: params.status_code,
      error_code: params.error_code,
      error_message: params.error_message,
      credential_type: params.credential_type,
      issuer_id: params.issuer_id,
      subject_id: params.subject_id,
      did: params.did,
      metadata: params.metadata,
    }

    writeLog(auditEvent)
  }

  /**
   * Log successful offer creation
   */
  logOfferCreated(params: {
    credential_type: string
    issuer_id: string
    pre_auth_code: string
    ttl_seconds: number
  }): void {
    this.log({
      event: 'offer.created',
      level: 'info',
      message: 'Credential offer created',
      outcome: 'success',
      status_code: 201,
      credential_type: params.credential_type,
      issuer_id: params.issuer_id,
      metadata: {
        pre_auth_code: params.pre_auth_code.substring(0, 16) + '...',
        ttl_seconds: params.ttl_seconds,
      },
    })
  }

  /**
   * Log successful token issuance
   */
  logTokenIssued(params: {
    credential_type: string
    pkce_used: boolean
    tx_code_used: boolean
  }): void {
    this.log({
      event: 'token.issued',
      level: 'info',
      message: 'Access token issued',
      outcome: 'success',
      status_code: 200,
      credential_type: params.credential_type,
      metadata: {
        pkce_used: params.pkce_used,
        tx_code_used: params.tx_code_used,
      },
    })
  }

  /**
   * Log token rejection
   */
  logTokenRejected(params: {
    reason: string
    error_code: string
    status_code: number
  }): void {
    this.log({
      event: 'token.rejected',
      level: 'warn',
      message: params.reason,
      outcome: 'failure',
      status_code: params.status_code,
      error_code: params.error_code,
    })
  }

  /**
   * Log credential issuance
   */
  logCredentialIssued(params: {
    credential_type: string
    issuer_id: string
    subject_id: string
    format: string
  }): void {
    this.log({
      event: 'credential.issued',
      level: 'info',
      message: 'Credential issued',
      outcome: 'success',
      status_code: 200,
      credential_type: params.credential_type,
      issuer_id: params.issuer_id,
      subject_id: params.subject_id,
      metadata: { format: params.format },
    })
  }

  /**
   * Log verification request
   */
  logVerificationRequested(params: {
    credential_id: string
    dcql_used: boolean
    privacy_mode: boolean
  }): void {
    this.log({
      event: 'verification.requested',
      level: 'info',
      message: 'Presentation verification requested',
      outcome: 'success',
      metadata: {
        credential_id: params.credential_id,
        dcql_used: params.dcql_used,
        privacy_mode: params.privacy_mode,
      },
    })
  }

  /**
   * Log verification result
   */
  logVerificationResult(params: {
    credential_id: string
    status: 'valid' | 'revoked' | 'unknown'
    claims_count?: number
  }): void {
    this.log({
      event: params.status === 'valid' ? 'verification.success' : 'verification.failed',
      level: params.status === 'valid' ? 'info' : 'warn',
      message: `Verification ${params.status}`,
      outcome: params.status === 'valid' ? 'success' : 'failure',
      status_code: params.status === 'valid' ? 200 : 400,
      metadata: {
        credential_id: params.credential_id,
        status: params.status,
        claims_count: params.claims_count,
      },
    })
  }

  /**
   * Log authentication failure
   */
  logAuthFailed(params: {
    reason: string
    error_code: string
  }): void {
    this.log({
      event: 'auth.failed',
      level: 'warn',
      message: params.reason,
      outcome: 'failure',
      status_code: 401,
      error_code: params.error_code,
    })
  }

  /**
   * Log rate limit exceeded
   */
  logRateLimitExceeded(params: {
    limit: number
    window_ms: number
  }): void {
    this.log({
      event: 'rate_limit.exceeded',
      level: 'warn',
      message: 'Rate limit exceeded',
      outcome: 'failure',
      status_code: 429,
      metadata: {
        limit: params.limit,
        window_ms: params.window_ms,
      },
    })
  }

  /**
   * Log PKCE failure
   */
  logPKCEFailed(): void {
    this.log({
      event: 'pkce.failed',
      level: 'warn',
      message: 'PKCE validation failed',
      outcome: 'failure',
      status_code: 401,
      error_code: 'invalid_grant',
    })
  }

  /**
   * Log internal error
   */
  logError(params: {
    message: string
    error: Error | unknown
    metadata?: Record<string, unknown>
  }): void {
    this.log({
      event: 'error.internal',
      level: 'error',
      message: params.message,
      outcome: 'error',
      status_code: 500,
      error_message: params.error instanceof Error ? params.error.message : String(params.error),
      metadata: {
        ...params.metadata,
        stack: params.error instanceof Error ? params.error.stack : undefined,
      },
    })
  }

  /**
   * Log nonce generation
   */
  logNonceGenerated(params: { ttl_seconds: number }): void {
    this.log({
      event: 'nonce.generated',
      level: 'debug',
      message: 'Nonce generated',
      outcome: 'success',
      status_code: 200,
      metadata: { ttl_seconds: params.ttl_seconds },
    })
  }

  /**
   * Log JWT signing
   */
  logJWTSigned(params: {
    algorithm: string
    kid: string
    payload_type: string
  }): void {
    this.log({
      event: 'jwt.signed',
      level: 'debug',
      message: 'JWT signed',
      outcome: 'success',
      metadata: {
        algorithm: params.algorithm,
        kid: params.kid,
        payload_type: params.payload_type,
      },
    })
  }
}

/**
 * Create a logger instance for a request
 */
export function createAuditLogger(request?: NextRequest): AuditLogger {
  return new AuditLogger(request)
}

/**
 * Log health check
 */
export function logHealthCheck(params: {
  component: string
  status: 'healthy' | 'unhealthy'
  details?: Record<string, unknown>
}): void {
  const event: AuditEvent = {
    timestamp: new Date().toISOString(),
    level: params.status === 'healthy' ? 'info' : 'error',
    event: 'health.check',
    message: `Health check: ${params.component} is ${params.status}`,
    outcome: params.status === 'healthy' ? 'success' : 'failure',
    metadata: {
      component: params.component,
      ...params.details,
    },
  }

  writeLog(event)
}
