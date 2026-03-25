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

import type { Express, NextFunction, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { HttpError } from '../utils/httpError';
import {
  captureAdvisoryEvent,
  captureEmployerDecision,
} from '../services/seal/sealEventCapture';
import { buildPassport } from '../services/entity/passportService';
import { buildEmployerEvidencePacket } from '../services/entity/employerPacket';
import {
  loadEmployerReviewStatus,
  recordEmployerReviewAcceptance,
  recordEmployerReviewRefreshRequest,
  recordEmployerReviewRouting,
  resolveEmployerReviewSubject,
} from '../services/entity/employerReviewActions';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

/** Extract Clerk user ID or throw 401 */
function requireClerkUserId(req: Request): string {
  const id = (req.headers['x-clerk-user-id'] as string | undefined)?.trim();
  if (!id) throw new HttpError(401, 'Missing x-clerk-user-id header.');
  return id;
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

      const subject = await resolveEmployerReviewSubject(entityId);
      if (!subject) throw new HttpError(404, `Entity ${entityId} not found or has no NPI.`);

      // Guard: no duplicate open acceptances
      const existing = await prisma.employerAcceptance.findFirst({
        where:  { employerId, clinicianNpi: subject.clinicianNpi, status: 'ACCEPTED' },
        select: { id: true },
      });
      if (existing) {
        return void res.status(409).json({
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

      const state = await recordEmployerReviewAcceptance({
        entityId,
        employerId,
        clinicianNpi: subject.clinicianNpi,
        role,
        facility,
        notes,
      });

      log('info', 'employer_review_accepted', {
        acceptanceId:  state.persistence.acceptanceId,
        auditEventId:  state.auditEventId,
        entityId,
        employerId,
        npi_prefix:    subject.clinicianNpi.slice(0, 4) + '····',
      });

      // SEAL: fire-and-forget employer decision signal with full trust snapshot
      void captureEmployerDecision({
        entityId,
        decision:                'PROCEED',
        reviewerRole:            'EMPLOYER',
        auditEventId:            state.auditEventId,
        trustSnapshotAtDecision: {
          acceptanceId:          state.persistence.acceptanceId,
          readinessStatus:       state.trustSnapshot.readinessStatus,
          readinessScore:        state.trustSnapshot.readinessScore,
          trustBand:             state.trustSnapshot.trustBand,
          trustScore:            state.trustSnapshot.trustScore,
          blockerCount:          state.trustSnapshot.blockerCount,
          exclusionStatus:       state.trustSnapshot.exclusionStatus,
          verifiedCredentials:   state.trustSnapshot.verifiedCredentialCount,
          staleCredentials:      state.trustSnapshot.staleCredentialCount,
          snapshotHash:          state.trustSnapshot.snapshotHash,
        },
        blockersAtDecision:      state.trustSnapshot.topBlockers,
        metadata:                { role: role ?? null, facility: facility ?? null },
      });

      return void res.status(201).json({ ok: true, state });
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

      const subject = await resolveEmployerReviewSubject(entityId);
      if (!subject) throw new HttpError(404, `Entity ${entityId} not found.`);

      const { staleSources, missingDomains, message } = (req.body ?? {}) as {
        staleSources?:    string[];
        missingDomains?:  string[];
        message?:         string;
      };
      const state = await recordEmployerReviewRefreshRequest({
        entityId,
        employerId,
        clinicianNpi: subject.clinicianNpi,
        staleSources,
        missingDomains,
        message,
      });

      log('info', 'employer_review_refresh_requested', {
        auditEventId: state.auditEventId,
        entityId,
        employerId,
        npi_prefix:    subject.clinicianNpi.slice(0, 4) + '····',
        staleSources:  state.details.staleSources,
        missingDomains: state.details.missingDomains,
      });

      // SEAL: fire-and-forget refresh request signal
      void captureAdvisoryEvent({
        entityId,
        advisoryVersion:       'employer-refresh-request',
        eventType:             'EMPLOYER_REVIEW',
        blockersAtEvent:       state.details.missingDomains,
        readinessScoreAtEvent: null,
        sourceCoverageAtEvent: { staleSources: state.details.staleSources },
        metadata:              { auditEventId: state.auditEventId, reason: 'refresh_requested' },
      });

      return void res.status(201).json({ ok: true, state });
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

      const subject = await resolveEmployerReviewSubject(entityId);
      if (!subject) throw new HttpError(404, `Entity ${entityId} not found.`);

      const { reason, priority } = (req.body ?? {}) as { reason?: string; priority?: string };
      const state = await recordEmployerReviewRouting({
        entityId,
        employerId,
        clinicianNpi: subject.clinicianNpi,
        reason,
        priority,
      });

      log('info', 'employer_review_routed_to_review', {
        auditEventId: state.auditEventId,
        entityId,
        employerId,
        npi_prefix:   subject.clinicianNpi.slice(0, 4) + '····',
        reason:       state.details.reason,
        priority:     state.details.priority,
        reviewItemId: state.persistence.reviewItemId,
      });

      // SEAL: fire-and-forget route-to-review decision signal with full trust snapshot
      void captureEmployerDecision({
        entityId,
        decision:                'ROUTE_TO_REVIEW',
        reviewerRole:            'EMPLOYER',
        auditEventId:            state.auditEventId,
        trustSnapshotAtDecision: {
          priority:            state.details.priority,
          reviewItemCreated:   state.persistence.reviewItemCreated,
          reviewItemId:        state.persistence.reviewItemId,
          readinessStatus:     state.trustSnapshot.readinessStatus,
          readinessScore:      state.trustSnapshot.readinessScore,
          trustBand:           state.trustSnapshot.trustBand,
          trustScore:          state.trustSnapshot.trustScore,
          blockerCount:        state.trustSnapshot.blockerCount,
          topBlockers:         state.trustSnapshot.topBlockers,
          exclusionStatus:     state.trustSnapshot.exclusionStatus,
          snapshotHash:        state.trustSnapshot.snapshotHash,
        },
        blockersAtDecision:      state.trustSnapshot.topBlockers,
        metadata:                {
          reason: state.details.reason,
          reviewItemCreated: state.persistence.reviewItemCreated,
        },
      });

      return void res.status(201).json({ ok: true, state });
    }),
  );

  app.get(
    '/api/employer-review/:entityId/status',
    asyncHandler(async (req, res) => {
      const employerId = requireClerkUserId(req);
      const { entityId } = req.params;

      if (!entityId?.trim()) throw new HttpError(400, 'entityId is required.');

      const subject = await resolveEmployerReviewSubject(entityId);
      if (!subject) throw new HttpError(404, `Entity ${entityId} not found.`);

      const state = await loadEmployerReviewStatus({
        entityId,
        employerId,
        clinicianNpi: subject.clinicianNpi,
      });

      return void res.status(200).json({ ok: true, state });
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
      const packet = buildEmployerEvidencePacket({
        passport,
        employerId,
      });

      log('info', 'employer_packet_exported', {
        entityId,
        employerId,
        npi_prefix:  clinicianNpi.slice(0, 4) + '····',
        exportedAt: packet.exportedAt,
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
      'GET  /api/employer-review/:entityId/status',
      'GET  /api/employer-review/:entityId/packet',
    ],
  });
}
