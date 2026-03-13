/**
 * applications.ts — Wave 229
 *
 * Routes:
 *   POST   /api/opportunities/:id/apply       — clinician applies
 *   GET    /api/clinician/applications         — clinician lists own applications
 *   DELETE /api/applications/:appId/withdraw   — clinician withdraws
 *
 *   GET    /api/employer/applications           — verifier lists all org applications
 *   GET    /api/opportunities/:id/applications  — verifier lists for one opportunity
 *   PATCH  /api/applications/:appId/review      — verifier reviews (REVIEWED|ACCEPTED|DECLINED)
 */

import type { Express, NextFunction, Request, Response } from 'express';
import {
  applyToOpportunity,
  listClinicianApplications,
  withdrawApplication,
  listAllOrgApplications,
  listApplicationsForOpportunity,
  reviewApplication,
} from '../services/opportunities/applicationService';
import { capsuleEngine } from '../services/decision/capsuleEngine';
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

export function registerApplicationRoutes(app: Express): void {
  /* ── Clinician: apply ── */
  app.post(
    '/api/opportunities/:id/apply',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const { id: opportunityId } = req.params;
      const { npi, coverNote } = req.body as { npi?: string; coverNote?: string };

      const application = await applyToOpportunity({ opportunityId, clerkUserId, npi, coverNote });
      res.status(201).json(application);
    }),
  );

  /* ── Clinician: list own applications ── */
  app.get(
    '/api/clinician/applications',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const applications = await listClinicianApplications(clerkUserId);
      res.json(applications);
    }),
  );

  /* ── Clinician: withdraw application ── */
  app.delete(
    '/api/applications/:appId/withdraw',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const { appId } = req.params;
      const updated = await withdrawApplication(appId, clerkUserId);
      res.json(updated);
    }),
  );

  /* ── Verifier: list all org applications ── */
  app.get(
    '/api/employer/applications',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const applications = await listAllOrgApplications(clerkUserId);
      res.json(applications);
    }),
  );

  /* ── Verifier: list applications for one opportunity ── */
  app.get(
    '/api/opportunities/:id/applications',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const { id: opportunityId } = req.params;
      const applications = await listApplicationsForOpportunity(opportunityId, clerkUserId);
      res.json(applications);
    }),
  );

  /* ── Verifier: review application ── */
  app.patch(
    '/api/applications/:appId/review',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const { appId: applicationId } = req.params;
      const { status, reviewNote } = req.body as { status?: string; reviewNote?: string };

      if (!status || !['REVIEWED', 'ACCEPTED', 'DECLINED'].includes(status)) {
        throw new HttpError(400, 'status must be REVIEWED, ACCEPTED, or DECLINED.');
      }

      const updated = await reviewApplication({
        applicationId,
        reviewerClerkUserId: clerkUserId,
        status: status as 'REVIEWED' | 'ACCEPTED' | 'DECLINED',
        reviewNote,
      });

      // Wave 244: Auto-create Decision Capsule when application is ACCEPTED
      if (status === 'ACCEPTED') {
        capsuleEngine.createDecisionFromApplication({
          applicationId,
          verifierClerkUserId: clerkUserId,
          decisionType: 'HIRING',
        }).catch((err: unknown) => {
          // Non-fatal: log but don't block the response
          log('warn', 'applications: decision_capsule_creation_failed', {
            applicationId,
            error: String(err),
          });
        });
      }

      res.json(updated);
    }),
  );
}
