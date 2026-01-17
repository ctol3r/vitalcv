/**
 * Service logger with fallback for environments without workspace resolution
 */

// Try to import logging-core, fall back to console if not available
let createLogger: ((opts: { service: string }) => any) | undefined;
let Logger: any;

try {
  const loggingCore = require('@chai-vc/logging-core');
  createLogger = loggingCore.createLogger;
  Logger = loggingCore.Logger;
} catch (e) {
  // Fallback: create simple console-based logger
  createLogger = (opts: { service: string }) => ({
    debug: (msg: any, ...args: any[]) => console.debug(`[${opts.service}]`, msg, ...args),
    info: (msg: any, ...args: any[]) => console.info(`[${opts.service}]`, msg, ...args),
    warn: (msg: any, ...args: any[]) => console.warn(`[${opts.service}]`, msg, ...args),
    error: (msg: any, ...args: any[]) => console.error(`[${opts.service}]`, msg, ...args),
  });
}

const loggerCache = new Map<string, any>();

export function getServiceLogger(scope: string): any {
  if (!loggerCache.has(scope)) {
    loggerCache.set(
      scope,
      createLogger!({
        service: scope.startsWith('services:') ? scope : `services:${scope}`,
      }),
    );
  }

  return loggerCache.get(scope)!;
}

