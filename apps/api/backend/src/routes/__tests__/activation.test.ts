import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    application: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
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

jest.mock('../../services/activation/applicationStartCommandService', () => ({
  confirmApplicationStart: jest.fn(),
}));

// requireOrgRole is mocked to ALWAYS pass. That is deliberate: it makes every
// assertion below a statement about the org-MEMBERSHIP check alone, independent
// of VERIFIER_RBAC_MODE. If membership is the real boundary, these tests hold
// even with the role guard fully open — which is the situation in production,
// where the mode is `shadow` and the guard is a no-op.
jest.mock('../../middleware/orgRoleGuard', () => ({
  requireOrgRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  VERIFIER_MUTATION_ROLES: ['admin', 'reviewer'],
}));

import prisma from '../../graphql/prisma_client';
import {
  instantiateActivationRequirements,
  resolveActivationRequirement,
} from '../../services/activation/activationRequirementService';
import { getApplicationStartState, markStartReady } from '../../services/activation/startEventService';
import { confirmApplicationStart } from '../../services/activation/applicationStartCommandService';
import { registerActivationRoutes } from '../activation';

const APP_ID = '11111111-1111-4111-8111-111111111111';
const REQ_ID = '22222222-2222-4222-8222-222222222222';
const CLINICIAN = 'user_clinician';
const EMPLOYER = 'user_employer';
const OUTSIDER = 'user_outsider';
const OWNING_ORG = 'org_owning';
const OTHER_ORG = 'org_other';

const findUnique = (prisma as unknown as { application: { findUnique: jest.Mock } }).application.findUnique;
const userFindUnique = (prisma as unknown as { user: { findUnique: jest.Mock } }).user.findUnique;

/**
 * Stands in for `verifiedIdentity` in enforce/shadow mode: it publishes
 * `req.verifiedAuth.verifiedUserId` only for a caller the test declares
 * verified. Tests send `x-test-verified-user` to simulate presenting a valid
 * Clerk JWT; a request without it models a caller who supplied only a forgeable
 * identity header, which the routes must reject.
 */
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
  registerActivationRoutes(app);
  return app;
}

function mockApplication(overrides: Partial<{ clerkUserId: string; npi: string | null; organizationId: string }> = {}) {
  findUnique.mockResolvedValue({
    clerkUserId: overrides.clerkUserId ?? CLINICIAN,
    npi: overrides.npi ?? '1457128589',
    opportunity: { organizationId: overrides.organizationId ?? OWNING_ORG },
  });
}

/** Declare which org the membership store says the caller belongs to. */
function mockCallerOrg(organizationId: string | null) {
  userFindUnique.mockResolvedValue(organizationId ? { organizationId } : null);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApplication();
  mockCallerOrg(OWNING_ORG);
});

