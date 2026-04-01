jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../errorHandler';

function buildResponse(): Response {
  const res = {
    locals: { request_id: 'req-1' },
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as Response;

  (res.status as unknown as jest.Mock).mockReturnValue(res);
  return res;
}

describe('errorHandler', () => {
  it('sanitizes employer-review schema compatibility failures', () => {
    const err = Object.assign(
      new Error('The table public.outbox_events does not exist in the current database.'),
      { code: 'P2021' },
    );
    const req = {
      method: 'POST',
      originalUrl: '/api/employer-review/entity-1/accept',
      url: '/api/employer-review/entity-1/accept',
    } as Request;
    const res = buildResponse();

    errorHandler(err, req, res, jest.fn() as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Employer review actions are temporarily unavailable. Please try again shortly.',
      },
    });
  });

  it('sanitizes non-employer schema compatibility failures with a generic dependency message', () => {
    const err = Object.assign(
      new Error('The table public.outbox_events does not exist in the current database.'),
      { code: 'P2021' },
    );
    const req = {
      method: 'POST',
      originalUrl: '/api/apply/bundle',
      url: '/api/apply/bundle',
    } as Request;
    const res = buildResponse();

    errorHandler(err, req, res, jest.fn() as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'A required service dependency is temporarily unavailable. Please try again shortly.',
      },
    });
  });
});
