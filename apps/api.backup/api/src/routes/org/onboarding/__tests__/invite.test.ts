import request from 'supertest';
import express from 'express';
import onboardingInviteRouter from '../invite';

const createOrgOnboardingRequest = jest.fn();
const attachAutoAnalysisResult = jest.fn();
const route = jest.fn();

jest.mock('../../../../../../../services/org/models/OrgOnboardingRequest.ts', () => ({
  createOrgOnboardingRequest: (payload: any) => createOrgOnboardingRequest(payload),
  attachAutoAnalysisResult: (id: string, result: any) =>
    attachAutoAnalysisResult(id, result),
}));

jest.mock('../../../../../../../services/agents/router.ts', () => ({
  __esModule: true,
  default: {
    route: (spec: any) => route(spec),
  },
}));

describe('POST /:orgId/onboarding/invite', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/org', onboardingInviteRouter);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates onboarding request and triggers auto-analysis', async () => {
    createOrgOnboardingRequest.mockResolvedValue({
      id: 'request-1',
      orgId: 'org-123',
      clinicianId: 'clinician-123',
      requiredPrivileges: [{ code: 'core' }],
      ehrSystem: 'Epic',
    });

    route.mockResolvedValue({
      taskId: 'org-onboarding-request-1',
      selectedAgent: 'openai-gpt4',
      reason: 'Capability match',
      timestamp: new Date(),
    });

    const response = await request(app)
      .post('/api/org/org-123/onboarding/invite')
      .send({
        clinicianId: 'clinician-123',
        requestedBy: 'admin-user',
        requiredPrivileges: ['core'],
        ehrSystem: 'Epic',
      });

    expect(response.status).toBe(201);
    expect(createOrgOnboardingRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicianId: 'clinician-123',
        orgId: 'org-123',
      })
    );
    expect(route).toHaveBeenCalled();
    expect(attachAutoAnalysisResult).toHaveBeenCalledWith(
      'request-1',
      expect.objectContaining({
        taskId: expect.any(String),
      })
    );
    expect(response.body.autoAnalysis.selectedAgent).toBe('openai-gpt4');
  });

  it('returns validation error for missing clinicianId', async () => {
    const response = await request(app)
      .post('/api/org/org-123/onboarding/invite')
      .send({
        requiredPrivileges: ['core'],
        ehrSystem: 'Epic',
      });

    expect(response.status).toBe(400);
    expect(createOrgOnboardingRequest).not.toHaveBeenCalled();
  });
});

