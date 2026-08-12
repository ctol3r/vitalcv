/**
 * platformAdminContext.ts — S1 closure for "a role header IS platform-operator
 * authorization".
 *
 * THE DEFECT
 * `tenantGuard#isSuperAdmin` answered from `x-user-role` / `x-verifier-role` /
 * `x-role`. Those are ordinary request headers on a public origin, so the whole
 * of `isSuperAdminRequest`'s authority — bypassing `enforceOrganizationMatch`,
 * bypassing the org-role guard, refreshing identity bindings, and widening
 * cross-org trust resolution — was available to anyone who could type a header
 * name. `verifiedIdentity` strips those headers, but ONLY on the anonymous
 * branch of `enforce`: a request that carries a verified token keeps them, so
 * even after the CLERK_JWT_VERIFICATION flip any signed-in account (a free
 * clinician signup) could still send `x-user-role: super-admin` and be a
 * platform operator. That residual is what this file closes, and it closes the
 * anonymous case at the same time.
 *
 * THE CLOSURE
 * Platform-operator status is a CONJUNCTION:
 *
 *   1. the caller asserted platform-operator context (the role header), AND
 *   2. the caller has a cryptographically verified Clerk session, AND
 *   3. that verified subject resolves to a `User` row with role ADMIN and
 *      status ACTIVE.
 *
 * (1) is a hint, never authorization — it is kept only so the legitimate
 * web-proxy path (`apps/web/lib/server/marketplace-proxy.ts` forwards
 * `x-user-role` from the verified Clerk session claims) is unchanged for a real
 * operator, and so the DB lookup costs nothing on the ~100% of requests that
 * never claim elevation. (3) is the same mechanism `middleware/platformAdmin.ts`
 * already uses for trust-root mutations; role is not membership and a header is
 * not a role.
 *
 * This is strictly a NARROWING. Every request that this grants was already
 * granted before; requests it now denies were never authenticated for the
 * privilege in the first place. There is no rollout flag: a mode whose non-
 * default settings restore an anonymous privilege escalation is a footgun, and
 * the rollback is a revert of this commit. What replaces the shadow window is
 * telemetry that fires on the enforcing path — every denial that the old code
 * would have allowed is logged as `platform_admin_binding_denied` with enough
 * shape to spot a real operator being broken, and nothing else changes for
 * anyone else.
 *
 * FAIL-CLOSED NOTES
 *   - No verified session (including CLERK_JWT_VERIFICATION=off, where
 *     `verifiedAuth` is never populated) → not a platform admin.
 *   - Lookup failure → not a platform admin. An authorization check that opens
 *     when its datastore is unavailable is not an authorization check.
 *   - Middleware not mounted → `platformAdmin` is undefined → not a platform
 *     admin. A guard that has to have run to deny is not a guard.
 */

import type { NextFunction, Request, Response } from 'express';
import type { UserRole, UserStatus } from '@prisma/client';

import { log } from '../obs/logger';
import type { VerifiedAuth } from './verifiedIdentity';

/**
 * Type-only import + checked assignment: the literals are validated against the
 * Prisma enums at compile time without pulling the generated client into this
 * module's runtime graph. This middleware sits on the global mount.
 */
const PLATFORM_ADMIN_ROLE: UserRole = 'ADMIN';
const PLATFORM_ADMIN_STATUS: UserStatus = 'ACTIVE';

/** The headers a caller can use to CLAIM platform-operator context. */
const ROLE_ASSERTION_HEADERS = ['x-user-role', 'x-verifier-role', 'x-role'] as const;
const SUPER_ADMIN_ROLE = 'super-admin';

export interface PlatformAdminBinding {
  /** The caller asserted `super-admin` via a role header. A hint, never authz. */
  asserted: boolean;
  /** Verified session + `User.role = ADMIN` + `User.status = ACTIVE`. */
  verified: boolean;
}

type PlatformAdminRequest = Request & { platformAdmin?: PlatformAdminBinding };

