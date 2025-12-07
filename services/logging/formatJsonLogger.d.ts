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
    ts: string;
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    service: string;
    requestId?: string;
    message: string;
    meta?: LogMeta;
}
export type LogLevel = LogEntry['level'];
declare class JsonLogger {
    private service;
    private logFormat;
    private minLevel;
    constructor(service?: string);
    private shouldLog;
    private formatEntry;
    private output;
    /**
     * Log a trace message (most verbose)
     */
    trace(message: string, meta?: LogMeta, requestId?: string): void;
    /**
     * Log a debug message
     */
    debug(message: string, meta?: LogMeta, requestId?: string): void;
    /**
     * Log an info message
     */
    info(message: string, meta?: LogMeta, requestId?: string): void;
    /**
     * Log a warning message
     */
    warn(message: string, meta?: LogMeta, requestId?: string): void;
    /**
     * Log an error message
     */
    error(message: string, meta?: LogMeta, requestId?: string): void;
    /**
     * Log a fatal error message
     */
    fatal(message: string, meta?: LogMeta, requestId?: string): void;
    /**
     * Create a child logger with a specific request ID
     */
    child(requestId: string): JsonLogger;
}
export declare const logger: JsonLogger;
export { JsonLogger };
