import type { NextFunction, Request, Response } from 'express';
import {
  getAssertedOrganizationId,
  getRequestOrganizationId,
  resolveVerifiedOrganizationId,
} from './organizationContext';
import { isVerifiedPlatformAdmin } from './platformAdminContext';
import { env } from '../config/env';
import { log } from '../obs/logger';

export type TenantRequest = Request & {
  organizationId?: string;
  organizationBindingEnforced?: boolean;
};

export type OrgBindingMode = 'off' | 'shadow' | 'enforce';

/** Resolved per-request so an ops flag flip takes effect without a redeploy. */
export function getOrgBindingMode(): OrgBindingMode {
  return env().TENANT_ORG_BINDING;
}

/**
 * G1 org-context binding — the closure for "presence of a caller-supplied org
 * id is treated as authorization" (ASVS 14.5.4 / 4.1.2).
 *
 * `requireTenantContext` historically accepted ANY non-empty `x-org-id` or
 * `?organizationId=`. Both are caller-supplied, so every route behind the guard
 * was reachable by an anonymous caller who set one header. This binds org
 * context to the caller's VERIFIED membership instead, staged exactly like the
 * G1 verified-identity and G2 verifier-RBAC rollouts — a security control must
 * never silently no-op, and must never flip blind:
 *
 *   off      — no-op (default). Behaviour identical to before this landed.
 *   shadow   — resolve the verified org and compare it to what the caller
 *              asserted; log the outcome; NEVER block. This measures the
 *              break-set before enforce, which matters more here than it did
 *              for G1: the web tier itself asserts org ids that can never
 *              match a row (`vcv-system`, `demo-pilot-org-alpha`), and
 *              `Organization.id` is a uuid column, so those callers WILL be
 *              denied by enforce and must be migrated first.
 *   enforce  — org context comes ONLY from verified membership. The asserted
 *              value is ignored entirely; a caller who asserts an org they are
 *              not a member of gets 403, and one with no verified membership
 *              gets no org context at all (401 on org-required routes).
 *
 * Binding happens once, on the single global mount, and writes `organizationId`
 * onto the request — so every downstream reader (`getRequestOrganizationId`,
 * `enforceOrganizationMatch`, and the routes that scope queries by org)
 * transparently inherits verified data with no per-route refactor. Same
 * mechanism `verifiedIdentity` uses to rewrite `x-clerk-user-id`.
 */
export async function bindOrganizationContext(req: Request): Promise<
  { ok: true } | { ok: false; status: number; body: Record<string, string> }
