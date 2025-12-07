/**
 * Tests for Readonly Mode Configuration
 * B150B-DR-007
 */

import { Request, Response, NextFunction } from 'express';
import {
  isReadonlyModeEnabled,
  getReadonlyModeConfig,
  isEndpointAllowedInReadonlyMode,
  readonlyModeMiddleware,
  getReadonlyModeHealthStatus,
} from '../readonlyMode';

describe('Readonly Mode Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isReadonlyModeEnabled', () => {
    it('should return false when READONLY_MODE is not set', () => {
      delete process.env.READONLY_MODE;
      expect(isReadonlyModeEnabled()).toBe(false);
    });

    it('should return true when READONLY_MODE is "true"', () => {
      process.env.READONLY_MODE = 'true';
      expect(isReadonlyModeEnabled()).toBe(true);
    });

    it('should return true when READONLY_MODE is "1"', () => {
      process.env.READONLY_MODE = '1';
      expect(isReadonlyModeEnabled()).toBe(true);
    });

    it('should return false when READONLY_MODE is "false"', () => {
      process.env.READONLY_MODE = 'false';
      expect(isReadonlyModeEnabled()).toBe(false);
    });
  });

  describe('getReadonlyModeConfig', () => {
    it('should return default config when not enabled', () => {
      delete process.env.READONLY_MODE;
      const config = getReadonlyModeConfig();
      expect(config.enabled).toBe(false);
      expect(config.allowedEndpoints).toContain('/healthz');
    });

    it('should return enabled config with custom message', () => {
      process.env.READONLY_MODE = 'true';
      process.env.READONLY_MODE_MESSAGE = 'Custom message';
      const config = getReadonlyModeConfig();
      expect(config.enabled).toBe(true);
      expect(config.message).toBe('Custom message');
    });
  });

  describe('isEndpointAllowedInReadonlyMode', () => {
    beforeEach(() => {
      process.env.READONLY_MODE = 'true';
    });

    it('should allow health check endpoints', () => {
      expect(isEndpointAllowedInReadonlyMode('/healthz')).toBe(true);
      expect(isEndpointAllowedInReadonlyMode('/healthz/liveness')).toBe(true);
      expect(isEndpointAllowedInReadonlyMode('/healthz/readiness')).toBe(true);
    });

    it('should allow read-only API endpoints', () => {
      expect(isEndpointAllowedInReadonlyMode('/api/npi/lookup')).toBe(true);
      expect(isEndpointAllowedInReadonlyMode('/api/claim/status')).toBe(true);
      expect(isEndpointAllowedInReadonlyMode('/api/credential/verify')).toBe(true);
    });

    it('should allow parameterized read-only endpoints', () => {
      expect(isEndpointAllowedInReadonlyMode('/api/npi/lookup?npi=1234567890')).toBe(true);
      expect(isEndpointAllowedInReadonlyMode('/api/claim/status?npi=1234567890')).toBe(true);
    });

    it('should block write endpoints', () => {
      expect(isEndpointAllowedInReadonlyMode('/api/claim/submit')).toBe(false);
      expect(isEndpointAllowedInReadonlyMode('/api/credential/issue')).toBe(false);
    });

    it('should allow all endpoints when not in readonly mode', () => {
      delete process.env.READONLY_MODE;
      expect(isEndpointAllowedInReadonlyMode('/api/claim/submit')).toBe(true);
    });
  });

  describe('readonlyModeMiddleware', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
      req = {
        method: 'POST',
        path: '/api/claim/submit',
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      next = jest.fn();
    });

    it('should allow requests when readonly mode is disabled', () => {
      delete process.env.READONLY_MODE;
      readonlyModeMiddleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow GET requests in readonly mode', () => {
      process.env.READONLY_MODE = 'true';
      req.method = 'GET';
      readonlyModeMiddleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block POST requests in readonly mode', () => {
      process.env.READONLY_MODE = 'true';
      req.method = 'POST';
      req.path = '/api/claim/submit';
      readonlyModeMiddleware(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Service Unavailable',
          code: 'READONLY_MODE',
        })
      );
    });

    it('should allow POST to allowed endpoints in readonly mode', () => {
      process.env.READONLY_MODE = 'true';
      req.method = 'POST';
      req.path = '/healthz';
      readonlyModeMiddleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should block PUT requests in readonly mode', () => {
      process.env.READONLY_MODE = 'true';
      req.method = 'PUT';
      req.path = '/api/credential/update';
      readonlyModeMiddleware(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(503);
    });

    it('should block DELETE requests in readonly mode', () => {
      process.env.READONLY_MODE = 'true';
      req.method = 'DELETE';
      req.path = '/api/credential/revoke';
      readonlyModeMiddleware(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(503);
    });
  });

  describe('getReadonlyModeHealthStatus', () => {
    it('should return readonly mode status when enabled', () => {
      process.env.READONLY_MODE = 'true';
      const status = getReadonlyModeHealthStatus();
      expect(status.readonlyMode).toBe(true);
      expect(status.message).toBeDefined();
    });

    it('should return readonly mode status when disabled', () => {
      delete process.env.READONLY_MODE;
      const status = getReadonlyModeHealthStatus();
      expect(status.readonlyMode).toBe(false);
      expect(status.message).toBeUndefined();
    });
  });
});

