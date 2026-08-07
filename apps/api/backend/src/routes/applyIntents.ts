import type { Express, NextFunction, Request, Response } from 'express';

import prisma from '../graphql/prisma_client';
import { publicApiRateLimit } from '../middleware/publicSafety';
import type { VerifiedAuth } from '../middleware/verifiedIdentity';
import { requireIdentityTier } from '../services/identity/identityGate';
import {
  createApplyIntent,
  previewApplyIntent,
  readApplyIntent,
  submitApplyIntent,
} from '../services/apply/applyIntentService';
import {
  readApplicationHandoffForEmployer,
  readHandoffReceiptsForEmployer,
} from '../services/handoffs/handoffReadService';
import { HttpError } from '../utils/httpError';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function verifiedUserId(req: Request): string | null {
  return (req as Request & { verifiedAuth?: VerifiedAuth }).verifiedAuth?.verifiedUserId?.trim() ?? null;
}

function requireVerifiedUserId(req: Request): string {
  const userId = verifiedUserId(req);
  if (!userId) throw new HttpError(401, 'Verified Clerk session required.');
  return userId;
}

function requireOpaqueRequestUri(value: string | undefined): string {
  const requestUri = value?.trim();
  if (!requestUri || !/^vai_[A-Za-z0-9_-]{20,80}$/.test(requestUri)) {
    throw new HttpError(404, 'Apply Intent not found.');
  }
  return requestUri;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(value: string | undefined): string {
  const id = value?.trim();
  if (!id || !UUID_RE.test(id)) throw new HttpError(404, 'Handoff receipt not found.');
  return id;
}

/**
 * Durable-audit delegation: createApplyIntent and submitApplyIntent execute
 * tx.auditEvent.create before their domain writes in the same Prisma transaction.
 * Their real-PostgreSQL contract test proves that no 2xx result exists without
 * the paired durable audit, consent, packet, application and handoff records.
 */
export function registerApplyIntentRoutes(app: Express): void {
  app.post(
    '/api/apply/intents',
    asyncHandler(async (req, res) => {
      const creatorClerkUserId = requireVerifiedUserId(req);
      const body = req.body as {
        opportunityId?: string;
        purpose?: string;
        requestedSections?: unknown;
        requestedCredentialTypes?: unknown;
        callbackUrl?: string | null;
        returnUrl?: string | null;
        state?: string;
        expiresInSeconds?: number;
      };
      const intent = await createApplyIntent({
        opportunityId: body.opportunityId ?? '',
        creatorClerkUserId,
        purpose: body.purpose,
        requestedSections: body.requestedSections,
        requestedCredentialTypes: body.requestedCredentialTypes,
        callbackUrl: body.callbackUrl,
        returnUrl: body.returnUrl,
        state: body.state,
        expiresInSeconds: body.expiresInSeconds,
      });
      res.status(201).json(intent);
    }),
  );

  app.get(
    '/api/apply/intents/:requestUri',
    publicApiRateLimit,
    asyncHandler(async (req, res) => {
      const requestUri = requireOpaqueRequestUri(req.params.requestUri);
      const actor = verifiedUserId(req);
      const intent = actor
        ? await previewApplyIntent(requestUri, actor)
        : await readApplyIntent(requestUri);
      res.setHeader('Cache-Control', 'private, no-store');
      res.json(intent);
    }),
  );

  app.post(
    '/api/apply/intents/:requestUri/submit',
    asyncHandler(async (req, res) => {
      const clinicianClerkUserId = requireVerifiedUserId(req);
      const requestUri = requireOpaqueRequestUri(req.params.requestUri);
      const applicant = await prisma.user.findUnique({ where: { clerkUserId: clinicianClerkUserId } });
      if (!applicant) throw new HttpError(404, 'User not found. Complete onboarding first.');
      await requireIdentityTier(applicant.id, 'work_email_confirmed');

      const body = req.body as {
        selectedSections?: unknown;
        coverNote?: string | null;
        authenticationMethod?: string;
        authenticationRef?: string | null;
      };
      const result = await submitApplyIntent({
        requestUri,
        clinicianClerkUserId,
        selectedSections: body.selectedSections,
        coverNote: body.coverNote,
        authenticationMethod: body.authenticationMethod ?? '',
        authenticationRef: body.authenticationRef,
      });
      res.status(201).json(result);
    }),
  );

  app.get(
    '/api/applications/:applicationId/handoff',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireVerifiedUserId(req);
      const view = await readApplicationHandoffForEmployer(
        requireUuid(req.params.applicationId),
        clerkUserId,
      );
      res.setHeader('Cache-Control', 'private, no-store');
      res.json(view);
    }),
  );

  app.get(
    '/api/handoffs/:handoffId/receipts',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireVerifiedUserId(req);
      const view = await readHandoffReceiptsForEmployer(
        requireUuid(req.params.handoffId),
        clerkUserId,
      );
      res.setHeader('Cache-Control', 'private, no-store');
      res.json(view);
    }),
  );
}
