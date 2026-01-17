/**
 * LoggingEnhancements
 * Standardizes log format (JSON with traceId, spanId, level, timestamp, service)
 * Integrates with ELK/Datadog stack and adds error and event logs
 */

import { getCurrentTraceContext } from './tracingMiddleware';

export interface RequestLike {
  method: string;
  path: string;
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  requestId?: string;
  traceId?: string;
  userId?: string;
  startTime?: number;
  [key: string]: any;
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: string; // ISO 8601 timestamp
  level: LogLevel;
  service: string;
  message: string;
  traceId?: string;
  spanId?: string;
  requestId?: string;
  userId?: string;
  [key: string]: any; // Additional metadata
}

export interface ErrorLogEntry extends LogEntry {
  level: 'error' | 'fatal';
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface EventLogEntry extends LogEntry {
  event: string;
  eventType: string;
  metadata?: Record<string, any>;
}

/**
 * Enhanced logger with trace correlation and standardized format
 */
export class EnhancedLogger {
  private serviceName: string;
  private logFormat: 'json' | 'plain';
  private minLevel: LogLevel;
  private enableTraceCorrelation: boolean;
  private enableDatadog: boolean;
  private enableELK: boolean;

  constructor(
    serviceName: string = process.env.SERVICE_NAME || 'vitalcv',
    options: {
      logFormat?: 'json' | 'plain';
      minLevel?: LogLevel;
      enableTraceCorrelation?: boolean;
      enableDatadog?: boolean;
      enableELK?: boolean;
    } = {},
  ) {
    this.serviceName = serviceName;
    this.logFormat = options.logFormat || (process.env.LOG_FORMAT === 'json' ? 'json' : 'plain');
    this.minLevel = options.minLevel || (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.enableTraceCorrelation = options.enableTraceCorrelation ?? true;
    this.enableDatadog = options.enableDatadog ?? process.env.DATADOG_ENABLED === 'true';
    this.enableELK = options.enableELK ?? process.env.ELK_ENABLED === 'true';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    const currentIndex = levels.indexOf(level);
    const minIndex = levels.indexOf(this.minLevel);
    return currentIndex >= minIndex;
  }

  private enrichLogEntry(entry: Partial<LogEntry>, req?: RequestLike): LogEntry {
    const baseEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: entry.level || 'info',
      service: this.serviceName,
      message: entry.message || '',
      ...entry,
    };

    // Add trace correlation if enabled
    if (this.enableTraceCorrelation) {
      const traceContext = getCurrentTraceContext();
      if (traceContext) {
        baseEntry.traceId = traceContext.traceId;
        baseEntry.spanId = traceContext.spanId;
      }
    }

    // Add request context if available
    if (req) {
      baseEntry.requestId = (req as any).requestId || (req as any).traceId;
      baseEntry.userId = (req as any).userId;
      baseEntry.httpMethod = req.method;
      baseEntry.httpPath = req.path;
      baseEntry.httpQuery = req.query;
    }

    // Add Datadog-specific fields
    if (this.enableDatadog) {
      baseEntry.dd = {
        service: this.serviceName,
        env: process.env.NODE_ENV || 'development',
        version: process.env.SERVICE_VERSION || '1.0.0',
      };
    }

    // Add ELK-specific fields
    if (this.enableELK) {
      baseEntry['@timestamp'] = baseEntry.timestamp;
      baseEntry['@version'] = '1';
      baseEntry.fields = {
        service: this.serviceName,
        environment: process.env.NODE_ENV || 'development',
      };
    }

    return baseEntry as LogEntry;
  }

  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    if (this.logFormat === 'json') {
      // JSON format: one line per log entry
      console.log(JSON.stringify(entry));
    } else {
      // Plain format: human-readable
      const timestamp = entry.timestamp;
      const levelEmoji = {
        trace: '🔍',
        debug: '🐛',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
        fatal: '💀',
      }[entry.level];

      const parts = [
        timestamp,
        `[${entry.level.toUpperCase()}]`,
        levelEmoji,
        `[${entry.service}]`,
        entry.traceId ? `[trace:${entry.traceId.substring(0, 8)}]` : '',
        entry.spanId ? `[span:${entry.spanId.substring(0, 8)}]` : '',
        entry.requestId ? `[req:${entry.requestId}]` : '',
        entry.message,
      ].filter(Boolean);

      let output = parts.join(' ');

      // Add metadata if present
      const {
        timestamp: _timestamp,
        level: _level,
        service: _service,
        message: _message,
        traceId: _traceId,
        spanId: _spanId,
        requestId: _requestId,
        userId: _userId,
        dd: _dd,
        '@timestamp': _elkTimestamp,
        '@version': _elkVersion,
        fields: _fields,
        ...metadata
      } = entry;

      if (Object.keys(metadata).length > 0) {
        output += ` ${JSON.stringify(metadata, null, 2)}`;
      }

      // Use appropriate console method based on level
      if (entry.level === 'error' || entry.level === 'fatal') {
        console.error(output);
      } else if (entry.level === 'warn') {
        console.warn(output);
      } else {
        console.log(output);
      }
    }
  }

