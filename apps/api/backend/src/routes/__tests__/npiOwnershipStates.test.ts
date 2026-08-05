/**
 * NPI ownership states — Wave 1075.
 *
 * PR #1074 made private clinician data require an `NpiOwnership` row, then
 * `POST /api/ownership/claim` handed those rows out for any ten-digit number
 * with no proof. The check was real; what it checked was a self-assertion.
 *
 * These assert the distinction that makes the binding mean something: a claim
 * is a REQUEST, and only verification is authority. They are written to fail
 * if anyone lets a pending row through again.
 */

import express from 'express';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    $use: jest.fn(),
    user: { findUnique: jest.fn() },
    npiOwnership: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    opportunity: { findUnique: jest.fn() },
  },
}));

jest.mock('../../modules/identity/nppes.service', () => ({
  fetchNpiFromCMS: jest.fn(),
}));

jest.mock('../../services/matcha/liveMatchaService', () => ({
  getLiveMatchesForNpi: jest.fn(),
  scoreOpportunityForNpi: jest.fn(),
  simulateForNpi: jest.fn(),
}));

jest.mock('../../services/distribution/applyBundle', () => ({
  generateApplyBundle: jest.fn(),
  getApplyBundle: jest.fn(),
  verifyBundle: jest.fn(),
}));

jest.mock('../../services/distribution/applyShareService', () => ({
  shareBundle: jest.fn(),
  listSharesForNpi: jest.fn(),
  revokeShare: jest.fn(),
  validateOrganizationContext: jest.fn(() => ({ valid: true })),
  ShareValidationError: class ShareValidationError extends Error {},
}));

jest.mock('../../services/feedback/prismaEventStore', () => ({
  emitLearningEvent: jest.fn(),
}));

import prismaClient from '../../graphql/prisma_client';
import { registerOwnershipRoutes } from '../ownership';
import { registerApplyRoutes } from '../apply';
import { registerMatchaRoutes } from '../matcha';
import { fetchNpiFromCMS } from '../../modules/identity/nppes.service';
import { generateApplyBundle } from '../../services/distribution/applyBundle';
import { listSharesForNpi } from '../../services/distribution/applyShareService';
import { getLiveMatchesForNpi } from '../../services/matcha/liveMatchaService';
import { log } from '../../obs/logger';

jest.mock('../../obs/logger', () => ({ log: jest.fn() }));

const prisma = prismaClient as unknown as {
  user: { findUnique: jest.Mock };
  npiOwnership: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    upsert: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
};

const CLINICIAN = 'user_clinician';
const OTHER = 'user_other';
const ADMIN = 'user_admin';
const NPI = '1003000126';
const ORG_NPI = '1003000134';

type Row = {
  npi: string;
  claimedAt: Date;
  verifiedAt: Date | null;
  verificationMethod: string | null;
  revokedAt: Date | null;
};

const CLAIMED_AT = new Date('2026-01-01T00:00:00Z');
const row = (over: Partial<Row> = {}): Row => ({
  npi: NPI,
  claimedAt: CLAIMED_AT,
  verifiedAt: null,
  verificationMethod: 'CLAIMED',
  revokedAt: null,
  ...over,
});

const PENDING = row();
const VERIFIED = row({ verifiedAt: new Date('2026-02-01T00:00:00Z'), verificationMethod: 'ADMIN_VERIFIED' });
const DELEGATED = row({ verifiedAt: new Date('2026-02-01T00:00:00Z'), verificationMethod: 'DELEGATED' });
const REVOKED = row({ revokedAt: new Date('2026-03-01T00:00:00Z') });

