import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RETRY_POLICY,
  buildWebhookEvent,
  nextRetryDelayMs,
  signWebhookDelivery,
  verifyWebhookSignature,
} from '../lib/platform/webhook';

const SECRET = 'whsec_test';
const TS = '1700000000';

function delivery() {
  const event = buildWebhookEvent({ id: 'evt_1', type: 'intelligence.notification', subjectKey: 'entity-1', occurredAt: '2026-03-01T00:00:00.000Z', data: { title: 'Trust decay' } });
  return signWebhookDelivery(event, SECRET, TS);
}

describe('webhook signing (W330-C3)', () => {
  it('signs deterministically and verifies a valid signature', () => {
    const d = delivery();
    expect(d.signature).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(d).toEqual(delivery()); // deterministic given injected timestamp
    expect(verifyWebhookSignature({ body: d.body, timestamp: d.timestamp, signature: d.signature, secret: SECRET })).toBe(true);
    expect(d.headers['X-VitalCV-Signature']).toBe(d.signature);
  });

  it('rejects a tampered body, wrong timestamp, or wrong secret', () => {
    const d = delivery();
    expect(verifyWebhookSignature({ body: d.body + ' ', timestamp: d.timestamp, signature: d.signature, secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ body: d.body, timestamp: '1700000001', signature: d.signature, secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ body: d.body, timestamp: d.timestamp, signature: d.signature, secret: 'wrong' })).toBe(false);
  });
});

describe('webhook retry policy (W330-C3)', () => {
  it('is deterministic exponential backoff, capped, and exhausts', () => {
    expect(nextRetryDelayMs(1)).toBe(1_000);
    expect(nextRetryDelayMs(2)).toBe(2_000);
    expect(nextRetryDelayMs(3)).toBe(4_000);
    expect(nextRetryDelayMs(4)).toBe(8_000);
    expect(nextRetryDelayMs(DEFAULT_RETRY_POLICY.maxAttempts)).toBeNull(); // exhausted
    expect(nextRetryDelayMs(0)).toBeNull();
    // cap honored
    expect(nextRetryDelayMs(2, { maxAttempts: 10, baseDelayMs: 50_000, maxDelayMs: 60_000 })).toBe(60_000);
  });
});
