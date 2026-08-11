/**
 * employerDecisionsIdentity.test.ts — S1.
 *
 * `GET /api/employer/decisions` resolves the caller's ORGANISATION from their
 * identity and then answers with that org's hiring decisions, so identity here
 * IS the tenancy boundary. It used to read `x-clerk-user-id` straight off the
 * request — a plain header on a public origin — which made "read another
 * employer's decision capsules" a matter of knowing one of their members' Clerk
 * ids.
 *
 * The property: an unverified caller gets nothing, whatever header they send,
 * and a verified caller is scoped to the org their own User row names.
 */
import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    application: { findMany: jest.fn() },
    decisionCapsule: { findMany: jest.fn() },
  },
}));
jest.mock('../../obs/logger', () => ({ log: jest.fn() }));

import type { VerifiedAuth } from '../../middleware/verifiedIdentity';
import { registerDecisionCapsuleRoutes } from '../decisionCapsules';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const prisma = require('../../graphql/prisma_client').default as {
  user: { findUnique: jest.Mock };
  application: { findMany: jest.Mock };
  decisionCapsule: { findMany: jest.Mock };
};

const VICTIM_CLERK_ID = 'user_victim_employer_member';

function buildApp(verifiedUserId?: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { verifiedAuth?: VerifiedAuth }).verifiedAuth = verifiedUserId
      ? { outcome: 'verified_match', verifiedUserId }
      : { outcome: 'header_without_token' };
    next();
  });
  registerDecisionCapsuleRoutes(app);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue({ organizationId: 'org-victim' });
  prisma.application.findMany.mockResolvedValue([]);
  prisma.decisionCapsule.findMany.mockResolvedValue([]);
});

describe('GET /api/employer/decisions', () => {
  it('401s a forged x-clerk-user-id with no verified session, and never looks the user up', async () => {
    await request(buildApp())
      .get('/api/employer/decisions')
      .set('x-clerk-user-id', VICTIM_CLERK_ID)
      .expect(401);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('401s an anonymous caller', async () => {
    await request(buildApp()).get('/api/employer/decisions').expect(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('scopes to the VERIFIED subject and ignores a conflicting identity header', async () => {
    await request(buildApp('user_real_caller'))
      .get('/api/employer/decisions')
      .set('x-clerk-user-id', VICTIM_CLERK_ID)
      .expect(200);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { clerkUserId: 'user_real_caller' },
    });
  });
});
