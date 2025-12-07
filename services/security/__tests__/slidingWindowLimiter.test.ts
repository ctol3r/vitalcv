/**
 * Tests for sliding window rate limiter
 * B143E-SPAM-002: Tests verify blocking & reset semantics
 */

import { SlidingWindowLimiter, createRateLimiter } from '../slidingWindowLimiter';

describe('SlidingWindowLimiter', () => {
  let limiter: SlidingWindowLimiter;

  beforeEach(() => {
    // Use in-memory mode for tests (no Redis required)
    limiter = new SlidingWindowLimiter({
      limit: 5,
      windowSeconds: 60,
      redisUrl: 'redis://localhost:9999', // Invalid URL to force in-memory fallback
      failOpen: true,
    });
  });

  afterEach(async () => {
    await limiter.close();
  });

  describe('Basic rate limiting', () => {
    it('should allow requests within limit', async () => {
      const identifier = 'test-user-1';

      for (let i = 0; i < 5; i++) {
        const result = await limiter.check(identifier);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(5 - (i + 1));
        expect(result.current).toBe(i + 1);
      }
    });

    it('should block requests exceeding limit', async () => {
      const identifier = 'test-user-2';

      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        await limiter.check(identifier);
      }

      // Next request should be blocked
      const result = await limiter.check(identifier);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.current).toBe(6);
    });

    it('should track different identifiers separately', async () => {
      const id1 = 'user-1';
      const id2 = 'user-2';

      // User 1 exhausts limit
      for (let i = 0; i < 5; i++) {
        await limiter.check(id1);
      }

      // User 2 should still have full limit
      const result = await limiter.check(id2);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.current).toBe(1);
    });
  });

  describe('Reset semantics', () => {
    it('should reset count after reset()', async () => {
      const identifier = 'test-reset';

      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        await limiter.check(identifier);
      }

      // Reset
      await limiter.reset(identifier);

      // Should be allowed again
      const result = await limiter.check(identifier);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.current).toBe(1);
    });
  });

  describe('Status check without increment', () => {
    it('should return status without incrementing counter', async () => {
      const identifier = 'test-status';

      // Make 3 requests
      await limiter.check(identifier);
      await limiter.check(identifier);
      await limiter.check(identifier);

      // Check status (should not increment)
      const status1 = await limiter.getStatus(identifier);
      expect(status1.current).toBe(3);
      expect(status1.remaining).toBe(2);

      // Check again (still should be 3)
      const status2 = await limiter.getStatus(identifier);
      expect(status2.current).toBe(3);
      expect(status2.remaining).toBe(2);
    });
  });

  describe('createRateLimiter helper', () => {
    it('should create limiter with correct config', async () => {
      const helperLimiter = createRateLimiter(10, 120, {
        keyPrefix: 'test-prefix',
      });

      expect(helperLimiter).toBeInstanceOf(SlidingWindowLimiter);
      await helperLimiter.close();
    });
  });

  describe('Fail-closed mode', () => {
    it('should deny requests when Redis unavailable and failOpen is false', async () => {
      const failClosedLimiter = new SlidingWindowLimiter({
        limit: 5,
        windowSeconds: 60,
        redisUrl: 'redis://localhost:9999', // Invalid URL
        failOpen: false,
      });

      const result = await failClosedLimiter.check('test-fail-closed');
      expect(result.allowed).toBe(false);

      await failClosedLimiter.close();
    });
  });
});