function invoke(
  app: express.Express,
  method: 'get' | 'post' | 'delete',
  routePath: string,
  opts: {
    params?: Record<string, string>;
    body?: unknown;
    headers?: Record<string, string>;
    verifiedUserId?: string;
    claims?: Record<string, unknown>;
  } = {},
): Promise<{ status: number; body: unknown }> {
  const layers = (app as unknown as {
    _router: {
      stack: Array<{
        route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: Function }> };
      }>;
    };
  })._router.stack;
  const layer = layers.find((l) => l.route?.path === routePath && l.route?.methods[method]);
  if (!layer?.route) throw new Error(`route not registered: ${method.toUpperCase()} ${routePath}`);

  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const req = {
      method: method.toUpperCase(),
      params: opts.params ?? {},
      query: {},
      body: opts.body ?? {},
      headers: opts.headers ?? {},
      route: { path: routePath },
      ...(opts.verifiedUserId
        ? { verifiedAuth: { verifiedUserId: opts.verifiedUserId, claims: opts.claims ?? {} } }
        : {}),
    } as unknown as express.Request;
    const res = {
      locals: {},
      status(code: number) { statusCode = code; return this; },
      json(payload: unknown) { resolve({ status: statusCode, body: payload }); return this; },
      setHeader() { return this; },
    } as unknown as express.Response;

    const stack = layer.route!.stack;
    const step = (i: number): void => {
      if (i >= stack.length) return;
      const next = (err?: unknown) => {
        if (err) {
          const e = err as { status?: number; statusCode?: number; message?: string; code?: string };
          resolve({ status: e.status ?? e.statusCode ?? 500, body: { error: e.message, code: e.code } });
          return;
        }
        step(i + 1);
      };
      try {
        Promise.resolve(stack[i].handle(req, res, next)).catch(next);
      } catch (error) { reject(error); }
    };
    step(0);
  });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  registerOwnershipRoutes(app);
  registerApplyRoutes(app);
  registerMatchaRoutes(app);
  return app;
}

/** Point the binding lookup at one state for the clinician, nothing for others. */
function bindingIs(state: Row | null, forUser = CLINICIAN) {
  prisma.npiOwnership.findFirst.mockImplementation(async ({ where }: { where: { userId: string } }) =>
    where.userId === forUser ? state : null,
  );
  prisma.npiOwnership.findUnique.mockImplementation(async ({ where }: { where: { userId_npi: { userId: string } } }) =>
    where.userId_npi.userId === forUser ? state : null,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue({ id: 'internal-user-1' });
  (fetchNpiFromCMS as jest.Mock).mockResolvedValue({
    rawPayload: { results: [{ enumeration_type: 'NPI-1' }] },
  });
  (generateApplyBundle as jest.Mock).mockResolvedValue({
    credentials: [{ type: 'LICENSE', issuer: 'CA Medical Board' }],
    trustState: {},
  });
  (listSharesForNpi as jest.Mock).mockResolvedValue([{ shareId: 's1' }]);
  (getLiveMatchesForNpi as jest.Mock).mockResolvedValue({
    npi: NPI,
    clinicianName: 'JEAN ABBOTT',
    matches: [{
      opportunityId: 'opp-1',
      opportunity: { id: 'opp-1', title: 'Staff Internist', organizationId: 'org-1', state: 'CA' },
      explanation: { matchBand: 'PARTIAL', matchScore: 40, fitReasons: [], blockers: [{ label: 'x' }] },
    }],
  });
  prisma.npiOwnership.upsert.mockResolvedValue(PENDING);
  bindingIs(null);
});

describe('1 — a signed-in user can submit a pending claim', () => {
  it('accepts the request as PENDING and says so', async () => {
    const r = await invoke(buildApp(), 'post', '/api/ownership/claim', {
      verifiedUserId: CLINICIAN, body: { npi: NPI },
    });
    expect(r.status).toBe(202);
    const o = (r.body as { ownership: { state: string; nextStep: string } }).ownership;
    expect(o.state).toBe('pending');
    expect(o.nextStep).toMatch(/verification required before private sharing/i);
    // A claim must never write a verification timestamp.
    expect(prisma.npiOwnership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ verificationMethod: 'CLAIMED' }),
        update: expect.objectContaining({ verifiedAt: null }),
      }),
    );
  });

  it('refuses anonymously', async () => {
    const r = await invoke(buildApp(), 'post', '/api/ownership/claim', { body: { npi: NPI } });
    expect(r.status).toBe(401);
    expect(prisma.npiOwnership.upsert).not.toHaveBeenCalled();
  });
});

