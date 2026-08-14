import { MembershipRole, UserRole, UserStatus } from '@prisma/client';
import type { Request } from 'express';

jest.mock('../../workspace/workspaceService', () => ({
  getHydratedWorkspaceUserByClerkUserId: jest.fn(),
}));

import { getHydratedWorkspaceUserByClerkUserId } from '../../workspace/workspaceService';
import {
  requireCredentialOpsOperator,
  resolveCredentialOpsViewer,
} from '../credentialOpsAuthorization';

const mockHydrate = getHydratedWorkspaceUserByClerkUserId as jest.MockedFunction<
  typeof getHydratedWorkspaceUserByClerkUserId
>;

function request(verifiedUserId?: string): Request {
  return {
    headers: {
      'x-org-id': 'forged-org',
      'x-org-role': 'ADMIN',
    },
    verifiedAuth: verifiedUserId ? { verifiedUserId } : undefined,
  } as unknown as Request;
}

function userFixture(input?: { role?: MembershipRole; activeOrgId?: string | null; twoMemberships?: boolean }) {
  const membership = (organizationId: string, role: MembershipRole) => ({
    id: `membership-${organizationId}`,
    personProfileId: 'person-id',
    organizationProfileId: `profile-${organizationId}`,
    role,
    active: true,
    invitedAt: null,
    acceptedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    organizationProfile: { id: `profile-${organizationId}`, organizationId },
  });
  const memberships = [membership('real-org', input?.role ?? MembershipRole.CREDENTIALING_SPECIALIST)];
  if (input?.twoMemberships) memberships.push(membership('second-org', MembershipRole.ADMIN));
  return {
    id: 'user-id',
    clerkUserId: 'verified-user',
    email: 'operator@example.test',
    role: UserRole.CLINICIAN,
    roleVersion: 1,
    status: UserStatus.ACTIVE,
    organizationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    personProfile: { memberships },
    workspacePreference: input?.activeOrgId === undefined
      ? null
      : { activeOrgId: input.activeOrgId },
  } as Awaited<ReturnType<typeof getHydratedWorkspaceUserByClerkUserId>>;
}

beforeEach(() => mockHydrate.mockReset());

it('fails closed without a cryptographically verified session despite forged headers', async () => {
  await expect(resolveCredentialOpsViewer(request())).rejects.toMatchObject({ status: 401 });
  expect(mockHydrate).not.toHaveBeenCalled();
});

it('derives the tenant and role from the active membership store', async () => {
  mockHydrate.mockResolvedValue(userFixture());
  const operator = await requireCredentialOpsOperator(request('verified-user'));
  expect(operator.activeOrganizationId).toBe('real-org');
  expect(operator.activeMembershipRole).toBe(MembershipRole.CREDENTIALING_SPECIALIST);
});

it('requires an explicit active workspace when multiple memberships exist', async () => {
  mockHydrate.mockResolvedValue(userFixture({ twoMemberships: true }));
  await expect(requireCredentialOpsOperator(request('verified-user'))).rejects.toMatchObject({ status: 409 });
});

it('refuses a HOLDER membership from mutating credential operations', async () => {
  mockHydrate.mockResolvedValue(userFixture({ role: MembershipRole.HOLDER }));
  await expect(requireCredentialOpsOperator(request('verified-user'))).rejects.toMatchObject({ status: 403 });
});
