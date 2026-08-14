jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    personProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    workspaceMembership: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    organizationProfile: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    opportunity: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    // Organization access governance: every authority decision is now durable
    // and emits an audit + outbox event, so this mock must model those writers
    // or upsertOrgProfile throws on an undefined delegate.
    organizationAccessRequest: {
      create: jest.fn(),
      update: jest.fn(),
    },
    auditEvent: { create: jest.fn() },
    outboxEvent: { upsert: jest.fn() },
    $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  },
}));

import prisma from '../../../graphql/prisma_client';
import {
  getOrgProfile,
  getPublicOpportunityById,
  updateOpportunity,
  upsertOrgProfile,
} from '../opportunityService';

const prismaMock = prisma as unknown as {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  personProfile: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
  workspaceMembership: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
  organization: {
    findUnique: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
  };
  organizationProfile: {
    update: jest.Mock;
    findUnique: jest.Mock;
  };
  opportunity: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  organizationAccessRequest: {
    create: jest.Mock;
    update: jest.Mock;
  };
  auditEvent: { create: jest.Mock };
  outboxEvent: { upsert: jest.Mock };
  $transaction: jest.Mock;
};

/**
 * Governance writers, reset per test. `create` must resolve an id — the access
 * request row is what the grant path later attaches the organization to.
 */
function resetGovernanceMocks() {
  prismaMock.organizationAccessRequest.create.mockReset().mockResolvedValue({ id: 'access-request-1' });
  prismaMock.organizationAccessRequest.update.mockReset().mockResolvedValue({});
  prismaMock.auditEvent.create.mockReset().mockResolvedValue({});
  prismaMock.outboxEvent.upsert.mockReset().mockResolvedValue({ id: 'outbox-1' });
}

