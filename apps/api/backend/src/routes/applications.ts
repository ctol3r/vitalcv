/**
 * applications.ts — Wave 229
 *
 * Routes:
 *   POST   /api/opportunities/:id/apply       — clinician applies
 *   GET    /api/clinician/applications         — clinician lists own applications
 *   DELETE /api/applications/:appId/withdraw   — clinician withdraws
 *
 *   GET    /api/employer/applications           — verifier lists all org applications
 *   GET    /api/employer/applications/dashboard — verifier lists workflow buckets
 *   GET    /api/opportunities/:id/applications  — verifier lists for one opportunity
 *   PATCH  /api/applications/:appId/review      — verifier reviews (REVIEWED|ACCEPTED|DECLINED)
 *   GET    /api/applications/:appId/workflow    — verifier reads workflow detail
 *   POST   /api/applications/:appId/workflow-action — verifier runs accept/request_info/reject
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
import {
  getEmployerWorkflowApplication,
  listEmployerWorkflowDashboard,
  runEmployerWorkflowAction,
} from '../services/opportunities/employerWorkflowService';
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

// Opportunity.id and Application.id are Postgres uuid columns — querying them
// with a non-uuid string makes Prisma throw (a 500) instead of returning null.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuidParam(value: string | undefined, label: string): string {
  const id = value?.trim();
  if (!id || !UUID_RE.test(id)) {
    throw new HttpError(404, `${label} not found.`);
  }
  return id;
}

export function registerApplicationRoutes(app: Express): void {
  /* ── Clinician: apply ── */
  app.post(
    '/api/opportunities/:id/apply',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const opportunityId = requireUuidParam(req.params.id, 'Opportunity');
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
      const appId = requireUuidParam(req.params.appId, 'Application');
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

  /* ── Verifier: workflow dashboard ── */
  app.get(
    '/api/employer/applications/dashboard',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const dashboard = await listEmployerWorkflowDashboard(clerkUserId);
      res.json(dashboard);
    }),
  );

  /* ── Verifier: list applications for one opportunity ── */
  app.get(
    '/api/opportunities/:id/applications',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const opportunityId = requireUuidParam(req.params.id, 'Opportunity');
      const applications = await listApplicationsForOpportunity(opportunityId, clerkUserId);
      res.json(applications);
    }),
  );

  /* ── Verifier: review application ── */
  app.patch(
    '/api/applications/:appId/review',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const applicationId = requireUuidParam(req.params.appId, 'Application');
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

      // Wave 269: Persist verifier decision capsules for approve / reject / conditional approve.
      const decisionAction = status === 'ACCEPTED'
        ? 'APPROVE'
        : status === 'DECLINED'
          ? 'REJECT'
          : 'CONDITIONAL_APPROVE';

      if (status === 'REVIEWED' || status === 'ACCEPTED' || status === 'DECLINED') {
        capsuleEngine.createDecisionFromApplication({
          applicationId,
          verifierClerkUserId: clerkUserId,
          decisionType: 'HIRING',
          decisionAction,
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

  /* ── Verifier: workflow detail ── */
  app.get(
    '/api/applications/:appId/workflow',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const appId = requireUuidParam(req.params.appId, 'Application');
      const workflowApplication = await getEmployerWorkflowApplication(appId, clerkUserId);
      res.json(workflowApplication);
    }),
  );

  /* ── Verifier: workflow action ── */
  app.post(
    '/api/applications/:appId/workflow-action',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const appId = requireUuidParam(req.params.appId, 'Application');
      const {
        action,
        requests,
        reviewNote,
      } = req.body as {
        action?: string;
        requests?: Array<{ field?: string; message?: string }>;
        reviewNote?: string;
      };

      if (!action || !['accept', 'request_info', 'reject'].includes(action)) {
        throw new HttpError(400, 'action must be accept, request_info, or reject.');
      }

      const result = await runEmployerWorkflowAction({
        action: action as 'accept' | 'request_info' | 'reject',
        applicationId: appId,
        reviewerClerkUserId: clerkUserId,
        requests: requests?.map((request) => ({
          field: request.field ?? '',
          message: request.message ?? '',
        })),
        reviewNote,
      });

      if (action === 'accept' || action === 'reject') {
        const decisionAction = action === 'accept' ? 'APPROVE' : 'REJECT';

        capsuleEngine.createDecisionFromApplication({
          applicationId: appId,
          verifierClerkUserId: clerkUserId,
          decisionType: 'HIRING',
          decisionAction,
        }).catch((err: unknown) => {
          log('warn', 'applications: workflow_capsule_creation_failed', {
            applicationId: appId,
            action,
            error: String(err),
          });
        });
      }

      res.json(result);
    }),
  );
}