describe('2–5 — a pending claim grants nothing', () => {
  beforeEach(() => bindingIs(PENDING));

  it('2. grants no private MATCHA', async () => {
    const r = await invoke(buildApp(), 'get', '/api/matcha/opportunities/:npi', {
      params: { npi: NPI }, verifiedUserId: CLINICIAN,
    });
    expect((r.body as { visibility: string }).visibility).toBe('public');
    expect(JSON.stringify(r.body)).not.toContain('matchBand');
  });

  it('2b. grants no simulate', async () => {
    const r = await invoke(buildApp(), 'get', '/api/matcha/simulate/:npi', {
      params: { npi: NPI }, verifiedUserId: CLINICIAN,
    });
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ code: 'OWNERSHIP_PENDING' });
  });

  it('3. grants no credential access', async () => {
    const r = await invoke(buildApp(), 'get', '/api/apply/credentials/:npi', {
      params: { npi: NPI }, verifiedUserId: CLINICIAN,
    });
    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).not.toContain('CA Medical Board');
    expect((r.body as { error: string }).error).toMatch(/verification required/i);
  });

  it('4. cannot create a share', async () => {
    const r = await invoke(buildApp(), 'post', '/api/apply/share', {
      verifiedUserId: CLINICIAN,
      body: { npi: NPI, organization_context: { organization_id: 'org-1', name: 'X', purpose_of_use: 'hiring' } },
    });
    expect(r.status).toBe(403);
  });

  it('4b. cannot list shares', async () => {
    const r = await invoke(buildApp(), 'get', '/api/apply/shares/:npi', {
      params: { npi: NPI }, verifiedUserId: CLINICIAN,
    });
    expect(r.status).toBe(403);
    expect(listSharesForNpi).not.toHaveBeenCalled();
  });

  it('5. cannot create an Apply bundle', async () => {
    const r = await invoke(buildApp(), 'post', '/api/apply/bundle', {
      verifiedUserId: CLINICIAN, body: { npi: NPI },
    });
    expect(r.status).toBe(403);
    expect(generateApplyBundle).not.toHaveBeenCalled();
  });
});

describe('6 — an organization NPI cannot be claimed as a clinician identity', () => {
  it('refuses a Type 2 NPI before writing anything', async () => {
    (fetchNpiFromCMS as jest.Mock).mockResolvedValue({
      rawPayload: { results: [{ enumeration_type: 'NPI-2' }] },
    });
    const r = await invoke(buildApp(), 'post', '/api/ownership/claim', {
      verifiedUserId: CLINICIAN, body: { npi: ORG_NPI },
    });
    expect(r.status).toBe(400);
    expect((r.body as { error: string }).error).toMatch(/organization/i);
    expect(prisma.npiOwnership.upsert).not.toHaveBeenCalled();
  });

  it('refuses rather than defaulting to individual when the registry is unreadable', async () => {
    (fetchNpiFromCMS as jest.Mock).mockRejectedValue(new Error('upstream down'));
    const r = await invoke(buildApp(), 'post', '/api/ownership/claim', {
      verifiedUserId: CLINICIAN, body: { npi: NPI },
    });
    expect(r.status).toBe(503);
    expect(prisma.npiOwnership.upsert).not.toHaveBeenCalled();
  });
});

describe('7–8 — a verified binding authorizes its own user only', () => {
  it('7. authorizes the correct user', async () => {
    bindingIs(VERIFIED);
    const r = await invoke(buildApp(), 'get', '/api/apply/credentials/:npi', {
      params: { npi: NPI }, verifiedUserId: CLINICIAN,
    });
    expect(r.status).toBe(200);
    expect((r.body as { credentials: unknown[] }).credentials).toHaveLength(1);
  });

  it('7b. a DELEGATED binding also authorizes', async () => {
    bindingIs(DELEGATED);
    const r = await invoke(buildApp(), 'get', '/api/apply/credentials/:npi', {
      params: { npi: NPI }, verifiedUserId: CLINICIAN,
    });
    expect(r.status).toBe(200);
  });

  it('8. does not authorize a different user', async () => {
    bindingIs(VERIFIED, CLINICIAN);
    const r = await invoke(buildApp(), 'get', '/api/apply/credentials/:npi', {
      params: { npi: NPI }, verifiedUserId: OTHER,
    });
    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).not.toContain('CA Medical Board');
  });

  it('8b. a verified row with an unrecognised method does NOT authorize', async () => {
    // Fail closed: a new method must be added to VERIFIED_METHODS on purpose.
    bindingIs(row({ verifiedAt: new Date(), verificationMethod: 'SELF_ATTESTED' }));
    const r = await invoke(buildApp(), 'get', '/api/apply/credentials/:npi', {
      params: { npi: NPI }, verifiedUserId: CLINICIAN,
    });
    expect(r.status).toBe(403);
  });
});

describe('9 — a revoked binding grants no access', () => {
  it('refuses and names the state', async () => {
    bindingIs(REVOKED);
    const r = await invoke(buildApp(), 'get', '/api/apply/credentials/:npi', {
      params: { npi: NPI }, verifiedUserId: CLINICIAN,
    });
    expect(r.status).toBe(403);
    expect((r.body as { error: string }).error).toMatch(/revoked/i);
  });

  it('a revoked-then-verified row is still revoked', async () => {
    bindingIs(row({ verifiedAt: new Date(), verificationMethod: 'ADMIN_VERIFIED', revokedAt: new Date() }));
    const r = await invoke(buildApp(), 'get', '/api/apply/credentials/:npi', {
      params: { npi: NPI }, verifiedUserId: CLINICIAN,
    });
    expect(r.status).toBe(403);
  });
});