describe('opportunityService org profile pilot policy', () => {
  beforeEach(() => {
    resetGovernanceMocks();
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.update.mockReset().mockResolvedValue({});
    prismaMock.personProfile.findUnique.mockReset();
    prismaMock.personProfile.create.mockReset();
    prismaMock.workspaceMembership.findFirst.mockReset();
    prismaMock.workspaceMembership.create.mockReset();
    prismaMock.organization.findUnique.mockReset();
    prismaMock.organization.update.mockReset();
    prismaMock.organization.create.mockReset();
    prismaMock.organizationProfile.update.mockReset();
    prismaMock.organizationProfile.findUnique.mockReset();
    prismaMock.opportunity.findUnique.mockReset();
    prismaMock.opportunity.findFirst.mockReset();
    prismaMock.opportunity.update.mockReset();
  });

  it('reads pilot policy fields from the requirements envelope', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prismaMock.personProfile.findUnique.mockResolvedValue({ id: 'person-1' });
    prismaMock.workspaceMembership.findFirst.mockResolvedValue({
      organizationProfileId: 'org-profile-1',
    });
    prismaMock.organizationProfile.findUnique.mockResolvedValue({
      organizationId: 'org-1',
      organization: { name: 'General Hospital' },
      facilityType: 'hospital',
      specialties: ['Cardiology'],
      statesCovered: ['CA'],
      tagline: 'Ready fast',
      description: 'Pilot profile',
      website: 'https://hospital.example',
      hiringTypes: ['FULL_TIME'],
      requirements: {
        requirements: [{ label: 'CA License', level: 'L2' }],
        pilotMode: true,
        organizationAcceptanceRules: {
          acceptL3CredentialsAutomatically: true,
          requirePsvOnlyForGaps: true,
        },
        trustAcceptanceContracts: {
          triggerDecisionCapsuleOnHire: true,
        },
        automationRules: {
          enabled: true,
          minReadinessScore: 68,
          requiredCredentials: ['CA License', 'Board Certification'],
          readyToInterviewThreshold: 88,
          autoAcceptThreshold: 94,
          notifyEmployer: true,
          notifyClinician: false,
        },
      },
    });

    const profile = await getOrgProfile('clerk-user-1');

    expect(profile).toEqual(expect.objectContaining({
      organizationId: 'org-1',
      pilotMode: true,
      requirements: [{ label: 'CA License', level: 'L2' }],
      organizationAcceptanceRules: {
        acceptL3CredentialsAutomatically: true,
        requirePsvOnlyForGaps: true,
      },
      trustAcceptanceContracts: {
        triggerDecisionCapsuleOnHire: true,
      },
      automationRules: {
        enabled: true,
        minReadinessScore: 68,
        requiredCredentials: ['CA License', 'Board Certification'],
        readyToInterviewThreshold: 88,
        autoAcceptThreshold: 94,
        notifyEmployer: true,
        notifyClinician: false,
      },
    }));
  });

  it('persists pilot policy fields inside the organization requirements envelope', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prismaMock.personProfile.findUnique.mockResolvedValue({ id: 'person-1' });
    prismaMock.workspaceMembership.findFirst.mockResolvedValue({
      organizationProfileId: 'org-profile-1',
    });
    prismaMock.organizationProfile.findUnique.mockResolvedValue({
      id: 'org-profile-1',
      organizationId: 'org-1',
      requirements: [{ label: 'Legacy requirement', level: 'L1' }],
    });
    prismaMock.organization.findUnique.mockResolvedValue(null);
    prismaMock.organization.update.mockResolvedValue({});
    prismaMock.organizationProfile.update.mockResolvedValue({});

    await upsertOrgProfile('clerk-user-1', {
      name: 'General Hospital',
      requirements: [{ label: 'CA License', level: 'L2' }],
      pilotMode: true,
      organizationAcceptanceRules: {
        acceptL3CredentialsAutomatically: true,
        requirePsvOnlyForGaps: true,
      },
      trustAcceptanceContracts: {
        triggerDecisionCapsuleOnHire: true,
      },
      automationRules: {
        enabled: true,
        minReadinessScore: 70,
        requiredCredentials: ['CA License', 'Board Certification'],
        readyToInterviewThreshold: 90,
        autoAcceptThreshold: 96,
        notifyEmployer: true,
        notifyClinician: true,
      },
    });

    expect(prismaMock.organizationProfile.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'org-profile-1' },
      data: expect.objectContaining({
        website: null,
        requirements: expect.objectContaining({
          requirements: [{ label: 'CA License', level: 'L2' }],
          pilotMode: true,
          organizationAcceptanceRules: {
            acceptL3CredentialsAutomatically: true,
            requirePsvOnlyForGaps: true,
          },
          trustAcceptanceContracts: {
            triggerDecisionCapsuleOnHire: true,
          },
          automationRules: {
            enabled: true,
            minReadinessScore: 70,
            requiredCredentials: ['CA License', 'Board Certification'],
            readyToInterviewThreshold: 90,
            autoAcceptThreshold: 96,
            notifyEmployer: true,
            notifyClinician: true,
          },
        }),
      }),
    }));
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { organizationId: 'org-1' },
    });
  });

  it('rejects placeholder employer domains before creating a public profile', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prismaMock.personProfile.findUnique.mockResolvedValue({ id: 'person-1' });
    prismaMock.workspaceMembership.findFirst.mockResolvedValue(null);

    await expect(upsertOrgProfile('clerk-user-1', {
      name: 'Placeholder Health',
      website: 'https://placeholder.example.com',
    })).rejects.toThrow('real employer domain');

    expect(prismaMock.organization.create).not.toHaveBeenCalled();
  });

  it('uses a canonical slug instead of a timestamped duplicate slug', async () => {
    // The create path grants admin membership, so it requires a work email at
    // the organization's own domain — the account email must match the website.
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'director@mindbridgehealth.com',
    });
    prismaMock.personProfile.findUnique.mockResolvedValue({ id: 'person-1' });
    prismaMock.workspaceMembership.findFirst.mockResolvedValue(null);
    prismaMock.organization.findUnique.mockResolvedValue(null);
    prismaMock.organization.create.mockResolvedValue({ id: 'org-1' });
    prismaMock.organizationProfile.findUnique.mockResolvedValue({ id: 'org-profile-1' });
    prismaMock.workspaceMembership.create.mockResolvedValue({});

    await upsertOrgProfile('clerk-user-1', {
      name: 'MindBridge Health, LLC',
      website: 'mindbridgehealth.com',
    });

    expect(prismaMock.organization.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'MindBridge Health, LLC',
        slug: 'mindbridge-health',
      }),
    }));
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { organizationId: 'org-1' },
    });
  });

  it('refuses to create an organization without work-domain authority', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'someone@gmail.com',
    });
    prismaMock.personProfile.findUnique.mockResolvedValue({ id: 'person-1' });
    prismaMock.workspaceMembership.findFirst.mockResolvedValue(null);

    await expect(upsertOrgProfile('clerk-user-1', {
      name: 'MindBridge Health, LLC',
      website: 'mindbridgehealth.com',
    })).rejects.toThrow('personal email address');

    expect(prismaMock.organization.create).not.toHaveBeenCalled();
  });

  it('persists an organization NPI when employer setup includes one', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prismaMock.personProfile.findUnique.mockResolvedValue({ id: 'person-1' });
    prismaMock.workspaceMembership.findFirst.mockResolvedValue({
      organizationProfileId: 'org-profile-1',
    });
    prismaMock.organizationProfile.findUnique.mockResolvedValue({
      id: 'org-profile-1',
      organizationId: 'org-1',
      requirements: [],
    });
    prismaMock.organization.findUnique.mockResolvedValue(null);
    prismaMock.organization.update.mockResolvedValue({});
    prismaMock.organizationProfile.update.mockResolvedValue({});

    await upsertOrgProfile('clerk-user-1', {
      name: 'General Hospital',
      npi: '1999999999',
    });

    expect(prismaMock.organizationProfile.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        npi: '1999999999',
      }),
    }));
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { organizationId: 'org-1' },
    });
  });
});

