import express from 'express';
import request from 'supertest';

/**
 * Canonical decision family — reachability through the REAL tenant guard.
 *
 * The route/service tests mount registerApplicationRoutes on a bare Express
 * app, which proves the handler contract but not that a request survives the
 * global middleware in app.ts. The tenant guard 401s any non-skip-listed path
 * before routing, and the marketplace proxies forward verified identity but
 * never an org header — so the employer decision routes (/review, /workflow,
 * /workflow-action), the clinician's /withdraw, and the clinician's own
 * application list shipped inert: accept, reject, clarify, and withdraw all
 * died as organization_context_required before routing, swallowed by their
 * callers. Same defect class as hireToStartReachability.test.ts, whose
 * pattern this file follows.
 *
 * The assertion is the OUTCOME (a verified caller with no organization
 * context reaches the service), not the mechanism.
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

import {
  listClinicianApplications,
  withdrawApplication,
} from '../../services/opportunities/applicationService';
import {
  getEmployerWorkflowApplication,
  runEmployerWorkflowAction,
} from '../../services/opportunities/employerWorkflowService';
import { requireTenantContextOrReadAccess, shouldSkipTenantContext } from '../../middleware/tenantGuard';
import { HttpError } from '../../utils/httpError';
import type { VerifiedAuth } from '../../middleware/verifiedIdentity';
import { registerApplicationRoutes } from '../applications';

const APPLICATION_ID = 'b2222222-2222-4222-8222-222222222222';

const runActionMock = runEmployerWorkflowAction as jest.MockedFunction<typeof runEmployerWorkflowAction>;
const getWorkflowMock = getEmployerWorkflowApplication as jest.MockedFunction<typeof getEmployerWorkflowApplication>;
const withdrawMock = withdrawApplication as jest.MockedFunction<typeof withdrawApplication>;
const listOwnMock = listClinicianApplications as jest.MockedFunction<typeof listClinicianApplications>;

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

describe('the canonical decision family survives the global tenant guard', () => {
  it('POST /workflow-action from a verified reviewer with no org header reaches the decision service', async () => {
    runActionMock.mockResolvedValue({
      application: { id: APPLICATION_ID },
      notificationTriggered: true,
      auditEventId: 'audit-1',
      decisionOutboxEventId: 'outbox-1',
      acceptanceId: null,
      startActivationId: null,
      remainingRequirementCount: 0,
    } as never);

    const res = await request(buildGuardedApp('employer-reviewer'))
      .post(`/api/applications/${APPLICATION_ID}/workflow-action`)
      .set('x-clerk-user-id', 'employer-reviewer')
      .send({ action: 'request_info', requests: [{ field: 'dea', message: 'Please add your DEA.' }] });

    expect(res.status).toBe(200);
    expect(runActionMock).toHaveBeenCalled();
  });

  it('GET /workflow from a verified reviewer with no org header reaches the read service', async () => {
    getWorkflowMock.mockResolvedValue({ id: APPLICATION_ID } as never);

    const res = await request(buildGuardedApp('employer-reviewer'))
      .get(`/api/applications/${APPLICATION_ID}/workflow`)
      .set('x-clerk-user-id', 'employer-reviewer');

    expect(res.status).toBe(200);
    expect(getWorkflowMock).toHaveBeenCalledWith(APPLICATION_ID, 'employer-reviewer');
  });

  it('DELETE /withdraw from the verified applicant with no org header reaches the service', async () => {
    withdrawMock.mockResolvedValue({ id: APPLICATION_ID, status: 'WITHDRAWN' } as never);

    const res = await request(buildGuardedApp('clinician-owner'))
      .delete(`/api/applications/${APPLICATION_ID}/withdraw`)
      .set('x-clerk-user-id', 'clinician-owner');

    expect(res.status).toBe(200);
    expect(withdrawMock).toHaveBeenCalledWith(APPLICATION_ID, 'clinician-owner');
  });

  it('GET /api/clinician/applications from a verified clinician with no org header reaches the service', async () => {
    listOwnMock.mockResolvedValue([] as never);

    const res = await request(buildGuardedApp('clinician-owner'))
      .get('/api/clinician/applications')
      .set('x-clerk-user-id', 'clinician-owner');

    expect(res.status).toBe(200);
    expect(listOwnMock).toHaveBeenCalledWith('clinician-owner');
  });

  it("a forged identity header without a verified session gets the route's own 401, never the guard's", async () => {
    for (const probe of [
      () => request(buildGuardedApp()).post(`/api/applications/${APPLICATION_ID}/workflow-action`).set('x-clerk-user-id', 'forged').send({ action: 'reject' }),
      () => request(buildGuardedApp()).delete(`/api/applications/${APPLICATION_ID}/withdraw`).set('x-clerk-user-id', 'forged'),
      () => request(buildGuardedApp()).get('/api/clinician/applications').set('x-clerk-user-id', 'forged'),
    ]) {
      const res = await probe();
      expect(res.status).toBe(401);
      expect(JSON.stringify(res.body)).not.toContain('organization');
    }
    expect(runActionMock).not.toHaveBeenCalled();
    expect(withdrawMock).not.toHaveBeenCalled();
    expect(listOwnMock).not.toHaveBeenCalled();
  });

  it('the exemption covers exactly the decision family and does not leak to neighbours', () => {
    for (const allowed of ['review', 'workflow', 'workflow-action', 'withdraw']) {
      expect(shouldSkipTenantContext(`/api/applications/${APPLICATION_ID}/${allowed}`)).toBe(true);
    }
    expect(shouldSkipTenantContext('/api/clinician/applications')).toBe(true);
    // The orphaned activation route stays guarded until deleted, and shape
    // variants must not ride along.
    expect(shouldSkipTenantContext(`/api/applications/${APPLICATION_ID}/activation`)).toBe(false);
    expect(shouldSkipTenantContext(`/api/applications/${APPLICATION_ID}/workflow-action/extra`)).toBe(false);
    expect(shouldSkipTenantContext(`/api/applicationsx/${APPLICATION_ID}/workflow`)).toBe(false);
    expect(shouldSkipTenantContext('/api/clinician/applications/other')).toBe(false);
  });
});
