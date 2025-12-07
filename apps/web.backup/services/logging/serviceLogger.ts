type LogMethod = (...args: unknown[]) => void;

export interface ServiceLogger {
  scope: string;
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  child(scope: string): ServiceLogger;
}

function formatScope(scope: string): string {
  const trimmed = scope.trim();
  return trimmed.length ? trimmed : 'service';
}

function buildLogger(scope: string): ServiceLogger {
  const formattedScope = formatScope(scope);
  const prefix = `[${formattedScope}]`;

  const makeLogger = (method: 'debug' | 'info' | 'warn' | 'error'): LogMethod => {
    return (...args: unknown[]) => {
      const consoleMethod = console[method] ?? console.log;
      consoleMethod(prefix, ...args);
    };
  };

  return {
    scope: formattedScope,
    debug: makeLogger('debug'),
    info: makeLogger('info'),
    warn: makeLogger('warn'),
    error: makeLogger('error'),
    child(childScope: string): ServiceLogger {
      const combinedScope = `${formattedScope}/${childScope}`.replace(/\/+/g, '/');
      return buildLogger(combinedScope);
    },
  };
}

export function getServiceLogger(scope: string): ServiceLogger {
  return buildLogger(scope);
}









