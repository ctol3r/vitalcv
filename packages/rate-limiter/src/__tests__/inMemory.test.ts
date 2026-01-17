/**
 * Tests for In-Memory Rate Limiter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRateLimiter } from '../inMemory';

describe('InMemoryRateLimiter', () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter({
      maxRequests: 5,
      windowMs: 1000, // 1 second
    });
  });

  it('should allow requests within limit', async () => {
    const result1 = await limiter.check('client1');
    const result2 = await limiter.check('client1');
    const result3 = await limiter.check('client1');

    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(4);

    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(3);

    expect(result3.allowed).toBe(true);
    expect(result3.remaining).toBe(2);
  });

  it('should block requests exceeding limit', async () => {
    // Make 5 requests (fill the limit)
    for (let i = 0; i < 5; i++) {
      await limiter.check('client1');
    }

    // 6th request should be blocked
    const result = await limiter.check('client1');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('should track different clients independently', async () => {
    await limiter.check('client1');
    await limiter.check('client1');
    await limiter.check('client2');

    const result1 = await limiter.check('client1');
    const result2 = await limiter.check('client2');

    expect(result1.remaining).toBe(2);
    expect(result2.remaining).toBe(3);
  });

  it('should allow requests after window expires', async () => {
    // Fill the limit
    for (let i = 0; i < 5; i++) {
      await limiter.check('client1');
    }

    // Should be blocked
    const blocked = await limiter.check('client1');
    expect(blocked.allowed).toBe(false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Should be allowed again
    const allowed = await limiter.check('client1');
    expect(allowed.allowed).toBe(true);
    expect(allowed.remaining).toBe(4);
  });

  it('should reset client limit', async () => {
    await limiter.check('client1');
    await limiter.check('client1');

    await limiter.reset('client1');

    const result = await limiter.check('client1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should provide correct reset timestamp', async () => {
    const before = Math.floor(Date.now() / 1000);
    const result = await limiter.check('client1');
    const after = Math.floor(Date.now() / 1000);

    expect(result.reset).toBeGreaterThanOrEqual(before);
    expect(result.reset).toBeLessThanOrEqual(after + 1);
  });

  it('should return correct limit in result', async () => {
    const result = await limiter.check('client1');

    expect(result.limit).toBe(5);
  });

  it('should clear all storage', () => {
    limiter.check('client1');
    limiter.check('client2');

    expect(limiter.size()).toBe(2);

    limiter.clear();

    expect(limiter.size()).toBe(0);
  });
});
