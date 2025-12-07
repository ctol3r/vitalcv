"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonLogger = exports.logger = void 0;
class JsonLogger {
    constructor(service = 'api') {
        this.service = service;
        this.logFormat = (process.env.LOG_FORMAT || 'json').toLowerCase() === 'json' ? 'json' : 'plain';
        // Determine minimum log level from LOG_LEVEL env var
        const logLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
        const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
        const levelIndex = levels.indexOf(logLevel);
        this.minLevel = levelIndex >= 0 ? levels[levelIndex] : 'info';
    }
    shouldLog(level) {
        const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
        const currentIndex = levels.indexOf(level);
        const minIndex = levels.indexOf(this.minLevel);
        return currentIndex >= minIndex;
    }
    formatEntry(level, message, requestId, meta) {
        return {
            ts: new Date().toISOString(),
            level,
            service: this.service,
            requestId,
            message,
            meta,
        };
    }
    output(entry) {
        if (!this.shouldLog(entry.level)) {
            return;
        }
        if (this.logFormat === 'json') {
            // JSON format: one line per log entry
            console.log(JSON.stringify(entry));
        }
        else {
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
                console.error(output);
            }
            else if (entry.level === 'warn') {
                console.warn(output);
            }
            else {
                console.log(output);
            }
        }
    }
    /**
     * Log a trace message (most verbose)
     */
    trace(message, meta, requestId) {
        this.output(this.formatEntry('trace', message, requestId, meta));
    }
    /**
     * Log a debug message
     */
    debug(message, meta, requestId) {
        this.output(this.formatEntry('debug', message, requestId, meta));
    }
    /**
     * Log an info message
     */
    info(message, meta, requestId) {
        this.output(this.formatEntry('info', message, requestId, meta));
    }
    /**
     * Log a warning message
     */
    warn(message, meta, requestId) {
        this.output(this.formatEntry('warn', message, requestId, meta));
    }
    /**
     * Log an error message
     */
    error(message, meta, requestId) {
        this.output(this.formatEntry('error', message, requestId, meta));
    }
    /**
     * Log a fatal error message
     */
    fatal(message, meta, requestId) {
        this.output(this.formatEntry('fatal', message, requestId, meta));
    }
    /**
     * Create a child logger with a specific request ID
     */
    child(requestId) {
        const childLogger = new JsonLogger(this.service);
        childLogger.logFormat = this.logFormat;
        childLogger.minLevel = this.minLevel;
        // Override output to always include requestId
        const originalOutput = childLogger.output.bind(childLogger);
        childLogger.output = (entry) => {
            entry.requestId = entry.requestId || requestId;
            originalOutput(entry);
        };
        return childLogger;
    }
}
exports.JsonLogger = JsonLogger;
// Export singleton instance for API service
exports.logger = new JsonLogger(process.env.SERVICE_NAME || 'api');
