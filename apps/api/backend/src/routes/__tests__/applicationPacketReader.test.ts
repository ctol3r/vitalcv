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
  readApplicationEvidenceView: jest.fn(),
}));

import {
  readApplicationPacket,
  readApplicationEvidenceView,
} from '../../services/opportunities/applicationPacketReadService';
import { HttpError } from '../../utils/httpError';
import type { VerifiedAuth } from '../../middleware/verifiedIdentity';
import { registerApplicationRoutes } from '../applications';

const APPLICATION_ID = 'a1111111-1111-4111-8111-111111111111';
const readSubmittedPacketMock = readApplicationPacket as jest.MockedFunction<typeof readApplicationPacket>;
const readPacketMock = readApplicationEvidenceView as jest.MockedFunction<typeof readApplicationEvidenceView>;

function responseFixture() {
  return {
    applicationId: APPLICATION_ID,
    opportunityId: 'b1111111-1111-4111-8111-111111111111',
    accessPerspective: 'clinician' as const,
    mode: 'sealed' as const,
    submittedPacket: {
      packetVersion: 2,
      packetHash: 'a'.repeat(64),
      clinicianNpi: '1558302470',
      integrity: 'valid' as const,
      purpose: 'Apply with VitalCV',
      recipient: 'Packet Test Health',
      consentAt: '2026-07-16T12:05:00.000Z',
      consentReceiptId: 'consent-1',
      consentGrantId: null,
      selectedSections: ['identity'],
      withheldFieldIds: [],
      fields: [],
      sectionAbsences: [],
      unexplainedSectionIds: [],
      methodologyVersion: '243.3',
      clinicianNote: null,
      lifecycle: 'active' as const,
    },
    legacyNotice: null,
    currentEvidence: {
      status: 'available' as const,
      observedAt: '2026-07-16T13:00:00.000Z',
      methodologyVersion: '243.3',
      fields: [],
      sectionAbsences: [],
      changesSinceSubmission: [],
      notice: 'Current Wallet evidence is shown separately and does not alter the submitted packet.',
    },
  };
}

function buildApp(verifiedUserId?: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { verifiedAuth?: VerifiedAuth }).verifiedAuth = verifiedUserId
      ? { outcome: 'verified_match', verifiedUserId }
      : { outcome: 'header_without_token' };
    next();
  });
  registerApplicationRoutes(app);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const httpError = error instanceof HttpError ? error : new HttpError(500, 'Internal error.');
    res.status(httpError.status).json({ error: { code: httpError.code, message: httpError.message } });
  });
  return app;
}

beforeEach(() => {
  readSubmittedPacketMock.mockReset();
  readSubmittedPacketMock.mockResolvedValue(responseFixture());
  readPacketMock.mockReset();
  readPacketMock.mockResolvedValue(responseFixture());
});

describe('GET /api/applications/:applicationId/packet', () => {
  it('rejects a forgeable identity header without a verified Clerk session', async () => {
    await request(buildApp())
      .get(`/api/applications/${APPLICATION_ID}/packet`)
      .set('x-clerk-user-id', 'clinician-owner')
      .expect(401);
    expect(readSubmittedPacketMock).not.toHaveBeenCalled();
  });

  it('uses verified identity while ignoring client identity, role, and organization assertions', async () => {
    const response = await request(buildApp('clinician-owner'))
      .get(`/api/applications/${APPLICATION_ID}/packet?version=2`)
      .set('x-clerk-user-id', 'forged-clinician')
      .set('x-clinician-id', 'another-clinician')
      .set('x-user-role', 'super-admin')
      .set('x-organization-id', 'attacker-org')
      .expect(200);

    expect(readSubmittedPacketMock).toHaveBeenCalledWith({
      applicationId: APPLICATION_ID,
      clerkUserId: 'clinician-owner',
      packetVersion: 2,
    });
    expect(response.body).toEqual(responseFixture());
  });

  it('adds current Wallet comparison only when the evidence view explicitly requests it', async () => {
    await request(buildApp('clinician-owner'))
      .get(`/api/applications/${APPLICATION_ID}/packet?includeCurrent=true`)
      .expect(200);
    expect(readPacketMock).toHaveBeenCalledWith({
      applicationId: APPLICATION_ID,
      clerkUserId: 'clinician-owner',
      packetVersion: undefined,
    });
    expect(readSubmittedPacketMock).not.toHaveBeenCalled();
  });

  it.each([
    [`/api/applications/not-a-uuid/packet`],
    [`/api/applications/${APPLICATION_ID}/packet?version=0`],
    [`/api/applications/${APPLICATION_ID}/packet?version=1.5`],
    [`/api/applications/${APPLICATION_ID}/packet?version=1&version=2`],
  ])('rejects malformed parameters: %s', async (path) => {
    await request(buildApp('clinician-owner'))
      .get(path)
      .expect(400);
    expect(readSubmittedPacketMock).not.toHaveBeenCalled();
  });

  it('passes through the honest legacy response without exposing database fields', async () => {
    readSubmittedPacketMock.mockResolvedValue({
      ...responseFixture(),
      mode: 'legacy',
      submittedPacket: null,
      legacyNotice: 'Legacy application — no immutable disclosure packet was captured at submission.',
    });

    const response = await request(buildApp('clinician-owner'))
      .get(`/api/applications/${APPLICATION_ID}/packet`)
      .expect(200);

    expect(response.body.submittedPacket).toBeNull();
    expect(response.body).not.toHaveProperty('id');
    expect(response.body).not.toHaveProperty('employerOrgId');
  });

  it('does not leak packet or organization metadata for denied and integrity-failed reads', async () => {
    readSubmittedPacketMock.mockRejectedValueOnce(new HttpError(404, 'Application packet not found.'));
    const denied = await request(buildApp('other-user'))
      .get(`/api/applications/${APPLICATION_ID}/packet`)
      .expect(404);
    expect(denied.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Application packet not found.' } });

    readSubmittedPacketMock.mockRejectedValueOnce(new HttpError(409, 'Application packet integrity verification failed.'));
    const integrity = await request(buildApp('clinician-owner'))
      .get(`/api/applications/${APPLICATION_ID}/packet`)
      .expect(409);
    expect(integrity.body).toEqual({
      error: { code: 'CONFLICT', message: 'Application packet integrity verification failed.' },
    });
    expect(JSON.stringify(integrity.body)).not.toContain('packetHash');
    expect(JSON.stringify(denied.body)).not.toContain('organization');
  });
});
