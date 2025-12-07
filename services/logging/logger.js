"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createLogger = createLogger;
const formatJsonLogger_1 = require("./formatJsonLogger");
const DEFAULT_SERVICE_NAME = process.env.SERVICE_NAME ||
    process.env.APP_NAME ||
    process.env.NODE_APP_INSTANCE ||
    'chai-vc-platform';
const loggerCache = new Map();
function getJsonLogger(service) {
    if (!loggerCache.has(service)) {
        loggerCache.set(service, new formatJsonLogger_1.JsonLogger(service));
    }
    return loggerCache.get(service);
}
class StructuredLogger {
    constructor(serviceName, jsonLogger, defaultMeta = {}) {
        this.serviceName = serviceName;
        this.jsonLogger = jsonLogger;
        this.defaultMeta = defaultMeta;
    }
    trace(message, meta) {
        this.jsonLogger.trace(message, this.mergeMeta(meta));
    }
    debug(message, meta) {
        this.jsonLogger.debug(message, this.mergeMeta(meta));
    }
    info(message, meta) {
        this.jsonLogger.info(message, this.mergeMeta(meta));
    }
    warn(message, meta) {
        this.jsonLogger.warn(message, this.mergeMeta(meta));
    }
    error(message, meta) {
        this.jsonLogger.error(message, this.mergeMeta(meta));
    }
    fatal(message, meta) {
        this.jsonLogger.fatal(message, this.mergeMeta(meta));
    }
    child(options = {}) {
        const nextMeta = this.mergeMeta(options.meta);
        const targetService = options.service || this.serviceName;
        let nextLogger = targetService === this.serviceName ? this.jsonLogger : getJsonLogger(targetService);
        if (options.requestId) {
            nextLogger = nextLogger.child(options.requestId);
        }
        return new StructuredLogger(targetService, nextLogger, nextMeta || {});
    }
    mergeMeta(meta) {
        const merged = { ...this.defaultMeta, ...(meta || {}) };
        return Object.keys(merged).length === 0 ? undefined : merged;
    }
}
/**
 * Create a logger instance for the given service/request context.
 */
function createLogger(options = {}) {
    const serviceName = options.service || DEFAULT_SERVICE_NAME;
    const baseLogger = getJsonLogger(serviceName);
    const mergedMeta = options.defaultMeta || {};
    let unifiedLogger = new StructuredLogger(serviceName, baseLogger, mergedMeta);
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
exports.logger = createLogger();
exports.default = exports.logger;
