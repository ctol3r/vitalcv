import { createLogger, type Logger } from '@chai-vc/logging-core';

const loggerCache = new Map<string, Logger>();

export function getServiceLogger(scope: string): Logger {
  if (!loggerCache.has(scope)) {
    loggerCache.set(
      scope,
      createLogger({
        service: scope.startsWith('services:') ? scope : `services:${scope}`,
      }),
    );
  }

  return loggerCache.get(scope)!;
}

