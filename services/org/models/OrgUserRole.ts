/**
 * B141A-GOV-002: OrgUserRole model
 * Maps users to organization roles (supports multiple roles per user)
 */

import { PrismaClient } from '@prisma/client';
import { checkPermission, hasAllPermissions } from './OrgRole';

const prisma = new PrismaClient();

/**
 * Assign role to user
 */
export async function assignRoleToUser(
  userId: string,
  orgId: string,
  orgRoleId: string,
  assignedBy?: string,
  expiresAt?: Date
) {
  // Check if role exists
  const role = await prisma.orgRole.findUnique({
    where: { id: orgRoleId },
  });

  if (!role || role.orgId !== orgId) {
    throw new Error('Invalid role for this organization');
  }

  // Create or update assignment
  return await prisma.orgUserRole.upsert({
    where: {
      userId_orgId_orgRoleId: {
        userId,
        orgId,
        orgRoleId,
      },
    },
    update: {
      isActive: true,
      assignedBy,
      expiresAt,
      assignedAt: new Date(),
    },
    create: {
      userId,
      orgId,
      orgRoleId,
      assignedBy,
      expiresAt,
      isActive: true,
    },
    include: {
      orgRole: true,
    },
  });
}

/**
 * Revoke role from user
 */
export async function revokeRoleFromUser(
  userId: string,
  orgId: string,
  orgRoleId: string
) {
  return await prisma.orgUserRole.updateMany({
    where: {
      userId,
      orgId,
      orgRoleId,
    },
    data: {
      isActive: false,
    },
  });
}

/**
 * Get all active roles for a user in an organization
 */
export async function getUserRolesInOrg(userId: string, orgId: string) {
  const now = new Date();

  return await prisma.orgUserRole.findMany({
    where: {
      userId,
      orgId,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: {
      orgRole: true,
    },
    orderBy: {
      assignedAt: 'desc',
    },
  });
}

/**
 * Get all permissions for a user in an organization
 * Combines permissions from all active roles
 */
export async function getUserPermissionsInOrg(
  userId: string,
  orgId: string
): Promise<string[]> {
  const userRoles = await getUserRolesInOrg(userId, orgId);

  // Flatten all permissions from all roles
  const allPermissions = new Set<string>();

  for (const userRole of userRoles) {
    for (const permission of userRole.orgRole.permissions) {
      allPermissions.add(permission);
    }
  }

  return Array.from(allPermissions);
}

/**
 * Check if user has a specific permission in an organization
 */
export async function userHasPermission(
  userId: string,
  orgId: string,
  requiredPermission: string
): Promise<boolean> {
  const permissions = await getUserPermissionsInOrg(userId, orgId);
  return checkPermission(permissions, requiredPermission);
}

/**
 * Check if user has all required permissions in an organization
 */
export async function userHasAllPermissions(
  userId: string,
  orgId: string,
  requiredPermissions: string[]
): Promise<boolean> {
  const permissions = await getUserPermissionsInOrg(userId, orgId);
  return hasAllPermissions(permissions, requiredPermissions);
}

/**
 * Get all users with a specific role in an organization
 */
export async function getUsersWithRole(orgId: string, roleId: string) {
  const now = new Date();

  return await prisma.orgUserRole.findMany({
    where: {
      orgId,
      orgRoleId: roleId,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: {
      assignedAt: 'desc',
    },
  });
}

/**
 * Expire all roles for a user in an organization
 */
export async function expireAllUserRoles(userId: string, orgId: string) {
  return await prisma.orgUserRole.updateMany({
    where: {
      userId,
      orgId,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });
}

/**
 * Clean up expired role assignments
 */
export async function cleanupExpiredRoles() {
  const now = new Date();

  return await prisma.orgUserRole.updateMany({
    where: {
      isActive: true,
      expiresAt: {
        lte: now,
      },
    },
    data: {
      isActive: false,
    },
  });
}

/**
 * Get role assignment details
 */
export async function getRoleAssignment(
  userId: string,
  orgId: string,
  orgRoleId: string
) {
  return await prisma.orgUserRole.findUnique({
    where: {
      userId_orgId_orgRoleId: {
        userId,
        orgId,
        orgRoleId,
      },
    },
    include: {
      orgRole: true,
    },
  });
}

/**
 * Bulk assign roles to multiple users
 */
export async function bulkAssignRoles(
  userIds: string[],
  orgId: string,
  orgRoleId: string,
  assignedBy: string
) {
  const assignments = userIds.map((userId) =>
    assignRoleToUser(userId, orgId, orgRoleId, assignedBy)
  );

  return await Promise.all(assignments);
}

