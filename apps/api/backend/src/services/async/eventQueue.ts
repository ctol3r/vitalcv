/**
 * eventQueue.ts — Wave 245: Async Trust Engine
 *
 * Simple in-memory event queue for credential monitoring events.
 * Designed for easy upgrade to Redis/SQS in production.
 *
 * Max queue size: 10,000 events (oldest dropped on overflow).
 */

import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CredentialEventType =
  | 'LICENSE_UPDATED'
  | 'LICENSE_EXPIRED'
  | 'SANCTION_DETECTED'
  | 'BOARD_EXPIRED'
  | 'DEA_UPDATED'
  | 'CREDENTIAL_VERIFIED'
  | 'CREDENTIAL_REVOKED'
  | 'MONITORING_ALERT';

export interface CredentialEvent {
  /** Unique event ID */
  eventId: string;
  /** NPI of the affected clinician */
  npi: string;
  /** Event category */
  type: CredentialEventType;
  /** ISO timestamp */
  occurredAt: string;
  /** Source system that emitted the event */
  source?: string;
  /** Optional structured payload */
  payload?: Record<string, unknown>;
}

// ── Queue ─────────────────────────────────────────────────────────────────────

const MAX_QUEUE_SIZE = 10_000;
const queue: CredentialEvent[] = [];

/**
 * Enqueue a credential event. If the queue is full, the oldest event is
 * dropped to make room (bounded memory).
 */
export function enqueueEvent(event: CredentialEvent): void {
  if (queue.length >= MAX_QUEUE_SIZE) {
    const dropped = queue.shift();
    log('warn', 'event_queue: overflow — dropping oldest event', {
      droppedEventId: dropped?.eventId,
      droppedType: dropped?.type,
      queueSize: queue.length,
    });
  }
  queue.push(event);
  log('debug', 'event_queue: enqueued', { eventId: event.eventId, type: event.type, npi: event.npi });
}

/**
 * Drain all queued events and return them. Queue is cleared after drain.
 */
export function drainEvents(): CredentialEvent[] {
  const events = queue.splice(0, queue.length);
  log('info', 'event_queue: drained', { eventCount: events.length });
  return events;
}

/**
 * Peek at the current queue depth without consuming events.
 */
export function getQueueDepth(): number {
  return queue.length;
}