// ── The regression this file exists for (#951) ───────────────────────────────
//
// Every route here authorized on a CLAIMED org role (`x-org-role`), never on
// org membership, and derived the acting org from the target application. Any
// caller who sent `x-org-role: admin` could read and mutate any organization's
// applications, with the write attributed to the victim org.
describe('activation routes — cross-tenant authorization (#951)', () => {
  it('refuses a caller whose org does not own the application, and does not leak that it exists', async () => {
    mockApplication({ organizationId: OWNING_ORG });
    mockCallerOrg(OTHER_ORG);

    const res = await request(buildApp())
      .get(`/api/applications/${APP_ID}/start-state`)
      .set('x-test-verified-user', OUTSIDER)
      .set('x-org-role', 'admin'); // the exact header that used to grant access

    expect(res.status).toBe(404);
    expect(getApplicationStartState).not.toHaveBeenCalled();
  });

  it('gives an unknown application and a foreign one the SAME response', async () => {
    mockApplication({ organizationId: OWNING_ORG });
    mockCallerOrg(OTHER_ORG);
    const foreign = await request(buildApp())
      .get(`/api/applications/${APP_ID}/start-state`)
      .set('x-test-verified-user', OUTSIDER);

    findUnique.mockResolvedValue(null);
    const unknown = await request(buildApp())
      .get(`/api/applications/${APP_ID}/start-state`)
      .set('x-test-verified-user', OUTSIDER);

    expect(foreign.status).toBe(unknown.status);
    expect(foreign.body).toEqual(unknown.body);
  });

  it('refuses a caller with no organization at all', async () => {
    mockCallerOrg(null);
    const res = await request(buildApp())
      .get(`/api/applications/${APP_ID}/start-state`)
      .set('x-test-verified-user', OUTSIDER)
      .set('x-org-role', 'admin');
    expect(res.status).toBe(404);
  });

  it('refuses a cross-tenant MUTATION and never reaches the service', async () => {
    mockApplication({ organizationId: OWNING_ORG });
    mockCallerOrg(OTHER_ORG);

    const res = await request(buildApp())
      .post(`/api/applications/${APP_ID}/start-ready`)
      .set('x-test-verified-user', OUTSIDER)
      .set('x-org-role', 'admin')
      .send({});

    expect(res.status).toBe(404);
    expect(markStartReady).not.toHaveBeenCalled();
  });

  it.each([
    ['post', `/api/applications/${APP_ID}/activation/instantiate`, { requirements: [{ category: 'evidence', label: 'x', necessity: 'required', owner: 'clinician' }] }],
    ['patch', `/api/applications/${APP_ID}/activation/requirements/${REQ_ID}`, { toStatus: 'met' }],
    ['post', `/api/applications/${APP_ID}/start-ready`, {}],
    ['post', `/api/applications/${APP_ID}/start`, { startedAt: '2026-01-01T00:00:00.000Z' }],
    ['post', `/api/applications/${APP_ID}/start/cancel`, { reasonCode: 'x' }],
  ])('%s %s is closed to a foreign org', async (method, path, body) => {
    mockApplication({ organizationId: OWNING_ORG });
    mockCallerOrg(OTHER_ORG);

    const agent = request(buildApp());
    const res = await (method === 'patch' ? agent.patch(path) : agent.post(path))
      .set('x-test-verified-user', OUTSIDER)
      .set('x-org-role', 'admin')
      .send(body);

    expect(res.status).toBe(404);
  });
});

// ── Identity must be verified, not merely asserted ───────────────────────────
describe('activation routes — verified identity', () => {
  it('rejects a caller who supplies only the forgeable identity header', async () => {
    const res = await request(buildApp())
      .get(`/api/applications/${APP_ID}/start-state`)
      .set('x-clerk-user-id', EMPLOYER) // no verified session
      .set('x-org-role', 'admin');
    expect(res.status).toBe(401);
  });

  it('rejects an unauthenticated mutation (401)', async () => {
    const res = await request(buildApp())
      .post(`/api/applications/${APP_ID}/activation/instantiate`)
      .send({ requirements: [] });
    expect(res.status).toBe(401);
  });
});

