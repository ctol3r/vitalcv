/**
 * eventBus.ts — minimal in-process pub/sub.
 *
 * Intentionally tiny: no persistence, no retry, no ordering guarantees
 * beyond "emit fires handlers synchronously in registration order".
 * Production multi-instance deployments will need to swap this for a
 * durable broker (Queues / Kafka). Keeping the surface narrow so that
 * swap is local.
 *
 * The bus MUST NOT throw on handler errors — a failing handler is
 * logged and other handlers still fire. This protects decision and
 * trust paths from cascading failures.
 */

import { log } from '../../obs/logger';

export interface VcvEvent<TPayload = Record<string, unknown>> {
  type: string;
  clinicianNpi?: string;
  source?: string;
  severity?: string;
  timestamp: string;
  payload?: TPayload;
}

export type EventHandler<TPayload = Record<string, unknown>> = (
  event: VcvEvent<TPayload>,
) => void | Promise<void>;

const handlers = new Map<string, Set<EventHandler>>();

export function on(type: string, handler: EventHandler): () => void {
  const set = handlers.get(type) ?? new Set<EventHandler>();
  set.add(handler);
  handlers.set(type, set);
  return () => {
    set.delete(handler);
    if (set.size === 0) handlers.delete(type);
  };
}

export async function emit(event: VcvEvent): Promise<void> {
  const set = handlers.get(event.type);
  if (!set || set.size === 0) return;
  for (const handler of set) {
    try {
      await handler(event);
    } catch (error) {
      log('warn', 'event_handler_failed', {
        type: event.type,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}

// Exported for tests: reset all registered handlers.
export function __resetEventBusForTests(): void {
  handlers.clear();
}
