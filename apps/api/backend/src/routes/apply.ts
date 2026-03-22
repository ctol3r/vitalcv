/**
 * apply.ts — Apply-with-VitalCV Routes
 *
 * Routes:
 *   POST   /api/apply/bundle           — generate bundle (clinician-auth)
 *   GET    /api/apply/bundle/:bundleId — retrieve bundle (public, employer-consumable)
 *   POST   /api/apply/verify           — verify bundle integrity (public)
 *   POST   /api/apply/share            — Sign & Share with org context (clinician-auth)
 *   GET    /api/apply/shares/:npi      — list shares for a clinician (clinician-auth)
 *   DELETE /api/apply/share/:shareId   — revoke a share (clinician-auth)
 */

import type { Express, NextFunction, Request, Response } from 'express';
import { generateApplyBundle, getApplyBundle, verifyBundle } from '../services/distribution/applyBundle';
import {
  shareBundle,
  listSharesForNpi,
  revokeShare,
  validateOrganizationContext,
  ShareValidationError,
} from '../services/distribution/applyShareService';
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

  // ── POST /api/apply/bundle ─────────────────────────────────────────────────
  app.post(
    '/api/apply/bundle',
    asyncHandler(async (req, res) => {
      requireClerkUserId(req);
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

  // ── GET /api/apply/bundle/:bundleId ────────────────────────────────────────
  app.get(
    '/api/apply/bundle/:bundleId',
    asyncHandler(async (req, res) => {
      const { bundleId } = req.params;
      const bundle = await getApplyBundle(bundleId);
      if (!bundle) throw new HttpError(404, 'Bundle not found.');
      if (new Date(bundle.expiresAt) < new Date()) {
        res.status(410).json({ error: 'Bundle has expired.', expiresAt: bundle.expiresAt });
        return;
      }
      res.json(bundle);
    }),
  );

  // ── POST /api/apply/verify ─────────────────────────────────────────────────
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

  // ── POST /api/apply/share ──────────────────────────────────────────────────
  /**
   * Sign & Share a bundle to a specific organization.
   *
   * Body: {
   *   npi: string,
   *   organization_context: {
   *     organization_id: string,
   *     name: string,
   *     callback_url?: string,
   *     purpose_of_use: string,
   *   },
   *   selectiveClaims?: string[],
   * }
   *
   * Returns: ShareResult — { success, shareId, bundleId, recipient, status,
   *                          sharedAt, expiresAt, bundleUrl,
   *                          webhookDelivered, emailSent }
   */
  app.post(
    '/api/apply/share',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const { npi, organization_context, selectiveClaims } = req.body as {
        npi?: string;
        organization_context?: unknown;
        selectiveClaims?: string[];
      };

      if (!npi || typeof npi !== 'string') {
        throw new HttpError(400, 'npi is required.');
      }

      let orgCtx;
      try {
        orgCtx = validateOrganizationContext(organization_context);
      } catch (err) {
        if (err instanceof ShareValidationError) {
          throw new HttpError(400, err.message);
        }
        throw err;
      }

      const result = await shareBundle(npi, clerkUserId, orgCtx, { selectiveClaims });
      res.status(201).json(result);
    }),
  );

  // ── GET /api/apply/shares/:npi ─────────────────────────────────────────────
  /**
   * List all shares for a clinician.
   * Returns array of ShareListEntry — summary of each share event.
   */
  app.get(
    '/api/apply/shares/:npi',
    asyncHandler(async (req, res) => {
      requireClerkUserId(req);
      const { npi } = req.params;
      if (!/^\d{10}$/.test(npi)) {
        throw new HttpError(400, 'npi must be a 10-digit NPI.');
      }
      const shares = await listSharesForNpi(npi);
      res.json({ shares });
    }),
  );

  // ── DELETE /api/apply/share/:shareId ──────────────────────────────────────
  /**
   * Revoke a specific share. Only the original sharer (by clerkUserId) can revoke.
   * The bundle itself is not deleted — it simply becomes marked revoked.
   * The public /apply/[bundleId] page should check share revocation status.
   */
  app.delete(
    '/api/apply/share/:shareId',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const { shareId } = req.params;

      let result;
      try {
        result = await revokeShare(shareId, clerkUserId);
      } catch (err) {
        if (err instanceof ShareValidationError) {
          throw new HttpError(400, err.message);
        }
        const coded = err as { statusCode?: number; message: string };
        if (coded.statusCode) {
          throw new HttpError(coded.statusCode, coded.message);
        }
        throw err;
      }

      res.json(result);
    }),
  );

  log('info', 'apply_routes_registered', {
    routes: [
      'POST   /api/apply/bundle',
      'GET    /api/apply/bundle/:bundleId',
      'POST   /api/apply/verify',
      'POST   /api/apply/share',
      'GET    /api/apply/shares/:npi',
      'DELETE /api/apply/share/:shareId',
    ],
  });
}
