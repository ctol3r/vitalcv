/**
 * The Clerk-subject ↔ internal User.id boundary.
 *
 * `npi_ownership.user_id` is a UUID column holding the INTERNAL `User.id` —
 * what routes/ownership.ts writes. Every caller of `requireNpiAuthorization`
 * passes the CLERK subject, so the query sent `user_2abc…` at a uuid column.
 * Postgres rejects that at the TYPE COMPARISON, before it can determine whether
 * any row exists. The consequences were:
 *
 *   - authenticated Apply-related routes returned 500 instead of 403;
 *   - a genuinely verified ownership binding could never have matched.
 *
 * The defect was active at the identity boundary, not dormant until the first
 * row appeared: an empty table does not prevent a type error.
 *
 * It survived because every existing test mocked `npiOwnership.findFirst`, and
 * a mock does not have a column type.
 */

import type { Request } from 'express';

import { HttpError } from '../../utils/httpError';
import { requireNpiAuthorization, resolveInternalUserId } from '../verifiedActor';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    npiOwnership: { findFirst: jest.fn() },
  },
}));
jest.mock('../../obs/logger', () => ({ log: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const prisma = require('../../graphql/prisma_client').default as {
  user: { findUnique: jest.Mock };
  npiOwnership: { findFirst: jest.Mock };
};

const CLERK_ID = 'user_2abcDEFghiJKLmnoPQR';
const INTERNAL_ID = '3f7c1e64-9b2a-4d51-8e33-0a1b2c3d4e5f';
const NPI = '1234567893';
const VERIFIED = {
  verifiedAt: new Date('2026-02-01T00:00:00Z'),
  verificationMethod: 'ADMIN_VERIFIED',
  revokedAt: null,
};

const req = (over: Record<string, unknown> = {}) =>
  ({ headers: {}, method: 'GET', route: { path: '/api/apply/shares/:npi' }, ...over }) as unknown as Request;

/** A Clerk subject is not a UUID. This is the shape Postgres rejected. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue({ id: INTERNAL_ID });
  prisma.npiOwnership.findFirst.mockResolvedValue(VERIFIED);
});

describe('1–2 · the ownership query never receives a Clerk subject', () => {
  it('1. sends no Clerk-shaped id to npiOwnership', async () => {
    await requireNpiAuthorization(CLERK_ID, NPI, req());
    const where = prisma.npiOwnership.findFirst.mock.calls[0][0].where;
    expect(where.userId).not.toBe(CLERK_ID);
    expect(String(where.userId).startsWith('user_')).toBe(false);
  });

  it('2. uses the internal UUID for the lookup', async () => {
    await requireNpiAuthorization(CLERK_ID, NPI, req());
    const where = prisma.npiOwnership.findFirst.mock.calls[0][0].where;
    expect(where.userId).toBe(INTERNAL_ID);
    expect(String(where.userId)).toMatch(UUID_RE);
  });

  it('resolves the Clerk subject through the User table, not by coercion', async () => {
    await requireNpiAuthorization(CLERK_ID, NPI, req());
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clerkUserId: CLERK_ID } }),
    );
  });

  it('resolveInternalUserId returns null rather than inventing an id', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    expect(await resolveInternalUserId(CLERK_ID)).toBeNull();
  });
});

describe('3–4 · a missing account or an unbound user is a refusal, never a 500', () => {
  it('3. a caller with no VitalCV user row gets 403', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(requireNpiAuthorization(CLERK_ID, NPI, req()))
      .rejects.toMatchObject({ status: 403 });
    // And the ownership table is never queried with an unresolved id.
    expect(prisma.npiOwnership.findFirst).not.toHaveBeenCalled();
  });

  it('4. an unbound user gets 403, not 500', async () => {
    prisma.npiOwnership.findFirst.mockResolvedValue(null);
    const err = await requireNpiAuthorization(CLERK_ID, NPI, req()).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(403);
    expect(err.status).not.toBe(500);
  });

  it('a malformed NPI is still rejected before any lookup', async () => {
    await expect(requireNpiAuthorization(CLERK_ID, '123', req()))
      .rejects.toMatchObject({ status: 400 });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.npiOwnership.findFirst).not.toHaveBeenCalled();
  });
});

describe('5–6 · binding states are unchanged by this fix', () => {
  it('5. a verified binding succeeds', async () => {
    await expect(requireNpiAuthorization(CLERK_ID, NPI, req())).resolves.toBeUndefined();
  });

  it('a DELEGATED binding also succeeds', async () => {
    prisma.npiOwnership.findFirst.mockResolvedValue({
      verifiedAt: VERIFIED.verifiedAt, verificationMethod: 'DELEGATED', revokedAt: null,
    });
    await expect(requireNpiAuthorization(CLERK_ID, NPI, req())).resolves.toBeUndefined();
  });

  it.each([
    ['pending CLAIMED', { verifiedAt: null, verificationMethod: 'CLAIMED', revokedAt: null }, 'OWNERSHIP_PENDING'],
    ['revoked', { verifiedAt: VERIFIED.verifiedAt, verificationMethod: 'ADMIN_VERIFIED', revokedAt: new Date() }, 'OWNERSHIP_REQUIRED'],
    ['unrecognised method', { verifiedAt: VERIFIED.verifiedAt, verificationMethod: 'SELF_ATTESTED', revokedAt: null }, 'OWNERSHIP_PENDING'],
    ['method without a timestamp', { verifiedAt: null, verificationMethod: 'ADMIN_VERIFIED', revokedAt: null }, 'OWNERSHIP_PENDING'],
  ])('6. %s is denied with 403', async (_label, binding, code) => {
    prisma.npiOwnership.findFirst.mockResolvedValue(binding);
    await expect(requireNpiAuthorization(CLERK_ID, NPI, req()))
      .rejects.toMatchObject({ status: 403, code });
  });
});

describe('7 · every affected path goes through the corrected boundary', () => {
  /*
   * The routes that call requireNpiAuthorization, and therefore the routes that
   * returned 500 instead of 403 for an authenticated caller:
   *
   *   POST   /api/apply/bundle
   *   POST   /api/apply/share
   *   GET    /api/apply/credentials/:npi
   *   GET    /api/apply/shares/:npi
   *   GET    /api/matcha/opportunities/:npi   (authenticated tier)
   *   GET    /api/matcha/simulate/:npi
   *   POST   /api/matcha/explain
   */
  const AFFECTED = [
    '/api/apply/bundle',
    '/api/apply/share',
    '/api/apply/credentials/:npi',
    '/api/apply/shares/:npi',
    '/api/matcha/opportunities/:npi',
    '/api/matcha/simulate/:npi',
    '/api/matcha/explain',
  ];

  it.each(AFFECTED)('%s resolves the internal id before querying ownership', async (route) => {
    prisma.user.findUnique.mockClear();
    prisma.npiOwnership.findFirst.mockClear();
    await requireNpiAuthorization(CLERK_ID, NPI, req({ route: { path: route } }));
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.npiOwnership.findFirst.mock.calls[0][0].where.userId).toBe(INTERNAL_ID);
  });

  it('the source files still route every check through this one function', () => {
    // A second, inline lookup would reintroduce the defect somewhere this
    // suite cannot see.
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    for (const file of ['../../routes/apply.ts', '../../routes/matcha.ts']) {
      const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
      expect(src).not.toMatch(/npiOwnership\.(findFirst|findUnique)/);
    }
  });
});
