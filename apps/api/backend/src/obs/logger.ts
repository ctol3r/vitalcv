import type { Request } from 'express';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function log(
  level: LogLevel,
  message: string,
  fields?: Record<string, unknown>,
): void {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  // Keep it single-line JSON for easy ingestion.
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](JSON.stringify(payload));
}

export function reqLogFields(req: Request & { requestId?: string }) {
  return {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
  };
}


