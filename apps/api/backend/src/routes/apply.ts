/**
 * apply.ts — Wave 246: Apply-with-VitalCV Routes
 *
 * Routes:
 *   POST /api/apply/bundle          — generate apply bundle (clinician-auth)
 *   GET  /api/apply/bundle/:bundleId — retrieve bundle (public, employer-consumable)
 *   POST /api/apply/verify          — verify bundle integrity (public)
 */

import type { Express, NextFunction, Request, Response } from 'express';
import { generateApplyBundle, getApplyBundle, verifyBundle } from '../services/distribution/applyBundle';
import { HttpError } from '../utils/httpError';
import { log } from '../obs/logger';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function requireClerkUserId(req: Request): string {
  const id = (req.headers['x-clerk-user-id'] as string | undefined)?.trim();
  if (!id) throw new HttpError(401, 'Missing x-clerk-user-id header.');
  return id;
}

export function registerApplyRoutes(app: Express): void {
  /**
   * POST /api/apply/bundle
   * Generate a credential bundle for an NPI (clinician must be authenticated).
   * Body: { npi: string, selectiveClaims?: string[] }
   */
  app.post(
    '/api/apply/bundle',
    asyncHandler(async (req, res) => {
      requireClerkUserId(req); // auth check — throws 401 if missing
      const { npi, selectiveClaims } = req.body as {
        npi?: string;
        selectiveClaims?: string[];
      };

      if (!npi || typeof npi !== 'string') {
        throw new HttpError(400, 'npi is required.');
      }

      const bundle = await generateApplyBundle(npi, { selectiveClaims });
      res.status(201).json(bundle);
    }),
  );

  /**
   * GET /api/apply/bundle/:bundleId
   * Retrieve a generated bundle (public — for employer consumption).
   */
  app.get(
    '/api/apply/bundle/:bundleId',
    asyncHandler(async (req, res) => {
      const { bundleId } = req.params;
      const bundle = await getApplyBundle(bundleId);
      if (!bundle) {
        throw new HttpError(404, 'Bundle not found.');
      }

      // Return 410 Gone if expired
      if (new Date(bundle.expiresAt) < new Date()) {
        res.status(410).json({ error: 'Bundle has expired.', expiresAt: bundle.expiresAt });
        return;
      }

      res.json(bundle);
    }),
  );

  /**
   * POST /api/apply/verify
   * Verify bundle integrity and expiration.
   * Body: { bundleId: string, signature: string }
   */
  app.post(
    '/api/apply/verify',
    asyncHandler(async (req, res) => {
      const { bundleId, signature } = req.body as {
        bundleId?: string;
        signature?: string;
      };

      if (!bundleId || !signature) {
        throw new HttpError(400, 'bundleId and signature are required.');
      }

      const result = await verifyBundle(bundleId, signature);
      res.json(result);
    }),
  );

  log('info', 'apply_routes_registered', { routes: ['POST /api/apply/bundle', 'GET /api/apply/bundle/:bundleId', 'POST /api/apply/verify'] });
}
