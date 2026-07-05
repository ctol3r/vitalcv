jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
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
  },
}));

import prisma from '../../../graphql/prisma_client';
import {
  getOrgProfile,
  upsertOrgProfile,
} from '../opportunityService';

const prismaMock = prisma as unknown as {
  user: { findUnique: jest.Mock };
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
};

describe('opportunityService org profile pilot policy', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockReset();
    prismaMock.personProfile.findUnique.mockReset();
    prismaMock.personProfile.create.mockReset();
    prismaMock.workspaceMembership.findFirst.mockReset();
    prismaMock.workspaceMembership.create.mockReset();
    prismaMock.organization.findUnique.mockReset();
    prismaMock.organization.update.mockReset();
    prismaMock.organization.create.mockReset();
    prismaMock.organizationProfile.update.mockReset();
    prismaMock.organizationProfile.findUnique.mockReset();
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
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
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
  });
});
