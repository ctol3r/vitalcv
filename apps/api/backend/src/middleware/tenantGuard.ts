import type { NextFunction, Request, Response } from 'express';
import { getRequestOrganizationId } from './organizationContext';

export type TenantRequest = Request & {
  organizationId?: string;
};

const SUPER_ADMIN_ROLE = 'super-admin';

/**
 * Route prefixes that allow READ access without an org context.
 * Intelligence and investigation surfaces are multi-tenant read-only —
 * auth is forwarded via x-clerk-user-id header; org is NOT required.
 * Write/mutation routes under these prefixes must enforce org separately.
 */
const INTELLIGENCE_READ_PREFIXES = [
  '/api/intelligence',
  '/api/investigation',
  '/api/provider-intelligence',
  '/api/findings',
  '/api/investigators',
  '/api/storylines',
  '/api/graph',
  '/api/directory',
  '/api/providers',
] as const;

export function isIntelligenceReadRoute(path: string): boolean {
  const normalized = path.split('?')[0].toLowerCase();
  return INTELLIGENCE_READ_PREFIXES.some(
    (prefix) => normalized.startsWith(prefix) || normalized === prefix,
  );
}

/**
 * Org-optional middleware for intelligence/investigation READ routes.
 *
 * Rules:
 * - Routes matching INTELLIGENCE_READ_PREFIXES: skip org requirement.
 *   Allow userId OR no auth → READ access. OrgId attached if present (best-effort).
 * - All other routes: delegate to requireTenantContext (org required).
 *
 * Write routes within intelligence paths must call requireTenantContext directly.
 */
export function requireTenantContextOrReadAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isIntelligenceReadRoute(req.path)) {
    const organizationId = getRequestOrganizationId(req);
    if (organizationId) {
      (req as TenantRequest).organizationId = organizationId;
    }
    next();
    return;
  }

  requireTenantContext(req, res, next);
}

function normalizeRole(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function parseRequestRole(req: Request): string | null {
  return (
    normalizeRole(req.get('x-user-role')) ??
    normalizeRole(req.get('x-verifier-role')) ??
    normalizeRole(req.get('x-role'))
  );
}

function isSuperAdmin(req: Request): boolean {
  return parseRequestRole(req) === SUPER_ADMIN_ROLE;
}

export function isSuperAdminRequest(req: Request): boolean {
  return isSuperAdmin(req);
}

export function requireTenantContext(req: Request, res: Response, next: NextFunction): void {
  const organizationId = getRequestOrganizationId(req);

  if (!organizationId) {
    res.status(401).json({
      error: 'organization_context_required',
      error_description: 'Organization context is required.',
    });
    return;
  }

  (req as TenantRequest).organizationId = organizationId;
  next();
}

export function enforceOrganizationMatch(
  req: Request,
  res: Response,
  targetOrganizationId: string | null | undefined,
): boolean {
  if (isSuperAdmin(req)) {
    return true;
  }

  const normalizedTarget = typeof targetOrganizationId === 'string' ? targetOrganizationId.trim() : '';
  const requestOrganizationId = getRequestOrganizationId(req)?.trim() ?? '';

  if (!requestOrganizationId || !normalizedTarget || normalizedTarget !== requestOrganizationId) {
    res.status(403).json({
      error: 'forbidden',
      error_description: 'Organization scope mismatch.',
    });
    return false;
  }

  return true;
}
