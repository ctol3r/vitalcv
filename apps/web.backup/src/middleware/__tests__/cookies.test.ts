/**
 * B146C-SEC-003: Unit tests for cookie security settings
 */

import { Response } from 'express';
import { setSecureCookie, setSessionCookie, setStrictSessionCookie, clearCookie } from '../cookies';

describe('Cookie Security Settings', () => {
  let mockRes: Partial<Response>;
  let cookieCalls: Array<{ name: string; value: string; options: any }>;

  beforeEach(() => {
    cookieCalls = [];
    mockRes = {
      cookie: jest.fn((name: string, value: string, options: any) => {
        cookieCalls.push({ name, value, options });
        return mockRes as Response;
      }),
    };
  });

  describe('setSecureCookie', () => {
    it('should set HttpOnly flag by default', () => {
      setSecureCookie(mockRes as Response, 'test-cookie', 'value');

      expect(cookieCalls).toHaveLength(1);
      expect(cookieCalls[0].options.httpOnly).toBe(true);
    });

    it('should set SameSite=Lax by default', () => {
      setSecureCookie(mockRes as Response, 'test-cookie', 'value');

      expect(cookieCalls[0].options.sameSite).toBe('lax');
    });

    it('should allow overriding SameSite', () => {
      setSecureCookie(mockRes as Response, 'test-cookie', 'value', {
        sameSite: 'strict',
      });

      expect(cookieCalls[0].options.sameSite).toBe('strict');
    });

    it('should set Secure flag in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      setSecureCookie(mockRes as Response, 'test-cookie', 'value');

      expect(cookieCalls[0].options.secure).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it('should allow overriding Secure flag', () => {
      setSecureCookie(mockRes as Response, 'test-cookie', 'value', {
        secure: false,
      });

      expect(cookieCalls[0].options.secure).toBe(false);
    });

    it('should set maxAge when provided', () => {
      setSecureCookie(mockRes as Response, 'test-cookie', 'value', {
        maxAge: 3600,
      });

      expect(cookieCalls[0].options.maxAge).toBe(3600);
    });
  });

  describe('setSessionCookie', () => {
    it('should set HttpOnly=true for session cookies', () => {
      setSessionCookie(mockRes as Response, 'session-token', 'token-value');

      expect(cookieCalls[0].options.httpOnly).toBe(true);
    });

    it('should set SameSite=Lax for session cookies', () => {
      setSessionCookie(mockRes as Response, 'session-token', 'token-value');

      expect(cookieCalls[0].options.sameSite).toBe('lax');
    });

    it('should set maxAge when provided', () => {
      setSessionCookie(mockRes as Response, 'session-token', 'token-value', 7200);

      expect(cookieCalls[0].options.maxAge).toBe(7200);
    });
  });

  describe('setStrictSessionCookie', () => {
    it('should set SameSite=Strict for strict session cookies', () => {
      setStrictSessionCookie(mockRes as Response, 'session-token', 'token-value');

      expect(cookieCalls[0].options.sameSite).toBe('strict');
    });

    it('should set HttpOnly=true for strict session cookies', () => {
      setStrictSessionCookie(mockRes as Response, 'session-token', 'token-value');

      expect(cookieCalls[0].options.httpOnly).toBe(true);
    });
  });

  describe('clearCookie', () => {
    it('should set cookie to expire immediately', () => {
      clearCookie(mockRes as Response, 'test-cookie');

      expect(cookieCalls).toHaveLength(1);
      expect(cookieCalls[0].value).toBe('');
      expect(cookieCalls[0].options.expires).toEqual(new Date(0));
    });

    it('should use secure defaults when clearing', () => {
      clearCookie(mockRes as Response, 'test-cookie');

      expect(cookieCalls[0].options.httpOnly).toBe(true);
      expect(cookieCalls[0].options.sameSite).toBe('lax');
    });
  });
});

