/**
 * B248B-PARTNER-019: PartnerRoles & Permissions
 *
 * Defines roles: partnerUser, partnerAdmin, partnerManager (internal);
 * assigns permissions for reading/updating profiles, agreements, opportunities;
 * integrates with AuthZ middleware.
 */

export enum PartnerRole {
  PARTNER_USER = 'partnerUser',
  PARTNER_ADMIN = 'partnerAdmin',
  PARTNER_MANAGER = 'partnerManager', // Internal role
}

export enum PartnerPermission {
  // Profile permissions
  READ_PROFILE = 'partners:profile:read',
  UPDATE_PROFILE = 'partners:profile:update',

  // Agreement permissions
  READ_AGREEMENT = 'partners:agreement:read',
  UPDATE_AGREEMENT = 'partners:agreement:update',
  SIGN_AGREEMENT = 'partners:agreement:sign',

  // Opportunity permissions
  READ_OPPORTUNITY = 'partners:opportunity:read',
  CREATE_OPPORTUNITY = 'partners:opportunity:create',
  UPDATE_OPPORTUNITY = 'partners:opportunity:update',
  ASSIGN_OPPORTUNITY = 'partners:opportunity:assign',

  // Proposal permissions
  READ_PROPOSAL = 'partners:proposal:read',
  CREATE_PROPOSAL = 'partners:proposal:create',
  UPDATE_PROPOSAL = 'partners:proposal:update',
  SUBMIT_PROPOSAL = 'partners:proposal:submit',
  DECIDE_PROPOSAL = 'partners:proposal:decide',

  // Campaign permissions
  READ_CAMPAIGN = 'partners:campaign:read',
  CREATE_CAMPAIGN = 'partners:campaign:create',
  UPDATE_CAMPAIGN = 'partners:campaign:update',

  // Task permissions
  READ_TASK = 'partners:task:read',
  CREATE_TASK = 'partners:task:create',
  UPDATE_TASK = 'partners:task:update',
  ASSIGN_TASK = 'partners:task:assign',

  // Metrics permissions
  READ_METRICS = 'partners:metrics:read',
}

/**
 * Role to permissions mapping
 */
export const ROLE_PERMISSIONS: Record<PartnerRole, PartnerPermission[]> = {
  [PartnerRole.PARTNER_USER]: [
    PartnerPermission.READ_PROFILE,
    PartnerPermission.READ_AGREEMENT,
    PartnerPermission.READ_OPPORTUNITY,
    PartnerPermission.READ_PROPOSAL,
    PartnerPermission.CREATE_PROPOSAL,
    PartnerPermission.UPDATE_PROPOSAL,
    PartnerPermission.SUBMIT_PROPOSAL,
    PartnerPermission.READ_CAMPAIGN,
    PartnerPermission.READ_TASK,
    PartnerPermission.READ_METRICS,
  ],

  [PartnerRole.PARTNER_ADMIN]: [
    // All partner user permissions
    PartnerPermission.READ_PROFILE,
    PartnerPermission.READ_AGREEMENT,
    PartnerPermission.READ_OPPORTUNITY,
    PartnerPermission.READ_PROPOSAL,
    PartnerPermission.CREATE_PROPOSAL,
    PartnerPermission.UPDATE_PROPOSAL,
    PartnerPermission.SUBMIT_PROPOSAL,
    PartnerPermission.READ_CAMPAIGN,
    PartnerPermission.READ_TASK,
    PartnerPermission.READ_METRICS,
    // Plus admin permissions
    PartnerPermission.UPDATE_PROFILE,
    PartnerPermission.READ_AGREEMENT,
    PartnerPermission.UPDATE_AGREEMENT,
    PartnerPermission.SIGN_AGREEMENT,
    PartnerPermission.CREATE_OPPORTUNITY,
    PartnerPermission.UPDATE_OPPORTUNITY,
    PartnerPermission.CREATE_CAMPAIGN,
    PartnerPermission.UPDATE_CAMPAIGN,
    PartnerPermission.CREATE_TASK,
    PartnerPermission.UPDATE_TASK,
  ],

  [PartnerRole.PARTNER_MANAGER]: [
    // All permissions (internal role)
    PartnerPermission.READ_PROFILE,
    PartnerPermission.UPDATE_PROFILE,
    PartnerPermission.READ_AGREEMENT,
    PartnerPermission.UPDATE_AGREEMENT,
    PartnerPermission.SIGN_AGREEMENT,
    PartnerPermission.READ_OPPORTUNITY,
    PartnerPermission.CREATE_OPPORTUNITY,
    PartnerPermission.UPDATE_OPPORTUNITY,
    PartnerPermission.ASSIGN_OPPORTUNITY,
    PartnerPermission.READ_PROPOSAL,
    PartnerPermission.CREATE_PROPOSAL,
    PartnerPermission.UPDATE_PROPOSAL,
    PartnerPermission.SUBMIT_PROPOSAL,
    PartnerPermission.DECIDE_PROPOSAL,
    PartnerPermission.READ_CAMPAIGN,
    PartnerPermission.CREATE_CAMPAIGN,
    PartnerPermission.UPDATE_CAMPAIGN,
    PartnerPermission.READ_TASK,
    PartnerPermission.CREATE_TASK,
    PartnerPermission.UPDATE_TASK,
    PartnerPermission.ASSIGN_TASK,
    PartnerPermission.READ_METRICS,
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: PartnerRole,
  permission: PartnerPermission,
): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

/**
 * Check if user has permission (supports multiple roles)
 */
export function userHasPermission(
  userRoles: string[],
  permission: PartnerPermission,
): boolean {
  // Check if user has partnerManager role (internal, has all permissions)
  if (userRoles.includes(PartnerRole.PARTNER_MANAGER)) {
    return true;
  }

  // Check other partner roles
  for (const role of userRoles) {
    if (Object.values(PartnerRole).includes(role as PartnerRole)) {
      if (hasPermission(role as PartnerRole, permission)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: PartnerRole): PartnerPermission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if user can access partner resource
 * Partner users can only access their own partner's resources
 * Partner managers can access all partners
 */
export function canAccessPartnerResource(
  userRoles: string[],
  userPartnerId: string | null,
  resourcePartnerId: string,
): boolean {
  // Partner managers can access all
  if (userRoles.includes(PartnerRole.PARTNER_MANAGER)) {
    return true;
  }

  // Partner users can only access their own partner
  if (userPartnerId && userPartnerId === resourcePartnerId) {
    return true;
  }

  return false;
}

/**
 * Middleware helper to check permission
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

export function checkPermission(
  userRoles: string[],
  permission: PartnerPermission,
  userPartnerId: string | null = null,
  resourcePartnerId: string | null = null,
): PermissionCheckResult {
  // Check permission
  if (!userHasPermission(userRoles, permission)) {
    return {
      allowed: false,
      reason: `User does not have permission: ${permission}`,
    };
  }

  // Check partner access if resource is partner-specific
  if (resourcePartnerId && !canAccessPartnerResource(userRoles, userPartnerId, resourcePartnerId)) {
    return {
      allowed: false,
      reason: 'User cannot access resources for this partner',
    };
  }

  return { allowed: true };
}

