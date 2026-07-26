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

  it('enforce: super-admin bypasses the org-role check even with no org-role', () => {
    process.env.VERIFIER_RBAC_MODE = 'enforce';
    const req = createRequest({ 'x-user-role': 'super-admin' });
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
