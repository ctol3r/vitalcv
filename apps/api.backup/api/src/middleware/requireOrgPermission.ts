/**
 * B141A-GOV-003: Permission checks middleware
 * Enforces organization-level permission requirements for API routes
 */

import { Request, Response, NextFunction } from 'express';
import { userHasAllPermissions, userHasPermission } from '../../../../services/org/models/OrgUserRole';

/**
 * Extended request interface with user and org context
 */
export interface OrgPermissionRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
    roles?: string[];
  };
  orgId?: string;
}

/**
 * Middleware factory to require specific permissions
 *
 * @param permissions - Single permission or array of permissions required (ALL must be present)
 * @param options - Additional options for permission checking
 *
 * @example
 * router.get('/audit/export',
 *   requireOrgPermission(['audit:export:read']),
 *   async (req, res) => { ... }
 * );
 *
 * @example Multiple permissions required
 * router.post('/settings',
 *   requireOrgPermission(['org:config:write', 'settings:ehr:write']),
 *   async (req, res) => { ... }
 * );
 */
export function requireOrgPermission(
  permissions: string | string[],
  options?: {
    /**
     * If true, user needs ANY of the permissions (OR logic)
     * Default: false (requires ALL permissions)
     */
    anyOf?: boolean;
    /**
     * Custom error message
     */
    errorMessage?: string;
    /**
     * Function to extract orgId from request
     * Default: (req) => req.params.orgId || req.query.orgId || req.body.orgId
     */
    getOrgId?: (req: OrgPermissionRequest) => string | undefined;
  }
) {
  const permArray = Array.isArray(permissions) ? permissions : [permissions];

  return async (req: OrgPermissionRequest, res: Response, next: NextFunction) => {
    try {
      // 1. Check if user is authenticated
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const userId = req.user.id;

      // 2. Extract orgId from request
      const getOrgId = options?.getOrgId || defaultGetOrgId;
      const orgId = getOrgId(req);

      if (!orgId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Organization ID is required',
        });
      }

      // Store orgId in request for downstream use
      req.orgId = orgId;

      // 3. Check permissions
      let hasPermission: boolean;

      if (options?.anyOf) {
        // Check if user has ANY of the permissions
        hasPermission = false;
        for (const perm of permArray) {
          if (await userHasPermission(userId, orgId, perm)) {
            hasPermission = true;
            break;
          }
        }
      } else {
        // Check if user has ALL of the permissions
        hasPermission = await userHasAllPermissions(userId, orgId, permArray);
      }

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden',
          message:
            options?.errorMessage ||
            `Missing required permission(s): ${permArray.join(', ')}`,
          requiredPermissions: permArray,
          logic: options?.anyOf ? 'ANY_OF' : 'ALL_OF',
        });
      }

      // 4. Permission check passed, continue
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Error checking permissions',
      });
    }
  };
}

/**
 * Default function to extract orgId from request
 */
function defaultGetOrgId(req: OrgPermissionRequest): string | undefined {
  return (
    req.params.orgId ||
    (req.query.orgId as string) ||
    req.body?.orgId ||
    req.headers['x-org-id'] as string
  );
}

/**
 * Middleware to require ANY of the specified permissions (convenience wrapper)
 */
export function requireAnyOrgPermission(
  permissions: string[],
  options?: Omit<Parameters<typeof requireOrgPermission>[1], 'anyOf'>
) {
  return requireOrgPermission(permissions, { ...options, anyOf: true });
}

/**
 * Common permission combinations
 */
export const OrgPermissions = {
  // Admin permissions
  FULL_ADMIN: ['org:*:*'],

  // Audit permissions
  AUDIT_READ: ['audit:export:read'],
  AUDIT_EXPORT: ['audit:export:read', 'audit:export:write'],

  // Role management
  ROLE_ASSIGN: ['user:role:assign'],
  ROLE_REVOKE: ['user:role:revoke'],
  ROLE_MANAGE: ['user:role:assign', 'user:role:revoke'],

  // Settings management
  SETTINGS_READ: ['org:config:read'],
  SETTINGS_WRITE: ['org:config:write', 'settings:*:write'],
  EHR_CONFIG: ['settings:ehr:write'],
  TEFCA_CONFIG: ['settings:tefca:write'],
  BILLING_CONFIG: ['settings:billing:write'],

  // Privilege management
  PRIVILEGE_READ: ['privilege:request:read'],
  PRIVILEGE_REVIEW: ['privilege:request:read', 'privilege:request:review'],
  PRIVILEGE_APPROVE: ['privilege:request:approve', 'privilege:request:deny'],

  // Payer management
  PAYER_READ: ['payer:enrollment:read', 'payer:config:read'],
  PAYER_WRITE: ['payer:enrollment:write', 'payer:config:write'],
  PAYER_SUBMIT: ['payer:enrollment:submit'],

  // Policy management
  POLICY_ACCEPT: ['policy:accept:write'],
};

/**
 * Type-safe permission requirement helpers
 */

/** Require full admin access */
export const requireAdmin = () => requireOrgPermission(OrgPermissions.FULL_ADMIN);

/** Require audit export permissions */
export const requireAuditExport = () => requireOrgPermission(OrgPermissions.AUDIT_EXPORT);

/** Require role management permissions */
export const requireRoleManagement = () => requireOrgPermission(OrgPermissions.ROLE_MANAGE);

/** Require settings write permissions */
export const requireSettingsWrite = () => requireOrgPermission(OrgPermissions.SETTINGS_WRITE);

/** Require privilege review permissions */
export const requirePrivilegeReview = () => requireOrgPermission(OrgPermissions.PRIVILEGE_REVIEW);

/** Require payer admin permissions */
export const requirePayerAdmin = () => requireOrgPermission([...OrgPermissions.PAYER_WRITE, ...OrgPermissions.PAYER_SUBMIT]);

