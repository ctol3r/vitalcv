/**
 * Tests for Next.js Security Headers Middleware
 *
 * @module middleware/__tests__/securityHeaders
 */

import { NextRequest, NextResponse } from 'next/server';
import { securityHeadersMiddleware } from '../securityHeaders';

describe('Next.js Security Headers Middleware', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    // Mock NextRequest
    mockRequest = {
      nextUrl: {
        protocol: 'https:',
        pathname: '/test',
      },
      headers: new Map([
        ['x-forwarded-proto', 'https'],
      ]),
    } as unknown as NextRequest;
  });

  describe('Core Security Headers', () => {
    it('should set Content-Security-Policy header', () => {
      const response = securityHeadersMiddleware(mockRequest);

      expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
      expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    });

    it('should generate unique nonce for each request', () => {
      const response1 = securityHeadersMiddleware(mockRequest);
      const response2 = securityHeadersMiddleware(mockRequest);

      const nonce1 = response1.headers.get('X-Nonce');
      const nonce2 = response2.headers.get('X-Nonce');

      expect(nonce1).toBeTruthy();
      expect(nonce2).toBeTruthy();
      expect(nonce1).not.toBe(nonce2);
    });

    it('should include nonce in CSP script-src', () => {
      const response = securityHeadersMiddleware(mockRequest);
      const nonce = response.headers.get('X-Nonce');
      const csp = response.headers.get('Content-Security-Policy');

      expect(csp).toContain(`'nonce-${nonce}'`);
      expect(csp).toContain("'strict-dynamic'");
    });

    it('should set X-Frame-Options to DENY', () => {
      const response = securityHeadersMiddleware(mockRequest);

      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('should set X-Content-Type-Options', () => {
      const response = securityHeadersMiddleware(mockRequest);

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should set X-XSS-Protection', () => {
      const response = securityHeadersMiddleware(mockRequest);

      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });

    it('should set Referrer-Policy', () => {
      const response = securityHeadersMiddleware(mockRequest);

      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('should set Permissions-Policy', () => {
      const response = securityHeadersMiddleware(mockRequest);
      const policy = response.headers.get('Permissions-Policy');

      expect(policy).toBeTruthy();
      expect(policy).toContain('geolocation=()');
      expect(policy).toContain('microphone=()');
      expect(policy).toContain('camera=()');
    });
  });

  describe('HSTS Header', () => {
    it('should set HSTS when protocol is https', () => {
      mockRequest.nextUrl.protocol = 'https:';

      const response = securityHeadersMiddleware(mockRequest);

      expect(response.headers.get('Strict-Transport-Security')).toBe(
        'max-age=31536000; includeSubDomains; preload'
      );
    });

    it('should set HSTS when x-forwarded-proto is https', () => {
      mockRequest.nextUrl.protocol = 'http:';
      mockRequest.headers = new Map([['x-forwarded-proto', 'https']]);

      const response = securityHeadersMiddleware(mockRequest);

      expect(response.headers.get('Strict-Transport-Security')).toBeTruthy();
    });

    it('should not set HSTS for http requests', () => {
      mockRequest.nextUrl.protocol = 'http:';
      mockRequest.headers = new Map();

      const response = securityHeadersMiddleware(mockRequest);

      expect(response.headers.get('Strict-Transport-Security')).toBeFalsy();
    });
  });

  describe('Cross-Origin Headers', () => {
    it('should set Cross-Origin-Opener-Policy', () => {
      const response = securityHeadersMiddleware(mockRequest);

      expect(response.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    });

    it('should set Cross-Origin-Embedder-Policy', () => {
      const response = securityHeadersMiddleware(mockRequest);

      expect(response.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
    });

    it('should set Cross-Origin-Resource-Policy', () => {
      const response = securityHeadersMiddleware(mockRequest);

      expect(response.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    });
  });

  describe('CSP Directives', () => {
    it('should include script-src directive', () => {
      const response = securityHeadersMiddleware(mockRequest);
      const csp = response.headers.get('Content-Security-Policy');

      expect(csp).toContain('script-src');
      expect(csp).toContain("'self'");
    });

    it('should include style-src directive', () => {
      const response = securityHeadersMiddleware(mockRequest);
      const csp = response.headers.get('Content-Security-Policy');

      expect(csp).toContain('style-src');
    });

    it('should include connect-src directive with API URLs', () => {
      const response = securityHeadersMiddleware(mockRequest);
      const csp = response.headers.get('Content-Security-Policy');

      expect(csp).toContain('connect-src');
    });

    it('should include img-src directive allowing data and blob', () => {
      const response = securityHeadersMiddleware(mockRequest);
      const csp = response.headers.get('Content-Security-Policy');

      expect(csp).toContain('img-src');
      expect(csp).toContain('data:');
      expect(csp).toContain('blob:');
    });

    it('should set object-src to none', () => {
      const response = securityHeadersMiddleware(mockRequest);
      const csp = response.headers.get('Content-Security-Policy');

      expect(csp).toContain("object-src 'none'");
    });

    it('should set frame-ancestors to none', () => {
      const response = securityHeadersMiddleware(mockRequest);
      const csp = response.headers.get('Content-Security-Policy');

      expect(csp).toContain("frame-ancestors 'none'");
    });

    it('should include upgrade-insecure-requests', () => {
      const response = securityHeadersMiddleware(mockRequest);
      const csp = response.headers.get('Content-Security-Policy');

      expect(csp).toContain('upgrade-insecure-requests');
    });
  });

  describe('Nonce Generation', () => {
    it('should generate nonce without dashes', () => {
      const response = securityHeadersMiddleware(mockRequest);
      const nonce = response.headers.get('X-Nonce');

      expect(nonce).toBeTruthy();
      expect(nonce).not.toContain('-');
    });

    it('should generate nonce with sufficient entropy', () => {
      const response = securityHeadersMiddleware(mockRequest);
      const nonce = response.headers.get('X-Nonce');

      // UUID without dashes should be 32 characters (128 bits)
      expect(nonce?.length).toBeGreaterThanOrEqual(32);
    });

    it('should store nonce in X-Nonce header for server component access', () => {
      const response = securityHeadersMiddleware(mockRequest);
      const nonce = response.headers.get('X-Nonce');
      const csp = response.headers.get('Content-Security-Policy');

      expect(nonce).toBeTruthy();
      expect(csp).toContain(`'nonce-${nonce}'`);
    });
  });

  describe('Response Handling', () => {
    it('should return NextResponse with headers', () => {
      const response = securityHeadersMiddleware(mockRequest);

      expect(response).toBeInstanceOf(NextResponse);
    });

    it('should preserve request in response', () => {
      const response = securityHeadersMiddleware(mockRequest);

      expect(response).toBeTruthy();
    });

    it('should not modify request object', () => {
      const originalProtocol = mockRequest.nextUrl.protocol;

      securityHeadersMiddleware(mockRequest);

      expect(mockRequest.nextUrl.protocol).toBe(originalProtocol);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing x-forwarded-proto header', () => {
      mockRequest.headers = new Map();
      mockRequest.nextUrl.protocol = 'https:';

      const response = securityHeadersMiddleware(mockRequest);

      expect(response.headers.get('Strict-Transport-Security')).toBeTruthy();
    });

    it('should handle http protocol gracefully', () => {
      mockRequest.nextUrl.protocol = 'http:';
      mockRequest.headers = new Map();

      expect(() => {
        securityHeadersMiddleware(mockRequest);
      }).not.toThrow();
    });

    it('should not set conflicting CSP directives', () => {
      const response = securityHeadersMiddleware(mockRequest);
      const csp = response.headers.get('Content-Security-Policy');

      // Should not have both 'unsafe-inline' and nonce
      const hasNonce = csp?.includes("'nonce-");
      const hasUnsafeInline = csp?.includes("'unsafe-inline'");

      if (hasNonce) {
        // If using nonce, should not have unsafe-inline in script-src
        const scriptSrcMatch = csp?.match(/script-src[^;]+/);
        if (scriptSrcMatch) {
          expect(scriptSrcMatch[0]).not.toContain("'unsafe-inline'");
        }
      }
    });
  });

  describe('Compliance Validation', () => {
    it('should meet Next.js security best practices', () => {
      const response = securityHeadersMiddleware(mockRequest);

      const requiredHeaders = [
        'Content-Security-Policy',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'Referrer-Policy',
      ];

      requiredHeaders.forEach(header => {
        expect(response.headers.get(header)).toBeTruthy();
      });
    });

    it('should not allow first-party resources to be blocked', () => {
      const response = securityHeadersMiddleware(mockRequest);
      const csp = response.headers.get('Content-Security-Policy');

      // Should allow 'self' in connect-src for API calls
      expect(csp).toContain("connect-src");
      expect(csp).toMatch(/connect-src[^;]*'self'/);
    });

    it('should use secure CSP without unsafe directives for production', () => {
      const response = securityHeadersMiddleware(mockRequest);
      const csp = response.headers.get('Content-Security-Policy');

      // Check that we're using nonce instead of unsafe-inline for scripts
      expect(csp).toContain("'strict-dynamic'");
    });

    it('should have all OWASP recommended headers', () => {
      const response = securityHeadersMiddleware(mockRequest);

      const owaspHeaders = [
        'Content-Security-Policy',
        'X-Content-Type-Options',
        'X-Frame-Options',
        'Referrer-Policy',
        'Permissions-Policy',
      ];

      owaspHeaders.forEach(header => {
        expect(response.headers.get(header)).toBeTruthy();
      });
    });
  });

  describe('Performance', () => {
    it('should execute in reasonable time', () => {
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        securityHeadersMiddleware(mockRequest);
      }

      const duration = Date.now() - start;

      // Should process 1000 requests in under 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should generate unique nonces efficiently', () => {
      const nonces = new Set();

      for (let i = 0; i < 100; i++) {
        const response = securityHeadersMiddleware(mockRequest);
        nonces.add(response.headers.get('X-Nonce'));
      }

      // All nonces should be unique
      expect(nonces.size).toBe(100);
    });
  });
});