describe('getPublicOpportunityById', () => {
  beforeEach(() => {
    prismaMock.opportunity.findFirst.mockReset().mockResolvedValue(null);
  });

  it('allows direct detail reads to preserve an explicit closed state', async () => {
    await expect(getPublicOpportunityById(
      '11111111-1111-1111-1111-111111111111',
    )).resolves.toBeNull();

    expect(prismaMock.opportunity.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.not.objectContaining({ status: 'ACTIVE' }),
    }));
  });
});

describe('updateOpportunity', () => {
  const OPP_ID = '11111111-1111-1111-1111-111111111111';

  function mockOrgResolution() {
    // clerkUserId → user → personProfile → workspaceMembership → org profile → org-1
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prismaMock.personProfile.findUnique.mockResolvedValue({ id: 'person-1' });
    prismaMock.workspaceMembership.findFirst.mockResolvedValue({
      organizationProfileId: 'org-profile-1',
    });
    prismaMock.organizationProfile.findUnique.mockResolvedValue({
      id: 'org-profile-1',
      organizationId: 'org-1',
    });
  }

  beforeEach(() => {
    resetGovernanceMocks();
    prismaMock.user.findUnique.mockReset();
    prismaMock.personProfile.findUnique.mockReset();
    prismaMock.workspaceMembership.findFirst.mockReset();
    prismaMock.organizationProfile.findUnique.mockReset();
    prismaMock.opportunity.findUnique.mockReset();
    prismaMock.opportunity.update.mockReset();
  });

  it('404s when the opportunity does not exist', async () => {
    mockOrgResolution();
    prismaMock.opportunity.findUnique.mockResolvedValue(null);

    await expect(
      updateOpportunity('clerk-user-1', OPP_ID, { status: 'CLOSED' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.opportunity.update).not.toHaveBeenCalled();
  });

  it('403s when the opportunity belongs to another organization', async () => {
    mockOrgResolution();
    prismaMock.opportunity.findUnique.mockResolvedValue({ organizationId: 'someone-elses-org' });

    await expect(
      updateOpportunity('clerk-user-1', OPP_ID, { status: 'CLOSED' }),
    ).rejects.toMatchObject({ status: 403 });
    expect(prismaMock.opportunity.update).not.toHaveBeenCalled();
  });

  it('writes only the provided fields and returns the updated truth', async () => {
    mockOrgResolution();
    prismaMock.opportunity.findUnique.mockResolvedValue({ organizationId: 'org-1' });
    prismaMock.opportunity.update.mockResolvedValue({
      id: OPP_ID,
      organizationId: 'org-1',
      title: 'Updated Cardiologist',
      specialty: 'Cardiology',
      hiringType: 'perm',
      state: 'CA',
      payRange: null,
      payMin: null,
      payMax: null,
      employerType: null,
      startUrgency: null,
      requirementLevel: 'L1',
      description: null,
      remote: false,
      status: 'CLOSED',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-10T00:00:00.000Z'),
      organization: {
        name: 'Bay Area Cardiac Group',
        slug: 'bay-area-cardiac-group',
        organizationProfile: null,
      },
    });

    const result = await updateOpportunity('clerk-user-1', OPP_ID, {
      title: 'Updated Cardiologist',
      status: 'CLOSED',
    });

    // Ownership check ran against the org-scoped id.
    expect(prismaMock.opportunity.findUnique).toHaveBeenCalledWith({
      where: { id: OPP_ID },
      select: { organizationId: true },
    });
    // Partial patch: only the two provided keys are written — nothing else.
    expect(prismaMock.opportunity.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: OPP_ID },
      data: { title: 'Updated Cardiologist', status: 'CLOSED' },
    }));
    expect(result.status).toBe('CLOSED');
    expect(result.title).toBe('Updated Cardiologist');
  });
});
