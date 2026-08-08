/**
 * orgBinding.test.ts — G1 org-context binding (tenantGuard#bindOrganizationContext).
 *
 * The defect these pin: `requireTenantContext` accepted the PRESENCE of a
 * caller-supplied `x-org-id` / `?organizationId=` as authorization, so every
 * route behind the guard answered an anonymous caller who set one header.
 *
 * Every case here asserts an OUTCOME (what the caller gets), not a mechanism —
 * a test that asserts "bindOrganizationContext was called" stays green when the
 * binding is wired up but ineffective. The bypass-injection cases at the bottom
 * are the ones that actually prove the guard: they reconstruct the old
 * behaviour and assert it is refused.
 */
jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: { user: { findUnique: jest.fn() } },
}));
jest.mock('../../obs/logger', () => ({ log: jest.fn() }));
jest.mock('../../config/env', () => ({
  __esModule: true,
  env: () => ({ TENANT_ORG_BINDING: process.env.TENANT_ORG_BINDING ?? 'off' }),
}));

import type { Request, Response } from 'express';
import { requireTenantContextOrReadAccess } from '../tenantGuard';
import {
  clearOrganizationMembershipCache,
  getRequestOrganizationId,
} from '../organizationContext';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const prisma = require('../../graphql/prisma_client').default as {
  user: { findUnique: jest.Mock };
};

const VERIFIED_ORG = '11111111-1111-4111-8111-111111111111';
const VICTIM_ORG = '22222222-2222-4222-8222-222222222222';

/** An org-scoped route that is NOT in shouldSkipTenantContext. */
const GUARDED_PATH = '/api/status-list';
/** An allowlisted route that nonetheless scopes reads by the asserted org. */
const SKIPPED_BUT_ORG_SCOPED_PATH = '/api/pilot/report';

interface Ctx {
  req: Request;
  res: Response & { status: jest.Mock; json: jest.Mock };
  next: jest.Mock;
}

