/**
 * platformAdmin.ts — authorization for trust-root mutations (#950).
 *
 * WHAT THIS REPLACES
 * The trust-anchor and trust-registry mutation routes gated on the mere
 * PRESENCE of an `x-admin-key` header:
 *
 *   if (!req.headers['x-admin-key'] && !isSuperAdminRequest(req)) → 403
 *
 * The header was never compared to anything — there was no `ADMIN_KEY` in the
 * codebase for it to be compared against — so `x-admin-key: x` was admin. The
 * fallback branch was no better: `isSuperAdminRequest` resolves from the
 * caller-supplied `x-user-role` / `x-verifier-role` / `x-role` headers, which
 * `verifiedIdentity` only strips at `enforce`.
 *
 * The shared-secret path is removed rather than repaired. Nothing in the repo
 * ever sent `x-admin-key` — no web caller, script, or runbook — so it had no
 * legitimate producer, and adding a secret to authenticate a client that does
 * not exist would recreate the shape #553 deleted with the HS256 stack.
 *
 * WHAT AUTHORIZES INSTEAD
 * The explicit server-side platform-administrator mechanism already used by the
 * application packet read (`applicationPacketReadService.ts`): a
 * cryptographically verified Clerk session, resolved to a User row whose role
 * is ADMIN and whose status is ACTIVE. No request role, organization, or
 * membership header participates. A suspended admin does not pass.
 *
 * FAIL-CLOSED NOTES
 *   - `verifiedIdentity` populates `req.verifiedAuth` only at `shadow` or
 *     `enforce`. With CLERK_JWT_VERIFICATION `off` there is no verified caller
 *     and every guarded route 401s. That is intended: these endpoints revoke
 *     trust anchors and grant issuer capabilities.
 *   - A membership lookup failure denies (503). An authorization check that
 *     opens when its datastore is unavailable is not an authorization check.
 */

import type { Request, Response } from 'express';

import prisma from '../graphql/prisma_client';
import { UserRole, UserStatus } from '@prisma/client';
import { log } from '../obs/logger';
import type { VerifiedAuth } from './verifiedIdentity';

/**
 * Resolve and authorize a platform operator.
 *
 * Follows the `ensureEnabled(res)` idiom already used by these route modules:
 * writes the failure response itself and returns false, so a handler reads
 * `if (!(await ensurePlatformAdmin(req, res))) return;`. Never throws — an
 * async handler that rejects would surface as an unhandled rejection rather
 * than a denial.
 */
export async function ensurePlatformAdmin(req: Request, res: Response): Promise<boolean> {
  const verifiedUserId = (req as Request & { verifiedAuth?: VerifiedAuth })
    .verifiedAuth?.verifiedUserId?.trim();

  if (!verifiedUserId) {
    log('warn', 'platform_admin_denied', { reason: 'unverified', path: req.path, method: req.method });
    res.status(401).json({ error: 'Verified platform administrator session required.' });
    return false;
  }

  let actor: { role: unknown; status: unknown } | null;
  try {
    actor = await prisma.user.findUnique({
      where: { clerkUserId: verifiedUserId },
      select: { role: true, status: true },
    });
  } catch (err) {
    log('error', 'platform_admin_lookup_failed', {
      path: req.path,
      method: req.method,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(503).json({ error: 'Authorization unavailable.' });
    return false;
  }

  if (actor?.role !== UserRole.ADMIN || actor.status !== UserStatus.ACTIVE) {
    log('warn', 'platform_admin_denied', { reason: 'not_platform_admin', path: req.path, method: req.method });
    res.status(403).json({ error: 'Platform administrator access required.' });
    return false;
  }

  return true;
}
