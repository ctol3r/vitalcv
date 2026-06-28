/**
 * Professional Trust Cloud — event streaming (Wave 900, C5)
 * ──────────────────────────────────────────────────────────────────────────
 * A platform event stream that reuses the vetted webhook HMAC signer
 * (`computeSignature`) — no new crypto. Subscribers register per-tenant for
 * event types; emitting an event produces one signed delivery per matching
 * subscription. Platform event types are distinct from the internal webhook
 * types, so we sign our own envelope rather than coupling to WebhookEventType.
 *
 * Pure/deterministic: eventId + timestamp are injected (no clock), so the same
 * inputs always produce the same signed deliveries — testable and replayable.
 */
import { computeSignature } from '@/lib/platform/webhook';

export type PlatformEventType =
  | 'exchange.issued'
  | 'exchange.verified'
  | 'readiness.changed'
  | 'evidence.updated';

export const PLATFORM_EVENT_TYPES: readonly PlatformEventType[] = [
  'exchange.issued',
  'exchange.verified',
  'readiness.changed',
  'evidence.updated',
] as const;

export const PLATFORM_EVENT_SCHEMA = 'vitalcv.platform-event.v1' as const;

export interface EventSubscription {
  subscriptionId: string;
  tenantId: string;
  /** Event types this subscriber wants. */
  types: PlatformEventType[];
  /** Delivery endpoint (opaque here). */
  endpoint: string;
  /** Per-subscription signing secret. */
  secret: string;
}

export interface PlatformEvent<T = unknown> {
  type: PlatformEventType;
  tenantId: string;
  /** Subject the event concerns — a stable key, never PII. */
  subjectKey: string;
  payload: T;
}

export interface SignedEventDelivery {
  subscriptionId: string;
  endpoint: string;
  eventId: string;
  /** Canonical JSON envelope that was signed. */
  body: string;
  /** Unix/ISO timestamp bound into the signature (replay context). */
  timestamp: string;
  /** `sha256=<hex>` over `${timestamp}.${body}`. */
  signature: string;
}

function isValidType(t: unknown): t is PlatformEventType {
  return typeof t === 'string' && (PLATFORM_EVENT_TYPES as readonly string[]).includes(t);
}

/**
 * Fan an event out to matching subscriptions (tenant AND type), producing one
 * signed delivery each. `eventId`/`timestamp` are injected for determinism.
 * Returns [] for an unknown event type (fails closed, never throws).
 */
export function emitPlatformEvent(
  event: PlatformEvent,
  subscriptions: EventSubscription[],
  injected: { eventId: string; timestamp: string },
): SignedEventDelivery[] {
  if (!isValidType(event.type)) return [];
  return subscriptions
    .filter((sub) => sub.tenantId === event.tenantId && sub.types.includes(event.type))
    .map((sub) => {
      const envelope = {
        schema: PLATFORM_EVENT_SCHEMA,
        id: injected.eventId,
        type: event.type,
        tenantId: event.tenantId,
        subjectKey: event.subjectKey,
        occurredAt: injected.timestamp,
        payload: event.payload,
      };
      const body = JSON.stringify(envelope);
      return {
        subscriptionId: sub.subscriptionId,
        endpoint: sub.endpoint,
        eventId: injected.eventId,
        body,
        timestamp: injected.timestamp,
        signature: computeSignature(injected.timestamp, body, sub.secret),
      };
    });
}
