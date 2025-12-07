/**
 * Tests for login abuse guard
 * B143E-SPAM-004: Tests cover normal vs brute force
 */

import { LoginAbuseGuard, createLoginAbuseGuard } from '../loginAbuseGuard';

describe('LoginAbuseGuard', () => {
  let guard: LoginAbuseGuard;

  beforeEach(() => {
    guard = new LoginAbuseGuard({
      maxFailedAttempts: 5,
      lockoutDurationSeconds: 60, // 1 minute for tests
      failureWindowSeconds: 60,
      redisUrl: 'redis://localhost:9999', // Invalid URL to force in-memory fallback
      enableLogging: false,
    });
  });

  afterEach(async () => {
    await guard.close();
  });

  describe('Normal login flow', () => {
    it('should allow successful logins', async () => {
      const context = {
        accountId: 'user@example.com',
        ip: '192.168.1.1',
        success: true,
      };

      const result = await guard.recordAttempt(context);
      expect(result.allowed).toBe(true);
      expect(result.failedAttempts).toBe(0);
      expect(result.lockoutExpiresAt).toBe(0);
    });

    it('should allow a few failed attempts', async () => {
      const context = {
        accountId: 'user@example.com',
        ip: '192.168.1.1',
        success: false,
      };

      // Allow up to maxFailedAttempts - 1
      for (let i = 0; i < 4; i++) {
        const result = await guard.recordAttempt(context);
        expect(result.allowed).toBe(true);
        expect(result.failedAttempts).toBe(i + 1);
      }
    });

    it('should reset failure count on successful login', async () => {
      const context = {
        accountId: 'user@example.com',
        ip: '192.168.1.1',
        success: false,
      };

      // Make 3 failed attempts
      await guard.recordAttempt(context);
      await guard.recordAttempt(context);
      await guard.recordAttempt(context);

      // Successful login
      const successResult = await guard.recordAttempt({
        ...context,
        success: true,
      });

      expect(successResult.allowed).toBe(true);
      expect(successResult.failedAttempts).toBe(0);

      // Next failed attempt should start from 0
      const nextFail = await guard.recordAttempt(context);
      expect(nextFail.failedAttempts).toBe(1);
    });
  });

  describe('Brute force protection', () => {
    it('should lock account after max failed attempts', async () => {
      const context = {
        accountId: 'user@example.com',
        ip: '192.168.1.1',
        success: false,
      };

      // Exhaust failure limit
      for (let i = 0; i < 5; i++) {
        await guard.recordAttempt(context);
      }

      // Next attempt should be blocked
      const result = await guard.recordAttempt(context);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Too many failed login attempts');
      expect(result.lockoutExpiresAt).toBeGreaterThan(0);
      expect(result.lockoutRemainingSeconds).toBeGreaterThan(0);
    });

    it('should prevent login during lockout period', async () => {
      const context = {
        accountId: 'user@example.com',
        ip: '192.168.1.1',
        success: false,
      };

      // Trigger lockout
      for (let i = 0; i < 5; i++) {
        await guard.recordAttempt(context);
      }

      // Try to login during lockout (even with correct credentials)
      const lockedResult = await guard.recordAttempt({
        ...context,
        success: true, // Even correct password is blocked
      });

      expect(lockedResult.allowed).toBe(false);
      expect(lockedResult.reason).toContain('Account locked');
    });

    it('should track failures per account separately', async () => {
      const context1 = {
        accountId: 'user1@example.com',
        ip: '192.168.1.1',
        success: false,
      };

      const context2 = {
        accountId: 'user2@example.com',
        ip: '192.168.1.1',
        success: false,
      };

      // User1 exhausts limit
      for (let i = 0; i < 5; i++) {
        await guard.recordAttempt(context1);
      }

      // User2 should still be allowed
      const result = await guard.recordAttempt(context2);
      expect(result.allowed).toBe(true);
      expect(result.failedAttempts).toBe(1);
    });

    it('should track failures per IP separately', async () => {
      const context1 = {
        accountId: 'user@example.com',
        ip: '192.168.1.1',
        success: false,
      };

      const context2 = {
        accountId: 'user@example.com',
        ip: '192.168.1.2',
        success: false,
      };

      // IP1 exhausts limit
      for (let i = 0; i < 5; i++) {
        await guard.recordAttempt(context1);
      }

      // IP2 should still be allowed
      const result = await guard.recordAttempt(context2);
      expect(result.allowed).toBe(true);
      expect(result.failedAttempts).toBe(1);
    });
  });

  describe('Check without recording', () => {
    it('should check lockout status without incrementing', async () => {
      const context = {
        accountId: 'user@example.com',
        ip: '192.168.1.1',
        success: false,
      };

      // Trigger lockout
      for (let i = 0; i < 5; i++) {
        await guard.recordAttempt(context);
      }

      // Check status (should not increment)
      const check1 = await guard.checkAllowed(context);
      expect(check1.allowed).toBe(false);

      // Check again (should still be locked)
      const check2 = await guard.checkAllowed(context);
      expect(check2.allowed).toBe(false);
      expect(check2.lockoutExpiresAt).toBe(check1.lockoutExpiresAt);
    });
  });

  describe('Reset functionality', () => {
    it('should reset failure count and lockout', async () => {
      const context = {
        accountId: 'user@example.com',
        ip: '192.168.1.1',
        success: false,
      };

      // Trigger lockout
      for (let i = 0; i < 5; i++) {
        await guard.recordAttempt(context);
      }

      // Reset
      await guard.reset('user@example.com', '192.168.1.1');

      // Should be allowed again
      const result = await guard.recordAttempt({
        ...context,
        success: true,
      });
      expect(result.allowed).toBe(true);
      expect(result.failedAttempts).toBe(0);
    });
  });

  describe('createLoginAbuseGuard helper', () => {
    it('should create guard with correct config', () => {
      const helperGuard = createLoginAbuseGuard(10, 900, {
        enableLogging: false,
      });

      expect(helperGuard).toBeInstanceOf(LoginAbuseGuard);
    });
  });
});

