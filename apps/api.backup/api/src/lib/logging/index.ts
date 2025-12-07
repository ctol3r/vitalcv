/**
 * Structured Logging with PII Redaction and Sampling
 * Tagged: cursor-batch-1107 (Task 0011) - UPDATED
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Pino-based logger with:
 * - Automatic PII field redaction
 * - Request correlation IDs for distributed tracing
 * - Sampling for noisy endpoints (/present, /metrics)
 * - Enhanced redaction guards
 */

import pino from 'pino';
import { createHash } from 'crypto';

// ============================================================================
// SAMPLING CONFIGURATION
// ============================================================================

/**
 * Sampling rates by endpoint pattern
 * Value between 0 and 1 (0 = drop all, 1 = log all)
 */
const SAMPLING_RATES: Record<string, number> = {
  '/api/verifier/present': 0.1, // 10% sampling for batch verification
  '/metrics': 0.01, // 1% sampling for metrics endpoint
  '/healthz': 0.01, // 1% sampling for health checks
  '/readyz': 0.05, // 5% sampling for readiness checks
  // Default: 1.0 (log everything)
};

/**
 * Determine if a request should be sampled based on endpoint
 */
export function shouldSampleLog(path: string): boolean {
  // Check exact match first
  if (SAMPLING_RATES[path] !== undefined) {
    return Math.random() < SAMPLING_RATES[path];
  }

  // Check pattern match
  for (const [pattern, rate] of Object.entries(SAMPLING_RATES)) {
    if (path.startsWith(pattern)) {
      return Math.random() < rate;
    }
  }

  // Default: log everything
  return true;
}

// ============================================================================
// PII REDACTION
// ============================================================================

// PII fields to redact from logs (EXPANDED for better coverage)
const PII_FIELDS = [
  'ssn',
  'socialSecurityNumber',
  'npi',
  'licenseNumber',
  'certificationNumber',
  'email',
  'phone',
  'phoneNumber',
  'mobile',
  'dateOfBirth',
  'dob',
  'birthDate',
  'birthdate',
  'address',
  'street',
  'streetAddress',
  'city',
  'zipCode',
  'postalCode',
  'zip',
  'password',
  'token',
  'apiKey',
  'secret',
  'privateKey',
  'credential',
  'credentialSubject',
  'disclosures', // SD-JWT disclosures contain PII
  'proof', // Cryptographic proofs may contain sensitive data
  'signature',
  'authorization', // Auth headers
  'cookie',
];

/**
 * Additional patterns to redact (regex-based)
 */
const PII_PATTERNS = [
  /authorization/i,
  /bearer/i,
  /api[_-]?key/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
];

/**
 * Hash-based redaction for PII
 * Converts sensitive values to SHA-256 hash prefixes for correlation
 */
function hashRedact(value: string): string {
  const hash = createHash('sha256').update(value).digest('hex');
  return `[REDACTED:${hash.substring(0, 8)}]`;
}

/**
 * Recursive redaction of PII fields in objects
 * ENHANCED: Now checks patterns and has better coverage
 */
function redactPII(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Redact if string looks like a JWT or token
    if (obj.match(/^eyJ[A-Za-z0-9_-]+\./)) {
      return hashRedact(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactPII);
  }

  if (typeof obj === 'object') {
    const redacted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Check if key matches PII field names
      const matchesPIIField = PII_FIELDS.some((field) =>
        lowerKey.includes(field.toLowerCase()),
      );

      // Check if key matches PII patterns
      const matchesPIIPattern = PII_PATTERNS.some((pattern) => pattern.test(key));

      if ((matchesPIIField || matchesPIIPattern) && typeof value === 'string' && value.length > 0) {
        redacted[key] = hashRedact(value);
      } else if (typeof value === 'object') {
        redacted[key] = redactPII(value);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }

  return obj;
}

/**
 * Custom serializers for common log objects
 */
const serializers = {
  req: (req: any) => ({
    id: req.id || req.headers?.[' x-request-id'],
    method: req.method,
    url: req.url,
    headers: redactPII(req.headers),
    remoteAddress: req.ip || req.connection?.remoteAddress,
    remotePort: req.connection?.remotePort,
  }),
  res: (res: any) => ({
    statusCode: res.statusCode,
    headers: redactPII(res.getHeaders?.()),
  }),
  err: pino.stdSerializers.err,
};

/**
 * Create base logger instance
 */
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      host: bindings.hostname,
    }),
  },
  serializers,
  redact: {
    paths: PII_FIELDS.map((field) => `*.${field}`),
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'chai-vc-platform-backend',
    env: process.env.NODE_ENV || 'development',
  },
});

/**
 * Create child logger with request context
 */
export function createRequestLogger(requestId: string, additionalContext?: object) {
  return logger.child({
    requestId,
    ...additionalContext,
  });
}

/**
 * Sanitize log data to remove PII
 */
export function sanitize(data: any): any {
  return redactPII(data);
}

/**
 * Log levels with PII-safe interfaces
 */
export const log = {
  trace: (msg: string, data?: any) => logger.trace(sanitize(data), msg),
  debug: (msg: string, data?: any) => logger.debug(sanitize(data), msg),
  info: (msg: string, data?: any) => logger.info(sanitize(data), msg),
  warn: (msg: string, data?: any) => logger.warn(sanitize(data), msg),
  error: (msg: string, data?: any) => logger.error(sanitize(data), msg),
  fatal: (msg: string, data?: any) => logger.fatal(sanitize(data), msg),
};

/**
 * Express middleware for request logging with sampling
 * UPDATED: Now applies sampling to reduce log volume for noisy endpoints
 */
export function requestLoggingMiddleware(req: any, res: any, next: any) {
  // Generate or extract request ID
  const requestId =
    req.headers['x-request-id'] ||
    req.headers['x-correlation-id'] ||
    `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  req.id = requestId;
  req.log = createRequestLogger(requestId, {
    method: req.method,
    path: req.path,
  });

  // Set response header
  res.setHeader('X-Request-ID', requestId);

  // Determine if we should sample this request
  const shouldLog = shouldSampleLog(req.path);
  req.shouldLog = shouldLog;

  const startTime = Date.now();

  // Log request (with sampling)
  if (shouldLog) {
    req.log.info({
      event: 'request_start',
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
    });
  }

  // Capture response
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;

    // Log response (with sampling)
    // Always log errors, even if sampling would normally skip
    if (shouldLog || res.statusCode >= 400) {
      req.log.info({
        event: 'request_end',
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        sampled: shouldLog ? undefined : false, // Indicate if this was unsampled but logged due to error
      });
    }

    return originalSend.call(this, data);
  };

  next();
}

export default logger;

