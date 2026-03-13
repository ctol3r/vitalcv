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
    }));
  });

  it('persists pilot policy fields inside the organization requirements envelope', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prismaMock.personProfile.findUnique.mockResolvedValue({ id: 'person-1' });
    prismaMock.workspaceMembership.findFirst.mockResolvedValue({
      organizationProfileId: 'org-profile-1',
      organizationProfile: {
        organizationId: 'org-1',
        requirements: [{ label: 'Legacy requirement', level: 'L1' }],
        organization: { name: 'General Hospital' },
      },
    });
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
    });

    expect(prismaMock.organizationProfile.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'org-profile-1' },
      data: expect.objectContaining({
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
        }),
      }),
    }));
  });
});
