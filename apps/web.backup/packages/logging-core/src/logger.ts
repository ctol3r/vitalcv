import pino, { Logger as PinoLogger } from 'pino';
import { getLogContext, LogContext } from './context';
import { serializeError } from './errorSerializer';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogFields {
  [key: string]: unknown;
}

export interface LoggerOptions {
  service?: string;
  defaultFields?: LogFields;
}

export interface LoggerChildOptions extends LoggerOptions {
  requestId?: string;
  userId?: string;
  orgId?: string;
}

export interface Logger {
  trace(message: string, fields?: LogFields): void;
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  fatal(message: string, fields?: LogFields): void;
  child(options?: LoggerChildOptions): Logger;
}

const DEFAULT_SERVICE = process.env.SERVICE_NAME || 'chai-vc-platform';

const baseLogger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  messageKey: 'message',
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
    }),
  },
  base: undefined,
});

class StructuredLogger implements Logger {
  constructor(
    private readonly logger: PinoLogger,
    private readonly defaultFields: LogFields = {},
  ) {}

  trace(message: string, fields?: LogFields): void {
    this.write('trace', message, fields);
  }

  debug(message: string, fields?: LogFields): void {
    this.write('debug', message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.write('info', message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.write('warn', message, fields);
  }

  error(message: string, fields?: LogFields): void {
    this.write('error', message, fields);
  }

  fatal(message: string, fields?: LogFields): void {
    this.write('fatal', message, fields);
  }

  child(options: LoggerChildOptions = {}): Logger {
    const childBindings: LogFields = {};
    if (options.service) {
      childBindings.service = options.service;
    }

    const defaultFields = {
      ...this.defaultFields,
      ...options.defaultFields,
    };

    if (options.requestId) {
      defaultFields.requestId = options.requestId;
    }
    if (options.userId) {
      defaultFields.userId = options.userId;
    }
    if (options.orgId) {
      defaultFields.orgId = options.orgId;
    }

    const childLogger = Object.keys(childBindings).length
      ? this.logger.child(childBindings)
      : this.logger;

    return new StructuredLogger(childLogger, defaultFields);
  }

  private write(level: LogLevel, message: string, fields?: LogFields): void {
    const payload = this.prepareFields(fields);
    if (payload) {
      (this.logger as any)[level](payload, message);
      return;
    }
    (this.logger as any)[level](message);
  }

  private prepareFields(fields?: LogFields): LogFields | undefined {
    const context = getLogContext();
    const mergedContext: LogFields = {};

    mergeIfDefined(mergedContext, context, ['requestId', 'userId', 'orgId', 'service']);

    const allFields: LogFields = {
      ...mergedContext,
      ...this.defaultFields,
      ...normalizeFields(fields),
    };

    return Object.keys(allFields).length ? allFields : undefined;
  }
}

function mergeIfDefined(target: LogFields, context: LogContext | undefined, keys: string[]) {
  if (!context) {
    return;
  }
  for (const key of keys) {
    const value = context[key];
    if (value !== undefined) {
      target[key] = value;
    }
  }
}

function normalizeFields(fields?: LogFields): LogFields {
  if (!fields) {
    return {};
  }

  return Object.entries(fields).reduce<LogFields>((acc, [key, value]) => {
    if (value instanceof Error) {
      acc[key] = serializeError(value);
    } else if (Array.isArray(value)) {
      acc[key] = value;
    } else if (value && typeof value === 'object' && (value as Error).name && (value as Error).message && (value as Error).stack) {
      acc[key] = serializeError(value as Error);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const serviceName = options.service || DEFAULT_SERVICE;
  const bindings = { service: serviceName };
  const loggerInstance = baseLogger.child(bindings);
  return new StructuredLogger(loggerInstance, options.defaultFields);
}

export const logger = createLogger();

