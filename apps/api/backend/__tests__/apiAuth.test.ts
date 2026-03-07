/**
 * apiAuth.test.ts — Wave 125: Authentication Tests
 */

import { registerApiKey, createSession, apiAuthMiddleware, requireAuth } from '../src/middleware/apiAuth';
import type { Request, Response, NextFunction } from 'express';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    path: '/api/trust/substrate/1234567890',
    method: 'GET',
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis() as any,
    json: jest.fn().mockReturnThis() as any,
  };
  return res as Response;
}

describe('API Auth Middleware', () => {
  test('public routes pass without auth', () => {
    const req = mockReq({ path: '/api/public/profile/1234567890' });
    const res = mockRes();
    const next = jest.fn();

    apiAuthMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.auth?.authenticated).toBe(false);
    expect(req.auth?.method).toBe('none');
  });

  test('API key authentication works', () => {
    const { rawKey } = registerApiKey({ clinicianId: 'test-clinician', tier: 'GROWTH' });
    const req = mockReq({
      headers: { 'x-api-key': rawKey } as any,
    });
    const res = mockRes();
    const next = jest.fn();

    apiAuthMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.auth?.authenticated).toBe(true);
    expect(req.auth?.method).toBe('api-key');
    expect(req.auth?.tier).toBe('GROWTH');
  });

  test('invalid API key falls through', () => {
    const req = mockReq({
      headers: { 'x-api-key': 'invalid-key' } as any,
    });
    const res = mockRes();
    const next = jest.fn();

    apiAuthMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.auth?.authenticated).toBe(false);
  });

  test('bearer token authentication works', () => {
    const token = createSession({ clinicianId: 'holder-1', npi: '1234567890' });
    const req = mockReq({
      headers: { authorization: `Bearer ${token}` } as any,
    });
    const res = mockRes();
    const next = jest.fn();

    apiAuthMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.auth?.authenticated).toBe(true);
    expect(req.auth?.method).toBe('bearer');
    expect(req.auth?.npi).toBe('1234567890');
  });

  test('expired session is rejected', () => {
    const token = createSession({ clinicianId: 'expired', ttlSeconds: -1 });
    const req = mockReq({
      headers: { authorization: `Bearer ${token}` } as any,
    });
    const res = mockRes();
    const next = jest.fn();

    apiAuthMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.auth?.authenticated).toBe(false);
  });

  test('trust band endpoint is public', () => {
    const req = mockReq({ path: '/api/trust/substrate/1234567890/band' });
    const res = mockRes();
    const next = jest.fn();

    apiAuthMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.auth?.method).toBe('none');
  });
});

describe('requireAuth', () => {
  test('blocks unauthenticated requests', () => {
    const req = mockReq();
    req.auth = { authenticated: false, method: 'none' };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('passes authenticated requests', () => {
    const req = mockReq();
    req.auth = { authenticated: true, method: 'api-key', keyId: 'k1', tier: 'STARTER' };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
