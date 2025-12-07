import { getServiceLogger } from './serviceLogger';
const log = getServiceLogger('logging/formatJsonLogger');
/**
 * Unified JSON logging format for API services
 *
 * Logs follow structured format: {ts, level, service, requestId, message, meta}
 * Toggle between plain and JSON via LOG_FORMAT environment variable
 *
 * Usage:
 *   import { logger } from './services/logging/formatJsonLogger';
 *   logger.info('User authenticated', { userId: '123' });
 *   logger.error('Database connection failed', { error: err.message });
 */

export interface LogMeta {
  [key: string]: any;
}

export interface LogEntry {
  ts: string; // ISO 8601 timestamp
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  service: string; // Service name (e.g., 'api', 'worker')
  requestId?: string; // Request ID for tracing
  message: string;
  meta?: LogMeta;
}

export type LogLevel = LogEntry['level'];

class JsonLogger {
  private service: string;
  private logFormat: 'json' | 'plain';
  private minLevel: LogLevel;

  constructor(service: string = 'api') {
    this.service = service;
    this.logFormat = (process.env.LOG_FORMAT || 'json').toLowerCase() === 'json' ? 'json' : 'plain';

    // Determine minimum log level from LOG_LEVEL env var
    const logLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
    const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    const levelIndex = levels.indexOf(logLevel as LogLevel);
    this.minLevel = levelIndex >= 0 ? levels[levelIndex] : 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    const currentIndex = levels.indexOf(level);
    const minIndex = levels.indexOf(this.minLevel);
    return currentIndex >= minIndex;
  }

  private formatEntry(level: LogLevel, message: string, requestId?: string, meta?: LogMeta): LogEntry {
    // B146C-SEC-001: Filter PHI from meta if present
    const filteredMeta = meta ? this.filterPHI(meta) : undefined;

    return {
      ts: new Date().toISOString(),
      level,
      service: this.service,
      requestId,
      message,
      meta: filteredMeta,
    };
  }

  /**
   * B146C-SEC-001: Filter PHI-sensitive fields from metadata
   * This provides defense-in-depth filtering at the JsonLogger level
   */
  private filterPHI(obj: any, depth: number = 0): any {
    if (depth > 10) return '[MAX_DEPTH_REACHED]';
    if (obj === null || obj === undefined) return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this.filterPHI(item, depth + 1));
    }

    if (typeof obj === 'object') {
      const sensitiveFields = ['name', 'birthDate', 'address', 'diagnosis', 'email', 'phone', 'ssn'];
      const filtered: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const isPHI = sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()));
        if (isPHI) {
          filtered[key] = typeof value === 'string' ? `[REDACTED:${value.length}chars]` : '[REDACTED]';
        } else {
          filtered[key] = this.filterPHI(value, depth + 1);
        }
      }
      return filtered;
    }

    return obj;
  }

  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    if (this.logFormat === 'json') {
      // JSON format: one line per log entry
      log.info(JSON.stringify(entry));
    } else {
      // Plain format: human-readable
      const timestamp = entry.ts;
      const levelEmoji = {
        trace: '🔍',
        debug: '🐛',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
        fatal: '💀',
      }[entry.level];

      const parts = [
        `${timestamp}`,
        `[${entry.level.toUpperCase()}]`,
        levelEmoji,
        `[${entry.service}]`,
        entry.requestId ? `[${entry.requestId}]` : '',
        entry.message,
      ].filter(Boolean);

      let output = parts.join(' ');

      if (entry.meta && Object.keys(entry.meta).length > 0) {
        output += ` ${JSON.stringify(entry.meta, null, 2)}`;
      }

      // Use appropriate console method based on level
      if (entry.level === 'error' || entry.level === 'fatal') {
        log.error(output);
      } else if (entry.level === 'warn') {
        log.warn(output);
      } else {
        log.info(output);
      }
    }
  }

  /**
   * Log a trace message (most verbose)
   */
  trace(message: string, meta?: LogMeta, requestId?: string): void {
    this.output(this.formatEntry('trace', message, requestId, meta));
  }

  /**
   * Log a debug message
   */
  debug(message: string, meta?: LogMeta, requestId?: string): void {
    this.output(this.formatEntry('debug', message, requestId, meta));
  }

  /**
   * Log an info message
   */
  info(message: string, meta?: LogMeta, requestId?: string): void {
    this.output(this.formatEntry('info', message, requestId, meta));
  }

  /**
   * Log a warning message
   */
  warn(message: string, meta?: LogMeta, requestId?: string): void {
    this.output(this.formatEntry('warn', message, requestId, meta));
  }

  /**
   * Log an error message
   */
  error(message: string, meta?: LogMeta, requestId?: string): void {
    this.output(this.formatEntry('error', message, requestId, meta));
  }

  /**
   * Log a fatal error message
   */
  fatal(message: string, meta?: LogMeta, requestId?: string): void {
    this.output(this.formatEntry('fatal', message, requestId, meta));
  }

  /**
   * Create a child logger with a specific request ID
   */
  child(requestId: string): JsonLogger {
    const childLogger = new JsonLogger(this.service);
    childLogger.logFormat = this.logFormat;
    childLogger.minLevel = this.minLevel;

    // Override output to always include requestId
    const originalOutput = childLogger.output.bind(childLogger);
    childLogger.output = (entry: LogEntry) => {
      entry.requestId = entry.requestId || requestId;
      originalOutput(entry);
    };

    return childLogger;
  }
}

// Export singleton instance for API service
export const logger = new JsonLogger(process.env.SERVICE_NAME || 'api');

// Export class for creating custom loggers
export { JsonLogger };