> {
  const mode = getOrgBindingMode();
  if (mode === 'off') {
    return { ok: true };
  }

  const asserted = getAssertedOrganizationId(req);
  const verified = await resolveVerifiedOrganizationId(req);

  if (mode === 'shadow') {
    // Only log requests that would change behaviour under enforce. A request
    // asserting nothing and verifying to nothing is the uninteresting majority.
    if (asserted || verified) {
      const outcome = !verified
        ? (asserted ? 'would_deny_unverified' : 'no_org')
        : asserted === verified
          ? 'match'
          : asserted
            ? 'would_deny_mismatch'
            : 'would_bind_unasserted';
      if (outcome !== 'match' && outcome !== 'no_org') {
        log('warn', 'org_binding_shadow', {
          outcome,
          mode,
          path: req.path,
          method: req.method,
          // Never log the asserted value itself — it is attacker-controlled
          // input and would land in log storage verbatim.
          hasAsserted: Boolean(asserted),
          hasVerified: Boolean(verified),
        });
      }
    }
    return { ok: true };
  }

  // --- enforce ---
  (req as TenantRequest).organizationBindingEnforced = true;

  if (verified) {
    (req as TenantRequest).organizationId = verified;
    // Asserting a DIFFERENT org than the one you belong to is not a mistake to
    // silently correct — it is the exact shape of the attack. Refuse it.
    if (asserted && asserted !== verified) {
      log('warn', 'org_binding_rejected', {
        reason: 'asserted_org_mismatch',
        path: req.path,
        method: req.method,
      });
      return {
        ok: false,
        status: 403,
        body: {
          error: 'forbidden',
          error_description: 'Organization scope mismatch.',
        },
      };
    }
    return { ok: true };
  }

  // No verified membership → no org context. `organizationBindingEnforced`
  // stops `getRequestOrganizationId` falling back to the asserted value, so
  // org-required routes 401 below rather than honouring the header.
  return { ok: true };
}

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
  const isAuthorizedPacketRead = /^\/api\/applications\/[^/]+\/(packet|hire-to-start)$/.test(normalized);
  // The canonical decision family (/review, /workflow, /workflow-action) and
  // the clinician's own /withdraw authorize entirely in-route: verified Clerk
  // identity (requireVerifiedClerkUserId), the org-role guard, and org scope
  // derived server-side from membership (getOrgForVerifier → 404 cross-org).
  // The marketplace proxies forward verified identity but never an org header,
  // so leaving these behind the turnstile ships the entire employer decision
  // path inert — accept/reject/clarify/withdraw all die as
  // organization_context_required before routing, swallowed by their callers.
  // /activation is deliberately NOT here: it is orphaned by the joined-case
  // swap and stays guarded until deleted.
  const isAuthorizedDecisionRoute = /^\/api\/applications\/[^/]+\/(review|workflow|workflow-action|withdraw)$/.test(normalized);

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
    // Anchor-witness proof surface. Identical rationale to the status list
    // above, and the same failure it was fixed for: the entire audience is
    // unauthenticated third parties checking that VitalCV has not rewritten
    // or backdated its own receipt history, so requiring org context 401s
    // exactly the callers the routes exist for — which is what production
    // did until this entry landed. Every response is a bare hash, a status
    // string, an opaque RFC 3161 token, or a public key; assertHashOnlyAnchor
    // gates what reaches the table these read from, so there is no tenant
    // data here to scope.
    || normalized.startsWith('/api/ledger/')
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
    // submission. These exact read routes (/packet and the joined
    // /hire-to-start case, which delegates to the same packet reader) perform
    // verified-identity, ownership, employer-membership, and platform-admin
    // authorization in their service, answering 404 to foreign callers.
    // Without this entry the marketplace proxies — which forward verified
    // identity but never an org header — get organization_context_required
    // before routing, and the panels silently never render
    // (routes/__tests__/hireToStartReachability.test.ts pins reachability).
    // Other /api/applications routes remain tenant guarded.
    || isAuthorizedPacketRead
    // Decision-route family: see isAuthorizedDecisionRoute above. Pinned by
    // routes/__tests__/decisionRouteReachability.test.ts, which also pins that
    // unlisted siblings (e.g. /activation) stay guarded.
    || isAuthorizedDecisionRoute
    // The clinician's own application list: self-scoped, verified-identity
    // only (no org exists for most clinicians). Same reachability defect and
    // pin as the decision family.
    || normalized === '/api/clinician/applications'
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
    // Deploy-verification surface. It answers ONE question — which commit is
    // this container running — and the whole point is that the asker is an
    // outside monitor with no account: `scripts/verifyProduction.ts` (which
    // defaults to the API base and expects 200 here), or a human following the
    // production-promotion discipline in CLAUDE.md, which requires reading a
    // matching `/api/version` before promoting. Requiring org context 401s
    // both, and the failure is worse than a dead route because the 401 looks
    // like an auth problem rather than a missing skip-list entry: production
    // served `organization_context_required` here while `/health` answered 200
    // on the same host, so the service looked up and the check looked broken.
    //
    // The substitute anyone reaches for — `vitalcv.com/api/version` — is a
    // DIFFERENT service (a Next route on the web container) and says nothing
    // about the API deployment. It is not even the same schema: that route
    // returns commit/platform/environment/branch, which is what
    // `deploy-web.yml` → `scripts/deploy-smoke.mjs` asserts. The API's own
    // deploy gate (`deploy-api.yml`) asserts `git_sha` from `/health`, not
    // this route, so nothing in CI was watching this 401.
    //
    // Nothing here is tenant-scoped: the payload is buildVersion, commitHash,
    // nodeVersion and prismaVersion — four process-level constants, identical
    // for every caller, with no request, org or subject input. The web tier
    // already publishes the same commit SHA unauthenticated for the same
    // reason (apps/web/app/api/version/route.ts).
    //
    // Exact match, not a prefix: `/api/version` is the only route in this
    // family, and a `startsWith` would exempt any future `/api/version/*`
    // sight unseen.
    || normalized === '/api/version'
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
export async function requireTenantContextOrReadAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Binding runs for EVERY request, skip-listed or not. The allowlist waives
  // the *requirement* for org context; it does not make an asserted org id
  // trustworthy. Seven allowlisted routes still scope their reads by whatever
  // org the caller asserts (`/api/verify/:shareId`, `/api/artifact/bundle/:npi`,
  // `/api/pilot/report`, …), so binding only the non-skipped paths would leave
  // the bypass open on exactly the routes that answer without a 401 first.
  try {
    const binding = await bindOrganizationContext(req);
    if (!binding.ok) {
      res.status(binding.status).json(binding.body);
      return;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    log('error', 'org_binding_error', { path: req.path, method: req.method, error: message });
    // `shadow` and `off` are non-blocking by contract — an internal fault in
    // the observer must not become an outage. `enforce` fails closed.
    if (getOrgBindingMode() === 'enforce') {
      res.status(503).json({
        error: 'organization_binding_unavailable',
        error_description: 'Unable to resolve organization membership.',
      });
      return;
    }
  }

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

/**
 * S1 — platform-operator status, from a VERIFIED session's DB role.
 *
 * This used to be `parseRequestRole(req) === 'super-admin'`, i.e. the answer to
 * "is this caller a platform operator?" was "they said so". That header is
 * settable by anyone who can reach the API origin, so every privilege gated on
 * `isSuperAdminRequest` — the `enforceOrganizationMatch` cross-org bypass, the
 * org-role guard bypass, identity-binding refresh, cross-org trust widening —
 * was reachable without any authentication at all.
 *
 * The header is now a hint only. `bindPlatformAdmin` (mounted globally, right
 * after `verifiedIdentity`) resolves the verified Clerk subject to a `User` row
 * and requires role ADMIN / status ACTIVE. If that middleware did not run, the
 * answer is `false` — a guard that must have run in order to deny is not a
 * guard. See middleware/platformAdminContext.ts.
 */
function isSuperAdmin(req: Request): boolean {
  return isVerifiedPlatformAdmin(req);
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
