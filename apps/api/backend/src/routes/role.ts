/**
 * role.ts — GET /api/me/role
 *
 * Resolves the VitalCV role for an authenticated Clerk user.
 * Called by the Next.js resolve-role proxy route during middleware fallback.
 *
 * Flow:
 *   1. Reads x-clerk-user-id + x-clerk-user-email headers (forwarded by Next.js server)
 *   2. Calls ensureWorkspaceUser() to upsert the User row in Prisma
 *   3. If user has a claimed NPI but role is still default CLINICIAN,
 *      infers role from NPI type (Type 1 → CLINICIAN, Type 2 → VERIFIER)
 *   4. Returns { role, userId }
 *
 * Wave A6 — Role inference from NPI ownership
 */
import type { Express, NextFunction, Request, Response } from 'express';
import { ensureWorkspaceUser } from '../services/workspace/workspaceService';
import { inferRoleFromNpi } from '../services/auth/roleInferenceService';
import { HttpError } from '../utils/httpError';
import { log } from '../obs/logger';
import prisma from '../graphql/prisma_client';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) return value[0];
  return undefined;
}

export function registerRoleRoutes(app: Express): void {
  /**
   * GET /api/me/role
   *
   * Returns { role: UserRole, userId: string, inferred?: boolean }
   * Requires: x-clerk-user-id header
   * Optional: x-clerk-user-email header (needed for first-time user creation)
   */
  app.get(
    '/api/me/role',
    asyncHandler(async (req: Request, res: Response) => {
      const clerkUserId = getHeaderValue(req.headers['x-clerk-user-id'])?.trim();
      if (!clerkUserId) {
        throw new HttpError(401, 'Missing x-clerk-user-id header.');
      }

      const clerkEmail = getHeaderValue(req.headers['x-clerk-user-email']);

      const user = await ensureWorkspaceUser(clerkUserId, clerkEmail);

      // ── Role inference from NPI ownership (Wave A6) ────────────────────
      // If user's role is the default CLINICIAN and they have a claimed NPI,
      // try to infer a more specific role from NPI type.
      let role = user.role;
      let inferred = false;

      if (role === 'CLINICIAN') {
        try {
          const ownership = await prisma.npiOwnership.findFirst({
            where: { userId: user.id, revokedAt: null },
            orderBy: { claimedAt: 'desc' },
          });

          if (ownership) {
            const inferredRole = await inferRoleFromNpi(ownership.npi);
            if (inferredRole !== 'CLINICIAN') {
              // Update the user's role — one-time inference
              await prisma.user.update({
                where: { id: user.id },
                data: { role: inferredRole },
              });
              role = inferredRole;
              inferred = true;
              log('info', 'role_auto_inferred', {
                userId: user.id,
                npi: ownership.npi,
                from: 'CLINICIAN',
                to: inferredRole,
              });
            }
          }
        } catch (err) {
          // Role inference is best-effort — don't block the response
          log('warn', 'role_inference_skipped', { userId: user.id, error: String(err) });
        }
      }

      res.json({
        role,
        userId: user.id,
        ...(inferred && { inferred: true }),
      });
    }),
  );
}
