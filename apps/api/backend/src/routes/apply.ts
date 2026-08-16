/**
 * apply.ts — Apply-with-VitalCV Routes
 *
 * Legacy bundle/share routes remain available. Phase 2 also registers the
 * canonical ParRequest-backed Apply Intent transaction routes through this
 * module so the application bootstrap has one Apply registration point.
 */

import type { Express, NextFunction, Request, Response } from 'express';
import { generateApplyBundle, verifyBundle } from '../services/distribution/applyBundle';
import {
  shareBundle,
  listSharesForNpi,
  revokeShare,
  readPublicBundle,
  validateOrganizationContext,
  ShareValidationError,
} from '../services/distribution/applyShareService';
import { HttpError } from '../utils/httpError';
import { requireVerifiedClerkUserId, requireNpiAuthorization } from '../middleware/verifiedActor';
import { resolveRecipientForOpportunity } from '../services/distribution/recipientResolution';
import { log } from '../obs/logger';
import { emitLearningEvent } from '../services/feedback/prismaEventStore';
import { registerApplyIntentRoutes } from './applyIntents';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

/**
 * C1 — every route below that discloses or revokes a clinician's evidence now
 * derives identity from the VERIFIED Clerk session JWT, never from the
 * browser-settable `x-clerk-user-id` header, and binds the acting user to the
 * requested NPI via NpiOwnership. A forged header cannot authorize a share,
 * and a signed-in user cannot act on another clinician's record.
 *
 * The old header-trusting helper is deliberately gone rather than left beside
 * the new one: a helper that reads a client header is a foot-gun on this file.
 */

export function registerApplyRoutes(app: Express): void {
  registerApplyIntentRoutes(app);

  app.post(
    '/api/apply/bundle',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireVerifiedClerkUserId(req);
      const { npi, selectiveClaims } = req.body as {
        npi?: string;
        selectiveClaims?: string[];
      };
      if (!npi || typeof npi !== 'string') {
        throw new HttpError(400, 'npi is required.');
      }
      await requireNpiAuthorization(clerkUserId, npi, req);
      const bundle = await generateApplyBundle(npi, { selectiveClaims });
      res.status(201).json(bundle);
    }),
  );

  app.get(
    '/api/apply/bundle/:bundleId',
    asyncHandler(async (req, res) => {
      const { bundleId } = req.params;
      // Anonymous capability URL. readPublicBundle fails closed on revocation as
      // well as expiry, so a revoked share stops serving the bundle.
      const result = await readPublicBundle(bundleId);
      if (result.outcome === 'not_found') throw new HttpError(404, 'Bundle not found.');
      if (result.outcome === 'expired') {
        res.status(410).json({ error: 'Bundle has expired.', expiresAt: result.expiresAt });
        return;
      }
      if (result.outcome === 'revoked') {
        res.status(410).json({ error: 'This share has been revoked.' });
        return;
      }
      res.json(result.bundle);
    }),
  );

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

  app.post(
    '/api/apply/share',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireVerifiedClerkUserId(req);
      const { npi, organization_context, selectiveClaims, opportunityId } = req.body as {
        npi?: string;
        organization_context?: unknown;
        selectiveClaims?: string[];
        /** C3 — when the share comes from a chosen listing, the recipient is
         *  resolved from it server-side rather than trusted from the body. */
        opportunityId?: string;
      };

      if (!npi || typeof npi !== 'string') {
        throw new HttpError(400, 'npi is required.');
      }

      // The share discloses THIS clinician's evidence — the caller must be
      // authorized for the NPI, not merely signed in.
      await requireNpiAuthorization(clerkUserId, npi, req);

      let orgCtx;
      try {
        orgCtx = validateOrganizationContext(organization_context);
      } catch (err) {
        if (err instanceof ShareValidationError) {
          throw new HttpError(400, err.message);
        }
        throw err;
      }

      /*
       * C3 — when an opportunity is named, the recipient is a FACT about that
       * listing, not a client assertion. resolveRecipientForOpportunity reads
       * the opportunity's real organization, refuses a mismatch against what
       * the client claimed, refuses a listing with no receiving organization,
       * and refuses one that is no longer active. The resolved values then
       * overwrite the client-supplied id and name.
       */
      if (opportunityId) {
        const recipient = await resolveRecipientForOpportunity(
          opportunityId,
          orgCtx.organization_id,
          orgCtx.purpose_of_use,
        );
        orgCtx = {
          ...orgCtx,
          organization_id: recipient.organizationId,
          name: recipient.organizationName,
          purpose_of_use: recipient.purposeOfUse,
        };
      }

      const result = await shareBundle(npi, clerkUserId, orgCtx, { selectiveClaims });

      emitLearningEvent({
        type: 'APPLICATION_SUBMITTED',
        providerId: npi,
        employerId: orgCtx.organization_id,
        metadata: { shareId: result.shareId, bundleId: result.bundleId },
        payload: {},
      });

      res.status(201).json(result);
    }),
  );

  // ── GET /api/apply/credentials/:npi ───────────────────────────────────────
  /**
   * C1 — the credential list the Apply modal selects from.
   *
   * The modal previously read `/api/trust-state/:npi`, which is anonymous
   * because the production homepage capsule needs it. But the modal renders
   * CREDENTIAL HOLDINGS — issuer, status, expiry — which is exactly the
   * compiled private state C2 exists to protect, so reaching it required no
   * session at all.
   *
   * This route serves the same shape behind the verified-and-bound contract.
   * The homepage's anonymous capsule route is deliberately left untouched:
   * changing it would alter production, and its payload is the capsule's
   * lane summary rather than a credential list.
   */
  app.get(
    '/api/apply/credentials/:npi',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireVerifiedClerkUserId(req);
      const { npi } = req.params;
      if (!/^\d{10}$/.test(npi)) {
        throw new HttpError(400, 'npi must be a 10-digit NPI.');
      }
      await requireNpiAuthorization(clerkUserId, npi, req);
      const bundle = await generateApplyBundle(npi, {});
      res.json({
        npi,
        credentials: bundle.credentials ?? [],
        trustState: bundle.trustState ?? null,
      });
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
      const clerkUserId = requireVerifiedClerkUserId(req);
      const { npi } = req.params;
      if (!/^\d{10}$/.test(npi)) {
        throw new HttpError(400, 'npi must be a 10-digit NPI.');
      }
      // Previously authenticated but UNBOUND — any signed-in user could read
      // another clinician's share history.
      await requireNpiAuthorization(clerkUserId, npi, req);
      const shares = await listSharesForNpi(npi);
      res.json({ shares });
    }),
  );

  app.delete(
    '/api/apply/share/:shareId',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireVerifiedClerkUserId(req);
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
      'POST   /api/apply/intents',
      'GET    /api/apply/intents/:requestUri',
      'POST   /api/apply/intents/:requestUri/submit',
      'GET    /api/applications/:applicationId/handoff',
      'GET    /api/handoffs/:handoffId/receipts',
      'POST   /api/apply/bundle',
      'GET    /api/apply/bundle/:bundleId',
      'POST   /api/apply/verify',
      'GET    /api/apply/credentials/:npi',
      'POST   /api/apply/share',
      'GET    /api/apply/shares/:npi',
      'DELETE /api/apply/share/:shareId',
    ],
  });
}
