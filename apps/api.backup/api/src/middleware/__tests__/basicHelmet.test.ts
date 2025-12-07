/**
 * B146C-SEC-006: Unit tests for basic helmet middleware
 */

import { Request, Response, NextFunction } from 'express';
import { basicHelmet } from '../basicHelmet';

describe('basicHelmet Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let headers: Record<string, string>;

  beforeEach(() => {
    headers = {};
    mockReq = {};
    mockRes = {
      setHeader: jest.fn((name: string, value: string) => {
        headers[name] = value;
        return mockRes as Response;
      }),
    };
    mockNext = jest.fn();
  });

  describe('default configuration', () => {
    it('should set X-Frame-Options header', () => {
      const middleware = basicHelmet();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(headers['X-Frame-Options']).toBe('DENY');
    });

    it('should set X-Content-Type-Options header', () => {
      const middleware = basicHelmet();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('should set X-XSS-Protection header', () => {
      const middleware = basicHelmet();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    });

    it('should call next()', () => {
      const middleware = basicHelmet();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('custom configuration', () => {
    it('should allow custom X-Frame-Options value', () => {
      const middleware = basicHelmet({ frameOptions: 'SAMEORIGIN' });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    });

    it('should allow disabling X-Content-Type-Options', () => {
      const middleware = basicHelmet({ noSniff: false });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(headers['X-Content-Type-Options']).toBeUndefined();
    });

    it('should allow disabling X-XSS-Protection', () => {
      const middleware = basicHelmet({ xssProtection: false });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(headers['X-XSS-Protection']).toBeUndefined();
    });
  });

  describe('header presence verification', () => {
    it('should set all three headers by default', () => {
      const middleware = basicHelmet();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(headers).toHaveProperty('X-Frame-Options');
      expect(headers).toHaveProperty('X-Content-Type-Options');
      expect(headers).toHaveProperty('X-XSS-Protection');
    });

    it('should not affect functionality', () => {
      const middleware = basicHelmet();

      // Should not throw
      expect(() => {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();

      expect(mockNext).toHaveBeenCalled();
    });
  });
});

