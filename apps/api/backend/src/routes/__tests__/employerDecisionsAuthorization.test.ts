/**
 * `GET /api/employer/decisions` returns an employer's ACCEPTED-candidate list.
 *
 * WHAT WAS WRONG
 * Identity was `req.headers['x-clerk-user-id']`, checked for PRESENCE only —
 * the 401 read "Missing x-clerk-user-id header". Presence is not
 * authentication. The value was then used to select the caller's organization,
 * so whoever named a user id was served as that user: the accepted NPIs for
 * that employer, plus the decision capsules attached to them.
 *
 * WHY THE MIDDLEWARE DID NOT SAVE IT
 * `verifiedIdentityMiddleware` rewrites `x-clerk-user-id` to the verified `sub`
 * only in its `enforce` branch. Production runs `CLERK_JWT_VERIFICATION=shadow`
 * (read from the Railway API service 2026-08-11), and shadow verifies, logs and
 * calls `next()` — no rewrite. So this handler saw the raw caller value.
 *
 * The fix does not wait on that flip: `requireVerifiedClerkUserId` reads
 * `verifiedAuth.verifiedUserId`, which is populated only when a bearer token
 * actually verified, in every mode.
 *
 * These cases therefore send a **forged header** and assert it buys nothing,
 * and they assert on the response plus whether the database was queried at all
 * — not on which middleware is mounted.
 */

import express from 'express';
import request from 'supertest';

// The first setup() pays the module-init + ts-jest compile cost for the route
// chain; without this the first case times out at 5s and reads as a flake.
jest.setTimeout(180_000);

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    application: { findMany: jest.fn() },
    decisionCapsule: { findMany: jest.fn(), findUnique: jest.fn() },
  },
}));
jest.mock('../../obs/logger', () => ({ log: jest.fn() }));

interface PrismaMock {
  user: { findUnique: jest.Mock };
  application: { findMany: jest.Mock };
  decisionCapsule: { findMany: jest.Mock; findUnique: jest.Mock };
}

// Taken AFTER jest.resetModules() — the mock factory re-runs on reset, so a
// handle captured at module load configures a dead generation and the denial
// assertions would pass for the wrong reason.
let prisma: PrismaMock;
let app: express.Express;

const EMPLOYER_CLERK = 'user_2employerEEEEEEEEEEE';
const EMPLOYER_ORG = '33333333-3333-4333-8333-333333333333';
const ACCEPTED_NPI = '1234567893';

function setup(options: { verifiedUserId?: string; forgedHeader?: string } = {}): void {
  jest.resetModules();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  prisma = require('../../graphql/prisma_client').default as PrismaMock;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerDecisionCapsuleRoutes } = require('../decisionCapsules');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { errorHandler } = require('../../middleware/errorHandler');

  prisma.user.findUnique.mockResolvedValue({ id: 'u1', organizationId: EMPLOYER_ORG });
  prisma.application.findMany.mockResolvedValue([{ npi: ACCEPTED_NPI }]);
  prisma.decisionCapsule.findMany.mockResolvedValue([
    {
      id: 'c1',
      subjectNpi: ACCEPTED_NPI,
      subjectDid: 'did:example:1',
      decisionType: 'HIRING',
      decisionTimestamp: new Date('2026-08-01T00:00:00Z'),
      status: 'ACTIVE',
      credentialIds: [],
      issuerIds: [],
      artifactHash: 'h',
      methodology: 'm',
      metadata: {},
      createdAt: new Date('2026-08-01T00:00:00Z'),
    },
  ]);

  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    // Shadow mode: the middleware sets verifiedAuth but never rewrites or
    // strips the identity header. Reproduced exactly.
    (req as express.Request & { verifiedAuth?: unknown }).verifiedAuth = options.verifiedUserId
      ? { outcome: 'verified_match', verifiedUserId: options.verifiedUserId }
      : { outcome: 'header_without_token' };
    if (options.forgedHeader) req.headers['x-clerk-user-id'] = options.forgedHeader;
    next();
  });
  registerDecisionCapsuleRoutes(a);
  a.use(errorHandler);
  app = a;
}

describe('GET /api/employer/decisions requires a verified session', () => {
  it('a forged x-clerk-user-id buys nothing — 401, and no org lookup happens', async () => {
    // Exactly the old exploit: name a user id, be served as that user.
    setup({ forgedHeader: EMPLOYER_CLERK });

    const res = await request(app).get('/api/employer/decisions');

    expect(res.status).toBe(401);
    // The header never reached a query, so no org was resolved from it.
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.decisionCapsule.findMany).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain(ACCEPTED_NPI);
  });

  it('no session and no header is also refused', async () => {
    setup();

    const res = await request(app).get('/api/employer/decisions');

    expect(res.status).toBe(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('a verified session is served, and the FORGED header is ignored in favour of it', async () => {
    // Verified as the employer, but the header names someone else entirely.
    setup({ verifiedUserId: EMPLOYER_CLERK, forgedHeader: 'user_2attackerAAAAAAAAAA' });

    const res = await request(app).get('/api/employer/decisions');

    expect(res.status).toBe(200);
    expect(res.body.capsules).toHaveLength(1);
    // The identity that selected the org is the VERIFIED one, not the header.
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { clerkUserId: EMPLOYER_CLERK },
    });
  });

  it('a verified user with no organization gets an empty set, not another org’s', async () => {
    setup({ verifiedUserId: EMPLOYER_CLERK });
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', organizationId: null });

    const res = await request(app).get('/api/employer/decisions');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ capsules: [], totalCount: 0 });
    expect(prisma.decisionCapsule.findMany).not.toHaveBeenCalled();
  });
});
