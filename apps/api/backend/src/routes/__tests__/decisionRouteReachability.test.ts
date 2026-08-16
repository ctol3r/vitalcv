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
// The start-lifecycle routes resolve the caller's org membership from prisma
// directly; the only direct prisma call in applications.ts (the applicant
// lookup on POST apply) is not exercised here, so this mock is inert for the
// decision-family cases above it.
jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    application: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));
jest.mock('../../services/activation/startEventService', () => ({
  getApplicationStartState: jest.fn(),
  markStartReady: jest.fn(),
  cancelStart: jest.fn(),
}));
jest.mock('../../services/activation/applicationStartCommandService', () => ({
  confirmApplicationStart: jest.fn(),
}));
jest.mock('../../services/activation/activationRequirementService', () => ({
  instantiateActivationRequirements: jest.fn(),
  resolveActivationRequirement: jest.fn(),
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
import prisma from '../../graphql/prisma_client';
import { markStartReady } from '../../services/activation/startEventService';
import { confirmApplicationStart } from '../../services/activation/applicationStartCommandService';
import { resolveActivationRequirement } from '../../services/activation/activationRequirementService';
import { registerApplicationRoutes } from '../applications';
import { registerActivationRoutes } from '../activation';

const APPLICATION_ID = 'b2222222-2222-4222-8222-222222222222';
const REQUIREMENT_ID = 'c3333333-3333-4333-8333-333333333333';

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
  registerActivationRoutes(app);
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
    for (const allowed of ['review', 'workflow', 'workflow-action', 'withdraw', 'start-ready', 'start']) {
      expect(shouldSkipTenantContext(`/api/applications/${APPLICATION_ID}/${allowed}`)).toBe(true);
    }
    expect(shouldSkipTenantContext('/api/clinician/applications')).toBe(true);
    expect(shouldSkipTenantContext(`/api/applications/${APPLICATION_ID}/activation/requirements/${REQUIREMENT_ID}`)).toBe(true);
    // Unproxied siblings stay guarded, and shape variants must not ride along.
    expect(shouldSkipTenantContext(`/api/applications/${APPLICATION_ID}/activation`)).toBe(false);
    expect(shouldSkipTenantContext(`/api/applications/${APPLICATION_ID}/activation/instantiate`)).toBe(false);
    expect(shouldSkipTenantContext(`/api/applications/${APPLICATION_ID}/activation/requirements`)).toBe(false);
    expect(shouldSkipTenantContext(`/api/applications/${APPLICATION_ID}/activation/requirements/${REQUIREMENT_ID}/extra`)).toBe(false);
    expect(shouldSkipTenantContext(`/api/applications/${APPLICATION_ID}/start-state`)).toBe(false);
    expect(shouldSkipTenantContext(`/api/applications/${APPLICATION_ID}/start/cancel`)).toBe(false);
    expect(shouldSkipTenantContext(`/api/applications/${APPLICATION_ID}/start-ready/extra`)).toBe(false);
    expect(shouldSkipTenantContext(`/api/applications/${APPLICATION_ID}/workflow-action/extra`)).toBe(false);
    expect(shouldSkipTenantContext(`/api/applicationsx/${APPLICATION_ID}/workflow`)).toBe(false);
    expect(shouldSkipTenantContext('/api/clinician/applications/other')).toBe(false);
  });
});

