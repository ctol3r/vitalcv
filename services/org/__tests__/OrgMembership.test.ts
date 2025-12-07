/**
 * B162C-MULTI-001: OrgMembership model tests
 */

import { OrgMembershipRole, PrismaClient } from '@prisma/client';
import {
  createOrgMembership,
  getOrgMembership,
  isOrgAdmin,
  listMembersForOrg,
  listMembershipsForUser,
  removeOrgMembership,
  upsertOrgMembership,
  updateOrgMembershipRole,
} from '../models/OrgMembership';

const prisma = new PrismaClient();

describe('OrgMembership Model', () => {
  const testUserId = 'org-membership-user-1';
  const testOrgId = 'org-membership-org-1';
  const secondOrgId = 'org-membership-org-2';

  beforeAll(async () => {
    // Ensure supporting user + partner config records exist for FK constraints
    await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        email: `${testUserId}@example.com`,
        name: 'Org Membership Tester',
        roles: [],
      },
    });

    const partnerPayloads = [
      { id: testOrgId, partnerId: `${testOrgId}-pid`, partnerName: 'Test Org Primary' },
      { id: secondOrgId, partnerId: `${secondOrgId}-pid`, partnerName: 'Test Org Secondary' },
    ];

    for (const payload of partnerPayloads) {
      await prisma.partnerConfig.upsert({
        where: { id: payload.id },
        update: {
          partnerName: payload.partnerName,
          isActive: true,
        },
        create: {
          id: payload.id,
          partnerId: payload.partnerId,
          partnerName: payload.partnerName,
          allowedOrigins: [],
          isActive: true,
          authType: 'bearer',
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.orgMembership.deleteMany({
      where: {
        userId: testUserId,
      },
    });

    await prisma.partnerConfig.deleteMany({
      where: {
        id: { in: [testOrgId, secondOrgId] },
      },
    });

    await prisma.user.deleteMany({
      where: { id: testUserId },
    });

    await prisma.$disconnect();
  });

  it('creates a membership with default VIEWER role', async () => {
    const membership = await createOrgMembership(testUserId, testOrgId);

    expect(membership).toBeDefined();
    expect(membership.userId).toBe(testUserId);
    expect(membership.orgId).toBe(testOrgId);
    expect(membership.role).toBe(OrgMembershipRole.VIEWER);
    expect(membership.org?.partnerName).toBe('Test Org Primary');
  });

  it('upserts membership and updates role', async () => {
    const updated = await upsertOrgMembership(testUserId, testOrgId, OrgMembershipRole.ADMIN);

    expect(updated.role).toBe(OrgMembershipRole.ADMIN);
    expect(await isOrgAdmin(testUserId, testOrgId)).toBe(true);

    const downgraded = await updateOrgMembershipRole(testUserId, testOrgId, OrgMembershipRole.REVIEWER);
    expect(downgraded.role).toBe(OrgMembershipRole.REVIEWER);
    expect(await isOrgAdmin(testUserId, testOrgId)).toBe(false);
  });

  it('lists memberships for a user', async () => {
    await upsertOrgMembership(testUserId, secondOrgId, OrgMembershipRole.VIEWER);

    const memberships = await listMembershipsForUser(testUserId);
    const orgIds = memberships.map((m) => m.orgId);

    expect(memberships.length).toBeGreaterThanOrEqual(2);
    expect(orgIds).toEqual(expect.arrayContaining([testOrgId, secondOrgId]));
  });

  it('lists members for an org filtered by role', async () => {
    const members = await listMembersForOrg(testOrgId);
    expect(members.length).toBeGreaterThan(0);

    const reviewers = await listMembersForOrg(testOrgId, OrgMembershipRole.REVIEWER);
    expect(reviewers.every((m) => m.role === OrgMembershipRole.REVIEWER)).toBe(true);
  });

  it('fetches and removes membership', async () => {
    const membership = await getOrgMembership(testUserId, secondOrgId);
    expect(membership).toBeDefined();
    expect(membership?.role).toBe(OrgMembershipRole.VIEWER);

    await removeOrgMembership(testUserId, secondOrgId);
    const afterDelete = await getOrgMembership(testUserId, secondOrgId);
    expect(afterDelete).toBeNull();
  });
});
