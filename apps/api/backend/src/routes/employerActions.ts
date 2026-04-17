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
 * Packet export is treated as a trust-distribution event and always writes an
 * audit record before returning the bundle.
 */

import { randomUUID } from 'node:crypto';
import type { Express, NextFunction, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { HttpError } from '../utils/httpError';
import { sha256ForPayload } from '../utils/deterministic';
import {
  captureEmployerDecision,
  captureStartOutcome,
} from '../services/seal/sealEventCapture';
import { emitLearningEvent } from '../services/feedback/prismaEventStore';
import { captureDecisionSignal } from '../services/feedback/decisionSignalService';
import { recomputeMatchBoosts } from '../services/feedback/matchBoostService';
import { buildPassport } from '../services/entity/passportService';
import { buildEmployerEvidencePacket } from '../services/entity/employerPacket';
import { createEmployerEvidencePacketZipStream } from '../services/entity/employerPacketExport';
import {
  loadEmployerAcceptanceHistory,
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

function resolvePacketExportFormat(req: Request): 'json' | 'zip' {
  const queryFormat = typeof req.query.format === 'string'
    ? req.query.format.trim().toLowerCase()
    : null;

  if (queryFormat && queryFormat !== 'json' && queryFormat !== 'zip') {
    throw new HttpError(400, 'format must be either json or zip.');
  }

  if (queryFormat === 'zip') {
    return 'zip';
  }
  if (queryFormat === 'json') {
    return 'json';
  }

  return (req.get('accept') ?? '').includes('application/zip') ? 'zip' : 'json';
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function buildEmployerDecisionMetadata(input: {
  attribution: {
    organizationContextId: string | null;
    bundleShareEventId: string | null;
    bundleId: string | null;
    organizationId: string | null;
    organizationName: string | null;
    purposeOfUse: string | null;
  };
  scopeSource?: Record<string, unknown> | null;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const scopeSource = input.scopeSource ?? {};

  return {
    eventName: 'employer_decision_recorded',
    organizationContextId: input.attribution.organizationContextId ?? null,
    bundleShareEventId: input.attribution.bundleShareEventId ?? null,
    bundleId: input.attribution.bundleId ?? null,
    organizationId: input.attribution.organizationId ?? null,
    organizationName: input.attribution.organizationName ?? null,
    purposeOfUse: input.attribution.purposeOfUse ?? null,
    pilotId: readOptionalString(scopeSource.pilotId),
    workflowLane: readOptionalString(scopeSource.workflowLane),
    geographyTag: readOptionalString(scopeSource.geographyTag),
    ...(input.extra ?? {}),
  };
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

      // ── Source coverage gate ────────────────────────────────────────
      // Validate that the passport is not BLOCKED at the moment of acceptance.
      // An employer must not accept a clinician whose spine sources are
      // not in a decision-grade state.
      const passport = await buildPassport(entityId);
      if (!passport) {
        throw new HttpError(422, 'Cannot accept: passport data is not available for this entity.');
      }
      if (passport.decisionPosture.status === 'BLOCKED') {
        return void res.status(422).json({
          error: 'acceptance_blocked',
          error_description: 'Cannot accept: one or more critical source checks are blocking readiness.',
          blockers: passport.decisionPosture.blockers,
          missingSources: passport.decisionPosture.missing.map((s) => s.sourceId),
        });
      }

      const { role, facility, notes } = (req.body ?? {}) as {
        role?:     string;
        facility?: string;
        notes?:    string;
        acceptanceScope?: string;
        acceptanceReason?: string;
        organizationContextId?: string;
        bundleId?: string;
      };

      const state = await recordEmployerReviewAcceptance({
        entityId,
        employerId,
        clinicianNpi: subject.clinicianNpi,
        organizationContextId: req.body?.organizationContextId,
        bundleId: req.body?.bundleId,
        role,
        facility,
        notes,
        acceptanceScope: req.body?.acceptanceScope,
        acceptanceReason: req.body?.acceptanceReason,
      });

      log('info', 'employer_review_accepted', {
        acceptanceId:  state.persistence.acceptanceId,
        auditEventId:  state.auditEventId,
        entityId,
        employerId,
        npi_prefix:    subject.clinicianNpi.slice(0, 4) + '····',
      });

      // SEAL: fire-and-forget employer decision signal with full trust snapshot
      const snap = state.trustSnapshot;
      void captureEmployerDecision({
        entityId,
        organizationContextId: state.attribution.organizationContextId,
        decision:                'PROCEED',
        reviewerRole:            'EMPLOYER',
        auditEventId:            state.auditEventId,
        trustSnapshotAtDecision: {
          acceptanceId:          state.persistence.acceptanceId,
          readinessStatus:       snap?.readinessStatus,
          readinessScore:        snap?.readinessScore,
          trustBand:             snap?.trustBand,
          trustScore:            snap?.trustScore,
          blockerCount:          snap?.blockerCount,
          exclusionStatus:       snap?.exclusionStatus,
          verifiedCredentials:   snap?.verifiedCredentialCount,
          staleCredentials:      snap?.staleCredentialCount,
          snapshotHash:          snap?.snapshotHash,
        },
        readinessScoreAtDecision: snap?.readinessScore ?? null,
        blockersAtDecision:      snap?.topBlockers ?? [],
        metadata:                buildEmployerDecisionMetadata({
          attribution: state.attribution,
          scopeSource: req.body ?? null,
          extra: {
            acceptedByOrgId: state.acceptance?.acceptedByOrgId ?? null,
            acceptanceScope: state.acceptance?.acceptanceScope ?? null,
            acceptanceReason: state.acceptance?.acceptanceReason ?? null,
            role: role ?? null,
            facility: facility ?? null,
          },
        }),
      });

      // Learning: capture accept decision signal + trigger boost recomputation
      void captureDecisionSignal({
        entityId,
        employerId,
        decision: 'accept',
        trustSnapshot: snap ? {
          readinessStatus: snap.readinessStatus,
          readinessScore: snap.readinessScore,
          trustBand: snap.trustBand,
          trustScore: snap.trustScore,
          blockerCount: snap.blockerCount,
          topBlockers: snap.topBlockers,
          exclusionStatus: snap.exclusionStatus,
          verifiedCredentialCount: snap.verifiedCredentialCount,
          staleCredentialCount: snap.staleCredentialCount,
          snapshotHash: snap.snapshotHash,
        } : null,
        bundleId: state.attribution.bundleId,
      });
      void recomputeMatchBoosts().catch(() => {});

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
        organizationContextId?: string;
        bundleId?: string;
      };
      const state = await recordEmployerReviewRefreshRequest({
        entityId,
        employerId,
        clinicianNpi: subject.clinicianNpi,
        organizationContextId: req.body?.organizationContextId,
        bundleId: req.body?.bundleId,
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

      // SEAL: fire-and-forget refresh request decision with full trust snapshot
      const snap = state.trustSnapshot;
      void captureEmployerDecision({
        entityId,
        organizationContextId: state.attribution.organizationContextId,
        decision: 'REQUEST_REFRESH',
        reviewerRole: 'EMPLOYER',
        auditEventId: state.auditEventId,
        trustSnapshotAtDecision: {
          staleSources: state.details.staleSources,
          missingDomains: state.details.missingDomains,
          readinessStatus: snap?.readinessStatus,
          readinessScore: snap?.readinessScore,
          trustBand: snap?.trustBand,
          trustScore: snap?.trustScore,
          blockerCount: snap?.blockerCount,
          topBlockers: snap?.topBlockers,
          exclusionStatus: snap?.exclusionStatus,
          snapshotHash: snap?.snapshotHash,
        },
        readinessScoreAtDecision: snap?.readinessScore ?? null,
        blockersAtDecision: [...new Set([
          ...(snap?.topBlockers ?? []),
          ...state.details.missingDomains,
        ])],
        metadata: buildEmployerDecisionMetadata({
          attribution: state.attribution,
          scopeSource: req.body ?? null,
          extra: {
            staleSources: state.details.staleSources,
            missingDomains: state.details.missingDomains,
            reason: state.details.reason,
          },
        }),
      });

      // Learning: capture request-info decision signal
      void captureDecisionSignal({
        entityId,
        employerId,
        decision: 'request_info',
        trustSnapshot: snap ? {
          readinessStatus: snap.readinessStatus,
          readinessScore: snap.readinessScore,
          trustBand: snap.trustBand,
          trustScore: snap.trustScore,
          blockerCount: snap.blockerCount,
          topBlockers: snap.topBlockers,
          exclusionStatus: snap.exclusionStatus,
          verifiedCredentialCount: snap.verifiedCredentialCount,
          staleCredentialCount: snap.staleCredentialCount,
          snapshotHash: snap.snapshotHash,
        } : null,
        bundleId: state.attribution.bundleId,
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

      const { reason, priority } = (req.body ?? {}) as {
        reason?: string;
        priority?: string;
        organizationContextId?: string;
        bundleId?: string;
      };
      const state = await recordEmployerReviewRouting({
        entityId,
        employerId,
        clinicianNpi: subject.clinicianNpi,
        organizationContextId: req.body?.organizationContextId,
        bundleId: req.body?.bundleId,
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
        organizationContextId: state.attribution.organizationContextId,
        decision:                'ROUTE_TO_REVIEW',
        reviewerRole:            'EMPLOYER',
        auditEventId:            state.auditEventId,
        trustSnapshotAtDecision: (() => {
          const s = state.trustSnapshot;
          return {
            priority:            state.details.priority,
            reviewItemCreated:   state.persistence.reviewItemCreated,
            reviewItemId:        state.persistence.reviewItemId,
            readinessStatus:     s?.readinessStatus,
            readinessScore:      s?.readinessScore,
            trustBand:           s?.trustBand,
            trustScore:          s?.trustScore,
            blockerCount:        s?.blockerCount,
            topBlockers:         s?.topBlockers,
            exclusionStatus:     s?.exclusionStatus,
            snapshotHash:        s?.snapshotHash,
          };
        })(),
        readinessScoreAtDecision: state.trustSnapshot?.readinessScore ?? null,
        blockersAtDecision:      state.trustSnapshot?.topBlockers ?? [],
        metadata:                buildEmployerDecisionMetadata({
          attribution: state.attribution,
          scopeSource: req.body ?? null,
          extra: {
            reason: state.details.reason,
            reviewItemCreated: state.persistence.reviewItemCreated,
          },
        }),
      });

      // Learning: capture reject decision signal + trigger boost recomputation
      void captureDecisionSignal({
        entityId,
        employerId,
        decision: 'reject',
        trustSnapshot: state.trustSnapshot ? {
          readinessStatus: state.trustSnapshot.readinessStatus,
          readinessScore: state.trustSnapshot.readinessScore,
          trustBand: state.trustSnapshot.trustBand,
          trustScore: state.trustSnapshot.trustScore,
          blockerCount: state.trustSnapshot.blockerCount,
          topBlockers: state.trustSnapshot.topBlockers,
          exclusionStatus: state.trustSnapshot.exclusionStatus,
          verifiedCredentialCount: state.trustSnapshot.verifiedCredentialCount,
          staleCredentialCount: state.trustSnapshot.staleCredentialCount,
          snapshotHash: state.trustSnapshot.snapshotHash,
        } : null,
        bundleId: state.attribution.bundleId,
      });
      void recomputeMatchBoosts().catch(() => {});

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
        organizationContextId: typeof req.query.organizationContextId === 'string'
          ? req.query.organizationContextId
          : undefined,
        bundleId: typeof req.query.bundleId === 'string'
          ? req.query.bundleId
          : undefined,
      });

      // Learning: track employer viewed event (fire-and-forget)
      emitLearningEvent({
        type: 'EMPLOYER_VIEWED',
        providerId: entityId,
        employerId,
        metadata: {},
        payload: {},
      });

      return void res.status(200).json({ ok: true, state });
    }),
  );

  app.get(
    '/api/employer-review/:entityId/acceptance-history',
    asyncHandler(async (req, res) => {
      const { entityId } = req.params;

      if (!entityId?.trim()) throw new HttpError(400, 'entityId is required.');

      const subject = await resolveEmployerReviewSubject(entityId);
      if (!subject) throw new HttpError(404, `Entity ${entityId} not found.`);

      const history = await loadEmployerAcceptanceHistory({
        entityId,
        clinicianNpi: subject.clinicianNpi,
      });

      return void res.status(200).json(history);
    }),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/employer-review/:entityId/packet
  // Evidence packet export — structured JSON or ZIP bundle of current trust state.
  // Every export writes an ARTIFACT_EXPORTED audit record before the payload is returned.
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
      const format = resolvePacketExportFormat(req);
      const packet = buildEmployerEvidencePacket({
        passport,
        employerId,
      });
      const auditMetadata = toJsonValue(JSON.parse(JSON.stringify({
        schema: 'vitalcv.employer.packet-export.v1',
        exportType: 'EMPLOYER_PACKET',
        format,
        employerId,
        entityId,
        clinicianNpi,
        exportedAt: packet.exportedAt,
        manifestHash: sha256ForPayload(packet.manifest),
        sourceIds: packet.manifest.sources.map((source) => source.sourceId),
        staleSources: packet.manifest.sources
          .filter((source) => source.state === 'stale')
          .map((source) => source.sourceId),
        reviewRequiredSources: packet.manifest.sources
          .filter((source) => source.reviewRequired)
          .map((source) => source.sourceId),
        receiptReferenceCount: packet.receiptReferences.length,
        artifactReferenceCount: packet.artifactReferences.length,
        sourceCoverageSummary: packet.sourceCoverageSummary,
        freshness: packet.freshness,
      })));
      await prisma.auditEvent.create({
        data: {
          type: 'ARTIFACT_EXPORTED',
          hash: sha256ForPayload({
            type: 'ARTIFACT_EXPORTED',
            referenceId: entityId,
            metadata: auditMetadata,
          }),
          referenceId: entityId,
          clinicianId: clinicianNpi,
          metadata: auditMetadata,
        },
      });

      log('info', 'employer_packet_exported', {
        entityId,
        employerId,
        npi_prefix:  clinicianNpi.slice(0, 4) + '····',
        exportedAt: packet.exportedAt,
        format,
        score:       packet.readiness.score,
        blockers:    packet.readiness.blockers.length,
      });

      const filenameStem = `vitalcv-packet-${clinicianNpi}-${new Date().toISOString().slice(0, 10)}`;
      if (format === 'zip') {
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${filenameStem}.zip"`,
        );
        res.setHeader('Content-Type', 'application/zip');
        createEmployerEvidencePacketZipStream(packet).pipe(res);
        return;
      }

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filenameStem}.json"`,
      );
      res.setHeader('Content-Type', 'application/json');
      void res.json(packet);
    }),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/employer-review/:entityId/share-packet
  // Generate an ephemeral share link and log an EMPLOYER_PACKET_SHARED audit event.
  // Returns: { ok, shareUrl, auditEventId }
  // ─────────────────────────────────────────────────────────────────────────
  app.post(
    '/api/employer-review/:entityId/share-packet',
    asyncHandler(async (req, res) => {
      const employerId = requireClerkUserId(req);
      const { entityId } = req.params;

      if (!entityId?.trim()) throw new HttpError(400, 'entityId is required.');

      const subject = await resolveEmployerReviewSubject(entityId);
      if (!subject) throw new HttpError(404, `Entity ${entityId} not found or has no NPI.`);

      const { npi: bodyNpi } = (req.body ?? {}) as { npi?: string };
      const clinicianNpi = bodyNpi ?? subject.clinicianNpi;

      // Generate ephemeral share token
      const shareToken = `chk_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
      const shareUrl = `${req.protocol}://${req.get('host')}/review/${shareToken}`;

      const auditMetadata = toJsonValue({
        schema: 'vitalcv.employer.packet-shared.v1',
        employerId,
        entityId,
        clinicianNpi,
        shareToken,
        shareUrl,
        sharedAt: new Date().toISOString(),
      });

      const auditEvent = await prisma.auditEvent.create({
        data: {
          type: 'EMPLOYER_PACKET_SHARED',
          hash: sha256ForPayload({
            type: 'EMPLOYER_PACKET_SHARED',
            referenceId: entityId,
            metadata: auditMetadata,
          }),
          referenceId: entityId,
          clinicianId: clinicianNpi,
          metadata: auditMetadata,
        },
      });

      log('info', 'employer_packet_shared', {
        auditEventId: auditEvent.id,
        entityId,
        employerId,
        npi_prefix: clinicianNpi.slice(0, 4) + '····',
        shareToken,
      });

      return void res.status(201).json({
        ok: true,
        shareUrl,
        auditEventId: auditEvent.id,
      });
    }),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/employer-review/:entityId/confirm-start
  // Record the clinician's actual start date, closing the wedge proof loop.
  // AUDIT CONTRACT: StartAttestation + AuditEvent written in $transaction
  //                 before returning 2xx (START_ATTESTED is a canonical
  //                 non-repudiation event).
  // Returns: { ok, attestationId, auditEventId, startedAt }
  // ─────────────────────────────────────────────────────────────────────────
  app.post(
    '/api/employer-review/:entityId/confirm-start',
    asyncHandler(async (req, res) => {
      const employerId = requireClerkUserId(req);
      const { entityId } = req.params;

      if (!entityId?.trim()) throw new HttpError(400, 'entityId is required.');

      const subject = await resolveEmployerReviewSubject(entityId);
      if (!subject) throw new HttpError(404, `Entity ${entityId} not found or has no NPI.`);

      const { startedAt, role, facility, acceptanceId: bodyAcceptanceId } = (req.body ?? {}) as {
        startedAt?: string;
        role?:      string;
        facility?:  string;
        acceptanceId?: string;
      };

      if (!startedAt) throw new HttpError(400, 'startedAt is required.');
      if (!role?.trim()) throw new HttpError(400, 'role is required.');
      if (!facility?.trim()) throw new HttpError(400, 'facility is required.');

      const startDate = new Date(startedAt);
      if (isNaN(startDate.getTime())) throw new HttpError(400, 'startedAt must be a valid ISO date.');

      // Resolve the open acceptance for this employer+clinician.
      // If a specific acceptanceId is provided, use it; otherwise find the most recent ACCEPTED one.
      const acceptance = await (bodyAcceptanceId
        ? prisma.employerAcceptance.findFirst({
            where:  { id: bodyAcceptanceId, employerId, status: 'ACCEPTED' },
            select: { id: true, clinicianNpi: true },
          })
        : prisma.employerAcceptance.findFirst({
            where:   { employerId, clinicianNpi: subject.clinicianNpi, status: 'ACCEPTED' },
            orderBy: { acceptedAt: 'desc' },
            select:  { id: true, clinicianNpi: true },
          })
      );

      if (!acceptance) {
        throw new HttpError(409, 'No active acceptance found for this employer/clinician pair. Accept first before recording a start.');
      }

      const attestationId = randomUUID();
      const auditEventId  = randomUUID();
      const attestationHash = sha256ForPayload({
        attestationId,
        acceptanceId: acceptance.id,
        entityId,
        employerId,
        clinicianNpi: acceptance.clinicianNpi,
        startedAt: startDate.toISOString(),
        role,
        facility,
      });

      // AUDIT: START_ATTESTED is one of the 5 canonical non-repudiation events.
      // StartAttestation and AuditEvent are written atomically before returning 2xx.
      const { attestation } = await prisma.$transaction(async (tx) => {
        const created = await tx.startAttestation.create({
          data: {
            id:          attestationId,
            acceptanceId: acceptance.id,
            role:        role.trim(),
            facility:    facility.trim(),
            startedAt:   startDate,
          },
        });

        await tx.auditEvent.create({
          data: {
            id:          auditEventId,
            type:        'START_ATTESTED',
            hash:        attestationHash,
            referenceId: attestationId,
            clinicianId: acceptance.clinicianNpi,
            anchored:    false,
            metadata: {
              attestationId,
              acceptanceId: acceptance.id,
              entityId,
              employerId,
              startedAt:   startDate.toISOString(),
              role,
              facility,
            },
          },
        });

        return { attestation: created };
      });

      log('info', 'employer_start_attested', {
        attestationId:  attestation.id,
        auditEventId,
        acceptanceId:   acceptance.id,
        entityId,
        employerId,
        npi_prefix:     (acceptance.clinicianNpi ?? '0000000000').slice(0, 4) + '····',
        startedAt:      startDate.toISOString(),
      });

      // SEAL: fire-and-forget start outcome capture for KPI funnel
      void captureStartOutcome({
        entityId,
        startedAt:             startDate,
        blockersAtStart:       [],
        sourceCoverageAtStart: {},
        metadata: {
          attestationId:  attestation.id,
          acceptanceId:   acceptance.id,
          employerId,
          role,
          facility,
          recordedVia: 'employer_review_confirm_start',
        },
      }).catch((err: unknown) => {
        log('warn', 'start_outcome_capture_failed', {
          attestationId: attestation.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });

      return void res.status(201).json({
        ok:            true,
        attestationId: attestation.id,
        auditEventId,
        startedAt:     startDate.toISOString(),
      });
    }),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/employer-review/npi/:npi/refresh-requests
  // Returns recent pending refresh requests for a clinician NPI.
  // Clinician-facing: surfaces "an employer has requested updated credentials."
  // No auth required — NPI is already public; the response contains no PII beyond count.
  // ─────────────────────────────────────────────────────────────────────────
  app.get(
    '/api/employer-review/npi/:npi([0-9]{10})/refresh-requests',
    asyncHandler(async (req, res) => {
      const { npi } = req.params;

      const LOOKBACK_DAYS = 30;
      const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

      const latest = await prisma.auditEvent.findFirst({
        where: {
          type:        'EMPLOYER_REVIEW_REFRESH_REQUESTED',
          clinicianId: npi,
          createdAt:   { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        select:  { id: true, createdAt: true },
      });

      const count = latest
        ? await prisma.auditEvent.count({
            where: {
              type:        'EMPLOYER_REVIEW_REFRESH_REQUESTED',
              clinicianId: npi,
              createdAt:   { gte: since },
            },
          })
        : 0;

      return void res.status(200).json({
        hasPendingRequest: count > 0,
        count,
        latestAt: latest?.createdAt.toISOString() ?? null,
      });
    }),
  );

  log('info', 'employer_action_routes_registered', {
    routes: [
      'POST /api/employer-review/:entityId/accept',
      'POST /api/employer-review/:entityId/request-refresh',
      'POST /api/employer-review/:entityId/route-to-review',
      'GET  /api/employer-review/:entityId/status',
      'GET  /api/employer-review/:entityId/acceptance-history',
      'GET  /api/employer-review/:entityId/packet',
      'POST /api/employer-review/:entityId/share-packet',
      'POST /api/employer-review/:entityId/confirm-start',
      'GET  /api/employer-review/npi/:npi/refresh-requests',
    ],
  });
}
