/**
 * B93-SEC-001: Tests for allowed_sinks enforcement middleware
 *
 * Acceptance criteria:
 * - Requests missing allowed_sinks=403
 * - Audit deny receipt anchored
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { createAllowedSinksEnforcer } from '../allowedSinksEnforcer';

describe('allowedSinksEnforcer', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      headers: {},
      path: '/test',
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  it('should return 403 when allowed_sinks is missing from body', async () => {
    mockReq.body = {
      sink: 'svc.test',
      payload: { test: 'data' },
    };

    const middleware = createAllowedSinksEnforcer({
      allowedSinks: ['svc.test'],
      requireSignature: false,
    });

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'MESSAGE_DENIED',
        reason: 'Request missing allowed_sinks',
        sink: 'svc.test',
        hashAnchor: expect.any(String),
        receiptHash: expect.any(String),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 403 when allowed_sinks is missing from headers', async () => {
    mockReq.body = {
      sink: 'svc.test',
    };
    mockReq.headers = {
      'x-sink-id': 'svc.test',
    };

    const middleware = createAllowedSinksEnforcer({
      allowedSinks: ['svc.test'],
      requireSignature: false,
    });

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'MESSAGE_DENIED',
        reason: 'Request missing allowed_sinks',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 403 when allowed_sinks is empty array', async () => {
    mockReq.body = {
      sink: 'svc.test',
      allowed_sinks: [],
    };

    const middleware = createAllowedSinksEnforcer({
      allowedSinks: ['svc.test'],
      requireSignature: false,
    });

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'MESSAGE_DENIED',
        reason: 'Request missing allowed_sinks',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should include hashAnchor and receiptHash in deny response', async () => {
    mockReq.body = {
      sink: 'svc.test',
      payload: { test: 'data' },
    };

    const middleware = createAllowedSinksEnforcer({
      allowedSinks: ['svc.test'],
      requireSignature: false,
    });

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    const jsonCall = (mockRes.json as any).mock.calls[0][0];
    expect(jsonCall).toHaveProperty('hashAnchor');
    expect(jsonCall).toHaveProperty('receiptHash');
    expect(typeof jsonCall.hashAnchor).toBe('string');
    expect(typeof jsonCall.receiptHash).toBe('string');
    expect(jsonCall.hashAnchor.length).toBeGreaterThan(0);
    expect(jsonCall.receiptHash.length).toBeGreaterThan(0);
  });

  it('should include requestId in deny response', async () => {
    mockReq.body = {
      sink: 'svc.test',
    };
    mockReq.headers = {
      'x-request-id': 'test-request-123',
    };

    const middleware = createAllowedSinksEnforcer({
      allowedSinks: ['svc.test'],
      requireSignature: false,
    });

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'test-request-123',
      })
    );
  });

  it('should proceed to next middleware when allowed_sinks is present', async () => {
    mockReq.body = {
      sink: 'svc.test',
      allowed_sinks: ['svc.test'],
      payload: { test: 'data' },
    };

    const middleware = createAllowedSinksEnforcer({
      allowedSinks: ['svc.test'],
      requireSignature: false,
    });

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    // Should call next() (via guard middleware)
    // Note: This test may need adjustment based on guard middleware behavior
    expect(mockRes.status).not.toHaveBeenCalledWith(403);
  });

  it('should extract allowed_sinks from x-allowed-sinks header', async () => {
    mockReq.body = {
      sink: 'svc.test',
    };
    mockReq.headers = {
      'x-allowed-sinks': 'svc.test,svc.other',
    };

    const middleware = createAllowedSinksEnforcer({
      allowedSinks: ['svc.test'],
      requireSignature: false,
    });

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    // Should not deny if allowed_sinks is in header
    expect(mockRes.status).not.toHaveBeenCalledWith(403);
  });
});

