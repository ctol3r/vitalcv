/**
 * platformAdminBinding.test.ts — S1 closure for the super-admin role header.
 *
 * The defect these pin: `isSuperAdminRequest` answered from `x-user-role` /
 * `x-verifier-role` / `x-role`, so "is this caller a platform operator?" was
 * decided by the caller. `verifiedIdentity` strips those headers only on the
 * ANONYMOUS branch of enforce, which left an authenticated residual: any signed-
 * in account — a free clinician signup — kept the cross-org bypass by sending
 * one header.
 *
 * Every case asserts an OUTCOME (did the caller get through
 * `enforceOrganizationMatch` / `requireOrgRole` for an org they do not belong
 * to), never a mechanism. The bypass-injection cases at the bottom reconstruct
 * the old header-trusting shapes and assert each is refused.
 */
jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: { user: { findUnique: jest.fn() } },
}));
jest.mock('../../obs/logger', () => ({ log: jest.fn() }));
jest.mock('../../config/env', () => ({
  __esModule: true,
  env: () => ({
    TENANT_ORG_BINDING: 'off',
    VERIFIER_RBAC_MODE: process.env.VERIFIER_RBAC_MODE ?? 'off',
  }),
}));

import type { NextFunction, Request, Response } from 'express';
import {
  bindPlatformAdmin,
  clearPlatformAdminCache,
  isVerifiedPlatformAdmin,
} from '../platformAdminContext';
import { enforceOrganizationMatch, isSuperAdminRequest } from '../tenantGuard';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const prisma = require('../../graphql/prisma_client').default as {
  user: { findUnique: jest.Mock };
};

const CALLER_ORG = '11111111-1111-4111-8111-111111111111';
const VICTIM_ORG = '22222222-2222-4222-8222-222222222222';

interface Ctx {
  req: Request;
  res: Response & { status: jest.Mock; json: jest.Mock };
}

function makeCtx(
  opts: { roleHeader?: string; headerName?: string; verifiedUserId?: string; assertedOrg?: string } = {},
): Ctx {
  const headers: Record<string, string> = {};
  if (opts.roleHeader) headers[opts.headerName ?? 'x-user-role'] = opts.roleHeader;
  if (opts.assertedOrg) headers['x-org-id'] = opts.assertedOrg;

  const req = {
    path: '/api/internal/expiration-forecast/' + VICTIM_ORG,
    method: 'GET',
    query: {},
    headers,
    get(name: string) {
      return headers[name.toLowerCase()];
    },
    ...(opts.verifiedUserId
      ? { verifiedAuth: { outcome: 'token_only', verifiedUserId: opts.verifiedUserId } }
      : {}),
  } as unknown as Request;

  const res = { status: jest.fn(), json: jest.fn() } as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
  (res.status as jest.Mock).mockReturnValue(res);

  return { req, res };
}

async function bind(ctx: Ctx): Promise<void> {
  await bindPlatformAdmin(ctx.req, ctx.res, (() => undefined) as unknown as NextFunction);
}

beforeEach(() => {
  jest.clearAllMocks();
  clearPlatformAdminCache();
  delete process.env.VERIFIER_RBAC_MODE;
});

