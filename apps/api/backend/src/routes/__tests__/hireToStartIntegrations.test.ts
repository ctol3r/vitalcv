import express from 'express';
import request from 'supertest';

jest.mock('../../services/integrations/hireToStartIntegrationService', () => ({
  receiveHireToStartIntegrationEvent: jest.fn(),
}));
jest.mock('../../services/integrations/hireToStartRoleImportService', () => ({
  importGenericHireToStartRoles: jest.fn(),
}));

import { receiveHireToStartIntegrationEvent } from '../../services/integrations/hireToStartIntegrationService';
import { importGenericHireToStartRoles } from '../../services/integrations/hireToStartRoleImportService';
import { HttpError } from '../../utils/httpError';
import type { VerifiedAuth } from '../../middleware/verifiedIdentity';
import { registerHireToStartIntegrationRoutes } from '../hireToStartIntegrations';

const receiveMock = receiveHireToStartIntegrationEvent as jest.MockedFunction<typeof receiveHireToStartIntegrationEvent>;
const importRolesMock = importGenericHireToStartRoles as jest.MockedFunction<typeof importGenericHireToStartRoles>;

function buildApp(verifiedUserId?: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { verifiedAuth?: VerifiedAuth }).verifiedAuth = verifiedUserId
      ? { outcome: 'verified_match', verifiedUserId }
      : { outcome: 'header_without_token' };
    next();
  });
  registerHireToStartIntegrationRoutes(app);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const httpError = error instanceof HttpError ? error : new HttpError(500, 'Internal error.');
    res.status(httpError.status).json({ error: httpError.message });
  });
  return app;
}

const event = {
  version: '1',
  organizationId: 'a1111111-1111-4111-8111-111111111111',
  sourceSystem: 'partner-test',
  externalEventId: 'event-1',
  eventType: 'application.external_reference.upserted',
  applicationId: 'b1111111-1111-4111-8111-111111111111',
  occurredAt: '2026-08-14T20:00:00.000Z',
  data: { objectType: 'ats-application', externalIdentifier: 'ATS-123' },
};

beforeEach(() => {
  receiveMock.mockReset();
  receiveMock.mockResolvedValue({
    receiptId: 'c1111111-1111-4111-8111-111111111111',
    state: 'PROCESSED',
    duplicate: false,
    payloadHash: 'a'.repeat(64),
    reason: null,
  });
  importRolesMock.mockReset();
  importRolesMock.mockResolvedValue({
    organizationId: 'a1111111-1111-4111-8111-111111111111',
    created: 1,
    updated: 0,
    opportunityIds: ['b1111111-1111-4111-8111-111111111111'],
  });
});

describe('POST /api/integrations/hire-to-start/roles/import', () => {
  const payload = {
    sourceSystem: 'partner-ats',
    roles: [{
      externalRoleId: 'ROLE-123',
      title: 'Employed hospitalist',
      specialty: 'Internal Medicine',
      hiringType: 'permanent',
      state: 'CA',
    }],
  };

  it('requires verified identity rather than a caller-supplied user header', async () => {
    await request(buildApp())
      .post('/api/integrations/hire-to-start/roles/import')
      .set('x-clerk-user-id', 'spoofed-user')
      .send(payload)
      .expect(401);
    expect(importRolesMock).not.toHaveBeenCalled();
  });

  it('derives organization scope in the service from the verified caller', async () => {
    const response = await request(buildApp('verified-employer'))
      .post('/api/integrations/hire-to-start/roles/import')
      .set('x-clerk-user-id', 'spoofed-user')
      .set('x-org-id', 'spoofed-organization')
      .send(payload)
      .expect(200);
    expect(importRolesMock).toHaveBeenCalledWith('verified-employer', payload);
    expect(response.headers['cache-control']).toBe('private, no-store');
  });
});

describe('POST /api/integrations/hire-to-start/events', () => {
  it('requires the complete signature envelope before processing', async () => {
    await request(buildApp()).post('/api/integrations/hire-to-start/events').send(event).expect(401);
    expect(receiveMock).not.toHaveBeenCalled();
  });

  it('passes only signature headers and returns a private accepted receipt', async () => {
    const response = await request(buildApp())
      .post('/api/integrations/hire-to-start/events')
      .set('x-vitalcv-key-id', 'd1111111-1111-4111-8111-111111111111')
      .set('x-vitalcv-timestamp', '1786737600')
      .set('x-vitalcv-signature', `v1=${'b'.repeat(64)}`)
      .send(event)
      .expect(202);

    expect(receiveMock).toHaveBeenCalledWith(event, {
      keyId: 'd1111111-1111-4111-8111-111111111111',
      timestamp: '1786737600',
      signature: `v1=${'b'.repeat(64)}`,
    });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body).toMatchObject({ state: 'PROCESSED', duplicate: false });
  });

  it('returns 200 for an idempotent duplicate without changing its receipt id', async () => {
    receiveMock.mockResolvedValueOnce({
      receiptId: 'c1111111-1111-4111-8111-111111111111',
      state: 'PROCESSED',
      duplicate: true,
      payloadHash: 'a'.repeat(64),
      reason: null,
    });
    await request(buildApp())
      .post('/api/integrations/hire-to-start/events')
      .set('x-vitalcv-key-id', 'd1111111-1111-4111-8111-111111111111')
      .set('x-vitalcv-timestamp', '1786737600')
      .set('x-vitalcv-signature', `v1=${'b'.repeat(64)}`)
      .send(event)
      .expect(200);
  });
});
