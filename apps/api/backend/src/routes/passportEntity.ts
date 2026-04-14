/**
 * passportEntity.ts — Trust Passport API (entity-centric)
 *
 * GET  /api/passport/entity/:id     — full passport by entity ID
 * GET  /api/passport/npi/:npi       — full passport by NPI (resolves entity)
 * POST /api/share                   — share passport to an org context
 * POST /api/organization-context    — create an org context for review/employment
 *
 * Auth: anonymous for GET (value before login).
 *       POST /api/share requires x-clerk-user-id (biometric confirmed client-side).
 */

import { randomUUID } from 'node:crypto';
import type { Express, NextFunction, Request, Response } from 'express';
import { buildPassport } from '../services/entity/passportService';
import { buildPassportDataByNpi } from '../services/passport/npiPassportContract';
import { createOrgContext, transitionOrgContextStatus } from '../domain/entity/orgContextService';
import { isValidNpi } from '../domain/entity/npiRouter';
import { HttpError } from '../utils/httpError';
import { log } from '../obs/logger';
import prisma from '../graphql/prisma_client';
import { generateApplyBundle } from '../services/distribution/applyBundle';
import {
  buildEmployerReviewPayload,
  employerReviewPayloadToJson,
} from '../services/entity/employerReviewPayload';
import { sha256ForPayload } from '../utils/deterministic';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function clerkUserId(req: Request): string | undefined {
  const raw = req.headers['x-clerk-user-id'];
  return typeof raw === 'string' ? raw.trim() : undefined;
}

