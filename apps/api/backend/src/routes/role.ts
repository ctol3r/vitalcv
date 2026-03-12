/**
 * role.ts — GET /api/me/role
 *
 * Resolves the VitalCV role for an authenticated Clerk user.
 * Called by the Next.js resolve-role proxy route during middleware fallback.
 *
 * Flow:
 *   1. Reads x-clerk-user-id + x-clerk-user-email headers (forwarded by Next.js server)
 *   2. Calls ensureWorkspaceUser() to upsert the User row in Prisma
 *   3. Returns { role, userId }
 */
import type { Express, NextFunction, Request, Response } from 'express';
import { ensureWorkspaceUser } from '../services/workspace/workspaceService';
import { HttpError } from '../utils/httpError';

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
   * Returns { role: UserRole, userId: string }
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

      res.json({
        role: user.role,
        userId: user.id,
      });
    }),
  );
}