  /**
   * Log a trace message (most verbose)
   */
  trace(message: string, meta?: Record<string, any>, req?: RequestLike): void {
    const entry = this.enrichLogEntry({ level: 'trace', message, ...meta }, req);
    this.output(entry);
  }

  /**
   * Log a debug message
   */
  debug(message: string, meta?: Record<string, any>, req?: RequestLike): void {
    const entry = this.enrichLogEntry({ level: 'debug', message, ...meta }, req);
    this.output(entry);
  }

  /**
   * Log an info message
   */
  info(message: string, meta?: Record<string, any>, req?: RequestLike): void {
    const entry = this.enrichLogEntry({ level: 'info', message, ...meta }, req);
    this.output(entry);
  }

  /**
   * Log a warning message
   */
  warn(message: string, meta?: Record<string, any>, req?: RequestLike): void {
    const entry = this.enrichLogEntry({ level: 'warn', message, ...meta }, req);
    this.output(entry);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | any, meta?: Record<string, any>, req?: RequestLike): void {
    const errorEntry: ErrorLogEntry = {
      ...this.enrichLogEntry({ level: 'error', message, ...meta }, req),
      error: {
        name: error?.name || 'UnknownError',
        message: error?.message || String(error) || message,
        stack: error?.stack,
        code: error?.code,
      },
    } as ErrorLogEntry;

    this.output(errorEntry);
  }

  /**
   * Log a fatal error message
   */
  fatal(message: string, error?: Error | any, meta?: Record<string, any>, req?: RequestLike): void {
    const errorEntry: ErrorLogEntry = {
      ...this.enrichLogEntry({ level: 'fatal', message, ...meta }, req),
      error: {
        name: error?.name || 'UnknownError',
        message: error?.message || String(error) || message,
        stack: error?.stack,
        code: error?.code,
      },
    } as ErrorLogEntry;

    this.output(errorEntry);
  }

  /**
   * Log an event
   */
  event(event: string, eventType: string, metadata?: Record<string, any>, req?: RequestLike): void {
    const eventEntry: EventLogEntry = {
      ...this.enrichLogEntry({ level: 'info', message: `Event: ${event}`, ...metadata }, req),
      event,
      eventType,
      metadata,
    } as EventLogEntry;

    this.output(eventEntry);
  }

  /**
   * Create a child logger with additional context
   */
  child(options: {
    service?: string;
    requestId?: string;
    userId?: string;
    [key: string]: any;
  }): EnhancedLogger {
    const childLogger = new EnhancedLogger(options.service || this.serviceName, {
      logFormat: this.logFormat,
      minLevel: this.minLevel,
      enableTraceCorrelation: this.enableTraceCorrelation,
      enableDatadog: this.enableDatadog,
      enableELK: this.enableELK,
    });

    // Override enrichLogEntry to include child context
    const originalEnrich = childLogger.enrichLogEntry.bind(childLogger);
    childLogger.enrichLogEntry = (entry: Partial<LogEntry>, req?: RequestLike) => {
      const enriched = originalEnrich(entry, req);
      return {
        ...enriched,
        requestId: options.requestId || enriched.requestId,
        userId: options.userId || enriched.userId,
        ...options,
      };
    };

    return childLogger;
  }
}

/**
 * Express middleware to add request context to logs
 */
export function loggingMiddleware(logger: EnhancedLogger) {
  return (req: RequestLike, res: any, next: () => void) => {
    // Generate request ID if not present
    if (!(req as any).requestId) {
      (req as any).requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Add request ID to response headers
    res.setHeader('X-Request-Id', (req as any).requestId);

    // Log request start
    logger.debug(
      'Request started',
      {
        method: req.method,
        path: req.path,
        query: req.query,
        headers: req.headers,
      },
      req,
    );

    // Log request end
    res.on('finish', () => {
      logger.debug(
        'Request completed',
        {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: Date.now() - (req as any).startTime,
        },
        req,
      );
    });

    (req as any).startTime = Date.now();
    next();
  };
}

// Singleton instance
let defaultLogger: EnhancedLogger | null = null;

/**
 * Get or create default logger
 */
export function getLogger(serviceName?: string): EnhancedLogger {
  if (!defaultLogger) {
    defaultLogger = new EnhancedLogger(serviceName);
  }
  return defaultLogger;
}

export default EnhancedLogger;