function normalizeRole(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Did the caller CLAIM platform-operator context? Exported so `tenantGuard` can
 * keep reporting the assertion separately from the authorization; nothing may
 * make an access decision on this alone.
 */
export function assertsPlatformAdmin(req: Request): boolean {
  for (const header of ROLE_ASSERTION_HEADERS) {
    // Express's `req.get` is case-insensitive and folds the array form.
    if (normalizeRole(req.get(header)) === SUPER_ADMIN_ROLE) return true;
  }
  return false;
}

// ─── Verified platform-admin resolution ─────────────────────────────────────

/**
 * Same short TTL as the org-membership cache in `organizationContext.ts`, and
 * for the same reason: a demotion or a suspension must take effect quickly, and
 * 30s bounds the staleness window while collapsing a burst into one query.
 */
const ADMIN_CACHE_TTL_MS = 30_000;
const ADMIN_CACHE_MAX = 1_000;
const adminCache = new Map<string, { isAdmin: boolean; expiresAt: number }>();

type AdminStore = {
  user: {
    findUnique: (args: {
      where: { clerkUserId: string };
      select: { role: true; status: true };
    }) => Promise<{ role: unknown; status: unknown } | null>;
  };
};

let adminStore: AdminStore | null = null;

function getAdminStore(): AdminStore {
  if (!adminStore) {
    // Lazy, for the same reason organizationContext.ts is lazy: this module is
    // on the global mount and a static import would instantiate a PrismaClient
    // in the module graph of everything that touches the tenant guard.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    adminStore = require('../graphql/prisma_client').default as AdminStore;
  }
  return adminStore;
}

/** Test seam — reset between cases so a cached answer cannot leak across tests. */
export function clearPlatformAdminCache(): void {
  adminCache.clear();
  adminStore = null;
}

async function resolveVerifiedPlatformAdmin(req: Request): Promise<boolean> {
  const verifiedUserId = (req as Request & { verifiedAuth?: VerifiedAuth })
    .verifiedAuth?.verifiedUserId?.trim();

  if (!verifiedUserId) return false;

  const cached = adminCache.get(verifiedUserId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.isAdmin;
  }

  let isAdmin = false;
  try {
    const actor = await getAdminStore().user.findUnique({
      where: { clerkUserId: verifiedUserId },
      select: { role: true, status: true },
    });
    isAdmin = actor?.role === PLATFORM_ADMIN_ROLE && actor?.status === PLATFORM_ADMIN_STATUS;
  } catch (err) {
    log('error', 'platform_admin_lookup_failed', {
      path: req.path,
      method: req.method,
      error: err instanceof Error ? err.message : String(err),
    });
    // Do NOT cache a failure: a transient outage must not pin a denial for 30s
    // once the datastore is back. Deny this request only.
    return false;
  }

  if (adminCache.size >= ADMIN_CACHE_MAX) {
    adminCache.clear();
  }
  adminCache.set(verifiedUserId, { isAdmin, expiresAt: Date.now() + ADMIN_CACHE_TTL_MS });
  return isAdmin;
}

/**
 * Global middleware. Mounted once, immediately after `verifiedIdentity`, so
 * every downstream reader of `isSuperAdminRequest` transparently gets a
 * verified answer with no per-route refactor — the same single-mount mechanism
 * `verifiedIdentity` and `bindOrganizationContext` use.
 */
export async function bindPlatformAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const asserted = assertsPlatformAdmin(req);

  if (!asserted) {
    (req as PlatformAdminRequest).platformAdmin = { asserted: false, verified: false };
    next();
    return;
  }

  const verified = await resolveVerifiedPlatformAdmin(req);
  (req as PlatformAdminRequest).platformAdmin = { asserted: true, verified };

  if (verified) {
    log('info', 'platform_admin_binding_granted', { path: req.path, method: req.method });
  } else {
    // The measurement that replaces a shadow window: every request the old
    // header-trusting code would have elevated, and no longer does. A real
    // operator broken by this shows up here immediately.
    //
    // Deliberately NOT logged: the asserted role value or any identifier. The
    // header is attacker-controlled input and would land in log storage
    // verbatim; `hadVerifiedSession` is the field that separates "an anonymous
    // prober" from "a signed-in account that is not an admin".
    log('warn', 'platform_admin_binding_denied', {
      path: req.path,
      method: req.method,
      hadVerifiedSession: Boolean(
        (req as Request & { verifiedAuth?: VerifiedAuth }).verifiedAuth?.verifiedUserId,
      ),
    });
  }

  next();
}

/**
 * The authorization answer. `true` only when the binding middleware ran AND
 * resolved a verified platform administrator.
 */
export function isVerifiedPlatformAdmin(req: Request): boolean {
  return (req as PlatformAdminRequest).platformAdmin?.verified === true;
}
