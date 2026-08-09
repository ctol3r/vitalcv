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
  '/api/opportunities',
  '/api/candidates',
] as const;

export function isIntelligenceReadRoute(path: string): boolean {
  const normalized = path.split('?')[0].toLowerCase();
  return INTELLIGENCE_READ_PREFIXES.some(
    (prefix) => normalized.startsWith(prefix) || normalized === prefix,
  );
}

function normalizePath(path: string): string {
  const normalized = path.split('?')[0]?.toLowerCase() ?? '';
  if (normalized.length <= 1) {
    return normalized || '/';
  }

  return normalized.replace(/\/+$/, '');
}

/**
 * Paths that must never skip tenant context, checked before any allow rule.
 *
 * The allow list below is a *read* list — its own header says write routes
 * under these prefixes "must enforce org separately". `/api/directory/publish`
 * never did: it mints an integrity-hashed, federation-ready snapshot, and it
 * was reachable unauthenticated on the backend's public domain because
 * `/api/directory` is matched both by the explicit prefix rule and by
 * `isIntelligenceReadRoute`. Excluding it from one matcher would leave the
 * other open, so the deny rule runs first and covers both.
 *
 * This is a deny list, not a blanket "writes never skip" rule, because several
 * prefixes here (`/api/identity`, `/api/profile/`, `/api/apply/`, `/api/ingest`)
 * carry onboarding writes that legitimately have no org context yet — blocking
 * those would dead-end the signup golden path.
 */
const NEVER_SKIP_TENANT_CONTEXT = [
  '/api/directory/publish',
] as const;

