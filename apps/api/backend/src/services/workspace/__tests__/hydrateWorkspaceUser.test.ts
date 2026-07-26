// The Prisma schema declares no relations between User, PersonProfile,
// WorkspaceMembership, OrganizationProfile, or WorkspacePreference, so the
// workspace composite must be stitched from the real tables. These tests pin
// that stitch: profile resolved via userId, memberships via personProfileId,
// org profiles batched by id, and a membership whose org row is missing is
// dropped (fail closed) rather than surfaced as a workspace.
const prismaMock = {
  user: { findUnique: jest.fn() },
  personProfile: { findUnique: jest.fn() },
  workspacePreference: { findUnique: jest.fn(), create: jest.fn() },
  workspaceMembership: { findMany: jest.fn() },
  organizationProfile: { findMany: jest.fn() },
};

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: prismaMock,
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import {
  ensureWorkspacePreference,
  getHydratedWorkspaceUserByClerkUserId,
  hydrateWorkspaceUser,
} from '../workspaceService';

const baseUser = {
  id: 'user-1',
  clerkUserId: 'user_clerk1',
  email: 'clin@example.com',
  role: 'CLINICIAN',
  roleVersion: 1,
  status: 'ACTIVE',
  organizationId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
} as never;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('hydrateWorkspaceUser', () => {
  it('returns a null profile composite when no PersonProfile row exists', async () => {
    prismaMock.personProfile.findUnique.mockResolvedValue(null);
    prismaMock.workspacePreference.findUnique.mockResolvedValue(null);

    const result = await hydrateWorkspaceUser(baseUser);

    expect(result.personProfile).toBeNull();
    expect(result.workspacePreference).toBeNull();
    expect(prismaMock.personProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(prismaMock.workspaceMembership.findMany).not.toHaveBeenCalled();
  });

  it('stitches profile, memberships, and org profiles through the FK hops', async () => {
    prismaMock.personProfile.findUnique.mockResolvedValue({ id: 'profile-1', userId: 'user-1', npi: '1234567893' });
    prismaMock.workspacePreference.findUnique.mockResolvedValue({ id: 'pref-1', userId: 'user-1', activePersona: 'CLINICIAN' });
    prismaMock.workspaceMembership.findMany.mockResolvedValue([
      { id: 'm-1', personProfileId: 'profile-1', organizationProfileId: 'org-a', role: 'VERIFIER', active: true },
      { id: 'm-2', personProfileId: 'profile-1', organizationProfileId: 'org-b', role: 'ADMIN', active: false },
    ]);
    prismaMock.organizationProfile.findMany.mockResolvedValue([
      { id: 'org-a', organizationId: 'org-uuid-a' },
      { id: 'org-b', organizationId: 'org-uuid-b' },
    ]);

    const result = await hydrateWorkspaceUser(baseUser);

    expect(prismaMock.workspaceMembership.findMany).toHaveBeenCalledWith({
      where: { personProfileId: 'profile-1' },
      orderBy: { createdAt: 'asc' },
    });
    expect(prismaMock.organizationProfile.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['org-a', 'org-b'] } },
    });
    expect(result.personProfile?.memberships).toHaveLength(2);
    expect(result.personProfile?.memberships[0]).toMatchObject({
      id: 'm-1',
      organizationProfile: { id: 'org-a', organizationId: 'org-uuid-a' },
    });
    expect(result.workspacePreference).toMatchObject({ id: 'pref-1' });
  });

  it('drops a membership whose organization profile row is missing (fail closed)', async () => {
    prismaMock.personProfile.findUnique.mockResolvedValue({ id: 'profile-1', userId: 'user-1' });
    prismaMock.workspacePreference.findUnique.mockResolvedValue(null);
    prismaMock.workspaceMembership.findMany.mockResolvedValue([
      { id: 'm-1', personProfileId: 'profile-1', organizationProfileId: 'org-a', role: 'VERIFIER', active: true },
      { id: 'm-orphan', personProfileId: 'profile-1', organizationProfileId: 'org-gone', role: 'ADMIN', active: true },
    ]);
    prismaMock.organizationProfile.findMany.mockResolvedValue([
      { id: 'org-a', organizationId: 'org-uuid-a' },
    ]);

    const result = await hydrateWorkspaceUser(baseUser);

    expect(result.personProfile?.memberships).toHaveLength(1);
    expect(result.personProfile?.memberships[0].id).toBe('m-1');
  });
});

describe('ensureWorkspacePreference', () => {
  it('supplies an explicit id on create — workspace_preferences has no DB default (P2011 guard)', async () => {
    prismaMock.workspacePreference.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue(baseUser);
    prismaMock.personProfile.findUnique.mockResolvedValue(null);
    prismaMock.workspacePreference.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(data),
    );

    await ensureWorkspacePreference('user-1');

    expect(prismaMock.workspacePreference.create).toHaveBeenCalledTimes(1);
    const createData = prismaMock.workspacePreference.create.mock.calls[0][0].data;
    expect(createData.userId).toBe('user-1');
    expect(createData.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('getHydratedWorkspaceUserByClerkUserId', () => {
  it('returns null when no user row exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(getHydratedWorkspaceUserByClerkUserId('user_missing')).resolves.toBeNull();
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { clerkUserId: 'user_missing' },
    });
  });

  it('hydrates the composite for an existing user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(baseUser);
    prismaMock.personProfile.findUnique.mockResolvedValue(null);
    prismaMock.workspacePreference.findUnique.mockResolvedValue(null);

    const result = await getHydratedWorkspaceUserByClerkUserId('user_clerk1');

    expect(result?.id).toBe('user-1');
    expect(result?.personProfile).toBeNull();
  });
});
