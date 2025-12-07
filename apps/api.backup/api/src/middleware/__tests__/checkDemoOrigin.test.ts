/**
 * B146C-SEC-004: Unit tests for demo widget origin checking
 */

import { Request, Response, NextFunction } from 'express';
import { checkDemoOrigin } from '../checkDemoOrigin';

describe('checkDemoOrigin Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let statusCode: number;
  let responseBody: any;

  beforeEach(() => {
    statusCode = 0;
    responseBody = null;

    mockReq = {
      headers: {},
      path: '/demo/widget/apply',
      ip: '127.0.0.1',
    };

    mockRes = {
      status: jest.fn((code: number) => {
        statusCode = code;
        return mockRes as Response;
      }),
      json: jest.fn((body: any) => {
        responseBody = body;
        return mockRes as Response;
      }),
    };

    mockNext = jest.fn();
  });

  describe('with allowed origins configured', () => {
    const middleware = checkDemoOrigin({
      allowedOrigins: ['https://demo.example.com', 'https://partner.com'],
    });

    it('should allow request from allowed origin (Origin header)', () => {
      mockReq.headers = {
        origin: 'https://demo.example.com',
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusCode).toBe(0);
    });

    it('should allow request from allowed origin (Referer header)', () => {
      mockReq.headers = {
        referer: 'https://partner.com/widget',
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusCode).toBe(0);
    });

    it('should block request from disallowed origin', () => {
      mockReq.headers = {
        origin: 'https://evil.com',
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusCode).toBe(403);
      expect(responseBody.error).toBe('origin_not_allowed');
    });

    it('should block request with no Origin or Referer', () => {
      mockReq.headers = {};

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusCode).toBe(403);
      expect(responseBody.error).toBe('origin_required');
    });

    it('should handle case-insensitive origin matching', () => {
      mockReq.headers = {
        origin: 'HTTPS://DEMO.EXAMPLE.COM',
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle origins with trailing slashes', () => {
      mockReq.headers = {
        origin: 'https://demo.example.com/',
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('with allowMissingOrigin enabled', () => {
    const middleware = checkDemoOrigin({
      allowedOrigins: ['https://demo.example.com'],
      allowMissingOrigin: true,
    });

    it('should allow request with no origin', () => {
      mockReq.headers = {};

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('with no origins configured', () => {
    const middleware = checkDemoOrigin({
      allowedOrigins: [],
    });

    it('should allow all requests when no origins configured', () => {
      mockReq.headers = {
        origin: 'https://any-origin.com',
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('environment variable configuration', () => {
    const originalEnv = process.env.DEMO_WIDGET_ORIGINS;

    afterEach(() => {
      process.env.DEMO_WIDGET_ORIGINS = originalEnv;
    });

    it('should read allowed origins from DEMO_WIDGET_ORIGINS env var', () => {
      process.env.DEMO_WIDGET_ORIGINS = 'https://env1.com,https://env2.com';

      const middleware = checkDemoOrigin();

      mockReq.headers = {
        origin: 'https://env1.com',
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});

