/**
 * Tests for Apply-with-VitalCV abuse detector
 * B143E-SPAM-001: Integration test with rapid-fire submissions
 */

import { ApplyAbuseDetector, createApplyAbuseDetector } from '../applyAbuseDetector';

describe('ApplyAbuseDetector', () => {
  let detector: ApplyAbuseDetector;

  beforeEach(() => {
    detector = new ApplyAbuseDetector({
      maxSubmissionsPerDay: 5,
      redisUrl: 'redis://localhost:9999', // Invalid URL to force in-memory fallback
      enableLogging: false,
    });
  });

  afterEach(async () => {
    await detector.close();
  });

  describe('Basic abuse detection', () => {
    it('should allow submissions within limit', async () => {
      const context = {
        ip: '192.168.1.1',
        email: 'test@example.com',
      };

      for (let i = 0; i < 5; i++) {
        const result = await detector.checkSubmission(context);
        expect(result.allowed).toBe(true);
        expect(result.count).toBe(i + 1);
      }
    });

    it('should block submissions exceeding limit', async () => {
      const context = {
        ip: '192.168.1.2',
        email: 'test2@example.com',
      };

      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        await detector.checkSubmission(context);
      }

      // Next submission should be blocked
      const result = await detector.checkSubmission(context);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Exceeded daily submission limit');
      expect(result.count).toBeGreaterThan(5);
    });

    it('should track different identifiers separately', async () => {
      const context1 = {
        ip: '192.168.1.3',
        email: 'user1@example.com',
      };

      const context2 = {
        ip: '192.168.1.4',
        email: 'user2@example.com',
      };

      // Exhaust limit for user1
      for (let i = 0; i < 5; i++) {
        await detector.checkSubmission(context1);
      }

      // User2 should still have full limit
      const result = await detector.checkSubmission(context2);
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(1);
    });
  });

  describe('Per-identifier tracking', () => {
    it('should track IP addresses', async () => {
      const context = {
        ip: '10.0.0.1',
      };

      for (let i = 0; i < 5; i++) {
        const result = await detector.checkSubmission(context);
        expect(result.allowed).toBe(true);
      }

      const blocked = await detector.checkSubmission(context);
      expect(blocked.allowed).toBe(false);
    });

    it('should track email addresses', async () => {
      const context = {
        email: 'test@example.com',
      };

      for (let i = 0; i < 5; i++) {
        const result = await detector.checkSubmission(context);
        expect(result.allowed).toBe(true);
      }

      const blocked = await detector.checkSubmission(context);
      expect(blocked.allowed).toBe(false);
    });

    it('should track device IDs', async () => {
      const context = {
        deviceId: 'device-123',
      };

      for (let i = 0; i < 5; i++) {
        const result = await detector.checkSubmission(context);
        expect(result.allowed).toBe(true);
      }

      const blocked = await detector.checkSubmission(context);
      expect(blocked.allowed).toBe(false);
    });

    it('should track DIDs', async () => {
      const context = {
        applicantDid: 'did:example:123',
      };

      for (let i = 0; i < 5; i++) {
        const result = await detector.checkSubmission(context);
        expect(result.allowed).toBe(true);
      }

      const blocked = await detector.checkSubmission(context);
      expect(blocked.allowed).toBe(false);
    });
  });

  describe('Rapid-fire submissions', () => {
    it('should handle rapid-fire submissions from same IP', async () => {
      const context = {
        ip: '192.168.1.100',
      };

      // Rapid-fire 10 submissions
      const results = await Promise.all(
        Array.from({ length: 10 }, () => detector.checkSubmission(context))
      );

      const allowedCount = results.filter((r) => r.allowed).length;
      expect(allowedCount).toBe(5); // Only first 5 should be allowed

      const blockedCount = results.filter((r) => !r.allowed).length;
      expect(blockedCount).toBe(5); // Last 5 should be blocked
    });

    it('should handle rapid-fire submissions from multiple IPs', async () => {
      const contexts = Array.from({ length: 10 }, (_, i) => ({
        ip: `192.168.1.${100 + i}`,
      }));

      // All should be allowed (different IPs)
      const results = await Promise.all(
        contexts.map((ctx) => detector.checkSubmission(ctx))
      );

      const allAllowed = results.every((r) => r.allowed);
      expect(allAllowed).toBe(true);
    });
  });

  describe('Email normalization', () => {
    it('should normalize email addresses', async () => {
      const context1 = {
        email: 'Test@Example.COM',
      };

      const context2 = {
        email: 'test@example.com',
      };

      // Should treat as same email (case-insensitive)
      for (let i = 0; i < 5; i++) {
        await detector.checkSubmission(context1);
      }

      const result = await detector.checkSubmission(context2);
      expect(result.allowed).toBe(false);
    });
  });

  describe('Reset functionality', () => {
    it('should reset submission count', async () => {
      const context = {
        ip: '192.168.1.200',
      };

      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        await detector.checkSubmission(context);
      }

      // Reset
      await detector.resetSubmissionCount(context);

      // Should be allowed again
      const result = await detector.checkSubmission(context);
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(1);
    });
  });

  describe('Get submission count', () => {
    it('should return current count without incrementing', async () => {
      const context = {
        ip: '192.168.1.300',
      };

      // Make 3 submissions
      await detector.checkSubmission(context);
      await detector.checkSubmission(context);
      await detector.checkSubmission(context);

      // Check count (should not increment)
      const status1 = await detector.getSubmissionCount(context);
      expect(status1.count).toBe(3);

      const status2 = await detector.getSubmissionCount(context);
      expect(status2.count).toBe(3); // Still 3, not incremented
    });
  });

  describe('createApplyAbuseDetector helper', () => {
    it('should create detector with correct config', () => {
      const helperDetector = createApplyAbuseDetector(10, {
        enableLogging: false,
      });

      expect(helperDetector).toBeInstanceOf(ApplyAbuseDetector);
    });
  });
});

