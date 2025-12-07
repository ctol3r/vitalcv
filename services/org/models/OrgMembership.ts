/**
 * B162C-MULTI-001: OrgMembership model
 * Role-aware user ↔ org memberships with ADMIN/REVIEWER/VIEWER roles
 */

import { OrgMembershipRole, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type OrgMembershipWithOrg = Awaited<ReturnType<typeof getOrgMembership>>;

/**
 * Upsert a membership for a user/org combination with the given role
 */
export async function upsertOrgMembership(
  userId: string,
  orgId: string,
  role: OrgMembershipRole = OrgMembershipRole.VIEWER
) {
  return prisma.orgMembership.upsert({
    where: {
      userId_orgId: {
        userId,
        orgId,
      },
    },
    update: {
      role,
    },
    create: {
      userId,
      orgId,
      role,
    },
    include: basicOrgSelect,
  });
}

/**
 * Create a membership (throws if duplicate)
 */
export async function createOrgMembership(
  userId: string,
  orgId: string,
  role: OrgMembershipRole = OrgMembershipRole.VIEWER
) {
  return prisma.orgMembership.create({
    data: {
      userId,
      orgId,
      role,
    },
    include: basicOrgSelect,
  });
}

/**
 * Update only the role for an existing membership
 */
export async function updateOrgMembershipRole(
  userId: string,
  orgId: string,
  role: OrgMembershipRole
) {
  return prisma.orgMembership.update({
    where: {
      userId_orgId: {
        userId,
        orgId,
      },
    },
    data: {
      role,
    },
    include: basicOrgSelect,
  });
}

/**
 * Remove membership for user/org
 */
export async function removeOrgMembership(userId: string, orgId: string) {
  return prisma.orgMembership.delete({
    where: {
      userId_orgId: {
        userId,
        orgId,
      },
    },
  });
}

/**
 * Fetch membership for user/org combo
 */
export async function getOrgMembership(userId: string, orgId: string) {
  return prisma.orgMembership.findUnique({
    where: {
      userId_orgId: {
        userId,
        orgId,
      },
    },
    include: basicOrgSelect,
  });
}

/**
 * List all memberships for a user ordered by creation time
 */
export async function listMembershipsForUser(userId: string) {
  return prisma.orgMembership.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'asc' }],
    include: basicOrgSelect,
  });
}

/**
 * List all members for an organization, optionally filtering by role
 */
export async function listMembersForOrg(orgId: string, role?: OrgMembershipRole) {
  return prisma.orgMembership.findMany({
    where: {
      orgId,
      ...(role ? { role } : {}),
    },
    orderBy: [{ createdAt: 'asc' }],
  });
}

/**
 * Check if user has membership in org with optional role filtering
 */
export async function userHasMembership(
  userId: string,
  orgId: string,
  roles?: OrgMembershipRole[]
) {
  const membership = await getOrgMembership(userId, orgId);
  if (!membership) {
    return false;
  }
  if (!roles || roles.length === 0) {
    return true;
  }
  return roles.includes(membership.role as OrgMembershipRole);
}

/**
 * Convenience helper to check for admin role
 */
export async function isOrgAdmin(userId: string, orgId: string) {
  return userHasMembership(userId, orgId, [OrgMembershipRole.ADMIN]);
}

const basicOrgSelect = {
  org: {
    select: {
      id: true,
      partnerId: true,
      partnerName: true,
    },
  },
};
