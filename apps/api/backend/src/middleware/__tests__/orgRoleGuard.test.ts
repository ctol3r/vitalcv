import type { Request, Response } from 'express';
import {
  getRbacMode,
  parseRequestOrgRole,
  requireOrgRole,
  VERIFIER_MUTATION_ROLES,
} from '../orgRoleGuard';

function createRequest(headers: Record<string, string> = {}): Request {
  return {
    method: 'POST',
    path: '/api/applications/app_1/review',
    get(name: string) {
      return headers[name.toLowerCase()] ?? headers[name] ?? undefined;
    },
  } as unknown as Request;
}

function createResponse(): Response & { status: jest.Mock; json: jest.Mock } {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);
  return response as unknown as Response & { status: jest.Mock; json: jest.Mock };
}

const ORIGINAL_MODE = process.env.VERIFIER_RBAC_MODE;

afterEach(() => {
  if (ORIGINAL_MODE === undefined) {
    delete process.env.VERIFIER_RBAC_MODE;
  } else {
    process.env.VERIFIER_RBAC_MODE = ORIGINAL_MODE;
  }
});

describe('orgRoleGuard — getRbacMode', () => {
  it('defaults to off when unset or unrecognized', () => {
    delete process.env.VERIFIER_RBAC_MODE;
    expect(getRbacMode()).toBe('off');
    process.env.VERIFIER_RBAC_MODE = 'nonsense';
    expect(getRbacMode()).toBe('off');
  });

  it('reads shadow and enforce case-insensitively', () => {
    process.env.VERIFIER_RBAC_MODE = 'SHADOW';
    expect(getRbacMode()).toBe('shadow');
    process.env.VERIFIER_RBAC_MODE = ' Enforce ';
    expect(getRbacMode()).toBe('enforce');
  });
});

describe('orgRoleGuard — parseRequestOrgRole', () => {
  it('maps canonical roles and common synonyms', () => {
    expect(parseRequestOrgRole(createRequest({ 'x-org-role': 'admin' }))).toBe('admin');
    expect(parseRequestOrgRole(createRequest({ 'x-org-role': 'OWNER' }))).toBe('admin');
    expect(parseRequestOrgRole(createRequest({ 'x-org-role': 'reviewer' }))).toBe('reviewer');
    expect(parseRequestOrgRole(createRequest({ 'x-org-role': 'read-only' }))).toBe('read_only');
    expect(parseRequestOrgRole(createRequest({ 'x-org-role': 'readonly' }))).toBe('read_only');
    expect(parseRequestOrgRole(createRequest({ 'x-organization-role': 'viewer' }))).toBe('read_only');
  });

  it('returns null for missing or unknown roles', () => {
    expect(parseRequestOrgRole(createRequest())).toBeNull();
    expect(parseRequestOrgRole(createRequest({ 'x-org-role': 'wizard' }))).toBeNull();
  });
});

describe('orgRoleGuard — requireOrgRole', () => {
  it('is a no-op in off mode (default): read_only passes an admin/reviewer route', () => {
    delete process.env.VERIFIER_RBAC_MODE;
    const req = createRequest({ 'x-org-role': 'read_only' });
    const res = createResponse();
    const next = jest.fn();

    requireOrgRole(VERIFIER_MUTATION_ROLES)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('enforce: allows admin', () => {
    process.env.VERIFIER_RBAC_MODE = 'enforce';
    const req = createRequest({ 'x-org-role': 'admin' });
    const res = createResponse();
    const next = jest.fn();

    requireOrgRole(VERIFIER_MUTATION_ROLES)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('enforce: allows reviewer', () => {
    process.env.VERIFIER_RBAC_MODE = 'enforce';
    const req = createRequest({ 'x-org-role': 'reviewer' });
    const res = createResponse();
    const next = jest.fn();

    requireOrgRole(VERIFIER_MUTATION_ROLES)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('enforce: blocks read_only with a 403', () => {
    process.env.VERIFIER_RBAC_MODE = 'enforce';
    const req = createRequest({ 'x-org-role': 'read_only' });
    const res = createResponse();
    const next = jest.fn();

    requireOrgRole(VERIFIER_MUTATION_ROLES)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'insufficient_org_role' }),
    );
  });

  it('enforce: blocks a request with no org-role at all', () => {
    process.env.VERIFIER_RBAC_MODE = 'enforce';
    const req = createRequest();
    const res = createResponse();
    const next = jest.fn();

    requireOrgRole(VERIFIER_MUTATION_ROLES)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  /*
   * S1 — this pair replaces a single case that asserted
   * "super-admin bypasses the org-role check" from the HEADER alone. That
   * assertion encoded the defect: the header is caller-supplied, so the bypass
   * was available to anyone. The doctrine (a platform operator bypasses the
   * org-role requirement) is unchanged; what changed is where the answer comes
   * from — `bindPlatformAdmin` resolves a verified Clerk session to a
   * `User.role = ADMIN` row. The assertion is STRENGTHENED, not relaxed: the
   * legitimate bypass is still asserted below, and the forged one is now
   * refused.
   */
  it('enforce: a super-admin ROLE HEADER alone does not bypass the org-role check', () => {
    process.env.VERIFIER_RBAC_MODE = 'enforce';
    const req = createRequest({ 'x-user-role': 'super-admin' });
    const res = createResponse();
    const next = jest.fn();

    requireOrgRole(VERIFIER_MUTATION_ROLES)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('enforce: a VERIFIED platform admin bypasses the org-role check even with no org-role', () => {
    process.env.VERIFIER_RBAC_MODE = 'enforce';
    const req = createRequest({ 'x-user-role': 'super-admin' });
    // What bindPlatformAdmin writes after resolving the verified subject to an
    // ADMIN/ACTIVE User row. Set directly so this case stays a unit test of the
    // guard; platformAdminBinding.test.ts covers the resolution itself.
    (req as Request & { platformAdmin?: unknown }).platformAdmin = {
      asserted: true,
      verified: true,
    };
    const res = createResponse();
    const next = jest.fn();

    requireOrgRole(VERIFIER_MUTATION_ROLES)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('shadow: allows a would-be-denied read_only through (observe-only)', () => {
    process.env.VERIFIER_RBAC_MODE = 'shadow';
    const req = createRequest({ 'x-org-role': 'read_only' });
    const res = createResponse();
    const next = jest.fn();

    requireOrgRole(VERIFIER_MUTATION_ROLES)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
