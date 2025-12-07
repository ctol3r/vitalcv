import { Request, Response, NextFunction } from 'express';
import { httpsOnly } from '../httpsOnly';

describe('httpsOnly middleware', () => {
  const originalEnv = process.env;

  function createResponse(): Response {
    const res: Partial<Response> = {};
    res.json = jest.fn().mockReturnValue(res);
    res.status = jest.fn().mockReturnValue(res);
    return res as Response;
  }

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.DEMO;
    delete process.env.HTTPS_ONLY_DISABLE;
    delete process.env.APP_ENV;
    delete process.env.DEPLOY_ENV;
    delete process.env.RUNTIME_ENV;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects insecure HTTP requests in production', () => {
    process.env.NODE_ENV = 'production';

    const req = {
      secure: false,
      headers: {},
      path: '/api',
      originalUrl: '/api',
      method: 'GET',
      ip: '192.0.2.10',
    } as Partial<Request>;

    const res = createResponse();
    const next = jest.fn();
    const logger = { warn: jest.fn() };

    const middleware = httpsOnly({ logger });
    middleware(req as Request, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[HTTPS_ONLY] Blocked insecure request')
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows HTTPS-forwarded requests in staging', () => {
    process.env.APP_ENV = 'staging';

    const req = {
      secure: false,
      headers: { 'x-forwarded-proto': 'https' },
      path: '/api',
      originalUrl: '/api',
      method: 'POST',
    } as Partial<Request>;

    const res = createResponse();
    const next = jest.fn();

    const middleware = httpsOnly();
    middleware(req as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows HTTP requests when DEMO mode is enabled', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEMO = 'true';

    const req = {
      secure: false,
      headers: {},
      path: '/api/demo/reset',
      originalUrl: '/api/demo/reset',
      method: 'POST',
    } as Partial<Request>;

    const res = createResponse();
    const next = jest.fn();

    const middleware = httpsOnly();
    middleware(req as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows HTTP probes for health endpoints even in production', () => {
    process.env.NODE_ENV = 'production';

    const req = {
      secure: false,
      headers: {},
      path: '/healthz/readiness',
      originalUrl: '/healthz/readiness',
      method: 'GET',
    } as Partial<Request>;

    const res = createResponse();
    const next = jest.fn();

    const middleware = httpsOnly();
    middleware(req as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('does not enforce HTTPS outside staging/production environments', () => {
    process.env.NODE_ENV = 'development';

    const req = {
      secure: false,
      headers: {},
      path: '/api/feature',
      originalUrl: '/api/feature',
      method: 'GET',
    } as Partial<Request>;

    const res = createResponse();
    const next = jest.fn();

    const middleware = httpsOnly();
    middleware(req as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

