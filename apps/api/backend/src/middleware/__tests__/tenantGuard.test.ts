import type { Request, Response } from 'express';
import {
  requireTenantContextOrReadAccess,
  shouldSkipTenantContext,
} from '../tenantGuard';

function createRequest(path: string, headers: Record<string, string> = {}): Request {
  return {
    path,
    get(name: string) {
      return headers[name.toLowerCase()] ?? headers[name] ?? undefined;
    },
    query: {},
  } as unknown as Request;
}

function createResponse(): Response & {
  status: jest.Mock;
  json: jest.Mock;
} {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);
  return response as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
}

describe('tenantGuard', () => {
  it('skips tenant context for health and readiness probes', () => {
    expect(shouldSkipTenantContext('/health')).toBe(true);
    expect(shouldSkipTenantContext('/health/')).toBe(true);
    expect(shouldSkipTenantContext('/readyz')).toBe(true);
  });

  it('keeps non-public write routes protected', () => {
    expect(shouldSkipTenantContext('/api/clinician/activate')).toBe(false);
  });

  it('allows health probes through without organization context', () => {
    const req = createRequest('/health');
    const res = createResponse();
    const next = jest.fn();

    requireTenantContextOrReadAccess(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects protected routes without organization context', () => {
    const req = createRequest('/api/clinician/activate');
    const res = createResponse();
    const next = jest.fn();

    requireTenantContextOrReadAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'organization_context_required',
      error_description: 'Organization context is required.',
    });
  });
});
