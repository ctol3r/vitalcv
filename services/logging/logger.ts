import { JsonLogger, LogMeta } from './formatJsonLogger';

export type LoggerLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * B146C-SEC-001: List of PHI-sensitive field names that should be redacted from logs
 * These fields are filtered by default to prevent PHI leakage in console logs
 */
const PHI_SENSITIVE_FIELDS = new Set([
  'name',
  'firstName',
  'lastName',
  'fullName',
  'birthDate',
  'dateOfBirth',
  'dob',
  'address',
  'streetAddress',
  'city',
  'state',
  'zipCode',
  'postalCode',
  'phone',
  'phoneNumber',
  'email',
  'emailAddress',
  'ssn',
  'socialSecurityNumber',
  'diagnosis',
  'diagnoses',
  'condition',
  'conditions',
  'medicalRecord',
  'medicalRecords',
  'patientId',
  'patientName',
  'npi', // NPI can be considered PHI in some contexts
  'insuranceId',
  'insuranceNumber',
  'medicaidId',
  'medicareId',
]);

/**
 * Recursively filters PHI-sensitive fields from an object
 * @param obj - Object to filter
 * @param depth - Current recursion depth (prevents infinite loops)
 * @returns Filtered object with sensitive fields redacted
 */
function filterPHI(obj: any, depth: number = 0): any {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[MAX_DEPTH_REACHED]';
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => filterPHI(item, depth + 1));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const filtered: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Check if this key matches any PHI-sensitive field (case-insensitive)
      const isPHI = Array.from(PHI_SENSITIVE_FIELDS).some(
        field => lowerKey === field.toLowerCase() || lowerKey.includes(field.toLowerCase())
      );

      if (isPHI) {
        // Redact the value - show type and length for debugging but not actual data
        if (typeof value === 'string') {
          filtered[key] = `[REDACTED:${value.length}chars]`;
        } else if (typeof value === 'number') {
          filtered[key] = '[REDACTED:number]';
        } else if (value instanceof Date) {
          filtered[key] = '[REDACTED:date]';
        } else {
          filtered[key] = '[REDACTED]';
        }
      } else {
        // Recursively filter nested objects
        filtered[key] = filterPHI(value, depth + 1);
      }
    }
    return filtered;
  }

  // Primitive values pass through unchanged
  return obj;
}

export interface LoggerChildOptions {
  /**
   * Request or correlation identifier that should be injected into every log line.
   */
  requestId?: string;
  /**
   * Additional metadata merged into subsequent log entries.
   */
  meta?: LogMeta;
  /**
   * Override the service name for the child logger.
   */
  service?: string;
}

export interface LoggerOptions {
  service?: string;
  requestId?: string;
  defaultMeta?: LogMeta;
}

export interface UnifiedLogger {
  trace(message: string, meta?: LogMeta): void;
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
  fatal(message: string, meta?: LogMeta): void;
  child(options?: LoggerChildOptions): UnifiedLogger;
}

const DEFAULT_SERVICE_NAME =
  process.env.SERVICE_NAME ||
  process.env.APP_NAME ||
  process.env.NODE_APP_INSTANCE ||
  'chai-vc-platform';

const loggerCache = new Map<string, JsonLogger>();

function getJsonLogger(service: string): JsonLogger {
  if (!loggerCache.has(service)) {
    loggerCache.set(service, new JsonLogger(service));
  }

  return loggerCache.get(service)!;
}

class StructuredLogger implements UnifiedLogger {
  private readonly jsonLogger: JsonLogger;
  private readonly defaultMeta: LogMeta;
  private readonly serviceName: string;

  constructor(serviceName: string, jsonLogger: JsonLogger, defaultMeta: LogMeta = {}) {
    this.serviceName = serviceName;
    this.jsonLogger = jsonLogger;
    this.defaultMeta = defaultMeta;
  }

  trace(message: string, meta?: LogMeta): void {
    this.jsonLogger.trace(message, this.mergeMeta(meta));
  }

  debug(message: string, meta?: LogMeta): void {
    this.jsonLogger.debug(message, this.mergeMeta(meta));
  }

  info(message: string, meta?: LogMeta): void {
    this.jsonLogger.info(message, this.mergeMeta(meta));
  }

  warn(message: string, meta?: LogMeta): void {
    this.jsonLogger.warn(message, this.mergeMeta(meta));
  }

  error(message: string, meta?: LogMeta): void {
    this.jsonLogger.error(message, this.mergeMeta(meta));
  }

  fatal(message: string, meta?: LogMeta): void {
    this.jsonLogger.fatal(message, this.mergeMeta(meta));
  }

  child(options: LoggerChildOptions = {}): UnifiedLogger {
    const nextMeta = this.mergeMeta(options.meta);
    const targetService = options.service || this.serviceName;

    let nextLogger =
      targetService === this.serviceName ? this.jsonLogger : getJsonLogger(targetService);

    if (options.requestId) {
      nextLogger = nextLogger.child(options.requestId);
    }

    return new StructuredLogger(targetService, nextLogger, nextMeta || {});
  }

  private mergeMeta(meta?: LogMeta): LogMeta | undefined {
    const merged = { ...this.defaultMeta, ...(meta || {}) };
    // B146C-SEC-001: Filter PHI-sensitive fields before logging
    const filtered = filterPHI(merged);
    return Object.keys(filtered).length === 0 ? undefined : filtered;
  }
}

/**
 * Create a logger instance for the given service/request context.
 */
export function createLogger(options: LoggerOptions = {}): UnifiedLogger {
  const serviceName = options.service || DEFAULT_SERVICE_NAME;
  const baseLogger = getJsonLogger(serviceName);
  const mergedMeta = options.defaultMeta || {};

  let unifiedLogger: UnifiedLogger = new StructuredLogger(serviceName, baseLogger, mergedMeta);

  if (options.requestId || options.service) {
    unifiedLogger = unifiedLogger.child({
      requestId: options.requestId,
      service: options.service,
    });
  }

  return unifiedLogger;
}

/**
 * Shared logger used when no custom context is needed.
 */
export const logger: UnifiedLogger = createLogger();

export default logger;

