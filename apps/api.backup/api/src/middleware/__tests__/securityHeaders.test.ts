/**
 * Tests for Security Headers Middleware
 *
 * @module middleware/__tests__/securityHeaders
 */

import { Request, Response, NextFunction } from 'express';
import { securityHeaders, strictSecurityHeaders, relaxedSecurityHeaders } from '../securityHeaders';

describe('Security Headers Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: NextFunction;
  let setHeaderSpy: jest.Mock;

  beforeEach(() => {
    setHeaderSpy = jest.fn();

    mockReq = {
      secure: true,
      headers: {
        'x-forwarded-proto': 'https',
      },
    };

    mockRes = {
      setHeader: setHeaderSpy,
    };

    nextFunction = jest.fn();
  });

  describe('Default Security Headers', () => {
    it('should set HSTS header when request is secure', () => {
      const middleware = securityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should not set HSTS header when request is not secure', () => {
      mockReq.secure = false;
      mockReq.headers = {};

      const middleware = securityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).not.toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.any(String)
      );
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should set CSP header with default directives', () => {
      const middleware = securityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("default-src 'none'")
      );
      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("frame-ancestors 'none'")
      );
    });

    it('should set X-Frame-Options header', () => {
      const middleware = securityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    });

    it('should set X-Content-Type-Options header', () => {
      const middleware = securityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    });

    it('should set X-XSS-Protection header', () => {
      const middleware = securityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    });

    it('should set Referrer-Policy header', () => {
      const middleware = securityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
    });

    it('should set Permissions-Policy header', () => {
      const middleware = securityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Permissions-Policy',
        expect.stringContaining('geolocation=()')
      );
    });

    it('should set Cross-Origin headers', () => {
      const middleware = securityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith('Cross-Origin-Embedder-Policy', 'require-corp');
      expect(setHeaderSpy).toHaveBeenCalledWith('Cross-Origin-Opener-Policy', 'same-origin');
      expect(setHeaderSpy).toHaveBeenCalledWith('Cross-Origin-Resource-Policy', 'same-origin');
    });
  });

  describe('Custom Configuration', () => {
    it('should use custom HSTS max-age', () => {
      const middleware = securityHeaders({ hstsMaxAge: 63072000 });
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload'
      );
    });

    it('should respect hstsIncludeSubDomains=false', () => {
      const middleware = securityHeaders({ hstsIncludeSubDomains: false });
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; preload'
      );
    });

    it('should use custom CSP directives', () => {
      const middleware = securityHeaders({
        cspDirectives: {
          'default-src': ["'self'"],
          'connect-src': ["'self'", 'https://api.example.com'],
        },
      });
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("default-src 'self'")
      );
      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining('https://api.example.com')
      );
    });

    it('should respect frameOptions=false', () => {
      const middleware = securityHeaders({ frameOptions: false });
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).not.toHaveBeenCalledWith('X-Frame-Options', expect.any(String));
    });

    it('should use custom referrer policy', () => {
      const middleware = securityHeaders({ referrerPolicy: 'no-referrer' });
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    });
  });

  describe('Strict Security Headers Preset', () => {
    it('should set stricter HSTS with 2-year max-age', () => {
      const middleware = strictSecurityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload'
      );
    });

    it('should set strict CSP with no sources', () => {
      const middleware = strictSecurityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("default-src 'none'")
      );
      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("base-uri 'none'")
      );
    });

    it('should set no-referrer policy', () => {
      const middleware = strictSecurityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    });
  });

  describe('Relaxed Security Headers Preset', () => {
    it('should set relaxed CSP allowing self connections', () => {
      const middleware = relaxedSecurityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("connect-src 'self'")
      );
    });

    it('should use SAMEORIGIN for frame options', () => {
      const middleware = relaxedSecurityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith('X-Frame-Options', 'SAMEORIGIN');
    });
  });

  describe('Edge Cases', () => {
    it('should handle x-forwarded-proto header for HSTS', () => {
      mockReq.secure = false;
      mockReq.headers = { 'x-forwarded-proto': 'https' };

      const middleware = securityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.stringContaining('max-age=31536000')
      );
    });

    it('should not fail if headers object is missing', () => {
      mockReq.headers = undefined as any;

      const middleware = securityHeaders();

      expect(() => {
        middleware(mockReq as Request, mockRes as Response, nextFunction);
      }).not.toThrow();

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should call next() exactly once', () => {
      const middleware = securityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Header Validation', () => {
    it('should set all required security headers', () => {
      const middleware = securityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      const requiredHeaders = [
        'Content-Security-Policy',
        'X-Content-Type-Options',
        'X-XSS-Protection',
        'Referrer-Policy',
        'Permissions-Policy',
        'Cross-Origin-Embedder-Policy',
        'Cross-Origin-Opener-Policy',
        'Cross-Origin-Resource-Policy',
        'X-Permitted-Cross-Domain-Policies',
      ];

      requiredHeaders.forEach(header => {
        expect(setHeaderSpy).toHaveBeenCalledWith(header, expect.any(String));
      });
    });

    it('should not set duplicate headers', () => {
      const middleware = securityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      const headerCalls = setHeaderSpy.mock.calls;
      const headerNames = headerCalls.map(call => call[0]);
      const uniqueHeaders = new Set(headerNames);

      expect(headerNames.length).toBe(uniqueHeaders.size);
    });
  });

  describe('Integration with Express', () => {
    it('should work in Express middleware chain', () => {
      const middleware1 = jest.fn((req, res, next) => next());
      const middleware2 = securityHeaders();
      const middleware3 = jest.fn((req, res, next) => next());

      middleware1(mockReq, mockRes, () => {
        middleware2(mockReq as Request, mockRes as Response, () => {
          middleware3(mockReq, mockRes, nextFunction);
        });
      });

      expect(middleware1).toHaveBeenCalled();
      expect(setHeaderSpy).toHaveBeenCalled();
      expect(middleware3).toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('Compliance Validation', () => {
    it('should meet OWASP security header requirements', () => {
      const middleware = securityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      // OWASP recommended headers
      const owaspHeaders = [
        'Strict-Transport-Security',
        'Content-Security-Policy',
        'X-Content-Type-Options',
        'X-Frame-Options',
        'Referrer-Policy',
      ];

      owaspHeaders.forEach(header => {
        const wasSet = setHeaderSpy.mock.calls.some(call => call[0] === header);
        expect(wasSet).toBe(true);
      });
    });

    it('should set CSP without unsafe-inline or unsafe-eval', () => {
      const middleware = securityHeaders();
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      const cspCall = setHeaderSpy.mock.calls.find(
        call => call[0] === 'Content-Security-Policy'
      );
      const cspValue = cspCall?.[1] as string;

      expect(cspValue).not.toContain("'unsafe-inline'");
      expect(cspValue).not.toContain("'unsafe-eval'");
    });
  });
});

