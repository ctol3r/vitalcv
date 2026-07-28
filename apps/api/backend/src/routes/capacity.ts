/**
 * capacity.ts — Wave 240
 *
 * Routes:
 *   GET /api/capacity/system          — system-wide capacity (public, aggregate)
 *   GET /api/capacity/:organizationId — capacity score for the CALLER's own org
 *
 * Trust contract:
 *   - The per-org score is competitively sensitive: open positions, pipeline
 *     depth, hires accepted this quarter, and review latency describe an
 *     employer's hiring posture. It is readable only by a member of that
 *     organization.
 *   - The org in the path is a caller-supplied value, so it is never used as
 *     the authorization scope. The caller's org is resolved from the membership
 *     store using their verified Clerk id, and the path must equal it. Anything
 *     else — a different org, a malformed id, a caller with no org — returns a
 *     uniform 404, so the endpoint cannot be used to enumerate organizations or
 *     to distinguish "not yours" from "does not exist".
 *   - Identity is the verified Clerk session, not `x-clerk-user-id`: that header
 *     is forgeable until CLERK_JWT_VERIFICATION reaches `enforce`, and it was
 *     the whole of the previous check.
 */

import type { Express, NextFunction, Request, Response } from 'express';
import {
  computeOrganizationCapacity,
  computeSystemCapacity,
} from '../services/capacity/capacityEngine';
import prisma from '../graphql/prisma_client';
import { HttpError } from '../utils/httpError';
import type { VerifiedAuth } from '../middleware/verifiedIdentity';
import { log } from '../obs/logger';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);
}

function requireVerifiedClerkUserId(req: Request): string {
  const verifiedUserId = (req as Request & { verifiedAuth?: VerifiedAuth })
    .verifiedAuth?.verifiedUserId?.trim();
  if (!verifiedUserId) {
    throw new HttpError(401, 'Verified Clerk session required.');
  }
  return verifiedUserId;
}

/** The caller's organization, from the membership store — never from a header
 *  or a path parameter. */
async function resolveCallerOrganizationId(clerkUserId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { organizationId: true },
  });
  return user?.organizationId ?? null;
}

export function registerCapacityRoutes(app: Express): void {
  /**
   * GET /api/capacity/system
   * System-wide capacity snapshot — public. Aggregate only; it names no
   * organization. Registered before the parameterised route so the literal
   * "system" segment cannot be captured as an organizationId.
   */
  app.get(
    '/api/capacity/system',
    asyncHandler(async (_req, res) => {
      const result = await computeSystemCapacity();
      res.json(result);
    }),
  );

  /**
   * GET /api/capacity/:organizationId
   * The caller's own organization capacity score.
   */
  app.get(
    '/api/capacity/:organizationId',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireVerifiedClerkUserId(req);
      const requested = req.params.organizationId?.trim();

      // Uniform 404 for every unauthorized shape. Note this also keeps a
      // malformed id away from Prisma: `organizationId` is a uuid column, so a
      // non-uuid string made `opportunity.count()` throw, and the handler
      // rethrew it into a 500 whose body carried the Prisma error code and
      // query shape. An id that is not the caller's own org never reaches a
      // query now.
      const callerOrganizationId = await resolveCallerOrganizationId(clerkUserId);
      if (!requested || !callerOrganizationId || requested !== callerOrganizationId) {
        log('warn', 'capacity_org_denied', {
          reason: !callerOrganizationId ? 'caller_has_no_org' : 'not_caller_org',
        });
        throw new HttpError(404, 'Organization not found.');
      }

      try {
        const result = await computeOrganizationCapacity(callerOrganizationId);
        res.json(result);
      } catch (err) {
        log('error', 'capacity_org_error', {
          error: err instanceof Error ? err.message : 'unknown',
        });
        throw err;
      }
    }),
  );
}
