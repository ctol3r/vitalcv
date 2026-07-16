import express from 'express';
import request from 'supertest';

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
jest.mock('../../services/opportunities/applicationPacketReadService', () => ({
  ...jest.requireActual('../../services/opportunities/applicationPacketReadService'),
  readApplicationPacket: jest.fn(),
}));

import {
  readApplicationPacket,
} from '../../services/opportunities/applicationPacketReadService';
import { HttpError } from '../../utils/httpError';
import { registerApplicationRoutes } from '../applications';

const APPLICATION_ID = 'a1111111-1111-4111-8111-111111111111';
const readPacketMock = readApplicationPacket as jest.MockedFunction<typeof readApplicationPacket>;

function responseFixture() {
  return {
    applicationId: APPLICATION_ID,
    opportunityId: 'b1111111-1111-4111-8111-111111111111',
    accessPerspective: 'clinician' as const,
    mode: 'sealed' as const,
    submittedPacket: {
      packetVersion: 2,
      packetHash: 'a'.repeat(64),
      integrity: 'valid' as const,
      purpose: 'Apply with VitalCV',
      recipient: 'Packet Test Health',
      consentAt: '2026-07-16T12:05:00.000Z',
      consentReceiptId: 'consent-1',
      selectedSections: ['identity'],
      fields: [],
      methodologyVersion: '243.3',
      lifecycle: 'active' as const,
    },
    legacyNotice: null,
  };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  registerApplicationRoutes(app);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const httpError = error instanceof HttpError ? error : new HttpError(500, 'Internal error.');
    res.status(httpError.status).json({ error: { code: httpError.code, message: httpError.message } });
  });
  return app;
}

beforeEach(() => {
  readPacketMock.mockReset();
  readPacketMock.mockResolvedValue(responseFixture());
});

describe('GET /api/applications/:applicationId/packet', () => {
  it('requires an authenticated Clerk identity', async () => {
    await request(buildApp())
      .get(`/api/applications/${APPLICATION_ID}/packet`)
      .expect(401);
    expect(readPacketMock).not.toHaveBeenCalled();
  });

  it('parses the requested version and ignores client role and organization assertions', async () => {
    const response = await request(buildApp())
      .get(`/api/applications/${APPLICATION_ID}/packet?version=2`)
      .set('x-clerk-user-id', 'clinician-owner')
      .set('x-clinician-id', 'another-clinician')
      .set('x-user-role', 'super-admin')
      .set('x-organization-id', 'attacker-org')
      .expect(200);

    expect(readPacketMock).toHaveBeenCalledWith({
      applicationId: APPLICATION_ID,
      clerkUserId: 'clinician-owner',
      packetVersion: 2,
    });
    expect(response.body).toEqual(responseFixture());
  });

  it.each([
    [`/api/applications/not-a-uuid/packet`],
    [`/api/applications/${APPLICATION_ID}/packet?version=0`],
    [`/api/applications/${APPLICATION_ID}/packet?version=1.5`],
    [`/api/applications/${APPLICATION_ID}/packet?version=1&version=2`],
  ])('rejects malformed parameters: %s', async (path) => {
    await request(buildApp())
      .get(path)
      .set('x-clerk-user-id', 'clinician-owner')
      .expect(400);
    expect(readPacketMock).not.toHaveBeenCalled();
  });

  it('passes through the honest legacy response without exposing database fields', async () => {
    readPacketMock.mockResolvedValue({
      ...responseFixture(),
      mode: 'legacy',
      submittedPacket: null,
      legacyNotice: 'Legacy application — no immutable disclosure packet was captured at submission.',
    });

    const response = await request(buildApp())
      .get(`/api/applications/${APPLICATION_ID}/packet`)
      .set('x-clerk-user-id', 'clinician-owner')
      .expect(200);

    expect(response.body.submittedPacket).toBeNull();
    expect(response.body).not.toHaveProperty('id');
    expect(response.body).not.toHaveProperty('employerOrgId');
  });

  it('does not leak packet or organization metadata for denied and integrity-failed reads', async () => {
    readPacketMock.mockRejectedValueOnce(new HttpError(404, 'Application packet not found.'));
    const denied = await request(buildApp())
      .get(`/api/applications/${APPLICATION_ID}/packet`)
      .set('x-clerk-user-id', 'other-user')
      .expect(404);
    expect(denied.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Application packet not found.' } });

    readPacketMock.mockRejectedValueOnce(new HttpError(409, 'Application packet integrity verification failed.'));
    const integrity = await request(buildApp())
      .get(`/api/applications/${APPLICATION_ID}/packet`)
      .set('x-clerk-user-id', 'clinician-owner')
      .expect(409);
    expect(integrity.body).toEqual({
      error: { code: 'CONFLICT', message: 'Application packet integrity verification failed.' },
    });
    expect(JSON.stringify(integrity.body)).not.toContain('packetHash');
    expect(JSON.stringify(denied.body)).not.toContain('organization');
  });
});
