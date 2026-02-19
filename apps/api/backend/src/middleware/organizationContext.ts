import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../auth/jwt';

type OrganizationRequest = Request & {
  organizationId?: string;
};

type JwtPayloadShape = {
  organizationId?: unknown;
  organization_id?: unknown;
  organization?: {
    id?: unknown;
  };
  orgId?: unknown;
  org_id?: unknown;
  tenantId?: unknown;
  tenant_id?: unknown;
  tenant?: {
    id?: unknown;
  };
};

function parseOrganizationId(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return parseOrganizationId(value[0]);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOrganizationFromJwtToken(token: string): string | undefined {
  const [maybeBearer, maybeToken] = token.split(/\s+/);
  const bearerToken = maybeBearer && maybeBearer.toLowerCase() === 'bearer' ? maybeToken : token;
  if (!bearerToken) {
    return undefined;
  }

  try {
    const payload = verifyToken(bearerToken) as JwtPayloadShape;
    return (
      parseOrganizationId(payload.organizationId) ??
      parseOrganizationId(payload.organization_id) ??
      parseOrganizationId(payload.orgId) ??
      parseOrganizationId(payload.org_id) ??
      parseOrganizationId(payload.tenantId) ??
      parseOrganizationId(payload.tenant_id) ??
      parseOrganizationId((payload.organization && typeof payload.organization === 'object' && 'id' in payload.organization
        ? payload.organization.id
        : undefined)) ??
      parseOrganizationId((payload.tenant && typeof payload.tenant === 'object' && 'id' in payload.tenant ? payload.tenant.id : undefined))
    );
  } catch {
    return undefined;
  }
}

function parseOrganizationFromQuery(req: Request): string | undefined {
  return parseOrganizationId(req.query.organizationId);
}

function parseOrganizationFromHeader(req: Request): string | undefined {
  return parseOrganizationId(req.get('x-org-id'));
}

export function getRequestOrganizationId(req: Request): string | undefined {
  const attached = (req as OrganizationRequest).organizationId;
  if (typeof attached === 'string' && attached.trim().length > 0) {
    return attached.trim();
  }

  const fromJwt = parseOrganizationFromJwtToken(req.get('authorization') ?? '');
  if (fromJwt) {
    return fromJwt;
  }

  return parseOrganizationFromQuery(req) ?? parseOrganizationFromHeader(req);
}

export function requireOrganizationContext(req: Request, _res: Response, next: NextFunction): void {
  const organizationId = getRequestOrganizationId(req);
  if (organizationId) {
    (req as OrganizationRequest).organizationId = organizationId;
  }

  next();
}
