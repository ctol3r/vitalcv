import express from 'express';
import request from 'supertest';

jest.mock('../../middleware/platformAdmin', () => ({ ensurePlatformAdmin: jest.fn() }));
jest.mock('../../services/credential-ops/credentialOpsAuthorization', () => ({
  requireCredentialOpsOperator: jest.fn(),
  resolveCredentialOpsViewer: jest.fn(),
}));
jest.mock('../../services/credential-ops/credentialOpsService', () => ({
  activateCredentialOpsTemplate: jest.fn(),
  createCredentialOperationsCase: jest.fn(),
  createCredentialOpsTemplate: jest.fn(),
  listCredentialOperationsCases: jest.fn(),
  listCredentialOpsTemplates: jest.fn(),
  readCredentialOperationsCase: jest.fn(),
}));

import { ensurePlatformAdmin } from '../../middleware/platformAdmin';
import {
  requireCredentialOpsOperator,
  resolveCredentialOpsViewer,
} from '../../services/credential-ops/credentialOpsAuthorization';
import {
  createCredentialOperationsCase,
  readCredentialOperationsCase,
} from '../../services/credential-ops/credentialOpsService';
import { registerCredentialOpsRoutes } from '../credentialOps';

const CASE_ID = '11111111-1111-4111-8111-111111111111';
const TEMPLATE_ID = '22222222-2222-4222-8222-222222222222';
const SUBJECT_ID = '33333333-3333-4333-8333-333333333333';
const REAL_ORG = '44444444-4444-4444-8444-444444444444';
const FORGED_ORG = '55555555-5555-4555-8555-555555555555';

function buildApp() {
  const app = express();
  app.use((req, _res, next) => {
    const verified = req.headers['x-test-verified-user'];
    if (typeof verified === 'string') {
      (req as unknown as { verifiedAuth: unknown }).verifiedAuth = { verifiedUserId: verified };
    }
    next();
  });
  app.use(express.json());
  registerCredentialOpsRoutes(app);
  app.use((error: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status ?? 500).json({ error: error.message ?? 'error' });
  });
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  (ensurePlatformAdmin as jest.Mock).mockImplementation(async (_req, _res) => true);
  (requireCredentialOpsOperator as jest.Mock).mockResolvedValue({
    clerkUserId: 'operator-user',
    activeOrganizationId: REAL_ORG,
    activeMembershipRole: 'CREDENTIALING_SPECIALIST',
    activeOrganizationIds: [REAL_ORG],
    isPlatformAdmin: false,
  });
  (resolveCredentialOpsViewer as jest.Mock).mockResolvedValue({
    clerkUserId: 'viewer-user',
    activeOrganizationId: null,
    activeMembershipRole: null,
    activeOrganizationIds: [],
    isPlatformAdmin: false,
  });
});

it('creates a case in the server-derived tenant and ignores forged organization inputs', async () => {
  (createCredentialOperationsCase as jest.Mock).mockResolvedValue({
    created: true,
    case: { id: CASE_ID },
  });
  const response = await request(buildApp())
    .post('/api/credential-ops/cases')
    .set('x-test-verified-user', 'operator-user')
    .set('x-org-id', FORGED_ORG)
    .send({
      organizationId: FORGED_ORG,
      workflowTemplateId: TEMPLATE_ID,
      subjectEntityId: SUBJECT_ID,
      professionCode: 'MD',
      idempotencyKey: 'client-request-1',
    });

  expect(response.status).toBe(201);
  expect(createCredentialOperationsCase).toHaveBeenCalledWith(
    'operator-user',
    REAL_ORG,
    expect.not.objectContaining({ organizationId: expect.anything() }),
  );
});

it('returns 200 for an idempotent case retry', async () => {
  (createCredentialOperationsCase as jest.Mock).mockResolvedValue({
    created: false,
    case: { id: CASE_ID },
  });
  const response = await request(buildApp()).post('/api/credential-ops/cases').send({
    workflowTemplateId: TEMPLATE_ID,
    subjectEntityId: SUBJECT_ID,
    professionCode: 'MD',
    idempotencyKey: 'client-request-1',
  });
  expect(response.status).toBe(200);
});

it('passes the server-resolved viewer to the uniform case reader', async () => {
  (readCredentialOperationsCase as jest.Mock).mockResolvedValue({ id: CASE_ID });
  const response = await request(buildApp()).get(`/api/credential-ops/cases/${CASE_ID}`);
  expect(response.status).toBe(200);
  expect(readCredentialOperationsCase).toHaveBeenCalledWith(
    CASE_ID,
    expect.objectContaining({ clerkUserId: 'viewer-user' }),
  );
});

it('rejects malformed case identifiers before querying the service', async () => {
  const response = await request(buildApp()).get('/api/credential-ops/cases/not-a-uuid');
  expect(response.status).toBe(404);
  expect(readCredentialOperationsCase).not.toHaveBeenCalled();
});

it('does not let a forged admin header reach template creation', async () => {
  (ensurePlatformAdmin as jest.Mock).mockImplementation(async (_req, res: express.Response) => {
    res.status(401).json({ error: 'Verified platform administrator session required.' });
    return false;
  });
  const response = await request(buildApp())
    .post('/api/credential-ops/templates')
    .set('x-admin-key', 'anything')
    .send({});
  expect(response.status).toBe(401);
});
