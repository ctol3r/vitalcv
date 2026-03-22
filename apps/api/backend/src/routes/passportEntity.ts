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

import type { Express, NextFunction, Request, Response } from 'express';
import { buildPassport, buildPassportByNpi } from '../services/entity/passportService';
import { createOrgContext } from '../domain/entity/orgContextService';
import { isValidNpi } from '../domain/entity/npiRouter';
import { HttpError } from '../utils/httpError';
import { log } from '../obs/logger';
import prisma from '../graphql/prisma_client';
import { randomUUID } from 'node:crypto';

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
    }),
  );

  // ── GET /api/passport/npi/:npi ──────────────────────────────────────────────
  app.get(
    '/api/passport/npi/:npi([0-9]{10})',
    asyncHandler(async (req: Request, res: Response) => {
      const { npi } = req.params as { npi: string };
      if (!isValidNpi(npi)) throw new HttpError(400, 'Invalid NPI format.');
      const passport = await buildPassportByNpi(npi);
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
      });
      if (!context) throw new HttpError(404, 'Organization context not found.');

      // Build the share payload
      const eventId    = randomUUID();
      const sharedAt   = new Date();
      const expiresAt  = new Date(sharedAt.getTime() + 24 * 60 * 60 * 1000); // 24h TTL

      // Fetch credentials to include in share
      const creds = await prisma.vcvCredential.findMany({
        where: {
          subjectId: entityId,
          status:    'ACTIVE',
          ...(selectiveDomains?.length
            ? { domain: { in: selectiveDomains as import('@prisma/client').VcvCredentialDomain[] } }
            : {}),
        },
      });

      // Record the share in the org context subject's submission data
      await prisma.vcvOrgContextSubject.upsert({
        where: { contextId_subjectId: { contextId: organizationContextId, subjectId: entityId } },
        create: {
          contextId:    organizationContextId,
          subjectId:    entityId,
          subjectStatus: 'SUBMITTED',
          respondedAt:  sharedAt,
          submissionData: {
            eventId,
            sharedByUserId: userId,
            sharedAt:   sharedAt.toISOString(),
            expiresAt:  expiresAt.toISOString(),
            credentialIds: creds.map(c => c.id),
            selectiveDomains: selectiveDomains ?? 'ALL',
          } as import('@prisma/client').Prisma.InputJsonValue,
        },
        update: {
          subjectStatus: 'SUBMITTED',
          respondedAt:  sharedAt,
          submissionData: {
            eventId,
            sharedByUserId: userId,
            sharedAt:   sharedAt.toISOString(),
            expiresAt:  expiresAt.toISOString(),
            credentialIds: creds.map(c => c.id),
            selectiveDomains: selectiveDomains ?? 'ALL',
          } as import('@prisma/client').Prisma.InputJsonValue,
        },
      });

      // Transition context to ACTIVE if still PENDING
      if (context.status === 'PENDING') {
        await prisma.vcvOrganizationContext.update({
          where: { id: organizationContextId },
          data:  { status: 'ACTIVE' },
        });
      }

      log('info', 'passport_shared', {
        eventId, entityId, contextId: organizationContextId,
        userId, credentialCount: creds.length,
      });

      res.status(201).json({
        eventId,
        status:    'delivered',
        timestamp: sharedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        credentialsShared: creds.length,
      });
    }),
  );
}