describe('platform-admin binding — who is a platform operator', () => {
  it('grants a verified session whose User row is ADMIN/ACTIVE', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    const ctx = makeCtx({ roleHeader: 'super-admin', verifiedUserId: 'user_admin' });
    await bind(ctx);
    expect(isVerifiedPlatformAdmin(ctx.req)).toBe(true);
  });

  it('accepts the assertion on any of the three legacy role headers', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    for (const headerName of ['x-user-role', 'x-verifier-role', 'x-role']) {
      clearPlatformAdminCache();
      const ctx = makeCtx({ roleHeader: 'SUPER-ADMIN', headerName, verifiedUserId: 'user_admin' });
      await bind(ctx);
      expect(isVerifiedPlatformAdmin(ctx.req)).toBe(true);
    }
  });

  it('denies a verified session whose User row is a suspended admin', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', status: 'SUSPENDED' });
    const ctx = makeCtx({ roleHeader: 'super-admin', verifiedUserId: 'user_suspended' });
    await bind(ctx);
    expect(isVerifiedPlatformAdmin(ctx.req)).toBe(false);
  });

  it('denies a verified session with no User row at all', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const ctx = makeCtx({ roleHeader: 'super-admin', verifiedUserId: 'user_ghost' });
    await bind(ctx);
    expect(isVerifiedPlatformAdmin(ctx.req)).toBe(false);
  });

  it('denies when the membership lookup throws — fail closed, and does not cache the failure', async () => {
    prisma.user.findUnique.mockRejectedValueOnce(new Error('connection refused'));
    const down = makeCtx({ roleHeader: 'super-admin', verifiedUserId: 'user_admin' });
    await bind(down);
    expect(isVerifiedPlatformAdmin(down.req)).toBe(false);

    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    const recovered = makeCtx({ roleHeader: 'super-admin', verifiedUserId: 'user_admin' });
    await bind(recovered);
    expect(isVerifiedPlatformAdmin(recovered.req)).toBe(true);
  });

  it('never queries the store when no platform-operator context is claimed', async () => {
    const ctx = makeCtx({ verifiedUserId: 'user_admin' });
    await bind(ctx);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(isVerifiedPlatformAdmin(ctx.req)).toBe(false);
  });

  it('is false when the binding middleware never ran (a guard that must run to deny is not a guard)', () => {
    const ctx = makeCtx({ roleHeader: 'super-admin', verifiedUserId: 'user_admin' });
    expect(isVerifiedPlatformAdmin(ctx.req)).toBe(false);
    expect(isSuperAdminRequest(ctx.req)).toBe(false);
  });
});

describe('bypass injection — the exact shapes the old code allowed', () => {
  /**
   * THE FINDING. `verifiedIdentity` deletes the role headers only when the
   * request is anonymous, so post-flip this shape survives verbatim: a real
   * Clerk session (any free signup) plus one header.
   */
  it('an AUTHENTICATED non-admin sending x-user-role: super-admin does not pass enforceOrganizationMatch', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'CLINICIAN', status: 'ACTIVE' });
    const ctx = makeCtx({
      roleHeader: 'super-admin',
      verifiedUserId: 'user_free_signup',
      assertedOrg: CALLER_ORG,
    });
    await bind(ctx);

    const allowed = enforceOrganizationMatch(ctx.req, ctx.res, VICTIM_ORG);

    expect(allowed).toBe(false);
    expect(ctx.res.status).toHaveBeenCalledWith(403);
  });

  it('an ANONYMOUS caller sending x-user-role: super-admin does not pass enforceOrganizationMatch', async () => {
    const ctx = makeCtx({ roleHeader: 'super-admin', assertedOrg: CALLER_ORG });
    await bind(ctx);

    const allowed = enforceOrganizationMatch(ctx.req, ctx.res, VICTIM_ORG);

    expect(allowed).toBe(false);
    expect(ctx.res.status).toHaveBeenCalledWith(403);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('a verified platform admin still crosses org scope — the legitimate path is preserved', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    const ctx = makeCtx({
      roleHeader: 'super-admin',
      verifiedUserId: 'user_admin',
      assertedOrg: CALLER_ORG,
    });
    await bind(ctx);

    expect(enforceOrganizationMatch(ctx.req, ctx.res, VICTIM_ORG)).toBe(true);
    expect(ctx.res.status).not.toHaveBeenCalled();
  });

  it('org scope still matches normally for a non-admin acting inside their own org', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'CLINICIAN', status: 'ACTIVE' });
    const ctx = makeCtx({ verifiedUserId: 'user_free_signup', assertedOrg: CALLER_ORG });
    await bind(ctx);

    expect(enforceOrganizationMatch(ctx.req, ctx.res, CALLER_ORG)).toBe(true);
    expect(ctx.res.status).not.toHaveBeenCalled();
  });
});
