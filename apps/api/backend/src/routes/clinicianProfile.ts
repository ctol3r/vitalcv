/**
 * Clinician activation routes — Wave 1076 B1.
 *
 *   POST   /api/clinician-profile/claim            create or recover a draft
 *   GET    /api/clinician-profile/:npi             read it
 *   PATCH  /api/clinician-profile/:npi             save corrections
 *   POST   /api/clinician-profile/:npi/review      confirm review
 *   POST   /api/clinician-profile/:npi/sharing     confirm sharing control
 *   GET    /api/clinician-profile                  the caller's reusable profiles
 *
 * Every route requires a VERIFIED Clerk session and scopes to that user. Note
 * what none of them require: ownership verification. Activation must not wait
 * on an administrator, an employer, or an institution-gated source — that is
 * the whole point of separating "profile saved" from "ownership verified".
 *
 * There is deliberately no activation endpoint. Activation is not something a
 * client asserts; it is what the server concludes when review, sharing control
 * and save are all true. A client that could POST /activate could activate
 * without doing any of them.
 */

import type { Express, NextFunction, Request, Response } from 'express';

import { HttpError } from '../utils/httpError';
import { requireVerifiedClerkUserId } from '../middleware/verifiedActor';
import { publicApiRateLimit } from '../middleware/publicSafety';
import {
  confirmReview,
  confirmSharingControl,
  createOrRecoverDraft,
  listProfiles,
  readDraft,
  saveCorrections,
} from '../services/activation/clinicianProfileService';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

export function registerClinicianProfileRoutes(app: Express): void {
  /**
   * The claim step. Runs AFTER the clinician has seen resolved value on the
   * homepage and signed in — never before, so nobody is asked to create an
   * account to find out whether the product does anything.
   *
   * The anonymous preview the browser holds is passed here and bound to the
   * user. A durable private profile is never keyed by NPI alone.
   */
  app.post(
    '/api/clinician-profile/claim',
    publicApiRateLimit,
    asyncHandler(async (req, res) => {
      const userId = requireVerifiedClerkUserId(req);
      const { npi, resolved, observations } = req.body as {
        npi?: string;
        resolved?: Record<string, unknown>;
        observations?: Record<string, unknown>;
      };
      if (!npi) throw new HttpError(400, 'npi is required.');
      const view = await createOrRecoverDraft(userId, npi, resolved ?? {}, observations ?? {});
      res.status(200).json(view);
    }),
  );

  app.get(
    '/api/clinician-profile',
    publicApiRateLimit,
    asyncHandler(async (req, res) => {
      const userId = requireVerifiedClerkUserId(req);
      res.json({ profiles: await listProfiles(userId) });
    }),
  );

  app.get(
    '/api/clinician-profile/:npi',
    publicApiRateLimit,
    asyncHandler(async (req, res) => {
      const userId = requireVerifiedClerkUserId(req);
      res.json(await readDraft(userId, req.params.npi));
    }),
  );

  app.patch(
    '/api/clinician-profile/:npi',
    publicApiRateLimit,
    asyncHandler(async (req, res) => {
      const userId = requireVerifiedClerkUserId(req);
      const { corrections } = req.body as { corrections?: unknown };
      res.json(await saveCorrections(userId, req.params.npi, corrections ?? {}));
    }),
  );

  app.post(
    '/api/clinician-profile/:npi/review',
    publicApiRateLimit,
    asyncHandler(async (req, res) => {
      const userId = requireVerifiedClerkUserId(req);
      res.json(await confirmReview(userId, req.params.npi));
    }),
  );

  app.post(
    '/api/clinician-profile/:npi/sharing',
    publicApiRateLimit,
    asyncHandler(async (req, res) => {
      const userId = requireVerifiedClerkUserId(req);
      res.json(await confirmSharingControl(userId, req.params.npi));
    }),
  );
}
