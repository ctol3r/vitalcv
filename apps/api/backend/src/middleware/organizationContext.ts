import type { NextFunction, Request, Response } from 'express';

type OrganizationRequest = Request & {
  organizationId?: string;
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

function parseOrganizationFromQuery(req: Request): string | undefined {
  return parseOrganizationId(req.query.organizationId);
}

function parseOrganizationFromHeader(req: Request): string | undefined {
  return parseOrganizationId(req.get('x-org-id'));
}

// Org context comes only from the pre-attached request, `?organizationId=`,
// or `x-org-id`. Authorization bearer tokens are deliberately NOT parsed:
// the legacy HS256 verifier here fell back to a hardcoded dev secret
// (ASVS 2.10.2, gap G6) and nothing in the platform mints such tokens —
// do not re-add a shared-secret token path. The query/header sources are
// unauthenticated and tracked as gap G1 (14.5.4 / 4.1.2).
export function getRequestOrganizationId(req: Request): string | undefined {
  const attached = (req as OrganizationRequest).organizationId;
  if (typeof attached === 'string' && attached.trim().length > 0) {
    return attached.trim();
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
