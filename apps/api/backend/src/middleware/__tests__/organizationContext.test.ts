import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getRequestOrganizationId, requireOrganizationContext } from '../organizationContext';

// Pins the G6 remediation (ASVS 2.10.2, docs/security/ASVS-scorecard-2026-07.md):
// the legacy HS256 verifier that fell back to the hardcoded 'development-secret'
// is gone, so a bearer token — with ANY signature — must never inject
// organization context.

function createRequest(options: {
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  organizationId?: string;
} = {}): Request {
  const headers = options.headers ?? {};
  return {
    organizationId: options.organizationId,
    query: options.query ?? {},
    get(name: string) {
      return headers[name.toLowerCase()] ?? headers[name] ?? undefined;
    },
  } as unknown as Request;
}

function forgedBearer(payload: Record<string, unknown>, secret: string): Record<string, string> {
  return { authorization: `Bearer ${jwt.sign(payload, secret)}` };
}

describe('organizationContext', () => {
  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it('does not derive organization context from a token signed with the removed dev-secret default', () => {
    const req = createRequest({
      headers: forgedBearer({ organizationId: 'attacker-org' }, 'development-secret'),
    });

    expect(getRequestOrganizationId(req)).toBeUndefined();
  });

  it('ignores every legacy org/tenant claim shape in bearer tokens', () => {
    const payloads: Record<string, unknown>[] = [
      { organizationId: 'attacker-org' },
      { organization_id: 'attacker-org' },
      { orgId: 'attacker-org' },
      { org_id: 'attacker-org' },
      { tenantId: 'attacker-org' },
      { tenant_id: 'attacker-org' },
      { organization: { id: 'attacker-org' } },
      { tenant: { id: 'attacker-org' } },
    ];

    for (const payload of payloads) {
      const req = createRequest({ headers: forgedBearer(payload, 'development-secret') });
      expect(getRequestOrganizationId(req)).toBeUndefined();
    }
  });

  it('ignores bearer tokens even when they are signed with a configured JWT_SECRET', () => {
    process.env.JWT_SECRET = 'a-real-production-grade-secret';
    const req = createRequest({
      headers: forgedBearer({ organizationId: 'attacker-org' }, 'a-real-production-grade-secret'),
    });

    expect(getRequestOrganizationId(req)).toBeUndefined();
  });

  it('never lets a bearer token shadow the explicit x-org-id header', () => {
    const req = createRequest({
      headers: {
        ...forgedBearer({ organizationId: 'attacker-org' }, 'development-secret'),
        'x-org-id': 'header-org',
      },
    });

    expect(getRequestOrganizationId(req)).toBe('header-org');
  });

  it('prefers the organization id already attached to the request', () => {
    const req = createRequest({
      organizationId: 'attached-org',
      headers: { 'x-org-id': 'header-org' },
      query: { organizationId: 'query-org' },
    });

    expect(getRequestOrganizationId(req)).toBe('attached-org');
  });

  it('falls back to the organizationId query parameter, then the x-org-id header', () => {
    expect(
      getRequestOrganizationId(
        createRequest({ query: { organizationId: 'query-org' }, headers: { 'x-org-id': 'header-org' } }),
      ),
    ).toBe('query-org');

    expect(getRequestOrganizationId(createRequest({ headers: { 'x-org-id': 'header-org' } }))).toBe(
      'header-org',
    );
  });

  it('returns undefined when no organization source is present', () => {
    expect(getRequestOrganizationId(createRequest())).toBeUndefined();
  });

  it('requireOrganizationContext attaches the resolved organization id and always calls next', () => {
    const req = createRequest({ headers: { 'x-org-id': 'header-org' } });
    const next = jest.fn() as NextFunction;

    requireOrganizationContext(req, {} as Response, next);

    expect((req as Request & { organizationId?: string }).organizationId).toBe('header-org');
    expect(next).toHaveBeenCalledTimes(1);

    const bare = createRequest({
      headers: forgedBearer({ organizationId: 'attacker-org' }, 'development-secret'),
    });
    const bareNext = jest.fn() as NextFunction;

    requireOrganizationContext(bare, {} as Response, bareNext);

    expect((bare as Request & { organizationId?: string }).organizationId).toBeUndefined();
    expect(bareNext).toHaveBeenCalledTimes(1);
  });
});