export function shouldSkipTenantContext(path: string): boolean {
  const normalized = normalizePath(path);
  const isAuthorizedPacketRead = /^\/api\/applications\/[^/]+\/packet$/.test(normalized);

  if (NEVER_SKIP_TENANT_CONTEXT.includes(normalized as typeof NEVER_SKIP_TENANT_CONTEXT[number])) {
    return false;
  }

  return (
    normalized === '/'
    || normalized === '/health'
    || normalized === '/readyz'
    || normalized === '/metrics/public'
    || normalized.startsWith('/impact/')
    || normalized === '/verifier'
    || normalized === '/verify'
    || normalized.startsWith('/psv')
    || normalized.startsWith('/identity')
    || normalized.startsWith('/api/identity')
    // Role bootstrap: resolves a user by Clerk id alone (no org context yet).
    // Same rationale as /api/identity — a first-time signed-in user has no org
    // when the middleware asks "what role is this?", so requiring tenant
    // context here 401s and dead-ends the entire signed-in experience.
    || normalized === '/api/me/role'
    // Clinician personal-profile intake family (npi/bootstrap, links,
    // work-auth, resume, self-attested, completeness, identity/email-otp):
    // every route here is scoped to the Clerk user alone and authenticates
    // itself via x-clerk-user-id → internal User.id resolution. These are
    // onboarding-time surfaces — a brand-new clinician has no org yet, so
    // requiring org context 401s the signup golden path at its first write
    // (launch blocker #4 e2e pins this). Same rationale as /api/me/role.
    || normalized.startsWith('/api/profile/')
    // Workspace bootstrap: resolves by Clerk user id alone (x-clerk-user-id
    // header) and *produces* the persona/org context the rest of the app runs
    // on. Requiring org context before the workspace lookup is a chicken-and-
    // egg 401 that dead-ends /holder ("Couldn't load your profile").
    || normalized === '/api/me/workspaces'
    || normalized === '/api/workspaces/switch'
    || normalized.startsWith('/demo')
    || normalized.startsWith('/.well-known')
    || normalized.startsWith('/api/.well-known')
    || normalized.startsWith('/api-docs')
    || normalized === '/openapi.json'
    || normalized.startsWith('/recognitions')
    || normalized.startsWith('/acceptances')
    || normalized.startsWith('/starts')
    || normalized.startsWith('/status')
    || normalized.startsWith('/trust-state')
    || normalized.startsWith('/ingest')
    || normalized.startsWith('/api/ingest')
    || normalized.startsWith('/api/public/profile/')
    || normalized.startsWith('/api/passport/')
    || normalized.startsWith('/api/employer-review/')
    || normalized.startsWith('/api/apply/')
    // Wave M: persisted readiness snapshots — public verifier reads by
    // capability id (every access audited; revoked fails closed in-route).
    || normalized.startsWith('/api/snapshot/')
    || normalized.startsWith('/api/trust-state/')
    || normalized.startsWith('/api/trust-decision/')
    || normalized.startsWith('/api/trust-proof/')
    || normalized.startsWith('/api/verify')
    || normalized.startsWith('/api/verifier/accept')
    // W3C Bitstring Status List revocation registry. Its entire audience is
    // unauthenticated verifiers dereferencing the `statusListCredential` URL
    // embedded in an issued VC, so requiring org context 401s exactly the
    // callers the route exists for — and that 401 also masked the fact that
    // the manager behind it was throwing (launch blocker #14). The response
    // is a public, non-tenant-scoped credential: an opaque bitstring with no
    // subject identifiers, already rate limited by `publicApiRateLimit`.
    || normalized === '/api/credentials/status-list'
    // ISSUER-10 — the issuer PSV receipt write boundary. A service-to-service
    // call from the web server, not a user in an organization: there is no org
    // context to require, and requiring one would 401 the only caller the
    // route has. It is on this list ONLY because it authenticates itself first
    // with a fail-closed shared secret (ISSUER_PSV_RECEIPT_WRITER_SECRET) —
    // unset means 403 for everyone, including dev. If that check is ever
    // loosened, this entry must come out with it.
    || normalized === '/api/internal/issuer/psv-receipts'
    || normalized.startsWith('/api/pilot')
    || normalized.startsWith('/api/metrics')
    || normalized.startsWith('/api/artifact')
    || normalized.startsWith('/api/ask')
    || normalized.startsWith('/api/copilot')
    || normalized.startsWith('/api/agents')
    || normalized.startsWith('/api/watch')
    || normalized.startsWith('/api/search')
    || normalized.startsWith('/api/employers')
    // Clinicians do not require an organization to read their own immutable
    // submission. This exact read route performs verified-identity, ownership,
    // employer-membership, and platform-admin authorization in its service.
    // Other /api/applications routes remain tenant guarded.
    || isAuthorizedPacketRead
    // MATCHA clinician demand-side surfaces: NPI-keyed scoring reads plus
    // Clerk-header-scoped intent/opportunity writes, called via the web
    // proxies before any org context exists (same posture as
    // /api/opportunities above). Marketplace routes (/api/marketplace/*)
    // intentionally stay behind the tenant guard.
    || normalized.startsWith('/api/matcha')
    || normalized.startsWith('/bundle')
    || normalized.startsWith('/api/issuer/')
    || normalized.startsWith('/api/poe/')
    || normalized.startsWith('/api/audit/')
    || normalized.startsWith('/api/intelligence/')
    || normalized === '/api/providers'
    || normalized.startsWith('/api/findings')
    || normalized.startsWith('/api/investigators')
    || normalized.startsWith('/api/storylines')
    || normalized.startsWith('/api/directory')
    || normalized === '/api/system-health'
    // E0 source-runtime transparency. Anyone may ask whether a source is
    // actually live — that is the whole point of publishing it, and the
    // homepage states per-lane cadence to visitors who have no account.
    //
    // Listed as two exact matches, NOT `startsWith('/api/system/')`. That
    // prefix would also open `/api/system/telemetry`, `/telemetry/pilot`,
    // `/pulse`, `/status` and the three `/trust-health` routes, none of which
    // are transparency surfaces. The near-miss above — `/api/system-health`
    // with a hyphen — is a different route and is why this gap existed.
    || normalized === '/api/system/source-runtime'
    || normalized.startsWith('/api/system/source-runtime/')
    || normalized.startsWith('/api/graph/')
    || normalized.startsWith('/api/investigation/')
    || normalized.startsWith('/api/provider-intelligence/')
    || normalized.startsWith('/api/integrity/')
    || isIntelligenceReadRoute(normalized)
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
  if (shouldSkipTenantContext(req.path)) {
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