describe('10 — a forged x-clerk-user-id grants no access', () => {
  it.each([
    ['claim', 'post' as const, '/api/ownership/claim'],
    ['verify', 'post' as const, '/api/ownership/verify'],
    ['my ownerships', 'get' as const, '/api/ownership/me'],
  ])('%s ignores the header', async (_label, method, path) => {
    bindingIs(VERIFIED);
    const r = await invoke(buildApp(), method, path, {
      headers: { 'x-clerk-user-id': CLINICIAN },
      body: { npi: NPI, userId: 'internal-user-1' },
    });
    expect(r.status).toBe(401);
  });

  it('cannot reach credentials with a forged header even when a verified row exists', async () => {
    bindingIs(VERIFIED);
    const r = await invoke(buildApp(), 'get', '/api/apply/credentials/:npi', {
      params: { npi: NPI }, headers: { 'x-clerk-user-id': CLINICIAN },
    });
    expect(r.status).toBe(401);
  });
});

describe('11 — an administrator cannot verify without the role', () => {
  beforeEach(() => {
    prisma.npiOwnership.findUnique.mockResolvedValue({ revokedAt: null });
    prisma.npiOwnership.update.mockResolvedValue(VERIFIED);
  });

  it.each([
    ['no role', {}],
    ['a clinician role', { role: 'clinician' }],
    ['an invented role', { role: 'superuser' }],
    ['an empty role', { role: '' }],
  ])('refuses %s', async (_label, claims) => {
    const r = await invoke(buildApp(), 'post', '/api/ownership/verify', {
      verifiedUserId: OTHER, claims, body: { npi: NPI, userId: 'internal-user-1' },
    });
    expect(r.status).toBe(403);
    expect(prisma.npiOwnership.update).not.toHaveBeenCalled();
  });

  it('allows an administrator', async () => {
    const r = await invoke(buildApp(), 'post', '/api/ownership/verify', {
      verifiedUserId: ADMIN, claims: { role: 'admin' }, body: { npi: NPI, userId: 'internal-user-1' },
    });
    expect(r.status).toBe(200);
    expect((r.body as { ownership: { state: string } }).ownership.state).toBe('verified');
  });

  it('refuses to verify a revoked association rather than silently reviving it', async () => {
    prisma.npiOwnership.findUnique.mockResolvedValue({ revokedAt: new Date() });
    const r = await invoke(buildApp(), 'post', '/api/ownership/verify', {
      verifiedUserId: ADMIN, claims: { role: 'admin' }, body: { npi: NPI, userId: 'internal-user-1' },
    });
    expect(r.status).toBe(409);
    expect(prisma.npiOwnership.update).not.toHaveBeenCalled();
  });
});

describe('12 — verification is auditable without private payload data', () => {
  it('records who, what and which method — and no NPI or clinician detail', async () => {
    prisma.npiOwnership.findUnique.mockResolvedValue({ revokedAt: null });
    prisma.npiOwnership.update.mockResolvedValue(VERIFIED);

    await invoke(buildApp(), 'post', '/api/ownership/verify', {
      verifiedUserId: ADMIN, claims: { role: 'admin' }, body: { npi: NPI, userId: 'internal-user-1' },
    });

    const entry = (log as jest.Mock).mock.calls.find((c) => c[1] === 'ownership_verified');
    expect(entry).toBeDefined();
    const payload = JSON.stringify(entry![2]);
    expect(entry![2]).toMatchObject({
      actorId: ADMIN,
      method: 'ADMIN_VERIFIED',
      newState: 'verified',
    });
    // The NPI itself is a disclosure when paired with an actor, so it stays out.
    expect(payload).not.toContain(NPI);
    expect(payload).not.toContain('CA Medical Board');
    expect(payload).not.toContain('JEAN ABBOTT');
  });

  it('records a denied verification attempt', async () => {
    await invoke(buildApp(), 'post', '/api/ownership/verify', {
      verifiedUserId: OTHER, claims: { role: 'clinician' }, body: { npi: NPI, userId: 'u' },
    });
    const denial = (log as jest.Mock).mock.calls.find((c) => c[1] === 'ownership_verify_denied');
    expect(denial).toBeDefined();
    expect(JSON.stringify(denial![2])).not.toContain(NPI);
  });
});
