/**
 * B141A-GOV-001: OrgRole model
 * Defines organization-level roles with granular permissions
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Built-in role definitions with their permissions
 */
export const BUILT_IN_ROLES = {
  OrgAdmin: {
    roleId: 'org_admin',
    name: 'Organization Admin',
    description: 'Full administrative access to organization settings and resources',
    permissions: [
      'org:*:*', // Wildcard for all org permissions
      'audit:export:read',
      'audit:export:write',
      'user:role:assign',
      'user:role:revoke',
      'settings:*:write',
      'policy:accept:write',
    ],
  },
  PrivilegeReviewer: {
    roleId: 'privilege_reviewer',
    name: 'Privilege Reviewer',
    description: 'Can review and approve clinical privilege requests',
    permissions: [
      'privilege:request:read',
      'privilege:request:review',
      'privilege:request:approve',
      'privilege:request:deny',
      'audit:export:read',
    ],
  },
  PayerAdmin: {
    roleId: 'payer_admin',
    name: 'Payer Admin',
    description: 'Manages payer enrollment and credentialing',
    permissions: [
      'payer:enrollment:read',
      'payer:enrollment:write',
      'payer:enrollment:submit',
      'payer:config:read',
      'audit:export:read',
    ],
  },
  ReadOnly: {
    roleId: 'read_only',
    name: 'Read Only',
    description: 'Read-only access to organization resources',
    permissions: [
      'org:config:read',
      'privilege:request:read',
      'payer:enrollment:read',
      'audit:export:read',
    ],
  },
} as const;

/**
 * Permission hierarchy for wildcard matching
 */
export function checkPermission(
  userPermissions: string[],
  requiredPermission: string
): boolean {
  for (const perm of userPermissions) {
    // Exact match
    if (perm === requiredPermission) {
      return true;
    }

    // Wildcard matching: org:*:* matches org:config:read
    if (perm.includes('*')) {
      const permParts = perm.split(':');
      const reqParts = requiredPermission.split(':');

      if (permParts.length !== reqParts.length) {
        continue;
      }

      const matches = permParts.every((part, idx) => {
        return part === '*' || part === reqParts[idx];
      });

      if (matches) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if user has all required permissions
 */
export function hasAllPermissions(
  userPermissions: string[],
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.every((required) =>
    checkPermission(userPermissions, required)
  );
}

/**
 * Seed built-in roles for an organization
 */
export async function seedBuiltInRoles(orgId: string) {
  const roles = [];

  for (const [key, roleConfig] of Object.entries(BUILT_IN_ROLES)) {
    const role = await prisma.orgRole.upsert({
      where: {
        orgId_roleId: {
          orgId,
          roleId: roleConfig.roleId,
        },
      },
      update: {
        name: roleConfig.name,
        description: roleConfig.description,
        permissions: roleConfig.permissions,
        isBuiltIn: true,
      },
      create: {
        orgId,
        roleId: roleConfig.roleId,
        name: roleConfig.name,
        description: roleConfig.description,
        permissions: roleConfig.permissions,
        isBuiltIn: true,
      },
    });

    roles.push(role);
  }

  return roles;
}

/**
 * Get all roles for an organization
 */
export async function getOrgRoles(orgId: string) {
  return await prisma.orgRole.findMany({
    where: { orgId },
    include: {
      userRoles: {
        where: { isActive: true },
        select: {
          userId: true,
          assignedAt: true,
        },
      },
    },
    orderBy: [{ isBuiltIn: 'desc' }, { name: 'asc' }],
  });
}

/**
 * Get role by ID with permission check
 */
export async function getOrgRoleById(roleId: string) {
  return await prisma.orgRole.findUnique({
    where: { id: roleId },
    include: {
      userRoles: {
        where: { isActive: true },
      },
    },
  });
}

/**
 * Create custom role (not built-in)
 */
export async function createCustomRole(
  orgId: string,
  roleId: string,
  name: string,
  permissions: string[],
  description?: string
) {
  return await prisma.orgRole.create({
    data: {
      orgId,
      roleId,
      name,
      description,
      permissions,
      isBuiltIn: false,
    },
  });
}

/**
 * Update role permissions (custom roles only)
 */
export async function updateRolePermissions(
  roleId: string,
  permissions: string[]
) {
  const role = await prisma.orgRole.findUnique({
    where: { id: roleId },
  });

  if (!role) {
    throw new Error('Role not found');
  }

  if (role.isBuiltIn) {
    throw new Error('Cannot modify built-in roles');
  }

  return await prisma.orgRole.update({
    where: { id: roleId },
    data: { permissions },
  });
}

/**
 * Delete custom role
 */
export async function deleteCustomRole(roleId: string) {
  const role = await prisma.orgRole.findUnique({
    where: { id: roleId },
  });

  if (!role) {
    throw new Error('Role not found');
  }

  if (role.isBuiltIn) {
    throw new Error('Cannot delete built-in roles');
  }

  return await prisma.orgRole.delete({
    where: { id: roleId },
  });
}

