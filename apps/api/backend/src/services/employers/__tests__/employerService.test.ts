jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    organizationProfile: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { getEmployerBySlug } from '../employerService';

const prismaMock = prisma as unknown as {
  organizationProfile: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
};

function buildProfile(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: 'org-1',
    organization: {
      slug: 'mindbridge-health',
      name: 'MindBridge Health',
    },
    facilityType: null,
    tagline: null,
    specialties: [],
    statesCovered: [],
    website: null,
    description: 'Custom DB description',
    trustScore: 96,
    openRoles: 0,
    recentHires: 0,
    hiringStatus: 'HIRING_NOW',
    hiringTypes: [],
    timeToStart: null,
    timeToOnboard: null,
    clearToStartThreshold: null,
    payTransparency: false,
    payRange: null,
    requirements: [],
    verifiedSince: new Date('2024-01-01T00:00:00Z'),
    verified: true,
    ...overrides,
  };
}

describe('employerService', () => {
  beforeEach(() => {
    prismaMock.organizationProfile.findMany.mockReset();
    prismaMock.organizationProfile.findFirst.mockReset();
  });

  it('resolves by organization slug and overlays seeded details when db data is sparse', async () => {
    prismaMock.organizationProfile.findFirst.mockResolvedValue(buildProfile());

    const employer = await getEmployerBySlug('mindbridge-health');

    expect(employer).not.toBeNull();
    expect(employer?.slug).toBe('mindbridge-health');
    expect(employer?.trustScore).toBe(96);
    expect(employer?.specialtiesHired.length).toBeGreaterThan(0);
    expect(employer?.requirements.length).toBeGreaterThan(0);
    expect(employer?.overview.description).toBe('Custom DB description');
  });

  it('does not expose unverified non-seeded employers publicly', async () => {
    prismaMock.organizationProfile.findFirst.mockResolvedValue(buildProfile({
      organization: {
        slug: 'private-org',
        name: 'Private Org',
      },
      verified: false,
    }));

    const employer = await getEmployerBySlug('private-org');

    expect(employer).toBeNull();
  });
});