describe('activation routes — start-state read', () => {
  it('lets the owning clinician read the start-state without any org', async () => {
    mockApplication({ clerkUserId: CLINICIAN });
    mockCallerOrg(null); // applicants have no employer org
    (getApplicationStartState as jest.Mock).mockResolvedValue('not_ready');

    const res = await request(buildApp())
      .get(`/api/applications/${APP_ID}/start-state`)
      .set('x-test-verified-user', CLINICIAN);

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('not_ready');
  });

  it('lets a member of the OWNING org read', async () => {
    mockApplication({ clerkUserId: CLINICIAN, organizationId: OWNING_ORG });
    mockCallerOrg(OWNING_ORG);
    (getApplicationStartState as jest.Mock).mockResolvedValue('start_ready');

    const res = await request(buildApp())
      .get(`/api/applications/${APP_ID}/start-state`)
      .set('x-test-verified-user', EMPLOYER);

    expect(res.status).toBe(200);
  });

  it('404s a missing application', async () => {
    findUnique.mockResolvedValue(null);
    const res = await request(buildApp())
      .get(`/api/applications/${APP_ID}/start-state`)
      .set('x-test-verified-user', CLINICIAN);
    expect(res.status).toBe(404);
  });

  it('404s a non-uuid application id before touching the DB', async () => {
    const res = await request(buildApp())
      .get('/api/applications/not-a-uuid/start-state')
      .set('x-test-verified-user', CLINICIAN);
    expect(res.status).toBe(404);
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe('activation routes — mutations', () => {
  it('rejects an empty requirements array (400)', async () => {
    const res = await request(buildApp())
      .post(`/api/applications/${APP_ID}/activation/instantiate`)
      .set('x-test-verified-user', EMPLOYER)
      .send({ requirements: [] });
    expect(res.status).toBe(400);
  });

  it('instantiates a valid ledger (201) and passes the resolved org through', async () => {
    mockApplication({ organizationId: 'org_42', npi: '1457128589' });
    mockCallerOrg('org_42');
    (instantiateActivationRequirements as jest.Mock).mockResolvedValue({ created: 1, skipped: false });

    const res = await request(buildApp())
      .post(`/api/applications/${APP_ID}/activation/instantiate`)
      .set('x-test-verified-user', EMPLOYER)
      .send({ requirements: [{ category: 'evidence', label: 'State license', necessity: 'required', owner: 'clinician' }] });

    expect(res.status).toBe(201);
    expect(instantiateActivationRequirements).toHaveBeenCalledWith(
      expect.objectContaining({ applicationId: APP_ID, organizationId: 'org_42', clinicianNpi: '1457128589' }),
    );
  });

  it('attributes the write to the VERIFIED caller, not a header', async () => {
    mockApplication({ organizationId: OWNING_ORG });
    mockCallerOrg(OWNING_ORG);
    (markStartReady as jest.Mock).mockResolvedValue({ ok: true, state: 'start_ready' });

    await request(buildApp())
      .post(`/api/applications/${APP_ID}/start-ready`)
      .set('x-test-verified-user', EMPLOYER)
      .set('x-clerk-user-id', 'user_spoofed')
      .send({});

    expect(markStartReady).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: OWNING_ORG, actorId: EMPLOYER }),
    );
  });

  it('rejects an invalid requirement status on resolve (400)', async () => {
    const res = await request(buildApp())
      .patch(`/api/applications/${APP_ID}/activation/requirements/${REQ_ID}`)
      .set('x-test-verified-user', EMPLOYER)
      .send({ toStatus: 'banana' });
    expect(res.status).toBe(400);
  });

  it('maps a wrong_tenant resolve to the same 404 as an unknown requirement', async () => {
    (resolveActivationRequirement as jest.Mock).mockResolvedValue({ ok: false, reason: 'wrong_tenant' });
    const res = await request(buildApp())
      .patch(`/api/applications/${APP_ID}/activation/requirements/${REQ_ID}`)
      .set('x-test-verified-user', EMPLOYER)
      .send({ toStatus: 'met' });
    expect(res.status).toBe(404);
  });

  it('returns the named blockers when start-ready is refused (409)', async () => {
    (markStartReady as jest.Mock).mockResolvedValue({
      ok: false,
      reason: 'not_start_ready',
      blocking: [{ id: REQ_ID, necessity: 'required', status: 'not_started' }],
    });
    const res = await request(buildApp())
      .post(`/api/applications/${APP_ID}/start-ready`)
      .set('x-test-verified-user', EMPLOYER)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.reason).toBe('not_start_ready');
    expect(res.body.blocking).toHaveLength(1);
  });

  it('rejects a start with an invalid date (400)', async () => {
    const res = await request(buildApp())
      .post(`/api/applications/${APP_ID}/start`)
      .set('x-test-verified-user', EMPLOYER)
      .send({ startedAt: 'not-a-date' });
    expect(res.status).toBe(400);
    expect(confirmApplicationStart).not.toHaveBeenCalled();
  });

  it('returns the canonical attestation identifiers for a confirmed first day', async () => {
    (confirmApplicationStart as jest.Mock).mockResolvedValue({
      state: 'started',
      duplicate: false,
      attestation: { id: 'attestation-1', startedAt: new Date('2026-01-01T00:00:00.000Z') },
      lifecycleAuditEventId: 'lifecycle-audit-1',
      attestationAuditEventId: 'attestation-audit-1',
    });
    const res = await request(buildApp())
      .post(`/api/applications/${APP_ID}/start`)
      .set('x-test-verified-user', EMPLOYER)
      .send({ startedAt: '2026-01-01T00:00:00.000Z' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      state: 'started',
      startAttestationId: 'attestation-1',
      lifecycleAuditEventId: 'lifecycle-audit-1',
      attestationAuditEventId: 'attestation-audit-1',
    });
  });
});
