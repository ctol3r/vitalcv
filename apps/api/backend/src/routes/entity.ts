/**
 * entity.ts — Canonical entity API routes
 *
 * GET  /api/entity/:id               — full entity record by internal ID
 * GET  /api/entity/resolve/npi/:npi  — resolve NPI → entity (create if new)
 * GET  /api/entity/:id/roles         — role assignments for entity
 * GET  /api/entity/:id/relationships — relationship graph for entity
 *
 * These routes are the canonical entry point for all entity-based operations.
 * Authentication is not required for public entity resolution — same principle
 * as NPI entry: value before login.
 */

import type { Express, NextFunction, Request, Response } from 'express';
import {
  resolveEntityFromNpi,
  getEntityById,
  toEntitySummary,
} from '../services/entity/entityResolutionService';
import { isValidNpi } from '../domain/entity/npiRouter';
import { HttpError } from '../utils/httpError';
import { log } from '../obs/logger';
import prisma from '../graphql/prisma_client';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function registerEntityRoutes(app: Express): void {

  /**
   * GET /api/entity/resolve/npi/:npi
   *
   * The canonical NPI entry point. Looks up NPPES, creates/updates
   * the VcvEntity record, assigns initial role, returns EntitySummary.
   *
   * Returns: { entity, roles, routingEntry, subjectLabel }
   */
  app.get(
    '/api/entity/resolve/npi/:npi([0-9]{10})',
    asyncHandler(async (req: Request, res: Response) => {
      const { npi } = req.params as { npi: string };

      if (!isValidNpi(npi)) throw new HttpError(400, 'NPI must be a 10-digit string.');

      const record = await resolveEntityFromNpi(npi);
      const summary = toEntitySummary(record);

      res.json({
        entity:       summary,
        roles:        record.roles.map(r => ({
          id:        r.id,
          roleType:  r.roleType,
          source:    r.source,
          context:   r.context,
          validFrom: r.validFrom,
          validUntil: r.validUntil,
        })),
        credentials:  record.credentials.map(c => ({
          id:                c.id,
          domain:            c.domain,
          credentialType:    c.credentialType,
          status:            c.status,
          verificationLevel: c.verificationLevel,
          jurisdiction:      c.jurisdiction,
          expiresAt:         c.expiresAt,
          verifiedAt:        c.verifiedAt,
        })),
        routingEntry:  record.routingEntry,
        subjectLabel:  record.subjectLabel,
      });
    }),
  );

  /**
   * GET /api/entity/:id
   *
   * Full entity record by internal UUID.
   * Returns the same shape as the NPI resolution endpoint.
   */
  app.get(
    '/api/entity/:id([0-9a-f-]{36})',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params as { id: string };

      const record = await getEntityById(id);
      if (!record) throw new HttpError(404, 'Entity not found.');

      const summary = toEntitySummary(record);

      res.json({
        entity:       summary,
        roles:        record.roles.map(r => ({
          id:        r.id,
          roleType:  r.roleType,
          source:    r.source,
          context:   r.context,
          validFrom: r.validFrom,
          validUntil: r.validUntil,
        })),
        credentials:  record.credentials.map(c => ({
          id:                c.id,
          domain:            c.domain,
          credentialType:    c.credentialType,
          status:            c.status,
          verificationLevel: c.verificationLevel,
          jurisdiction:      c.jurisdiction,
          expiresAt:         c.expiresAt,
          verifiedAt:        c.verifiedAt,
        })),
        routingEntry:  record.routingEntry,
        subjectLabel:  record.subjectLabel,
      });
    }),
  );

  /**
   * GET /api/entity/:id/roles
   *
   * All role assignments for an entity, with optional active-only filter.
   * ?active=true filters to non-expired roles only.
   */
  app.get(
    '/api/entity/:id([0-9a-f-]{36})/roles',
    asyncHandler(async (req: Request, res: Response) => {
      const { id }    = req.params as { id: string };
      const activeOnly = req.query['active'] === 'true';

      const now = new Date();
      const roles = await prisma.vcvEntityRole.findMany({
        where: {
          entityId: id,
          ...(activeOnly ? {
            OR: [{ validUntil: null }, { validUntil: { gt: now } }],
          } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ entityId: id, roles, count: roles.length });
    }),
  );

  /**
   * GET /api/entity/:id/relationships
   *
   * All relationships where entity is subject OR object.
   * ?type=works_for,licensed_by filters by relationship type.
   * ?direction=outbound|inbound limits direction.
   */
  app.get(
    '/api/entity/:id([0-9a-f-]{36})/relationships',
    asyncHandler(async (req: Request, res: Response) => {
      const { id }        = req.params as { id: string };
      const direction     = (req.query['direction'] as string | undefined) ?? 'both';
      const typeFilter    = req.query['type'] as string | undefined;

      const typeList = typeFilter
        ? typeFilter.split(',').map(s => s.trim().toUpperCase()) as import('@prisma/client').VcvRelationshipType[]
        : undefined;

      const whereSubject = {
        subjectId: id,
        ...(typeList ? { relationshipType: { in: typeList } } : {}),
      };
      const whereObject = {
        objectId: id,
        ...(typeList ? { relationshipType: { in: typeList } } : {}),
      };

      const rels = await prisma.vcvEntityRelationship.findMany({
        where: {
          ...(direction === 'outbound' ? whereSubject
            : direction === 'inbound'  ? whereObject
            : { OR: [whereSubject, whereObject] }),
        },
        include: {
          subject: { select: { id: true, displayName: true, entityType: true } },
          object:  { select: { id: true, displayName: true, entityType: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      res.json({
        entityId: id,
        relationships: rels.map(r => ({
          id:               r.id,
          relationshipType: r.relationshipType,
          direction:        r.subjectId === id ? 'outbound' : 'inbound',
          subject:          r.subject,
          object:           r.object,
          confidence:       r.confidence,
          tier:             r.tier,
          startDate:        r.startDate,
          endDate:          r.endDate,
        })),
        count: rels.length,
      });
    }),
  );
}
