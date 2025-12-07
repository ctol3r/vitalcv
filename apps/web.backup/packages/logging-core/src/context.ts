import { AsyncLocalStorage } from 'node:async_hooks';

export interface LogContext {
  requestId?: string;
  userId?: string;
  orgId?: string;
  service?: string;
  [key: string]: unknown;
}

const storage = new AsyncLocalStorage<LogContext>();

function cloneContext(nextContext: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(nextContext).filter(([, value]) => value !== undefined),
  );
}

export function getLogContext(): LogContext | undefined {
  return storage.getStore();
}

export function runWithLogContext<T>(context: LogContext, callback: () => T): T {
  const current = storage.getStore() || {};
  const merged = { ...current, ...context };
  return storage.run(cloneContext(merged), callback);
}

export function updateLogContext(context: LogContext): void {
  const current = storage.getStore();
  if (current) {
    Object.assign(current, cloneContext(context));
    return;
  }

  storage.enterWith(cloneContext(context));
}

