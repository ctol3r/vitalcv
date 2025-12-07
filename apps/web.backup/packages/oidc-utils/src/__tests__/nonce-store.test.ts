import { describe, expect, it, vi } from 'vitest';
import { InMemoryNonceStore } from '../nonce-store';

describe('Nonce store', () => {
  it('issues and consumes nonces exactly once', async () => {
    const store = new InMemoryNonceStore({ ttlSeconds: 5 });
    const record = await store.issue();

    const firstConsume = await store.consume(record.value);
    expect(firstConsume).not.toBeNull();

    const secondConsume = await store.consume(record.value);
    expect(secondConsume).toBeNull();
  });

  it('expires nonces after TTL', async () => {
    vi.useFakeTimers();
    const store = new InMemoryNonceStore({ ttlSeconds: 1 });
    const record = await store.issue();
    vi.advanceTimersByTime(2000);

    const consumed = await store.consume(record.value);
    expect(consumed).toBeNull();
    expect(store.purgeExpired()).toBe(0); // Already purged on consume path

    vi.useRealTimers();
  });
});

