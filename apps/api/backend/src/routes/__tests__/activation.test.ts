import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    application: { findUnique: jest.fn() },
  },
}));

jest.mock('../../services/activation/activationRequirementService', () => ({
  getApplicationActivation: jest.fn(),
  instantiateActivationRequirements: jest.fn(),
  resolveActivationRequirement: jest.fn(),
}));

jest.mock('../../services/activation/startEventService', () => ({
  getApplicationStartState: jest.fn(),
  markStartReady: jest.fn(),
  recordStart: jest.fn(),
  cancelStart: jest.fn(),
}));

// Org-role is a header-trust boundary elsewhere; the route test exercises the
// route logic, not the guard, so it passes through here.
jest.mock('../../middleware/orgRoleGuard', () => ({
  requireOrgRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  VERIFIER_MUTATION_ROLES: ['admin', 'reviewer'],
}));

import prisma from '../../graphql/prisma_client';
import {
  getApplicationActivation,
  instantiateActivationRequirements,
  resolveActivationRequirement,
} from '../../services/activation/activationRequirementService';
import { markStartReady, recordStart } from '../../services/activation/startEventService';
import { registerActivationRoutes } from '../activation';

const APP_ID = '11111111-1111-4111-8111-111111111111';
const REQ_ID = '22222222-2222-4222-8222-222222222222';
const CLINICIAN = 'user_clinician';
const EMPLOYER = 'user_employer';

const findUnique = (prisma as unknown as { application: { findUnique: jest.Mock } }).application.findUnique;

function buildApp() {
  const app = express();
  app.use(express.json());
  registerActivationRoutes(app);
  return app;
}

function mockApplication(overrides: Partial<{ clerkUserId: string; npi: string | null; organizationId: string }> = {}) {
  findUnique.mockResolvedValue({
    clerkUserId: overrides.clerkUserId ?? CLINICIAN,
    npi: overrides.npi ?? '1457128589',
    opportunity: { organizationId: overrides.organizationId ?? 'org_1' },
  });
}

beforeEach(() => jest.clearAllMocks());

describe('activation routes — reads', () => {
  it('lets the owning clinician read the ledger', async () => {
    mockApplication({ clerkUserId: CLINICIAN });
    (getApplicationActivation as jest.Mock).mockResolvedValue({ requirements: [], readiness: { startReady: true, blocking: [] } });

    const res = await request(buildApp())
      .get(`/api/applications/${APP_ID}/activation`)
      .set('x-clerk-user-id', CLINICIAN);

    expect(res.status).toBe(200);
    expect(res.body.readiness.startReady).toBe(true);
  });

  it('rejects a caller who is neither the applicant nor an org member (403)', async () => {
    mockApplication({ clerkUserId: CLINICIAN });
    const res = await request(buildApp())
      .get(`/api/applications/${APP_ID}/activation`)
      .set('x-clerk-user-id', 'user_stranger');
    expect(res.status).toBe(403);
  });

  it('allows an employer with an org-role header to read', async () => {
    mockApplication({ clerkUserId: CLINICIAN });
    (getApplicationActivation as jest.Mock).mockResolvedValue({ requirements: [], readiness: { startReady: false, blocking: [] } });
    const res = await request(buildApp())
      .get(`/api/applications/${APP_ID}/activation`)
      .set('x-clerk-user-id', EMPLOYER)
      .set('x-org-role', 'reviewer');
    expect(res.status).toBe(200);
  });

  it('404s a missing application', async () => {
    findUnique.mockResolvedValue(null);
    const res = await request(buildApp())
      .get(`/api/applications/${APP_ID}/activation`)
      .set('x-clerk-user-id', CLINICIAN);
    expect(res.status).toBe(404);
  });

  it('404s a non-uuid application id before touching the DB', async () => {
    const res = await request(buildApp())
      .get('/api/applications/not-a-uuid/activation')
      .set('x-clerk-user-id', CLINICIAN);
    expect(res.status).toBe(404);
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe('activation routes — mutations', () => {
  it('requires x-clerk-user-id on instantiate (401)', async () => {
    mockApplication();
    const res = await request(buildApp())
      .post(`/api/applications/${APP_ID}/activation/instantiate`)
      .send({ requirements: [] });
    expect(res.status).toBe(401);
  });

  it('rejects an empty requirements array (400)', async () => {
    mockApplication();
    const res = await request(buildApp())
      .post(`/api/applications/${APP_ID}/activation/instantiate`)
      .set('x-clerk-user-id', EMPLOYER)
      .send({ requirements: [] });
    expect(res.status).toBe(400);
  });

  it('instantiates a valid ledger (201) and passes the resolved org through', async () => {
    mockApplication({ organizationId: 'org_42', npi: '1457128589' });
    (instantiateActivationRequirements as jest.Mock).mockResolvedValue({ created: 1, skipped: false });
    const res = await request(buildApp())
      .post(`/api/applications/${APP_ID}/activation/instantiate`)
      .set('x-clerk-user-id', EMPLOYER)
      .send({ requirements: [{ category: 'evidence', label: 'State license', necessity: 'required', owner: 'clinician' }] });
    expect(res.status).toBe(201);
    expect(instantiateActivationRequirements).toHaveBeenCalledWith(
      expect.objectContaining({ applicationId: APP_ID, organizationId: 'org_42', clinicianNpi: '1457128589' }),
    );
  });

  it('rejects an invalid requirement status on resolve (400)', async () => {
    mockApplication();
    const res = await request(buildApp())
      .patch(`/api/applications/${APP_ID}/activation/requirements/${REQ_ID}`)
      .set('x-clerk-user-id', EMPLOYER)
      .send({ toStatus: 'banana' });
    expect(res.status).toBe(400);
  });

  it('maps a wrong_tenant resolve to 403', async () => {
    mockApplication();
    (resolveActivationRequirement as jest.Mock).mockResolvedValue({ ok: false, reason: 'wrong_tenant' });
    const res = await request(buildApp())
      .patch(`/api/applications/${APP_ID}/activation/requirements/${REQ_ID}`)
      .set('x-clerk-user-id', EMPLOYER)
      .send({ toStatus: 'met' });
    expect(res.status).toBe(403);
  });

  it('returns the named blockers when start-ready is refused (409)', async () => {
    mockApplication();
    (markStartReady as jest.Mock).mockResolvedValue({
      ok: false,
      reason: 'not_start_ready',
      blocking: [{ id: REQ_ID, necessity: 'required', status: 'not_started' }],
    });
    const res = await request(buildApp())
      .post(`/api/applications/${APP_ID}/start-ready`)
      .set('x-clerk-user-id', EMPLOYER)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.reason).toBe('not_start_ready');
    expect(res.body.blocking).toHaveLength(1);
  });

  it('rejects a start with an invalid date (400)', async () => {
    mockApplication();
    const res = await request(buildApp())
      .post(`/api/applications/${APP_ID}/start`)
      .set('x-clerk-user-id', EMPLOYER)
      .send({ startedAt: 'not-a-date' });
    expect(res.status).toBe(400);
    expect(recordStart).not.toHaveBeenCalled();
  });
});