export function registerPassportEntityRoutes(app: Express): void {

  // ── GET /api/passport/entity/:id ────────────────────────────────────────────
  app.get(
    '/api/passport/entity/:id([0-9a-f-]{36})',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params as { id: string };
      const passport = await buildPassport(id);
      if (!passport) throw new HttpError(404, 'Entity not found.');
      res.json(passport);

      // SEAL: capture passport-view advisory event (fire-and-forget, after response)
      {
        const { captureAdvisoryEvent } = await import('../services/seal/sealEventCapture');
        void captureAdvisoryEvent({
          entityId:              id,
          advisoryVersion:       passport.readiness.level ?? 'unknown',
          eventType:             'PASSPORT_VIEW',
          blockersAtEvent:       passport.readiness.blockers,
          readinessScoreAtEvent: passport.readiness.score,
          // Derive real source coverage from passport — never hardcode
          sourceCoverageAtEvent: (() => {
            const checks = Array.isArray(passport.sourceCoverage?.checks)
              ? passport.sourceCoverage.checks
              : [];
            const byState: Record<string, string[]> = {};
            for (const c of checks) {
              const state = c.state ?? 'notChecked';
              (byState[state] ??= []).push(c.sourceId);
            }
            return byState;
          })(),
          metadata: { npiPrefix: passport.identity.npi?.slice(0, 4) ?? null },
        }).catch(() => void 0);
      }
    }),
  );

  // ── GET /api/passport/npi/:npi ──────────────────────────────────────────────
  app.get(
    '/api/passport/npi/:npi([0-9]{10})',
    asyncHandler(async (req: Request, res: Response) => {
      const { npi } = req.params as { npi: string };
      if (!isValidNpi(npi)) throw new HttpError(400, 'Invalid NPI format.');
      const passport = await buildPassportDataByNpi(npi);
      if (!passport) throw new HttpError(404, 'Passport could not be built for this NPI.');
      res.json(passport);
    }),
  );

  // ── POST /api/organization-context ──────────────────────────────────────────
  //
  // Creates a typed org context (APPLICATION, CREDENTIALING, PRIVILEGING, etc.)
  // Requestor must be an existing VcvEntity (organization/facility/etc.).
  // Returns the created context + initial status.
  app.post(
    '/api/organization-context',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = clerkUserId(req);
      const {
        requestorEntityId,
        contextType,
        title,
        description,
        dueAt,
        webhookUrl,
        externalRefId,
        subjectEntityIds = [],
      } = req.body as {
        requestorEntityId:  string;
        contextType:        string;
        title?:             string;
        description?:       string;
        dueAt?:             string;
        webhookUrl?:        string;
        externalRefId?:     string;
        subjectEntityIds?:  string[];
      };

      if (!requestorEntityId || !contextType) {
        throw new HttpError(400, 'requestorEntityId and contextType are required.');
      }

      const context = await createOrgContext({
        requestorEntityId,
        contextType: contextType as import('@prisma/client').VcvOrgContextType,
        title,
        description,
        dueAt:     dueAt ? new Date(dueAt) : undefined,
        webhookUrl,
        externalRefId,
        createdByUserId: userId,
        subjectEntityIds,
      });

      log('info', 'org_context_api_created', { id: context.id, contextType, userId });
      res.status(201).json({ context });
    }),
  );

  // ── POST /api/share ─────────────────────────────────────────────────────────
  //
  // Share a passport to an organization context.
  // Biometric confirmation is enforced CLIENT-SIDE before calling this.
  // Server records the share event with provenance.
  //
  // Input:
  //   { entityId, organizationContextId, selectiveDomains?: string[] }
  // Output:
  //   { eventId, status, timestamp, bundleUrl? }
  app.post(
    '/api/share',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = clerkUserId(req);
      if (!userId) throw new HttpError(401, 'Authentication required to share.');

      const {
        entityId,
        organizationContextId,
        selectiveDomains,
      } = req.body as {
        entityId:              string;
        organizationContextId: string;
        selectiveDomains?:     string[];
      };

      if (!entityId || !organizationContextId) {
        throw new HttpError(400, 'entityId and organizationContextId are required.');
      }

      // Verify entity exists
      const entity = await prisma.vcvEntity.findUnique({ where: { id: entityId } });
      if (!entity) throw new HttpError(404, 'Entity not found.');

      // Verify context exists
      const context = await prisma.vcvOrganizationContext.findUnique({
        where: { id: organizationContextId },
        include: {
          requestor: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      });
      if (!context) throw new HttpError(404, 'Organization context not found.');
      if (context.requestorId === entityId) {
        throw new HttpError(400, 'Requestor entity cannot also be the shared subject.');
      }
      if (!entity.npi) {
        throw new HttpError(400, 'Entity is missing an NPI and cannot be shared.');
      }

      const bundle = await generateApplyBundle(entity.npi, {
        selectiveClaims: selectiveDomains,
      });
      const reviewPayload = await buildEmployerReviewPayload({
        entityId,
        organizationContextId,
        sharedByUserId: userId,
        selectiveDomains,
      });

      const credentialsSummary = reviewPayload.credentialsIncluded.map((credential) => ({
        credentialId: credential.credentialId,
        credentialType: credential.credentialType,
        domain: credential.domain,
        status: credential.status,
        issuerName: credential.issuerName ?? null,
      }));

      const shareEvent = await prisma.bundleShareEvent.create({
        data: {
          bundleId: bundle.bundleId,
          npi: entity.npi,
          organizationContextId,
          subjectEntityId: entityId,
          sharedByClerkUserId: userId,
          organizationId: context.requestorId,
          organizationName: context.requestor.displayName,
          callbackUrl: context.webhookUrl ?? null,
          purposeOfUse: context.title ?? context.contextType,
          credentialsSummary: credentialsSummary as import('@prisma/client').Prisma.InputJsonValue,
          webhookStatus: 'SKIPPED',
          deliveryStatus: 'DELIVERED',
          checkedAt: new Date(reviewPayload.checkedAt),
          bundlePayload: employerReviewPayloadToJson(reviewPayload),
          receiptRefs: reviewPayload.receiptReferences,
          sourceCoverage: employerReviewPayloadToJson(reviewPayload.sourceCoverage),
          expiresAt: new Date(bundle.expiresAt),
        },
      });

      // AUDIT: write durable AuditEvent before the 201 response.
      // PASSPORT_SHARED is one of the 5 canonical non-repudiation events.
      await prisma.auditEvent.create({
        data: {
          id:          randomUUID(),
          type:        'PASSPORT_SHARED',
          hash:        sha256ForPayload({
            shareEventId:          shareEvent.id,
            entityId,
            organizationContextId,
            bundleId:              bundle.bundleId,
            sharedByUserId:        userId,
          }),
          referenceId: shareEvent.id,
          clinicianId: entity.npi,
          anchored:    false,
          metadata: {
            shareEventId:          shareEvent.id,
            entityId,
            organizationContextId,
            bundleId:              bundle.bundleId,
            sharedByUserId:        userId,
            credentialCount:       reviewPayload.credentialsIncluded.length,
          },
        },
      });

      await prisma.vcvOrgContextSubject.upsert({
        where: { contextId_subjectId: { contextId: organizationContextId, subjectId: entityId } },
        create: {
          contextId:    organizationContextId,
          subjectId:    entityId,
          subjectStatus: 'SUBMITTED',
          respondedAt:  shareEvent.sharedAt,
          submissionData: {
            shareEventId: shareEvent.id,
            eventId: shareEvent.id,
            bundleId: bundle.bundleId,
            sharedByUserId: userId,
            sharedAt:   shareEvent.sharedAt.toISOString(),
            expiresAt:  bundle.expiresAt,
            credentialIds: reviewPayload.credentialsIncluded.map((credential) => credential.credentialId),
            receiptRefs: reviewPayload.receiptReferences,
            selectiveDomains: selectiveDomains?.length ? selectiveDomains : 'ALL',
          } as import('@prisma/client').Prisma.InputJsonValue,
        },
        update: {
          subjectStatus: 'SUBMITTED',
          respondedAt:  shareEvent.sharedAt,
          submissionData: {
            shareEventId: shareEvent.id,
            eventId: shareEvent.id,
            bundleId: bundle.bundleId,
            sharedByUserId: userId,
            sharedAt:   shareEvent.sharedAt.toISOString(),
            expiresAt:  bundle.expiresAt,
            credentialIds: reviewPayload.credentialsIncluded.map((credential) => credential.credentialId),
            receiptRefs: reviewPayload.receiptReferences,
            selectiveDomains: selectiveDomains?.length ? selectiveDomains : 'ALL',
          } as import('@prisma/client').Prisma.InputJsonValue,
        },
      });

      if (context.status === 'PENDING') {
        await transitionOrgContextStatus(
          organizationContextId,
          'ACTIVE',
          userId,
          'Share submitted by subject',
        );
      }

      log('info', 'passport_shared', {
        shareEventId: shareEvent.id,
        entityId,
        contextId: organizationContextId,
        userId,
        credentialCount: reviewPayload.credentialsIncluded.length,
        bundleId: bundle.bundleId,
      });

      res.status(201).json({
        shareEventId: shareEvent.id,
        eventId: shareEvent.id,
        status: 'delivered',
        deliveryStatus: shareEvent.deliveryStatus,
        checkedAt: reviewPayload.checkedAt,
        timestamp: shareEvent.sharedAt.toISOString(),
        expiresAt: bundle.expiresAt,
        credentialsShared: reviewPayload.credentialsIncluded.length,
        bundleId: bundle.bundleId,
      });
    }),
  );
}
