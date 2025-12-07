const log = getServiceLogger('interop/tefca/pou-enforcement');
/**
 * B121C-POU-023: TEFCA PoU view enforcement layer
 *
 * Role claims filter attrs; audit PoU per call
 *
 * Acceptance Criteria:
 * - role claims filter attrs
 * - audit PoU per call
 */

import { Request, Response, NextFunction } from 'express';
import { decodeJwt } from 'jose';
import {
import { getServiceLogger } from '../../logging/serviceLogger';
  PurposeOfUse,
  RequesterRole,
  validateFieldsAgainstAllowlist,
  validateRoleBasedPolicy,
  POU_FIELD_ALLOWLISTS,
} from '../../../apps/verifier-api/src/policies/pouPolicy';

/**
 * Extract role claims from VP token or request headers
 */
function extractRoleClaims(req: Request): {
  roles: RequesterRole[];
  pou: PurposeOfUse;
  userId?: string;
  did?: string;
} {
  // Try to extract from VP token in Authorization header
  const authHeader = req.headers.authorization;
  let vpToken: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    vpToken = authHeader.substring(7);
  } else if (req.body?.vp_token) {
    vpToken = req.body.vp_token;
  }

  let roles: RequesterRole[] = [];
  let userId: string | undefined;
  let did: string | undefined;

  if (vpToken) {
    try {
      const decoded = decodeJwt(vpToken);
      // Extract roles from VP token claims
      // In production, verify signature and extract from verified claims
      if (decoded.roles && Array.isArray(decoded.roles)) {
        roles = decoded.roles.filter((r): r is RequesterRole =>
          ['clinician', 'admin', 'verifier', 'auditor', 'system'].includes(r as string)
        ) as RequesterRole[];
      }
      userId = decoded.sub as string | undefined;
      did = decoded.did as string | undefined;
    } catch (error) {
      log.warn('[TEFCA PoU] Failed to decode VP token:', error);
    }
  }

  // Fallback to headers or body
  if (roles.length === 0) {
    const headerRole = req.headers['x-requester-role'] as RequesterRole;
    if (headerRole && ['clinician', 'admin', 'verifier', 'auditor', 'system'].includes(headerRole)) {
      roles = [headerRole];
    }
  }

  // Extract PoU from headers or body
  const pou = (req.headers['x-purpose-of-use'] as PurposeOfUse) ||
              (req.body?.purpose_of_use as PurposeOfUse) ||
              'TREATMENT'; // Default to TREATMENT

  return {
    roles: roles.length > 0 ? roles : ['verifier'], // Default role
    pou,
    userId,
    did,
  };
}

/**
 * Filter response attributes based on role and PoU
 */
function filterAttributesByPoU(
  data: any,
  pou: PurposeOfUse,
  role: RequesterRole
): any {
  const allowlist = POU_FIELD_ALLOWLISTS[pou];

  // If OTHER PoU with wildcard, return all data
  if (pou === 'OTHER' && allowlist.includes('*')) {
    return data;
  }

  // Recursively filter object based on allowlist
  function filterObject(obj: any, path: string = ''): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item, index) => filterObject(item, `${path}[${index}]`));
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    const filtered: any = {};

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = path ? `${path}.${key}` : key;

      // Check if field is allowed
      const isAllowed = allowlist.some(allowedField => {
        if (allowedField === '*') return true;
        if (allowedField === fieldPath) return true;
        // Prefix match
        if (allowedField.endsWith('.*') && fieldPath.startsWith(allowedField.slice(0, -2))) {
          return true;
        }
        // Reverse prefix match
        if (fieldPath.endsWith('.*') && allowedField.startsWith(fieldPath.slice(0, -2))) {
          return true;
        }
        return false;
      });

      if (isAllowed) {
        filtered[key] = filterObject(value, fieldPath);
      }
    }

    return filtered;
  }

  return filterObject(data);
}

/**
 * Audit PoU usage per call
 */
async function auditPoUCall(
  req: Request,
  pou: PurposeOfUse,
  role: RequesterRole,
  userId?: string,
  did?: string
): Promise<void> {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    endpoint: req.path,
    method: req.method,
    pou,
    role,
    userId,
    did,
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
  };

  // In production, write to audit log/database
  // For now, log to console
  log.info('[TEFCA PoU Audit]', JSON.stringify(auditEntry));

  // TODO: Write to audit database/event store
  // Example:
  // await prisma.auditEvent.create({
  //   data: {
  //     type: 'TEFCA_POU_ACCESS',
  //     subjectNpi: req.body?.npi,
  //     userId,
  //     data: auditEntry,
  //   },
  // });
}

/**
 * B121C-POU-023: TEFCA PoU view enforcement middleware
 *
 * - Extracts role claims from VP token or headers
 * - Validates role-based policy
 * - Filters response attributes based on PoU allowlist
 * - Audits PoU usage per call
 */
export function tefcaPouEnforcement(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract role claims and PoU
    const { roles, pou, userId, did } = extractRoleClaims(req);
    const role = roles[0]; // Use first role (in production, may need to handle multiple roles)

    // Validate role-based policy
    const requestedFields = req.body?.fields || [];
    const roleValidation = validateRoleBasedPolicy(pou, role, requestedFields);

    if (!roleValidation.valid) {
      return res.status(403).json({
        error: 'role_policy_violation',
        error_description: roleValidation.error,
        purpose_of_use: pou,
        requester_role: role,
        hint: `Role '${role}' is not authorized for PoU '${pou}' or exceeds field limits`,
      });
    }

    // Validate fields against PoU allowlist
    if (requestedFields.length > 0) {
      const fieldValidation = validateFieldsAgainstAllowlist(requestedFields, pou);
      if (!fieldValidation.valid) {
        return res.status(400).json({
          error: 'field_not_allowed',
          error_description: fieldValidation.error,
          purpose_of_use: pou,
          requester_role: role,
          denied_fields: fieldValidation.deniedFields,
          allowed_fields: fieldValidation.allowedFields,
        });
      }
    }

    // Attach PoU context to request for downstream use
    (req as any).pouContext = {
      pou,
      role,
      roles,
      userId,
      did,
      allowedFields: requestedFields.length > 0
        ? validateFieldsAgainstAllowlist(requestedFields, pou).allowedFields
        : POU_FIELD_ALLOWLISTS[pou],
    };

    // Audit PoU call
    auditPoUCall(req, pou, role, userId, did).catch(err => {
      log.error('[TEFCA PoU] Audit failed:', err);
      // Don't fail request if audit fails
    });

    // Intercept response to filter attributes
    const originalJson = res.json.bind(res);
    res.json = function(body: any) {
      // Filter response attributes based on PoU
      const filteredBody = filterAttributesByPoU(body, pou, role);
      return originalJson(filteredBody);
    };

    next();
  } catch (error) {
    log.error('[TEFCA PoU] Enforcement error:', error);
    return res.status(500).json({
      error: 'pou_enforcement_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get PoU audit summary
 * In production, this would query the audit database
 */
export function getPouAuditSummary(req: Request, res: Response) {
  // TODO: Query audit database for PoU usage statistics
  res.json({
    message: 'PoU audit summary endpoint - implementation pending',
    hint: 'This endpoint will return aggregated PoU usage statistics from audit logs',
  });
}

