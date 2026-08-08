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

  it('allows only the authorized packet read without tenant context', () => {
    expect(shouldSkipTenantContext(
      '/api/applications/a1111111-1111-4111-8111-111111111111/packet',
    )).toBe(true);
    expect(shouldSkipTenantContext(
      '/api/applications/a1111111-1111-4111-8111-111111111111/packet/extra',
    )).toBe(false);
    expect(shouldSkipTenantContext(
      '/api/applications/a1111111-1111-4111-8111-111111111111/withdraw',
    )).toBe(false);
  });

  it('never skips tenant context for the directory publish write', () => {
    // /api/directory/publish mints an integrity-hashed, federation-ready
    // snapshot and was reachable unauthenticated on the backend's public
    // domain. The reads beside it stay public; only the write is closed.
    expect(shouldSkipTenantContext('/api/directory/publish')).toBe(false);
    expect(shouldSkipTenantContext('/api/directory/publish/')).toBe(false);
    expect(shouldSkipTenantContext('/API/Directory/Publish')).toBe(false);

    expect(shouldSkipTenantContext('/api/directory')).toBe(true);
    expect(shouldSkipTenantContext('/api/directory/csv')).toBe(true);
    expect(shouldSkipTenantContext('/api/directory/fhir')).toBe(true);
    expect(shouldSkipTenantContext('/api/directory/signed')).toBe(true);
    expect(shouldSkipTenantContext('/api/directory/snapshots')).toBe(true);
  });

  it('rejects an unauthenticated directory publish through the middleware', async () => {
    const req = createRequest('/api/directory/publish');
    const res = createResponse();
    const next = jest.fn();

    await requireTenantContextOrReadAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'organization_context_required',
      error_description: 'Organization context is required.',
    });
  });

  it('skips tenant context for clerk-scoped workspace bootstrap routes', () => {
    expect(shouldSkipTenantContext('/api/me/workspaces')).toBe(true);
    expect(shouldSkipTenantContext('/api/workspaces/switch')).toBe(true);
  });

  it('keeps other workspace-prefixed routes protected', () => {
    expect(shouldSkipTenantContext('/api/workspaces/other')).toBe(false);
    expect(shouldSkipTenantContext('/api/me/workspaces/extra')).toBe(false);
  });

  it('skips tenant context for the clinician personal-profile intake family', () => {
    // Onboarding-time, Clerk-user-scoped routes: a brand-new clinician has no
    // org, so org context here dead-ends the signup golden path (blocker #4).
    expect(shouldSkipTenantContext('/api/profile/npi/bootstrap')).toBe(true);
    // No-NPI / student preview lane — same onboarding-time, org-less rationale.
    expect(shouldSkipTenantContext('/api/profile/student/bootstrap')).toBe(true);
    expect(shouldSkipTenantContext('/api/profile/links')).toBe(true);
    expect(shouldSkipTenantContext('/api/profile/work-auth')).toBe(true);
    expect(shouldSkipTenantContext('/api/profile/self-attested')).toBe(true);
    expect(shouldSkipTenantContext('/api/profile/completeness')).toBe(true);
    expect(shouldSkipTenantContext('/api/profile/identity/email-otp/issue')).toBe(true);
  });

  it('skips tenant context for public verifier reads (trust proof)', () => {
    expect(shouldSkipTenantContext('/api/trust-proof/1003000126')).toBe(true);
  });

  it('skips tenant context for the public verifier companion reads', () => {
    expect(shouldSkipTenantContext('/api/passport/npi/1003000126')).toBe(true);
    expect(shouldSkipTenantContext('/api/employer-review/1003000126/acceptance-history')).toBe(true);
  });

  it('skips tenant context for MATCHA demand-side routes but keeps marketplace guarded (Wave K)', () => {
    expect(shouldSkipTenantContext('/api/matcha/opportunities/1003000126')).toBe(true);
    expect(shouldSkipTenantContext('/api/matcha/explain')).toBe(true);
    expect(shouldSkipTenantContext('/api/matcha/simulate/1003000126')).toBe(true);
    expect(shouldSkipTenantContext('/api/marketplace/match')).toBe(false);
    expect(shouldSkipTenantContext('/api/marketplace/pool')).toBe(false);
  });

  it('skips tenant context for public readiness-snapshot reads (Wave M)', () => {
    expect(shouldSkipTenantContext('/api/snapshot/11111111-1111-4111-8111-111111111111')).toBe(true);
  });

  it('allows the trust-proof read through without organization context', async () => {
    const req = createRequest('/api/trust-proof/1003000126');
    const res = createResponse();
    const next = jest.fn();

    await requireTenantContextOrReadAccess(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows health probes through without organization context', async () => {
    const req = createRequest('/health');
    const res = createResponse();
    const next = jest.fn();

    await requireTenantContextOrReadAccess(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects protected routes without organization context', async () => {
    const req = createRequest('/api/clinician/activate');
    const res = createResponse();
    const next = jest.fn();

    await requireTenantContextOrReadAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'organization_context_required',
      error_description: 'Organization context is required.',
    });
  });
});

describe('E0 source-runtime transparency is reachable without an organization', () => {
  // The regression this locks: the route file called itself "public source-
  // runtime transparency endpoints" while the guard returned 401
  // `organization_context_required` to every anonymous caller. A comment is
  // not an authorization decision.
  it('skips the tenant guard for the source-runtime routes', () => {
    expect(shouldSkipTenantContext('/api/system/source-runtime')).toBe(true);
    expect(shouldSkipTenantContext('/api/system/source-runtime/NPPES_API')).toBe(true);
    expect(shouldSkipTenantContext('/api/system/source-runtime/OIG_LEIE')).toBe(true);
  });

  // The reason the fix is two exact matches and not
  // `startsWith('/api/system/')`. That prefix reads as the obvious one-liner
  // and would silently publish seven unrelated operational endpoints.
  it.each([
    '/api/system/telemetry',
    '/api/system/telemetry/pilot',
    '/api/system/trust-health',
    '/api/system/trust-health/graph',
    '/api/system/trust-health/orphans',
    '/api/system/pulse',
    '/api/system/status',
  ])('does NOT open the neighbouring operational route %s', (path) => {
    expect(shouldSkipTenantContext(path)).toBe(false);
  });

  it('does not open a lookalike prefix', () => {
    expect(shouldSkipTenantContext('/api/system/source-runtime-internal')).toBe(false);
    expect(shouldSkipTenantContext('/api/system/source-runtimes')).toBe(false);
  });
});
