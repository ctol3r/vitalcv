import express from 'express';
import request from 'supertest';

/**
 * Hire-to-start joined case — reachability through the REAL tenant guard.
 *
 * applicationPacketReader.test.ts mounts registerApplicationRoutes on a bare
 * Express app, which proves the handler contract but says nothing about
 * whether a request survives the global middleware in app.ts. The tenant
 * guard 401s any non-skip-listed path before routing, and the web tier's
 * marketplace proxies send verified identity only — never an org header —
 * so a route missing from the skip list ships inert: the clinician panel
 * and the employer decision controls would silently never render. The same
 * class of bug shipped /api/ledger/* and /api/version dead (see
 * ledgerProofReachability.test.ts, the pattern this file follows).
 *
 * The assertion is the OUTCOME (a verified caller with no organization
 * context reaches the service and gets its answer), not the mechanism, so it
 * keeps working if the guard is ever reimplemented.
 */

jest.mock('../../services/opportunities/applicationService', () => ({
  applyToOpportunity: jest.fn(),
  listClinicianApplications: jest.fn(),
  withdrawApplication: jest.fn(),
  listAllOrgApplications: jest.fn(),
  listApplicationsForOpportunity: jest.fn(),
  reviewApplication: jest.fn(),
}));
jest.mock('../../services/opportunities/employerWorkflowService', () => ({
  getEmployerWorkflowApplication: jest.fn(),
  listEmployerWorkflowDashboard: jest.fn(),
  runEmployerWorkflowAction: jest.fn(),
}));
jest.mock('../../services/decision/capsuleEngine', () => ({
  capsuleEngine: { createDecisionFromApplication: jest.fn() },
}));
jest.mock('../../services/opportunities/hireToStartReadService', () => ({
  readHireToStartCase: jest.fn(),
}));

import { readHireToStartCase } from '../../services/opportunities/hireToStartReadService';
import { requireTenantContextOrReadAccess, shouldSkipTenantContext } from '../../middleware/tenantGuard';
import { HttpError } from '../../utils/httpError';
import type { VerifiedAuth } from '../../middleware/verifiedIdentity';
import { registerApplicationRoutes } from '../applications';

const APPLICATION_ID = 'a1111111-1111-4111-8111-111111111111';
const readHireToStartCaseMock = readHireToStartCase as jest.MockedFunction<typeof readHireToStartCase>;

/**
 * The stack as app.ts mounts it: verified identity is bound first, then the
 * tenant guard runs globally, then routes register. A caller that only ever
 * presents verified identity (the marketplace-proxy shape) must reach the
 * handler.
 */
function buildGuardedApp(verifiedUserId?: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { verifiedAuth?: VerifiedAuth }).verifiedAuth = verifiedUserId
      ? { outcome: 'verified_match', verifiedUserId }
      : { outcome: 'header_without_token' };
    next();
  });
  app.use(requireTenantContextOrReadAccess);
  registerApplicationRoutes(app);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const httpError = error instanceof HttpError ? error : new HttpError(500, 'Internal error.');
    res.status(httpError.status).json({ error: { code: httpError.code, message: httpError.message } });
  });
  return app;
}

afterEach(() => jest.clearAllMocks());

describe('GET /api/applications/:applicationId/hire-to-start survives the global tenant guard', () => {
  it('a verified caller with no organization context reaches the service and gets its answer', async () => {
    readHireToStartCaseMock.mockResolvedValue({ currentStage: 'application_submitted' } as never);

    const res = await request(buildGuardedApp('clinician-owner'))
      .get(`/api/applications/${APPLICATION_ID}/hire-to-start`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ currentStage: 'application_submitted' });
    expect(readHireToStartCaseMock).toHaveBeenCalledWith({
      applicationId: APPLICATION_ID,
      clerkUserId: 'clinician-owner',
    });
  });

  it("an unverified caller gets the route's own denial, never the guard's", async () => {
    const res = await request(buildGuardedApp())
      .get(`/api/applications/${APPLICATION_ID}/hire-to-start`)
      .set('x-clerk-user-id', 'forged-clinician');

    expect(res.status).toBe(401);
    // The route's verified-identity denial — not organization_context_required.
    expect(JSON.stringify(res.body)).not.toContain('organization');
    expect(readHireToStartCaseMock).not.toHaveBeenCalled();
  });

  it('the service 404 (anti-enumeration) passes through for a verified foreign caller', async () => {
    readHireToStartCaseMock.mockRejectedValue(new HttpError(404, 'Application packet not found.'));

    const res = await request(buildGuardedApp('outside-org-user'))
      .get(`/api/applications/${APPLICATION_ID}/hire-to-start`);

    expect(res.status).toBe(404);
  });

  it('the exemption is exactly the service-authorized reads and does not leak to neighbours', () => {
    expect(shouldSkipTenantContext(`/api/applications/${APPLICATION_ID}/hire-to-start`)).toBe(true);
    expect(shouldSkipTenantContext(`/api/applications/${APPLICATION_ID}/hire-to-start/extra`)).toBe(false);
    expect(shouldSkipTenantContext(`/api/applicationsx/${APPLICATION_ID}/hire-to-start`)).toBe(false);
    expect(shouldSkipTenantContext(`/api/applications/${APPLICATION_ID}/withdraw`)).toBe(false);
  });
});
