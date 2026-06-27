/**
 * VitalCV Platform webhook framework — CORE (Wave 330, C3).
 *
 * The deterministic, testable pieces an enterprise needs to receive trustworthy
 * events: a versioned event model, HMAC-SHA256 signed payloads (timing-safe
 * verification), and an exponential-backoff retry policy.
 *
 * SCOPE: this is the framework core only. LIVE delivery (subscription store,
 * change-detection event source, delivery worker/queue) requires the monitoring
 * backend + infra and is intentionally NOT implemented here — these primitives are
 * what a delivery worker would call. Pure: signing/verification/backoff are
 * deterministic given their inputs (timestamp is injected, never read from a clock).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export type WebhookEventType =
  | 'evidence.updated'
  | 'trust.changed'
  | 'timeline.event'
  | 'mobility.changed'
  | 'organization.changed'
  | 'intelligence.notification';

export interface WebhookEvent<T = unknown> {
  schema: 'vitalcv.webhook.v1';
  id: string;
  type: WebhookEventType;
  subjectKey: string;
  occurredAt: string;
  data: T;
}

export function buildWebhookEvent<T>(input: {
  id: string;
  type: WebhookEventType;
  subjectKey: string;
  occurredAt: string;
  data: T;
}): WebhookEvent<T> {
  return { schema: 'vitalcv.webhook.v1', ...input };
}

export interface SignedWebhookDelivery {
  eventId: string;
  /** Canonical JSON body that was signed. */
  body: string;
  /** Unix-seconds string included in the signature (replay protection). */
  timestamp: string;
  /** `sha256=<hex>` over `${timestamp}.${body}`. */
  signature: string;
  /** Suggested HTTP headers for the delivery. */
  headers: Record<string, string>;
}

/**
 * Shared HMAC-SHA256 primitive over `${timestamp}.${body}` (replay-bound).
 * Exported so the trust-exchange layer signs/verifies with the identical vetted
 * formula instead of duplicating its own crypto.
 */
export function computeSignature(timestamp: string, body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/** Sign an event for delivery. timestamp (unix-seconds string) is injected for determinism. */
export function signWebhookDelivery(event: WebhookEvent, secret: string, timestamp: string): SignedWebhookDelivery {
  const body = JSON.stringify(event);
  const signature = computeSignature(timestamp, body, secret);
  return {
    eventId: event.id,
    body,
    timestamp,
    signature,
    headers: {
      'Content-Type': 'application/json',
      'X-VitalCV-Event': event.type,
      'X-VitalCV-Event-Id': event.id,
      'X-VitalCV-Timestamp': timestamp,
      'X-VitalCV-Signature': signature,
    },
  };
}

/** Verify a received webhook signature (timing-safe). */
export function verifyWebhookSignature(input: {
  body: string;
  timestamp: string;
  signature: string;
  secret: string;
}): boolean {
  const expected = computeSignature(input.timestamp, input.body, input.secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(input.signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = { maxAttempts: 5, baseDelayMs: 1_000, maxDelayMs: 60_000 };

/**
 * Deterministic exponential backoff. `attempt` is 1-based (1 = first retry).
 * Returns the delay in ms, or null when retries are exhausted. No jitter (kept
 * deterministic; a delivery worker may add bounded jitter at send time).
 */
export function nextRetryDelayMs(attempt: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): number | null {
  if (attempt < 1 || attempt >= policy.maxAttempts) return null;
  return Math.min(policy.baseDelayMs * 2 ** (attempt - 1), policy.maxDelayMs);
}
