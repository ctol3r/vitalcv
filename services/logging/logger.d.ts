import { LogMeta } from './formatJsonLogger';
export type LoggerLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
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
/**
 * Create a logger instance for the given service/request context.
 */
export declare function createLogger(options?: LoggerOptions): UnifiedLogger;
/**
 * Shared logger used when no custom context is needed.
 */
export declare const logger: UnifiedLogger;
export default logger;
