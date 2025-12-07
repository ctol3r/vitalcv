import { OrgOnboardingRequestStatus, PrismaClient } from '@prisma/client';
import {
  attachAutoAnalysisResult,
  createOrgOnboardingRequest,
  listOrgOnboardingRequestsForClinician,
  listOrgOnboardingRequestsForOrg,
  updateOrgOnboardingRequestStatus,
} from '../models/OrgOnboardingRequest';

const prisma = new PrismaClient();

describe('OrgOnboardingRequest model', () => {
  const clinicianUserId = 'org-onboard-user';
  const clinicianId = 'org-onboard-clinician';
  const orgId = 'org-onboard-org';
  let requestId: string;

  beforeAll(async () => {
    await prisma.orgOnboardingRequest.deleteMany({
      where: { clinicianId },
    });
    await prisma.partnerConfig.deleteMany({ where: { id: orgId } });
    await prisma.clinicianProfile.deleteMany({ where: { id: clinicianId } });
    await prisma.user.deleteMany({ where: { id: clinicianUserId } });

    await prisma.user.create({
      data: {
        id: clinicianUserId,
        email: `${clinicianUserId}@example.com`,
        name: 'Org Onboarding Tester',
        roles: [],
      },
    });

    await prisma.clinicianProfile.create({
      data: {
        id: clinicianId,
        userId: clinicianUserId,
        npi: '1098765432',
        specialty: 'Dermatology',
        state: 'NY',
      },
    });

    await prisma.partnerConfig.create({
      data: {
        id: orgId,
        partnerId: 'onboarding',
        partnerName: 'Onboarding Org',
        allowedOrigins: [],
        isActive: true,
        authType: 'bearer',
      },
    });
  });

  afterAll(async () => {
    await prisma.orgOnboardingRequest.deleteMany({
      where: { clinicianId },
    });
    await prisma.partnerConfig.deleteMany({ where: { id: orgId } });
    await prisma.clinicianProfile.deleteMany({ where: { id: clinicianId } });
    await prisma.user.deleteMany({ where: { id: clinicianUserId } });
    await prisma.$disconnect();
  });

  it('creates onboarding request with normalized privileges', async () => {
    const request = await createOrgOnboardingRequest({
      clinicianId,
      orgId,
      requestedBy: 'admin-user',
      requiredPrivileges: [
        'core-privileges',
        { code: 'cardio-special', name: 'Cardio Special' },
      ],
      ehrSystem: 'Epic',
      notes: 'High priority onboarding',
    });

    requestId = request.id;
    const privileges = request.requiredPrivileges as Array<Record<string, string>>;
    expect(privileges).toHaveLength(2);
    expect(privileges[0].code).toBe('core-privileges');
    expect(request.org.partnerName).toBe('Onboarding Org');
  });

  it('updates status through review lifecycle and attaches analysis', async () => {
    const inReview = await updateOrgOnboardingRequestStatus(
      requestId,
      OrgOnboardingRequestStatus.IN_REVIEW
    );
    expect(inReview.status).toBe(OrgOnboardingRequestStatus.IN_REVIEW);

    const analysisAttached = await attachAutoAnalysisResult(requestId, {
      taskId: 'task-123',
      result: { agentId: 'openai-gpt4', score: 0.92 },
    });
    expect(analysisAttached.autoAnalysisTaskId).toBe('task-123');

    const approved = await updateOrgOnboardingRequestStatus(
      requestId,
      OrgOnboardingRequestStatus.APPROVED
    );
    expect(approved.status).toBe(OrgOnboardingRequestStatus.APPROVED);

    await expect(
      updateOrgOnboardingRequestStatus(requestId, OrgOnboardingRequestStatus.PENDING)
    ).rejects.toThrow(/Cannot transition/);
  });

  it('lists requests by clinician and org', async () => {
    const clinicianRequests = await listOrgOnboardingRequestsForClinician(clinicianId);
    expect(clinicianRequests.length).toBeGreaterThan(0);

    const orgRequests = await listOrgOnboardingRequestsForOrg(orgId);
    expect(orgRequests[0].org.id).toBe(orgId);
  });
});

