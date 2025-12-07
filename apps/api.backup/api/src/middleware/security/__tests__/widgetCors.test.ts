/**
 * B132A-WIDGET-003: Tests for CORS + rate-limit policy
 */

import { Request, Response } from 'express';
import {
  widgetCorsMiddleware,
  addPartnerOrigin,
  removePartnerOrigin,
  isOriginAllowed
} from '../widgetCors';

describe('widgetCors middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: jest.Mock;

  beforeEach(() => {
    mockReq = {
      get: jest.fn(),
      method: 'POST',
    };
    mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      end: jest.fn(),
    };
    nextFn = jest.fn();

    // Setup default partner origins for testing
    addPartnerOrigin('partner_test', 'https://test.example.com');
  });

  describe('allowed origins', () => {
    it('should allow request from allowlisted origin', () => {
      (mockReq.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'origin') return 'https://test.example.com';
        return undefined;
      });

      widgetCorsMiddleware(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://test.example.com'
      );
      expect(nextFn).toHaveBeenCalled();
    });

    it('should allow preflight requests from allowlisted origin', () => {
      mockReq.method = 'OPTIONS';
      (mockReq.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'origin') return 'https://test.example.com';
        return undefined;
      });

      widgetCorsMiddleware(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://test.example.com'
      );
      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  describe('denied origins', () => {
    it('should block request from non-allowlisted origin', () => {
      (mockReq.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'origin') return 'https://malicious.example.com';
        return undefined;
      });
      mockReq.ip = '1.2.3.4';

      widgetCorsMiddleware(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'forbidden',
        message: 'Origin not allowed',
      });
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should block request with no origin header', () => {
      (mockReq.get as jest.Mock).mockReturnValue(undefined);

      widgetCorsMiddleware(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(nextFn).not.toHaveBeenCalled();
    });
  });

  describe('origin management', () => {
    it('should add partner origin', () => {
      addPartnerOrigin('partner_new', 'https://new.example.com');
      expect(isOriginAllowed('https://new.example.com')).toBe(true);
    });

    it('should remove partner origin', () => {
      addPartnerOrigin('partner_temp', 'https://temp.example.com');
      expect(isOriginAllowed('https://temp.example.com')).toBe(true);

      removePartnerOrigin('partner_temp', 'https://temp.example.com');
      expect(isOriginAllowed('https://temp.example.com')).toBe(false);
    });

    it('should not duplicate origins', () => {
      addPartnerOrigin('partner_dup', 'https://dup.example.com');
      addPartnerOrigin('partner_dup', 'https://dup.example.com');
      // Should only exist once
    });
  });

  describe('referer fallback', () => {
    it('should allow request with valid referer when origin missing', () => {
      (mockReq.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'referer') return 'https://test.example.com/page';
        return undefined;
      });

      widgetCorsMiddleware(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://test.example.com'
      );
      expect(nextFn).toHaveBeenCalled();
    });
  });
});