describe('the start lifecycle commands survive the global tenant guard', () => {
  const applicationFindUnique = (prisma as unknown as { application: { findUnique: jest.Mock } }).application.findUnique;
  const userFindUnique = (prisma as unknown as { user: { findUnique: jest.Mock } }).user.findUnique;
  const markStartReadyMock = markStartReady as jest.MockedFunction<typeof markStartReady>;
  const confirmMock = confirmApplicationStart as jest.MockedFunction<typeof confirmApplicationStart>;
  const resolveRequirementMock = resolveActivationRequirement as jest.MockedFunction<typeof resolveActivationRequirement>;

  beforeEach(() => {
    // The route resolves the target application's owning org and the CALLER's
    // membership from the DB — the marketplace proxy sends no org header.
    applicationFindUnique.mockResolvedValue({
      clerkUserId: 'clinician-owner',
      npi: '1234567893',
      opportunity: { organizationId: 'org-owning' },
    });
    userFindUnique.mockResolvedValue({ organizationId: 'org-owning' });
  });

  it('POST /start-ready from a verified employer with no org header reaches the command', async () => {
    markStartReadyMock.mockResolvedValue({ ok: true, state: 'start_ready' });

    const res = await request(buildGuardedApp('employer-reviewer'))
      .post(`/api/applications/${APPLICATION_ID}/start-ready`)
      .set('x-clerk-user-id', 'employer-reviewer')
      .send({});

    expect(res.status).toBe(200);
    expect(markStartReadyMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-owning', actorId: 'employer-reviewer' }),
    );
  });

  it('POST /start from a verified employer with no org header reaches the command', async () => {
    confirmMock.mockResolvedValue({
      state: 'started',
      duplicate: false,
      applicationId: APPLICATION_ID,
      organizationId: 'org-owning',
      attestation: { id: 'attestation-1', startedAt: new Date('2026-08-01T00:00:00.000Z') } as never,
      lifecycleAuditEventId: 'lifecycle-audit-1',
      attestationAuditEventId: 'attestation-audit-1',
    });

    const res = await request(buildGuardedApp('employer-reviewer'))
      .post(`/api/applications/${APPLICATION_ID}/start`)
      .set('x-clerk-user-id', 'employer-reviewer')
      .send({ startedAt: '2026-08-01T00:00:00.000Z' });

    expect(res.status).toBe(201);
    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-owning', actorId: 'employer-reviewer' }),
    );
  });

  it('PATCH /activation/requirements/:id from a verified employer with no org header reaches the service', async () => {
    resolveRequirementMock.mockResolvedValue({ ok: true });

    const res = await request(buildGuardedApp('employer-reviewer'))
      .patch(`/api/applications/${APPLICATION_ID}/activation/requirements/${REQUIREMENT_ID}`)
      .set('x-clerk-user-id', 'employer-reviewer')
      .send({ toStatus: 'submitted' });

    expect(res.status).toBe(200);
    expect(resolveRequirementMock).toHaveBeenCalledWith(
      expect.objectContaining({ requirementId: REQUIREMENT_ID, organizationId: 'org-owning' }),
    );
  });

  it("a forged identity header without a verified session gets the route's own 401, never the guard's", async () => {
    for (const probe of [
      () => request(buildGuardedApp()).post(`/api/applications/${APPLICATION_ID}/start-ready`).set('x-clerk-user-id', 'forged').send({}),
      () => request(buildGuardedApp()).post(`/api/applications/${APPLICATION_ID}/start`).set('x-clerk-user-id', 'forged').send({ startedAt: '2026-08-01T00:00:00.000Z' }),
      () => request(buildGuardedApp()).patch(`/api/applications/${APPLICATION_ID}/activation/requirements/${REQUIREMENT_ID}`).set('x-clerk-user-id', 'forged').send({ toStatus: 'submitted' }),
    ]) {
      const res = await probe();
      expect(res.status).toBe(401);
      expect(JSON.stringify(res.body)).not.toContain('organization');
    }
    expect(markStartReadyMock).not.toHaveBeenCalled();
    expect(confirmMock).not.toHaveBeenCalled();
    expect(resolveRequirementMock).not.toHaveBeenCalled();
  });

  it('a verified caller in a FOREIGN org gets the same 404 as an unknown case', async () => {
    userFindUnique.mockResolvedValue({ organizationId: 'org-foreign' });

    const res = await request(buildGuardedApp('foreign-reviewer'))
      .post(`/api/applications/${APPLICATION_ID}/start`)
      .set('x-clerk-user-id', 'foreign-reviewer')
      .send({ startedAt: '2026-08-01T00:00:00.000Z' });

    expect(res.status).toBe(404);
    expect(confirmMock).not.toHaveBeenCalled();
  });
});
