/**
 * An organization's capacity score is readable only by its own members.
 *
 * Before this was fixed, `GET /api/capacity/:organizationId` took the org
 * straight from the URL and authorized on nothing but the presence of a
 * forgeable `x-clerk-user-id` header. Verified against production: a request
 * carrying `x-clerk-user-id: user_anything` and an arbitrary org id returned
 * HTTP 200 with a full capacity payload — open positions, pipeline depth, hires
 * accepted this quarter, review latency. Same defect class as #951, but the org
 * came from the path rather than a target record, so nothing coupled it to the
 * caller at all.
 */
import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: { user: { findUnique: jest.fn() } },
}));

jest.mock('../../services/capacity/capacityEngine', () => ({
  computeOrganizationCapacity: jest.fn(),
  computeSystemCapacity: jest.fn(),
}));

import prisma from '../../graphql/prisma_client';
import {
  computeOrganizationCapacity,
  computeSystemCapacity,
} from '../../services/capacity/capacityEngine';
import { registerCapacityRoutes } from '../capacity';

const userFindUnique = (prisma as unknown as { user: { findUnique: jest.Mock } }).user.findUnique;

const OWN_ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const MEMBER = 'user_member';

/** Publishes `req.verifiedAuth` only for a caller the test declares verified. */
function buildApp() {
  const app = express();
  app.use((req, _res, next) => {
    const verified = req.headers['x-test-verified-user'];
    if (typeof verified === 'string' && verified.length > 0) {
      (req as unknown as { verifiedAuth: unknown }).verifiedAuth = {
        outcome: 'verified_match',
        verifiedUserId: verified,
      };
    }
    next();
  });
  app.use(express.json());
  registerCapacityRoutes(app);
  return app;
}

function mockCallerOrg(organizationId: string | null) {
  userFindUnique.mockResolvedValue(organizationId ? { organizationId } : null);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCallerOrg(OWN_ORG);
  (computeOrganizationCapacity as jest.Mock).mockResolvedValue({
    organizationId: OWN_ORG,
    openPositions: 4,
    pipelineDepth: 11,
  });
  (computeSystemCapacity as jest.Mock).mockResolvedValue({ openPositions: 99 });
});

describe('cross-tenant capacity reads', () => {
  it('refuses another organization and never computes its score', async () => {
    const res = await request(buildApp())
      .get(`/api/capacity/${OTHER_ORG}`)
      .set('x-test-verified-user', MEMBER);

    expect(res.status).toBe(404);
    expect(computeOrganizationCapacity).not.toHaveBeenCalled();
  });

  it('refuses a caller with no organization', async () => {
    mockCallerOrg(null);
    const res = await request(buildApp())
      .get(`/api/capacity/${OWN_ORG}`)
      .set('x-test-verified-user', 'user_orgless');

    expect(res.status).toBe(404);
    expect(computeOrganizationCapacity).not.toHaveBeenCalled();
  });

  it('gives a foreign org and an unknown org the same response', async () => {
    const foreign = await request(buildApp())
      .get(`/api/capacity/${OTHER_ORG}`)
      .set('x-test-verified-user', MEMBER);
    const unknown = await request(buildApp())
      .get('/api/capacity/33333333-3333-4333-8333-333333333333')
      .set('x-test-verified-user', MEMBER);

    expect(foreign.status).toBe(unknown.status);
    expect(foreign.body).toEqual(unknown.body);
  });

  it('a malformed org id is refused before it can reach a query', async () => {
    // This shape previously produced a 500 whose body carried the Prisma error
    // code and the failing query, because a non-uuid reached opportunity.count().
    const res = await request(buildApp())
      .get('/api/capacity/not-a-uuid')
      .set('x-test-verified-user', MEMBER);

    expect(res.status).toBe(404);
    expect(computeOrganizationCapacity).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|P20\d\d/i);
  });
});

describe('identity must be verified, not asserted', () => {
  it('rejects the forgeable identity header alone', async () => {
    const res = await request(buildApp())
      .get(`/api/capacity/${OWN_ORG}`)
      .set('x-clerk-user-id', MEMBER);

    expect(res.status).toBe(401);
    expect(computeOrganizationCapacity).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated caller', async () => {
    const res = await request(buildApp()).get(`/api/capacity/${OWN_ORG}`);
    expect(res.status).toBe(401);
  });
});

describe('the legitimate reads still work', () => {
  it('a member reads their own org score', async () => {
    const res = await request(buildApp())
      .get(`/api/capacity/${OWN_ORG}`)
      .set('x-test-verified-user', MEMBER);

    expect(res.status).toBe(200);
    expect(res.body.pipelineDepth).toBe(11);
    expect(computeOrganizationCapacity).toHaveBeenCalledWith(OWN_ORG);
  });

  it('computes against the resolved org, never the path value', async () => {
    await request(buildApp())
      .get(`/api/capacity/${OWN_ORG}`)
      .set('x-test-verified-user', MEMBER);

    expect(computeOrganizationCapacity).toHaveBeenCalledTimes(1);
    expect(computeOrganizationCapacity).toHaveBeenCalledWith(OWN_ORG);
  });

  it('/api/capacity/system stays public and is not captured as an org id', async () => {
    const res = await request(buildApp()).get('/api/capacity/system');

    expect(res.status).toBe(200);
    expect(res.body.openPositions).toBe(99);
    expect(computeSystemCapacity).toHaveBeenCalled();
    expect(computeOrganizationCapacity).not.toHaveBeenCalled();
  });
});
