/**
 * employerActions.ts — M2: Accept with Confidence
 *
 * Employer-facing action routes for the review/[entityId] workflow.
 * Auth: Clerk session header (x-clerk-user-id). No API key required.
 *
 * Routes:
 *   POST /api/employer-review/:entityId/accept          — Accept as head start
 *   POST /api/employer-review/:entityId/request-refresh — Request missing/stale data
 *   POST /api/employer-review/:entityId/route-to-review — Route to manual review queue
 *   GET  /api/employer-review/:entityId/packet          — Evidence packet export
 *
 * AUDIT CONTRACT
 * ─────────────
 * Every mutating action writes an AuditEvent row in a transaction BEFORE
 * returning 2xx. No action can succeed silently.
 *
 * Packet export is read-only — no audit event required, but logs the access.
 */

import { randomUUID } from 'node:crypto';
import type { Express, NextFunction, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { HttpError } from '../utils/httpError';
import { buildPassport } from '../services/entity/passportService';
import { computeClinicianTrustState } from '../services/trust/trustStateEngine';
import { sha256ForPayload } from '../utils/deterministic';

// ── Types ──────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

/** Extract Clerk user ID or throw 401 */
function requireClerkUserId(req: Request): string {
  const id = (req.headers['x-clerk-user-id'] as string | undefined)?.trim();
  if (!id) throw new HttpError(401, 'Missing x-clerk-user-id header.');
  return id;
}

// ── Action types emitted to audit ledger ──────────────────────────────────

type EmployerActionType =
  | 'EMPLOYER_REVIEW_ACCEPTED'
  | 'EMPLOYER_REVIEW_REFRESH_REQUESTED'
  | 'EMPLOYER_REVIEW_ROUTED_TO_REVIEW';

// ── Shared: write audit event (required before returning 2xx) ─────────────

async function writeActionAudit(
  type:       EmployerActionType,
  entityId:   string,
  employerId: string,
  meta:       Record<string, unknown>,
): Promise<{ auditEventId: string; actionHash: string }> {
  const auditEventId = randomUUID();
  const actionHash = sha256ForPayload({ type, entityId, employerId, ...meta, auditEventId });

  await prisma.auditEvent.create({
    data: {
      id:          auditEventId,
      type,
      hash:        actionHash,
      referenceId: entityId,
      clinicianId: meta.clinicianNpi as string | null ?? null,
      anchored:    false,
      metadata:    { type, entityId, employerId, actionHash: actionHash.slice(0, 16) + '…', ...meta },
    },
  });

  return { auditEventId, actionHash };
}

// ── Route registration ─────────────────────────────────────────────────────

export function registerEmployerActionRoutes(app: Express): void {

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/employer-review/:entityId/accept
  // Accept as head start — creates EmployerAcceptance + mandatory audit event.
  // Returns: { ok, actionId, acceptanceId, auditEventId, timestamp }
  // ─────────────────────────────────────────────────────────────────────────
  app.post(
    '/api/employer-review/:entityId/accept',
    asyncHandler(async (req, res) => {
      const employerId = requireClerkUserId(req);
      const { entityId } = req.params;

      if (!entityId?.trim()) throw new HttpError(400, 'entityId is required.');

      // Resolve the entity to get NPI
      const entity = await prisma.vcvEntity.findUnique({
        where:  { id: entityId },
        select: { id: true, npi: true },
      });
      if (!entity?.npi) throw new HttpError(404, `Entity ${entityId} not found or has no NPI.`);

      const clinicianNpi = entity.npi;

      // Guard: no duplicate open acceptances
      const existing = await prisma.employerAcceptance.findFirst({
        where:  { employerId, clinicianNpi, status: 'ACCEPTED' },
        select: { id: true },
      });
      if (existing) {
        void res.status(409).json({
          error:             'already_accepted',
          error_description: 'An active acceptance already exists for this employer/NPI pair.',
          acceptanceId:      existing.id,
        });
      }

      const { role, facility, notes } = (req.body ?? {}) as {
        role?:     string;
        facility?: string;
        notes?:    string;
      };

      const now = new Date();

      // ATOMIC: write acceptance + audit event together
      const { acceptance, auditEvent } = await prisma.$transaction(async (tx) => {
        const acceptance = await tx.employerAcceptance.create({
          data: {
            id:           randomUUID(),
            employerId,
            clinicianNpi,
            artifactId:   null,
            status:       'ACCEPTED',
            acceptedAt:   now,
          },
        });

        const actionHash = sha256ForPayload({
          type:       'EMPLOYER_REVIEW_ACCEPTED',
          acceptanceId: acceptance.id,
          entityId,
          employerId,
          clinicianNpi,
          acceptedAt: now.toISOString(),
        });

        const auditEvent = await tx.auditEvent.create({
          data: {
            id:          randomUUID(),
            type:        'EMPLOYER_REVIEW_ACCEPTED',
            hash:        actionHash,
            referenceId: acceptance.id,
            clinicianId: clinicianNpi,
            anchored:    false,
            metadata:    {
              acceptanceId: acceptance.id,
              entityId,
              employerId,
              clinicianNpi,
              role:     role ?? null,
              facility: facility ?? null,
              notes:    notes ?? null,
              acceptedAt: now.toISOString(),
              actionHash: actionHash.slice(0, 16) + '…',
            },
          },
        });

        return { acceptance, auditEvent };
      });

      log('info', 'employer_review_accepted', {
        acceptanceId:  acceptance.id,
        auditEventId:  auditEvent.id,
        entityId,
        employerId,
        npi_prefix:    clinicianNpi.slice(0, 4) + '····',
      });

      void res.status(201).json({
        ok:           true,
        action:       'accepted',
        acceptanceId: acceptance.id,
        auditEventId: auditEvent.id,
        clinicianNpi,
        entityId,
        timestamp:    now.toISOString(),
      });
    }),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/employer-review/:entityId/request-refresh
  // Request the clinician refresh stale or missing data.
  // Writes audit event. Future: triggers clinician notification.
  // Returns: { ok, actionId, auditEventId, staleSources[], timestamp }
  // ─────────────────────────────────────────────────────────────────────────
  app.post(
    '/api/employer-review/:entityId/request-refresh',
    asyncHandler(async (req, res) => {
      const employerId = requireClerkUserId(req);
      const { entityId } = req.params;

      if (!entityId?.trim()) throw new HttpError(400, 'entityId is required.');

      const entity = await prisma.vcvEntity.findUnique({
        where:  { id: entityId },
        select: { id: true, npi: true },
      });
      if (!entity?.npi) throw new HttpError(404, `Entity ${entityId} not found.`);

      const clinicianNpi = entity.npi;
      const { staleSources, missingDomains, message } = (req.body ?? {}) as {
        staleSources?:    string[];
        missingDomains?:  string[];
        message?:         string;
      };

      const now = new Date();
      const actionId = randomUUID();

      const { auditEventId, actionHash } = await writeActionAudit(
        'EMPLOYER_REVIEW_REFRESH_REQUESTED',
        entityId,
        employerId,
        {
          clinicianNpi,
          actionId,
          staleSources:   staleSources ?? [],
          missingDomains: missingDomains ?? [],
          message:        message ?? null,
          requestedAt:    now.toISOString(),
        },
      );

      log('info', 'employer_review_refresh_requested', {
        actionId,
        auditEventId,
        entityId,
        employerId,
        npi_prefix:    clinicianNpi.slice(0, 4) + '····',
        staleSources,
        missingDomains,
      });

      void res.status(201).json({
        ok:             true,
        action:         'refresh_requested',
        actionId,
        auditEventId,
        clinicianNpi,
        entityId,
        staleSources:   staleSources ?? [],
        missingDomains: missingDomains ?? [],
        actionHash:     actionHash.slice(0, 16) + '…',
        timestamp:      now.toISOString(),
      });
    }),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/employer-review/:entityId/route-to-review
  // Route to manual review queue. Writes audit event + creates HITL entry.
  // Returns: { ok, actionId, auditEventId, timestamp }
  // ─────────────────────────────────────────────────────────────────────────
  app.post(
    '/api/employer-review/:entityId/route-to-review',
    asyncHandler(async (req, res) => {
      const employerId = requireClerkUserId(req);
      const { entityId } = req.params;

      if (!entityId?.trim()) throw new HttpError(400, 'entityId is required.');

      const entity = await prisma.vcvEntity.findUnique({
        where:  { id: entityId },
        select: { id: true, npi: true },
      });
      if (!entity?.npi) throw new HttpError(404, `Entity ${entityId} not found.`);

      const clinicianNpi = entity.npi;
      const { reason, priority } = (req.body ?? {}) as { reason?: string; priority?: string };

      const now = new Date();
      const actionId = randomUUID();

      // ATOMIC: audit event + HITL review record
      const { auditEvent } = await prisma.$transaction(async (tx) => {
        // Try to create HITL review item (table may not exist in all envs — graceful)
        let hitlId: string | null = null;
        try {
          const hitl = await (tx as unknown as {
            hITLReviewItem?: { create: (args: unknown) => Promise<{ id: string }> }
          }).hITLReviewItem?.create({
            data: {
              id:          randomUUID(),
              entityId,
              clinicianNpi,
              employerId,
              status:      'PENDING',
              priority:    priority ?? 'NORMAL',
              reason:      reason ?? 'Employer routed for manual review',
              createdAt:   now,
            },
          });
          hitlId = hitl?.id ?? null;
        } catch {
          // HITL table optional — don't fail the audit event
        }

        const actionHash = sha256ForPayload({
          type: 'EMPLOYER_REVIEW_ROUTED_TO_REVIEW',
          actionId,
          entityId,
          employerId,
          clinicianNpi,
          routedAt: now.toISOString(),
        });

        const auditEvent = await tx.auditEvent.create({
          data: {
            id:          randomUUID(),
            type:        'EMPLOYER_REVIEW_ROUTED_TO_REVIEW',
            hash:        actionHash,
            referenceId: entityId,
            clinicianId: clinicianNpi,
            anchored:    false,
            metadata:    {
              actionId,
              entityId,
              employerId,
              clinicianNpi,
              reason:   reason ?? null,
              priority: priority ?? 'NORMAL',
              hitlId:   hitlId,
              routedAt: now.toISOString(),
              actionHash: actionHash.slice(0, 16) + '…',
            },
          },
        });

        return { auditEvent };
      });

      log('info', 'employer_review_routed_to_review', {
        actionId,
        auditEventId: auditEvent.id,
        entityId,
        employerId,
        npi_prefix:   clinicianNpi.slice(0, 4) + '····',
        reason,
        priority,
      });

      void res.status(201).json({
        ok:           true,
        action:       'routed_to_review',
        actionId,
        auditEventId: auditEvent.id,
        clinicianNpi,
        entityId,
        reason:       reason ?? null,
        timestamp:    now.toISOString(),
      });
    }),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/employer-review/:entityId/packet
  // Evidence packet export — structured JSON of current trust state.
  // Read-only. Logs the access. No audit event required (read, not decision).
  // Returns: { entityId, npi, exportedAt, packet: { identity, safety, authority, eligibility, readiness } }
  // ─────────────────────────────────────────────────────────────────────────
  app.get(
    '/api/employer-review/:entityId/packet',
    asyncHandler(async (req, res): Promise<void> => {
      const employerId = requireClerkUserId(req);
      const { entityId } = req.params;

      if (!entityId?.trim()) throw new HttpError(400, 'entityId is required.');

      const [passport, entity] = await Promise.all([
        buildPassport(entityId),
        prisma.vcvEntity.findUnique({
          where:  { id: entityId },
          select: { id: true, npi: true },
        }),
      ]);

      if (!passport || !entity?.npi) {
        throw new HttpError(404, `Entity ${entityId} not found.`);
      }

      const clinicianNpi = entity.npi;

      // Fetch latest trust state for freshness metadata
      const trustState = await computeClinicianTrustState(clinicianNpi).catch(() => null);

      const exportedAt = new Date().toISOString();

      // Build the evidence packet — structured for employer download
      const packet = {
        exportedAt,
        exportedBy: employerId,
        entityId,
        clinicianNpi,
        displayName: passport.identity.displayName,

        // ── Identity layer
        identity: {
          npi:          passport.identity.npi,
          displayName:  passport.identity.displayName,
          specialty:    passport.identity.specialty ?? null,
          source:       'CMS NPPES',
          checkedAt:    passport.lastCheckedAt ?? null,
          status:       passport.identity.npi ? 'confirmed' : 'missing',
        },

        // ── Safety layer
        safety: {
          exclusionStatus:       passport.standing.exclusionStatus,
          exclusionCheckedAt:    passport.standing.exclusionCheckedAt ?? null,
          exclusionConfidence:   passport.standing.exclusionConfidenceLabel ?? null,
          source:                'OIG LEIE',
          isClear:               passport.standing.exclusionClear,
          negativeFindings:      passport.standing.negativeFindings.filter((f: string) =>
            !/pecos|enrollment|medicare/i.test(f)
          ),
        },

        // ── Authority layer
        authority: {
          credentials: passport.authority.credentials.map((c: {
            domain:               string;
            status:               string;
            jurisdiction?:        string | null;
            issuerName?:          string | null;
            sourceId?:            string | null;
            observedAt?:          string | null;
            verifiedAt?:          string | null;
            expiresAt?:           string | null;
            dataFreshnessLabel?:  string | null;
            claimConfidenceLabel?: string | null;
            authorityClaimCode?:  string | null;
            reviewRequired?:      boolean;
          }) => ({
            domain:        c.domain,
            status:        c.status,
            jurisdiction:  c.jurisdiction ?? null,
            issuerName:    c.issuerName ?? null,
            sourceId:      c.sourceId ?? null,
            observedAt:    c.observedAt ?? null,
            verifiedAt:    c.verifiedAt ?? null,
            expiresAt:     c.expiresAt ?? null,
            freshnessDays: c.dataFreshnessLabel ?? null,
            confidence:    c.claimConfidenceLabel ?? null,
            claimCode:     c.authorityClaimCode ?? null,
            reviewRequired: c.reviewRequired ?? false,
          })),
          summary: {
            active:  passport.authority.summary.active,
            missing: passport.authority.summary.missing,
          },
        },

        // ── Eligibility layer (MS16)
        eligibility: {
          pecosEnrollmentStatus: passport.standing.pecosEnrollmentStatus,
          enrollmentNote:        passport.standing.enrollmentNote ?? null,
          enrollmentDataVersion: passport.standing.enrollmentDataVersion ?? null,
          enrollmentDataFreshness: passport.standing.enrollmentDataFreshness ?? 'Quarterly',
          enrollmentCheckedAt:   passport.standing.enrollmentObservedAt ?? null,
          enrollmentConfidence:  passport.standing.enrollmentConfidenceLabel ?? null,
          source:                passport.standing.enrollmentSourceLabel ?? 'CMS PECOS',
        },

        // ── Readiness layer
        readiness: {
          score:               passport.readiness.score,
          estimatedStartDays:  passport.readiness.estimatedStartDays,
          blockers:            passport.readiness.blockers,
          nextActions:         passport.readiness.nextActions,
          readinessLevel:      trustState?.readiness_level ?? null,
        },

        // ── Source coverage — explicit, no assumptions
        sourceCoverage: {
          live:     ['NPPES', 'OIG / LEIE'],
          gated:    ['Nursys', 'FSMB'],
          mock:     ['CMS PECOS'],
          notChecked: ['NPDB', 'DEA', 'ABMS'],
        },
      };

      log('info', 'employer_packet_exported', {
        entityId,
        employerId,
        npi_prefix:  clinicianNpi.slice(0, 4) + '····',
        exportedAt,
        score:       packet.readiness.score,
        blockers:    packet.readiness.blockers.length,
      });

      // Set filename hint for browser download
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="vitalcv-packet-${clinicianNpi}-${new Date().toISOString().slice(0, 10)}.json"`,
      );
      res.setHeader('Content-Type', 'application/json');
      void res.json(packet);
    }),
  );

  log('info', 'employer_action_routes_registered', {
    routes: [
      'POST /api/employer-review/:entityId/accept',
      'POST /api/employer-review/:entityId/request-refresh',
      'POST /api/employer-review/:entityId/route-to-review',
      'GET  /api/employer-review/:entityId/packet',
    ],
  });
}
