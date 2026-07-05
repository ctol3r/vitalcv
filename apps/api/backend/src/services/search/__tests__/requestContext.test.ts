import type { Request } from 'express';

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    personProfile: {
      findUnique: jest.fn(),
    },
    workspacePreference: {
      findUnique: jest.fn(),
    },
    workspaceMembership: {
      findMany: jest.fn(),
    },
    organizationProfile: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from '../../../graphql/prisma_client';
import { resolveSearchRequestContext } from '../requestContext';

const prismaMock = prisma as unknown as {
  user: {
    findUnique: jest.Mock;
  };
  personProfile: {
    findUnique: jest.Mock;
  };
  workspacePreference: {
    findUnique: jest.Mock;
  };
  workspaceMembership: {
    findMany: jest.Mock;
  };
  organizationProfile: {
    findMany: jest.Mock;
  };
};

function buildRequest(headers: Record<string, string> = {}, query: Record<string, string> = {}): Request {
  return {
    headers,
    query,
    get(name: string) {
      const value = headers[name.toLowerCase()] ?? headers[name];
      return value;
    },
  } as unknown as Request;
}

describe('resolveSearchRequestContext', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockReset();
    prismaMock.personProfile.findUnique.mockReset();
    prismaMock.workspacePreference.findUnique.mockReset();
    prismaMock.workspaceMembership.findMany.mockReset();
    prismaMock.organizationProfile.findMany.mockReset();
  });

  it('returns a public context for anonymous requests', async () => {
    const context = await resolveSearchRequestContext(buildRequest(), 'Find jobs');

    expect(context.aclLevel).toBe('PUBLIC');
    expect(context.isAuthenticated).toBe(false);
    expect(context.organizationId).toBeUndefined();
    expect(context.membershipRoles).toContain('PUBLIC');
    expect(context.queryHash).toBeDefined();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('derives verifier workspace context from active org preference', async () => {
    // No relations exist between these models — the workspace user is
    // stitched from the four tables by hydrateWorkspaceUser().
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prismaMock.personProfile.findUnique.mockResolvedValue({
      id: 'person-1',
      userId: 'user-1',
    });
    prismaMock.workspacePreference.findUnique.mockResolvedValue({
      activePersona: 'VERIFIER',
      activeOrgId: 'org-1',
    });
    prismaMock.workspaceMembership.findMany.mockResolvedValue([
      {
        id: 'membership-1',
        personProfileId: 'person-1',
        organizationProfileId: 'org-profile-1',
        role: 'VERIFIER',
        active: true,
      },
    ]);
    prismaMock.organizationProfile.findMany.mockResolvedValue([
      {
        id: 'org-profile-1',
        organizationId: 'org-1',
      },
    ]);

    const context = await resolveSearchRequestContext(
      buildRequest({ 'x-clerk-user-id': 'clerk_123' }),
      'What does Kaiser require?',
    );

    expect(context.isAuthenticated).toBe(true);
    expect(context.aclLevel).toBe('VERIFIER');
    expect(context.organizationId).toBe('org-1');
    expect(context.membershipRoles).toContain('VERIFIER');
    expect(context.membershipRoles).toContain('AUTHENTICATED');
  });
});