function makeCtx(
  path: string,
  opts: { assertedOrg?: string; verifiedUserId?: string } = {},
): Ctx {
  const headers: Record<string, string> = {};
  if (opts.assertedOrg) headers['x-org-id'] = opts.assertedOrg;

  const req = {
    path,
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

  return { req, res, next: jest.fn() };
}

function statusOf(ctx: Ctx): number | 'passed' {
  if (ctx.next.mock.calls.length > 0) return 'passed';
  const call = ctx.res.status.mock.calls[0];
  return call ? (call[0] as number) : 0;
}

beforeEach(() => {
  jest.clearAllMocks();
  clearOrganizationMembershipCache();
  delete process.env.TENANT_ORG_BINDING;
  prisma.user.findUnique.mockResolvedValue(null);
});

afterAll(() => {
  delete process.env.TENANT_ORG_BINDING;
});

describe('org binding — off (default)', () => {
  it('is a pure no-op: behaviour is byte-identical to before the change', async () => {
    const ctx = makeCtx(GUARDED_PATH, { assertedOrg: VICTIM_ORG });
    await requireTenantContextOrReadAccess(ctx.req, ctx.res, ctx.next);

    expect(statusOf(ctx)).toBe('passed');
    expect(getRequestOrganizationId(ctx.req)).toBe(VICTIM_ORG);
    // No membership lookup at all — `off` must cost nothing.
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe('org binding — shadow', () => {
  beforeEach(() => {
    process.env.TENANT_ORG_BINDING = 'shadow';
  });

  it('NEVER blocks, even when the asserted org is one the caller does not belong to', async () => {
    prisma.user.findUnique.mockResolvedValue({ organizationId: VERIFIED_ORG });
    const ctx = makeCtx(GUARDED_PATH, { assertedOrg: VICTIM_ORG, verifiedUserId: 'user_a' });

    await requireTenantContextOrReadAccess(ctx.req, ctx.res, ctx.next);

    expect(statusOf(ctx)).toBe('passed');
    // Shadow observes; it must not change the resolved scope either.
    expect(getRequestOrganizationId(ctx.req)).toBe(VICTIM_ORG);
  });

  it('does not block an unverified caller who asserts an org', async () => {
    const ctx = makeCtx(GUARDED_PATH, { assertedOrg: VICTIM_ORG });
    await requireTenantContextOrReadAccess(ctx.req, ctx.res, ctx.next);
    expect(statusOf(ctx)).toBe('passed');
  });
});

describe('org binding — enforce', () => {
  beforeEach(() => {
    process.env.TENANT_ORG_BINDING = 'enforce';
  });

  it('binds the VERIFIED org when the caller asserts nothing', async () => {
    prisma.user.findUnique.mockResolvedValue({ organizationId: VERIFIED_ORG });
    const ctx = makeCtx(GUARDED_PATH, { verifiedUserId: 'user_a' });

    await requireTenantContextOrReadAccess(ctx.req, ctx.res, ctx.next);

    expect(statusOf(ctx)).toBe('passed');
    expect(getRequestOrganizationId(ctx.req)).toBe(VERIFIED_ORG);
  });

  it('passes when the asserted org matches verified membership', async () => {
    prisma.user.findUnique.mockResolvedValue({ organizationId: VERIFIED_ORG });
    const ctx = makeCtx(GUARDED_PATH, { assertedOrg: VERIFIED_ORG, verifiedUserId: 'user_a' });

    await requireTenantContextOrReadAccess(ctx.req, ctx.res, ctx.next);

    expect(statusOf(ctx)).toBe('passed');
    expect(getRequestOrganizationId(ctx.req)).toBe(VERIFIED_ORG);
  });

  it('403s a caller who asserts an org they are not a member of', async () => {
    prisma.user.findUnique.mockResolvedValue({ organizationId: VERIFIED_ORG });
    const ctx = makeCtx(GUARDED_PATH, { assertedOrg: VICTIM_ORG, verifiedUserId: 'user_a' });

    await requireTenantContextOrReadAccess(ctx.req, ctx.res, ctx.next);

    expect(statusOf(ctx)).toBe(403);
    expect(ctx.next).not.toHaveBeenCalled();
  });

  it('a clinician with no org gets NO org context — not the org they asserted', async () => {
    prisma.user.findUnique.mockResolvedValue({ organizationId: null });
    const ctx = makeCtx(GUARDED_PATH, { assertedOrg: VICTIM_ORG, verifiedUserId: 'user_clinician' });

    await requireTenantContextOrReadAccess(ctx.req, ctx.res, ctx.next);

    expect(statusOf(ctx)).toBe(401);
    expect(getRequestOrganizationId(ctx.req)).toBeUndefined();
  });

  it('fails closed when the membership lookup throws', async () => {
    prisma.user.findUnique.mockRejectedValue(new Error('db down'));
    const ctx = makeCtx(GUARDED_PATH, { assertedOrg: VICTIM_ORG, verifiedUserId: 'user_a' });

    await requireTenantContextOrReadAccess(ctx.req, ctx.res, ctx.next);

    expect(statusOf(ctx)).toBe(401);
    expect(getRequestOrganizationId(ctx.req)).toBeUndefined();
  });
});

/**
 * THE ACTUAL BYPASS. These reconstruct the production request that worked on
 * 2026-08-08 — anonymous, one header — and assert it is refused. If
 * `bindOrganizationContext` is removed, neutered, or wired up but ineffective,
 * these go red; the mode cases above would not.
 */
describe('bypass injection — anonymous caller with one header', () => {
  beforeEach(() => {
    process.env.TENANT_ORG_BINDING = 'enforce';
  });

  it('is refused on a guarded route', async () => {
    const ctx = makeCtx(GUARDED_PATH, { assertedOrg: VICTIM_ORG });

    await requireTenantContextOrReadAccess(ctx.req, ctx.res, ctx.next);

    expect(statusOf(ctx)).toBe(401);
    expect(ctx.next).not.toHaveBeenCalled();
    expect(getRequestOrganizationId(ctx.req)).toBeUndefined();
  });

  it('is refused via ?organizationId= as well as the header', async () => {
    const ctx = makeCtx(GUARDED_PATH);
    (ctx.req as unknown as { query: Record<string, string> }).query = {
      organizationId: VICTIM_ORG,
    };

    await requireTenantContextOrReadAccess(ctx.req, ctx.res, ctx.next);

    expect(statusOf(ctx)).toBe(401);
    expect(getRequestOrganizationId(ctx.req)).toBeUndefined();
  });

  it('does not leak the asserted org into an ALLOWLISTED route either', async () => {
    // The allowlist waives the org REQUIREMENT, so this route still passes to
    // its handler — but it must not hand the handler an org the caller merely
    // claimed. This is the 7-route class the skip-list would otherwise leave open.
    const ctx = makeCtx(SKIPPED_BUT_ORG_SCOPED_PATH, { assertedOrg: VICTIM_ORG });

    await requireTenantContextOrReadAccess(ctx.req, ctx.res, ctx.next);

    expect(statusOf(ctx)).toBe('passed');
    expect(getRequestOrganizationId(ctx.req)).toBeUndefined();
  });
});
