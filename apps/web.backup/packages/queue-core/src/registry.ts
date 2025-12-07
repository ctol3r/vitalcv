import { JobType } from './jobTypes';
import type { JobHandler } from './types';

const handlers = new Map<JobType, JobHandler>();

export function registerJobHandler<T extends JobType>(
  type: T,
  handler: JobHandler<T>
): void {
  if (handlers.has(type)) {
    console.warn(`[queue-core] Handler for ${type} already registered, overriding.`);
  }
  handlers.set(type, handler as JobHandler);
}

export function getJobHandler(type: JobType): JobHandler | undefined {
  return handlers.get(type);
}

export function clearJobHandlers(): void {
  handlers.clear();
}

