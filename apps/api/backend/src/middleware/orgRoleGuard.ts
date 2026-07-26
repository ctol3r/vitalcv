/**
 * orgRoleGuard.ts — Verifier org-role RBAC enforcement (launch blocker #2).
 *
 * Closes the "no role check on mutating verifier routes" gap. The canonical
 * org-role vocabulary lives in apps/web/lib/verifier/orgRolesFoundation.ts
 * (admin | reviewer | read_only); this mirrors it on the backend and turns the
 * vocabulary into an actual guard.
 *
 * Rollout is env-gated via VERIFIER_RBAC_MODE, mirroring the verified-identity
 * rollout (G1 / CLERK_JWT_VERIFICATION):
 *   - off     (default) — no-op; zero behaviour change on merge.
 *   - shadow  — evaluate + structured-log the denials enforce *would* make,
 *               but allow the request through (observe before you enforce).
 *   - enforce — 403 on an insufficient or missing org-role.
 *
 * TRUST BOUNDARY — read before trusting this as a security control. The guard
 * reads the caller's org-role from the `x-org-role` request header. That header
 * is only trustworthy when a layer that has *verified* the caller sets it: the
 * Next.js proxy (which verifies the Clerk session) on the UI path today, and
 * the verified-identity middleware (G1, PR #589) once it reaches `enforce` and
 * strips/rewrites client-supplied identity headers. Until G1 is at enforce,
 * treat this as defense-in-depth for the UI path — NOT a hard boundary against
 * a crafted direct-to-backend request. Full sequence + honesty notes:
 * docs/security/verifier-rbac-rollout.md.
 */
import type { NextFunction, Request, Response } from 'express';
import { isSuperAdminRequest } from './tenantGuard';
import { log } from '../obs/logger';

/**
 * Mirrors the OrgRole union in apps/web/lib/verifier/orgRolesFoundation.ts.
 * Keep the two in sync — the web file is the canonical vocabulary.
 */
export type OrgRole = 'admin' | 'reviewer' | 'read_only';

export type RbacMode = 'off' | 'shadow' | 'enforce';

/**
 * Roles permitted to run verifier *mutations* (review an application, run a
 * workflow action, accept a credential presentation). `read_only` members are
 * intentionally excluded — the whole point of the role is view-without-mutate.
 */
export const VERIFIER_MUTATION_ROLES: readonly OrgRole[] = ['admin', 'reviewer'];

/** Headers a verified upstream may use to declare the caller's org-role. */
const ORG_ROLE_HEADERS = ['x-org-role', 'x-organization-role'] as const;

/** Resolve the rollout mode at call time (env is read per-request, so an ops
 * flag flip takes effect without a redeploy and tests can set it per-case). */
export function getRbacMode(): RbacMode {
  const raw = (process.env.VERIFIER_RBAC_MODE ?? '').trim().toLowerCase();
  if (raw === 'enforce' || raw === 'shadow') {
    return raw;
  }
  return 'off';
}

/** Map a raw header value onto the canonical OrgRole union, tolerating the
 * common synonyms an IdP or org-membership system might emit. */
function normalizeOrgRole(value: string | undefined | null): OrgRole | null {
  if (!value) {
    return null;
  }
  const v = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (v === 'admin' || v === 'owner') {
    return 'admin';
  }
  if (v === 'reviewer' || v === 'member' || v === 'editor') {
    return 'reviewer';
  }
  if (v === 'read_only' || v === 'readonly' || v === 'viewer') {
    return 'read_only';
  }
  return null;
}

export function parseRequestOrgRole(req: Request): OrgRole | null {
  for (const header of ORG_ROLE_HEADERS) {
    const role = normalizeOrgRole(req.get(header));
    if (role) {
      return role;
    }
  }
  return null;
}

/**
 * Express middleware factory: require the caller's org-role to be one of
 * `allowed`. Behaviour depends on VERIFIER_RBAC_MODE (see file header).
 */
export function requireOrgRole(allowed: readonly OrgRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const mode = getRbacMode();
    if (mode === 'off') {
      next();
      return;
    }

    // Platform operators (super-admin) bypass org-scoped role checks.
    if (isSuperAdminRequest(req)) {
      next();
      return;
    }

    const role = parseRequestOrgRole(req);
    const permitted = role !== null && allowed.includes(role);
    if (permitted) {
      next();
      return;
    }

    const detail = {
      mode,
      method: req.method,
      path: req.path,
      role: role ?? 'none',
      allowed: allowed.join(','),
    };

    if (mode === 'shadow') {
      // Observe-only: record what enforce would have blocked, then allow through.
      log('warn', 'verifier_rbac_shadow_would_block', detail);
      next();
      return;
    }

    // enforce
    log('warn', 'verifier_rbac_denied', detail);
    res.status(403).json({
      error: 'insufficient_org_role',
      error_description:
        role === null
          ? 'Your organization role could not be determined for this action.'
          : `Your organization role (${role}) is not permitted to perform this action.`,
    });
  };
}
