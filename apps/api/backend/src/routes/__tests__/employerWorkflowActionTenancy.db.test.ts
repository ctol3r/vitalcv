/**
 * Wave 1 Binding B — the employer decision route, over HTTP, against a REAL
 * database.
 *
 * The service-level suite proves the tenancy chain. This one closes the last
 * gap by exercising the route the employer's browser actually calls:
 *
 *   POST /api/applications/:appId/workflow-action
 *     → runEmployerWorkflowAction → getEmployerWorkflowApplication
 *     → loadWorkflowApplicationMap → listAllOrgApplications → getOrgForVerifier
 *
 * The organization is created by the real self-serve service, not a seed, and
 * the Express stack (including `requireOrgRole`, which is left in its default
 * `off` mode — Binding A owns that flag and is not touched here) is real.
 */

import express from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';

jest.mock('../../services/trust/trustStateEngine', () => ({
  ...jest.requireActual('../../services/trust/trustStateEngine'),
  computeClinicianTrustState: jest.fn(async () => null),
}));
jest.mock('../../services/billing/billingEngine', () => ({ processApplicationBilling: jest.fn() }));
jest.mock('../../services/actions/actionEngineService', () => ({
  refreshActionRecommendations: jest.fn(),
}));

import { registerApplicationRoutes } from '../applications';
import { upsertOrgProfile } from '../../services/opportunities/opportunityService';

const prisma = new PrismaClient();

const suffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
const EMPLOYER = `route-employer-${suffix}`;
const EMPLOYER_DOMAIN = `route-clinic-${suffix}.org`;
const OUTSIDER = `route-outsider-${suffix}`;
const OUTSIDER_DOMAIN = `route-outsider-clinic-${suffix}.org`;
const CLINICIAN = `route-clinician-${suffix}`;

let applicationId: string;
let organizationId: string;

function buildApp(verifiedUserId?: string) {
  const app = express();
  app.use(express.json());
  if (verifiedUserId) {
    app.use((req, _res, next) => {
      (req as express.Request & { verifiedAuth?: { verifiedUserId: string } }).verifiedAuth = {
        verifiedUserId,
      };
      next();
    });
  }
  registerApplicationRoutes(app);
  // Minimal error translator: the real app maps HttpError to its status.
  app.use((err: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? 500).json({ error: err.message ?? 'error' });
  });
  return app;
}

async function setUpSelfServeEmployer(clerkUserId: string, domain: string, name: string) {
  await prisma.user.create({
    data: {
      clerkUserId,
      email: `admin@${domain}`,
      role: UserRole.CLINICIAN,
      status: UserStatus.ACTIVE,
    },
  });
  return upsertOrgProfile(clerkUserId, {
    name,
    website: `https://${domain}`,
    facilityType: 'hospital',
    statesCovered: ['CA'],
    hiringTypes: ['permanent'],
  });
}

beforeAll(async () => {
  const created = await setUpSelfServeEmployer(
    EMPLOYER,
    EMPLOYER_DOMAIN,
    `Route Clinic ${suffix}`,
  );
  organizationId = created.organizationId;

  await setUpSelfServeEmployer(
    OUTSIDER,
    OUTSIDER_DOMAIN,
    `Route Outsider Clinic ${suffix}`,
  );

  await prisma.user.create({
    data: {
      clerkUserId: CLINICIAN,
      email: `${CLINICIAN}@clinician.test`,
      role: UserRole.CLINICIAN,
      status: UserStatus.ACTIVE,
    },
  });

  const opportunity = await prisma.opportunity.create({
    data: {
      id: randomUUID(),
      organizationId,
      title: 'Hospitalist',
      specialty: 'Internal Medicine',
      hiringType: 'permanent',
      state: 'CA',
    },
  });

  const application = await prisma.application.create({
    data: {
      id: randomUUID(),
      opportunityId: opportunity.id,
      clerkUserId: CLINICIAN,
      npi: '1558302470',
      status: 'PENDING',
    },
  });
  applicationId = application.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/applications/:appId/workflow-action — self-serve employer', () => {
  it('serves the workflow detail to the employer who owns the opportunity', async () => {
    const res = await request(buildApp())
      .get(`/api/applications/${applicationId}/workflow`)
      .set('x-clerk-user-id', EMPLOYER);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(applicationId);
    expect(res.body.employer.organizationId).toBe(organizationId);
  });

  it('lets the employer act on their own application', async () => {
    const res = await request(buildApp(EMPLOYER))
      .post(`/api/applications/${applicationId}/workflow-action`)
      .set('x-clerk-user-id', EMPLOYER)
      .send({ action: 'request_info', requests: [{ field: 'dea', message: 'Please add your DEA.' }] });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('request_info');
  });

  it('still 404s an employer from a different organization', async () => {
    const res = await request(buildApp(OUTSIDER))
      .post(`/api/applications/${applicationId}/workflow-action`)
      .set('x-clerk-user-id', OUTSIDER)
      .send({ action: 'reject', reviewNote: 'Not a fit.' });

    expect(res.status).toBe(404);
  });

  it('rejects a spoofed identity header without a verified session', async () => {
    const res = await request(buildApp())
      .post(`/api/applications/${applicationId}/workflow-action`)
      .set('x-clerk-user-id', EMPLOYER)
      .send({ action: 'request_info', requests: [{ field: 'dea', message: 'Please add your DEA.' }] });

    expect(res.status).toBe(401);
  });

  it('still 401s a caller with no identity header', async () => {
    const res = await request(buildApp())
      .get(`/api/applications/${applicationId}/workflow`);

    expect(res.status).toBe(401);
  });
});
