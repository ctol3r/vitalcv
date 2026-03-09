import type { Request } from 'express';

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import prisma from '../../../graphql/prisma_client';
import { resolveSearchRequestContext } from '../requestContext';

const prismaMock = prisma as unknown as {
  user: {
    findUnique: jest.Mock;
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
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      workspacePreference: {
        activePersona: 'VERIFIER',
        activeOrgId: 'org-1',
      },
      personProfile: {
        memberships: [
          {
            role: 'VERIFIER',
            organizationProfile: {
              organizationId: 'org-1',
            },
          },
        ],
      },
    });

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
