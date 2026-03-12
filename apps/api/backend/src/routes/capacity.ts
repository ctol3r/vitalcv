/**
 * capacity.ts — Wave 240
 *
 * Routes:
 *   GET /api/capacity/system         — system-wide capacity (public, no auth)
 *   GET /api/capacity/:organizationId — org capacity score (requires x-clerk-user-id)
 */

import type { Express, NextFunction, Request, Response } from 'express';
import {
  computeOrganizationCapacity,
  computeSystemCapacity,
} from '../services/capacity/capacityEngine';
import { HttpError } from '../utils/httpError';
import { log } from '../obs/logger';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);
}

function requireClerkUserId(req: Request): string {
  const id = (req.headers['x-clerk-user-id'] as string | undefined)?.trim();
  if (!id) throw new HttpError(401, 'Missing x-clerk-user-id header.');
  return id;
}

export function registerCapacityRoutes(app: Express): void {
  /**
   * GET /api/capacity/system
   * System-wide capacity snapshot — public, no auth required.
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
   * Per-organization capacity score — requires Clerk auth.
   */
  app.get(
    '/api/capacity/:organizationId',
    asyncHandler(async (req, res) => {
      requireClerkUserId(req);
      const { organizationId } = req.params;
      if (!organizationId?.trim()) {
        throw new HttpError(400, 'organizationId is required.');
      }

      try {
        const result = await computeOrganizationCapacity(organizationId.trim());
        res.json(result);
      } catch (err) {
        log('error', 'capacity_org_error', {
          organizationId,
          error: err instanceof Error ? err.message : 'unknown',
        });
        throw err;
      }
    }),
  );
}
