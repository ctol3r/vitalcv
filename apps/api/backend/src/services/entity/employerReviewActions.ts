import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { sha256ForPayload } from '../../utils/deterministic';
import { buildPassportByNpi } from './passportService';
import { computeTrustScoreV1 } from '../trust/trustScoreV1';
import { log } from '../../obs/logger';
import type {
  CanonicalSourceCoverageSummary,
  CanonicalTruthDimensionId,
  CanonicalTruthStatus,
} from '../../../../../../packages/trust-state';

export type EmployerReviewActionIntent = 'accept' | 'refresh' | 'review';
export type EmployerReviewPriority = 'LOW' | 'NORMAL' | 'HIGH';
export type EmployerReviewPersistenceMode = 'durable_record' | 'audit_only';
export type EmployerReviewPersistenceTarget =
  | 'employer_acceptance'
  | 'review_queue_item'
  | 'outbox_event'
  | 'audit_event';

export interface EmployerReviewActionDetails {
  staleSources: string[];
  missingDomains: string[];
  reason: string | null;
  priority: EmployerReviewPriority | null;
}

export interface EmployerReviewActionSummary {
  title: string;
  description: string;
}

export interface EmployerReviewActionPersistence {
  mode: EmployerReviewPersistenceMode;
  target: EmployerReviewPersistenceTarget;
  acceptanceId: string | null;
  reviewItemId: string | null;
  outboxEventId: string | null;
  reviewItemCreated: boolean;
}

// ── Decision Trust Snapshot ──────────────────────────────────────────────────
//
// Captured at the moment an employer takes an action.
// Stored in the audit event metadata — immutable record of passport state
// at time of decision. Used for:
//   - Audit trail: "what state was the passport in when this was accepted?"
//   - Dispute resolution
//   - Pilot ROI measurement
//
// TRUTH CONTRACT: Every field comes from the trust spine. No assumptions.
// Missing/unavailable fields → explicit null, never omitted.

export interface DecisionTrustSnapshot {
  /** SHA-256 of the snapshot payload — verifiable receipt */
  snapshotHash: string;
  capturedAt: string;
  npi: string;
  readinessStatus: string;
  readinessScore: number;
  readinessLevel: string;
  trustBand: string;
  trustBandLabel: string;
  trustScore: number;
  trustScoreConfidence: number;
  exclusionStatus: string;
  exclusionCheckedAt: string | null;
  pecosEnrollmentStatus: string;
  verifiedCredentialCount: number;
  staleCredentialCount: number;
  reviewRequiredCount: number;
  blockerCount: number;
  topBlockers: string[];
  missingDomains: string[];
  gatedDomains: string[];
  truthStatuses: Record<CanonicalTruthDimensionId, CanonicalTruthStatus>;
  sourceCoverageSummary: CanonicalSourceCoverageSummary;
  lastCheckedAt: string | null;
}

function emptyTruthStatuses(): Record<CanonicalTruthDimensionId, CanonicalTruthStatus> {
  return {
    identity: 'PENDING',
    safety: 'PENDING',
    authority: 'PENDING',
    eligibility: 'PENDING',
  };
}

function emptySourceCoverageSummary(): CanonicalSourceCoverageSummary {
  return {
    checked: [],
    stale: [],
    pending: [],
    gated: [],
    unavailable: [],
    accessRequired: [],
    reviewRequired: [],
    notDecisionGrade: [],
    previewOnly: [],
  };
}

/**
 * Builds a DecisionTrustSnapshot from real passport + trust score data.
 * Non-blocking: returns a minimal snapshot on any failure so actions are never blocked.
 */
export async function buildDecisionTrustSnapshot(
  npi: string,
): Promise<DecisionTrustSnapshot> {
  const capturedAt = new Date().toISOString();

  try {
    const [passport, trustScore] = await Promise.all([
      buildPassportByNpi(npi).catch(() => null),
      computeTrustScoreV1(npi).catch(() => null),
    ]);

    if (!passport) {
      const minimal: DecisionTrustSnapshot = {
        snapshotHash: '',
        capturedAt,
        npi,
        readinessStatus: 'UNKNOWN',
        readinessScore: 0,
        readinessLevel: 'L0',
        trustBand: 'L0',
        trustBandLabel: 'UNVERIFIED',
        trustScore: 0,
        trustScoreConfidence: 0,
        exclusionStatus: 'UNCHECKED',
        exclusionCheckedAt: null,
        pecosEnrollmentStatus: 'UNKNOWN',
        verifiedCredentialCount: 0,
        staleCredentialCount: 0,
        reviewRequiredCount: 0,
        blockerCount: 0,
        topBlockers: [],
        missingDomains: [],
        gatedDomains: [],
        truthStatuses: emptyTruthStatuses(),
        sourceCoverageSummary: emptySourceCoverageSummary(),
        lastCheckedAt: null,
      };
      minimal.snapshotHash = sha256ForPayload(minimal);
      return minimal;
    }

    const creds = passport.authority.credentials;
    const staleCount = creds.filter(c => c.stale).length;
    const reviewCount = creds.filter(c => c.reviewRequired).length;
    const verifiedCount = creds.filter(c => !c.stale && !c.reviewRequired).length;

    const blockers = passport.readiness?.nextActions ?? [];
    const gatedDomains: string[] = [];
    if (passport.truth.authority.status === 'ACCESS REQUIRED') gatedDomains.push('STATE_LICENSE');
    if (passport.truth.eligibility.status === 'ACCESS REQUIRED') gatedDomains.push('MEDICARE_ENROLLMENT');

    const bandMap: Record<string, string> = {
      READY: 'L3', PARTIAL: 'L2', BLOCKED: 'L0', UNKNOWN: 'L0',
    };

    const snapshot: DecisionTrustSnapshot = {
      snapshotHash: '',
      capturedAt,
      npi,
      readinessStatus: passport.readiness?.status ?? 'UNKNOWN',
      readinessScore: passport.readiness?.score ?? 0,
      readinessLevel: passport.readiness?.level ?? 'L0',
      trustBand: trustScore?.band ?? bandMap[passport.readiness?.status ?? 'UNKNOWN'] ?? 'L0',
      trustBandLabel: trustScore?.bandLabel ?? 'UNVERIFIED',
      trustScore: trustScore?.score ?? 0,
      trustScoreConfidence: trustScore?.confidence ?? 0,
      exclusionStatus: passport.standing.exclusionStatus,
      exclusionCheckedAt: passport.standing.exclusionCheckedAt ?? null,
      pecosEnrollmentStatus: passport.standing.pecosEnrollmentStatus,
      verifiedCredentialCount: verifiedCount,
      staleCredentialCount: staleCount,
      reviewRequiredCount: reviewCount,
      blockerCount: blockers.length,
      topBlockers: blockers.slice(0, 5).map(b => b.title),
      missingDomains: passport.authority.summary.missing.slice(0, 10),
      gatedDomains,
      truthStatuses: {
        identity: passport.truth.identity.status,
        safety: passport.truth.safety.status,
        authority: passport.truth.authority.status,
        eligibility: passport.truth.eligibility.status,
      },
      sourceCoverageSummary: passport.sourceCoverage.summary,
      lastCheckedAt: passport.lastCheckedAt ?? null,
    };

    snapshot.snapshotHash = sha256ForPayload(snapshot);

    log('info', 'decision_trust_snapshot_captured', {
      npi,
      readinessStatus: snapshot.readinessStatus,
      trustBand: snapshot.trustBand,
      trustScore: snapshot.trustScore,
      blockerCount: snapshot.blockerCount,
    });

    return snapshot;
  } catch (err) {
    log('error', 'decision_trust_snapshot_failed', { npi, err: String(err) });
    const fallback: DecisionTrustSnapshot = {
      snapshotHash: '',
      capturedAt,
      npi,
      readinessStatus: 'UNKNOWN',
      readinessScore: 0,
      readinessLevel: 'L0',
      trustBand: 'L0',
      trustBandLabel: 'UNVERIFIED',
      trustScore: 0,
      trustScoreConfidence: 0,
      exclusionStatus: 'UNCHECKED',
      exclusionCheckedAt: null,
      pecosEnrollmentStatus: 'UNKNOWN',
      verifiedCredentialCount: 0,
      staleCredentialCount: 0,
      reviewRequiredCount: 0,
      blockerCount: 0,
      topBlockers: [],
      missingDomains: [],
      gatedDomains: [],
      truthStatuses: emptyTruthStatuses(),
      sourceCoverageSummary: emptySourceCoverageSummary(),
      lastCheckedAt: null,
    };
    fallback.snapshotHash = sha256ForPayload(fallback);
    return fallback;
  }
}

interface EmployerReviewActionAuditMetadata {
  action: EmployerReviewActionIntent;
  employerId: string;
  entityId: string;
  clinicianNpi: string;
  requestId: string;
  persistence: EmployerReviewActionPersistence;
  summary: EmployerReviewActionSummary;
  details: EmployerReviewActionDetails;
  context: {
    role: string | null;
    facility: string | null;
    notes: string | null;
  };
  /** Immutable trust state at time of decision — core of the audit trail.
   *  Optional for backwards compat: records written before a43b82d0 won't have it. */
  trustSnapshot?: DecisionTrustSnapshot;
}

export interface EmployerReviewActionState {
  action: EmployerReviewActionIntent;
  entityId: string;
  clinicianNpi: string;
  auditEventId: string;
  timestamp: string;
  persistence: EmployerReviewActionPersistence;
  summary: EmployerReviewActionSummary;
  details: EmployerReviewActionDetails;
  /** Trust state captured at the moment of this action — immutable audit record.
   *  Optional for backwards compat: records written before a43b82d0 won't have it. */
  trustSnapshot?: DecisionTrustSnapshot;
}

export interface EmployerReviewActionResponse {
  ok: true;
  state: EmployerReviewActionState;
}

export interface EmployerReviewStatusResponse {
  ok: true;
  state: EmployerReviewActionState | null;
}

export interface EmployerReviewSubject {
  entityId: string;
  clinicianNpi: string;
}

type EmployerActionAuditType =
  | 'EMPLOYER_REVIEW_ACCEPTED'
  | 'EMPLOYER_REVIEW_REFRESH_REQUESTED'
  | 'EMPLOYER_REVIEW_ROUTED_TO_REVIEW';

type OptionalHitlWriter = {
  hITLReviewItem?: {
    create: (args: {
      data: {
        id: string;
        entityId: string;
        clinicianNpi: string;
        employerId: string;
        status: string;
        priority: EmployerReviewPriority;
        reason: string;
        createdAt: Date;
      };
    }) => Promise<{ id: string }>;
  };
};

type AuditWriter = {
  auditEvent: {
    create: (args: {
      data: Prisma.AuditEventUncheckedCreateInput;
    }) => Promise<{ id: string; createdAt: Date }>;
    findFirst?: (args: Record<string, unknown>) => Promise<EmployerAuditEventRecord | null>;
  };
};

type OutboxWriter = {
  outboxEvent: {
    upsert: (args: Record<string, unknown>) => Promise<{ id: string }>;
  };
};

type AcceptanceWriter = {
  employerAcceptance: {
    create: (args: {
      data: Prisma.EmployerAcceptanceUncheckedCreateInput;
    }) => Promise<{ id: string; acceptedAt: Date }>;
    findFirst?: (args: Record<string, unknown>) => Promise<{
      id: string;
      acceptedAt: Date;
      status: string;
    } | null>;
  };
};

type EmployerAuditEventRecord = {
  id: string;
  createdAt: Date;
  metadata: unknown;
};

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function sanitizeString(value: unknown, maxLength = 280): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function sanitizeStringList(value: unknown, maxItems = 8): string[] {
  if (!Array.isArray(value)) return [];

  const normalized = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(normalized)).slice(0, maxItems);
}

function normalizePriority(value: unknown): EmployerReviewPriority {
  if (typeof value !== 'string') return 'NORMAL';

  switch (value.trim().toUpperCase()) {
    case 'HIGH':
      return 'HIGH';
    case 'LOW':
      return 'LOW';
    default:
      return 'NORMAL';
  }
}

function buildActionSummary(
  action: EmployerReviewActionIntent,
  persistence: EmployerReviewActionPersistence,
): EmployerReviewActionSummary {
  switch (action) {
    case 'accept':
      return {
        title: 'Head start accepted',
        description: 'The employer acceptance was persisted and linked to an audit event.',
      };
    case 'refresh':
      return {
        title: 'Refresh request recorded',
        description: persistence.outboxEventId
          ? 'The refresh request was persisted and queued for downstream processing.'
          : 'The refresh request was persisted in the audit trail.',
      };
    case 'review':
      return persistence.reviewItemCreated
        ? {
            title: 'Routed to review',
            description: 'The routing decision and manual review queue item were both persisted.',
          }
        : persistence.outboxEventId
          ? {
              title: 'Review routing recorded',
              description: 'The routing decision was persisted and queued for backend follow-up, but no durable manual review queue item was created in this environment.',
            }
        : {
            title: 'Review routing recorded',
            description: 'The routing decision was persisted in the audit trail, but no durable manual review queue item was created in this environment.',
          };
    default:
      return {
        title: 'Employer action recorded',
        description: 'The employer action was persisted.',
      };
  }
}

function buildEmptyDetails(overrides?: Partial<EmployerReviewActionDetails>): EmployerReviewActionDetails {
  return {
    staleSources: overrides?.staleSources ?? [],
    missingDomains: overrides?.missingDomains ?? [],
    reason: overrides?.reason ?? null,
    priority: overrides?.priority ?? null,
  };
}

function buildState(input: {
  auditEventId: string;
  timestamp: string;
  metadata: EmployerReviewActionAuditMetadata;
}): EmployerReviewActionState {
  return {
    action: input.metadata.action,
    entityId: input.metadata.entityId,
    clinicianNpi: input.metadata.clinicianNpi,
    auditEventId: input.auditEventId,
    timestamp: input.timestamp,
    persistence: input.metadata.persistence,
    summary: input.metadata.summary,
    details: input.metadata.details,
    trustSnapshot: input.metadata.trustSnapshot,
  };
}

function readMetadata(metadata: unknown): EmployerReviewActionAuditMetadata | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;

  const candidate = (metadata as { employerReviewAction?: unknown }).employerReviewAction;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;

  const record = candidate as Partial<EmployerReviewActionAuditMetadata>;
  if (
    (record.action !== 'accept' && record.action !== 'refresh' && record.action !== 'review')
    || typeof record.entityId !== 'string'
    || typeof record.clinicianNpi !== 'string'
    || typeof record.employerId !== 'string'
    || !record.persistence
    || !record.summary
    || !record.details
  ) {
    return null;
  }

  return {
    action: record.action,
    employerId: record.employerId,
    entityId: record.entityId,
    clinicianNpi: record.clinicianNpi,
    requestId: typeof record.requestId === 'string' ? record.requestId : 'unknown',
    persistence: {
      ...record.persistence,
      outboxEventId: record.persistence.outboxEventId ?? null,
    },
    summary: record.summary,
    details: record.details,
    context: record.context ?? { role: null, facility: null, notes: null },
    trustSnapshot:
      record.trustSnapshot && typeof record.trustSnapshot === 'object'
        ? record.trustSnapshot
        : undefined,
  };
}

function buildEmployerReviewOutboxPayload(
  metadata: EmployerReviewActionAuditMetadata,
): Prisma.InputJsonValue {
  return toJsonValue({
    schema: 'vitalcv.employer-review.action.v1',
    action: metadata.action,
    employerId: metadata.employerId,
    entityId: metadata.entityId,
    clinicianNpi: metadata.clinicianNpi,
    requestId: metadata.requestId,
    summary: metadata.summary,
    details: metadata.details,
    context: metadata.context,
    trustSnapshot: metadata.trustSnapshot ?? null,
  });
}

async function writeEmployerReviewOutboxEvent(
  writer: OutboxWriter,
  input: {
    type: EmployerActionAuditType;
    metadata: EmployerReviewActionAuditMetadata;
    availableAt: Date;
  },
): Promise<{ id: string }> {
  const dedupeKey = [
    'employer-review',
    input.metadata.action,
    input.metadata.employerId,
    input.metadata.entityId,
    input.metadata.requestId,
  ].join(':');

  return writer.outboxEvent.upsert({
    where: { dedupeKey },
    update: {
      payload: buildEmployerReviewOutboxPayload(input.metadata),
      status: 'PENDING',
      availableAt: input.availableAt,
      lastError: null,
    },
    create: {
      eventType: input.type,
      aggregateType: 'EMPLOYER_REVIEW',
      aggregateId: input.metadata.entityId,
      payload: buildEmployerReviewOutboxPayload(input.metadata),
      dedupeKey,
      status: 'PENDING',
      attemptCount: 0,
      availableAt: input.availableAt,
    },
    select: { id: true },
  });
}

async function writeEmployerReviewAuditEvent(
  writer: AuditWriter,
  input: {
    type: EmployerActionAuditType;
    referenceId: string;
    metadata: EmployerReviewActionAuditMetadata;
  },
): Promise<{ id: string; createdAt: Date }> {
  const actionHash = sha256ForPayload({
    type: input.type,
    referenceId: input.referenceId,
    employerReviewAction: input.metadata,
  });

  return writer.auditEvent.create({
    data: {
      id: randomUUID(),
      type: input.type,
      hash: actionHash,
      referenceId: input.referenceId,
      clinicianId: input.metadata.clinicianNpi,
      anchored: false,
      metadata: toJsonValue({
        employerReviewAction: input.metadata,
        actionHash,
      }),
    },
  });
}

export async function resolveEmployerReviewSubject(
  entityId: string,
): Promise<EmployerReviewSubject | null> {
  if (!entityId.trim()) return null;

  const entity = await prisma.vcvEntity.findUnique({
    where: { id: entityId },
    select: { id: true, npi: true },
  });

  if (!entity?.npi) return null;

  return {
    entityId: entity.id,
    clinicianNpi: entity.npi,
  };
}

export async function recordEmployerReviewAcceptance(input: {
  entityId: string;
  employerId: string;
  clinicianNpi: string;
  role?: unknown;
  facility?: unknown;
  notes?: unknown;
}): Promise<EmployerReviewActionState> {
  const now = new Date();
  const requestId = randomUUID();
  const context = {
    role: sanitizeString(input.role, 80),
    facility: sanitizeString(input.facility, 120),
    notes: sanitizeString(input.notes, 500),
  };

  // ── Capture trust snapshot BEFORE transaction — immutable audit record ──
  const trustSnapshot = await buildDecisionTrustSnapshot(input.clinicianNpi);

  const persistenceBase: EmployerReviewActionPersistence = {
    mode: 'durable_record',
    target: 'employer_acceptance',
    acceptanceId: null,
    reviewItemId: null,
    outboxEventId: null,
    reviewItemCreated: false,
  };

  const { auditEvent, metadata } = await prisma.$transaction(async (tx) => {
    const acceptance = await tx.employerAcceptance.create({
      data: {
        id: randomUUID(),
        employerId: input.employerId,
        clinicianNpi: input.clinicianNpi,
        artifactId: null,
        status: 'ACCEPTED',
        acceptedAt: now,
      },
    });

    const seededPersistence: EmployerReviewActionPersistence = {
      ...persistenceBase,
      acceptanceId: acceptance.id,
    };
    const outboxEvent = await writeEmployerReviewOutboxEvent(
      tx as unknown as OutboxWriter,
      {
        type: 'EMPLOYER_REVIEW_ACCEPTED',
        availableAt: now,
        metadata: {
          action: 'accept',
          employerId: input.employerId,
          entityId: input.entityId,
          clinicianNpi: input.clinicianNpi,
          requestId,
          persistence: seededPersistence,
          summary: buildActionSummary('accept', seededPersistence),
          details: buildEmptyDetails(),
          context,
          trustSnapshot,
        },
      },
    );

    const persistence: EmployerReviewActionPersistence = {
      ...seededPersistence,
      outboxEventId: outboxEvent.id,
    };
    const metadata: EmployerReviewActionAuditMetadata = {
      action: 'accept',
      employerId: input.employerId,
      entityId: input.entityId,
      clinicianNpi: input.clinicianNpi,
      requestId,
      persistence,
      summary: buildActionSummary('accept', persistence),
      details: buildEmptyDetails(),
      context,
      trustSnapshot,
    };

    const auditEvent = await writeEmployerReviewAuditEvent(
      tx as unknown as AuditWriter,
      {
        type: 'EMPLOYER_REVIEW_ACCEPTED',
        referenceId: acceptance.id,
        metadata,
      },
    );

    return { auditEvent, metadata };
  });

  return buildState({
    auditEventId: auditEvent.id,
    timestamp: auditEvent.createdAt.toISOString(),
    metadata,
  });
}

export async function recordEmployerReviewRefreshRequest(input: {
  entityId: string;
  employerId: string;
  clinicianNpi: string;
  staleSources?: unknown;
  missingDomains?: unknown;
  message?: unknown;
}): Promise<EmployerReviewActionState> {
  // Capture snapshot before write
  const trustSnapshot = await buildDecisionTrustSnapshot(input.clinicianNpi);
  const requestId = randomUUID();
  const details = buildEmptyDetails({
    staleSources: sanitizeStringList(input.staleSources),
    missingDomains: sanitizeStringList(input.missingDomains),
    reason: sanitizeString(input.message, 500),
  });
  const basePersistence: EmployerReviewActionPersistence = {
    mode: 'durable_record',
    target: 'outbox_event',
    acceptanceId: null,
    reviewItemId: null,
    outboxEventId: null,
    reviewItemCreated: false,
  };

  const { auditEvent, metadata } = await prisma.$transaction(async (tx) => {
    const seededMetadata: EmployerReviewActionAuditMetadata = {
      action: 'refresh',
      employerId: input.employerId,
      entityId: input.entityId,
      clinicianNpi: input.clinicianNpi,
      requestId,
      persistence: basePersistence,
      summary: buildActionSummary('refresh', basePersistence),
      details,
      context: {
        role: null,
        facility: null,
        notes: null,
      },
      trustSnapshot,
    };

    const outboxEvent = await writeEmployerReviewOutboxEvent(
      tx as unknown as OutboxWriter,
      {
        type: 'EMPLOYER_REVIEW_REFRESH_REQUESTED',
        metadata: seededMetadata,
        availableAt: new Date(),
      },
    );

    const persistence: EmployerReviewActionPersistence = {
      ...basePersistence,
      outboxEventId: outboxEvent.id,
    };
    const metadata: EmployerReviewActionAuditMetadata = {
      ...seededMetadata,
      persistence,
      summary: buildActionSummary('refresh', persistence),
    };

    const auditEvent = await writeEmployerReviewAuditEvent(
      tx as unknown as AuditWriter,
      {
        type: 'EMPLOYER_REVIEW_REFRESH_REQUESTED',
        referenceId: input.entityId,
        metadata,
      },
    );

    return { auditEvent, metadata };
  });

  return buildState({
    auditEventId: auditEvent.id,
    timestamp: auditEvent.createdAt.toISOString(),
    metadata,
  });
}

export async function recordEmployerReviewRouting(input: {
  entityId: string;
  employerId: string;
  clinicianNpi: string;
  reason?: unknown;
  priority?: unknown;
}): Promise<EmployerReviewActionState> {
  const now = new Date();
  const requestId = randomUUID();
  const normalizedPriority = normalizePriority(input.priority);
  const normalizedReason =
    sanitizeString(input.reason, 500)
    ?? 'Employer routed for manual review.';

  // Capture snapshot before transaction
  const trustSnapshot = await buildDecisionTrustSnapshot(input.clinicianNpi);

  const { auditEvent, metadata } = await prisma.$transaction(async (tx) => {
    let reviewItemId: string | null = null;

    try {
      const hitlWriter = tx as unknown as OptionalHitlWriter;
      const reviewItem = await hitlWriter.hITLReviewItem?.create({
        data: {
          id: randomUUID(),
          entityId: input.entityId,
          clinicianNpi: input.clinicianNpi,
          employerId: input.employerId,
          status: 'PENDING',
          priority: normalizedPriority,
          reason: normalizedReason,
          createdAt: now,
        },
      });
      reviewItemId = reviewItem?.id ?? null;
    } catch {
      reviewItemId = null;
    }

    const seededPersistence: EmployerReviewActionPersistence = {
      mode: 'durable_record',
      target: reviewItemId ? 'review_queue_item' : 'outbox_event',
      acceptanceId: null,
      reviewItemId,
      outboxEventId: null,
      reviewItemCreated: Boolean(reviewItemId),
    };
    const seededMetadata: EmployerReviewActionAuditMetadata = {
      action: 'review',
      employerId: input.employerId,
      entityId: input.entityId,
      clinicianNpi: input.clinicianNpi,
      requestId,
      persistence: seededPersistence,
      summary: buildActionSummary('review', seededPersistence),
      details: buildEmptyDetails({
        reason: normalizedReason,
        priority: normalizedPriority,
      }),
      context: {
        role: null,
        facility: null,
        notes: null,
      },
      trustSnapshot,
    };

    const outboxEvent = await writeEmployerReviewOutboxEvent(
      tx as unknown as OutboxWriter,
      {
        type: 'EMPLOYER_REVIEW_ROUTED_TO_REVIEW',
        metadata: seededMetadata,
        availableAt: now,
      },
    );

    const persistence: EmployerReviewActionPersistence = {
      ...seededPersistence,
      outboxEventId: outboxEvent.id,
    };
    const metadata: EmployerReviewActionAuditMetadata = {
      ...seededMetadata,
      persistence,
      summary: buildActionSummary('review', persistence),
    };

    const auditEvent = await writeEmployerReviewAuditEvent(
      tx as unknown as AuditWriter,
      {
        type: 'EMPLOYER_REVIEW_ROUTED_TO_REVIEW',
        referenceId: input.entityId,
        metadata,
      },
    );

    return { auditEvent, metadata };
  });

  return buildState({
    auditEventId: auditEvent.id,
    timestamp: auditEvent.createdAt.toISOString(),
    metadata,
  });
}

export async function loadEmployerReviewStatus(input: {
  entityId: string;
  employerId: string;
  clinicianNpi: string;
}): Promise<EmployerReviewActionState | null> {
  const [latestAcceptance, latestAuditOnly] = await Promise.all([
    prisma.employerAcceptance.findFirst({
      where: {
        employerId: input.employerId,
        clinicianNpi: input.clinicianNpi,
        status: 'ACCEPTED',
      },
      select: {
        id: true,
        acceptedAt: true,
        status: true,
      },
      orderBy: {
        acceptedAt: 'desc',
      },
    }),
    prisma.auditEvent.findFirst({
      where: {
        referenceId: input.entityId,
        type: {
          in: [
            'EMPLOYER_REVIEW_REFRESH_REQUESTED',
            'EMPLOYER_REVIEW_ROUTED_TO_REVIEW',
          ],
        },
        metadata: {
          path: ['employerReviewAction', 'employerId'],
          equals: input.employerId,
        },
      },
      select: {
        id: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
  ]);

  let latestAcceptanceState: EmployerReviewActionState | null = null;
  if (latestAcceptance) {
    const acceptanceAudit = await prisma.auditEvent.findFirst({
      where: {
        referenceId: latestAcceptance.id,
        type: 'EMPLOYER_REVIEW_ACCEPTED',
        metadata: {
          path: ['employerReviewAction', 'employerId'],
          equals: input.employerId,
        },
      },
      select: {
        id: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const metadata = readMetadata(acceptanceAudit?.metadata);
    if (acceptanceAudit && metadata) {
      latestAcceptanceState = buildState({
        auditEventId: acceptanceAudit.id,
        timestamp: acceptanceAudit.createdAt.toISOString(),
        metadata,
      });
    }
  }

  const latestAuditOnlyMetadata = readMetadata(latestAuditOnly?.metadata);
  const latestAuditOnlyState = latestAuditOnly && latestAuditOnlyMetadata
    ? buildState({
        auditEventId: latestAuditOnly.id,
        timestamp: latestAuditOnly.createdAt.toISOString(),
        metadata: latestAuditOnlyMetadata,
      })
    : null;

  if (!latestAcceptanceState) return latestAuditOnlyState;
  if (!latestAuditOnlyState) return latestAcceptanceState;

  return Date.parse(latestAcceptanceState.timestamp) >= Date.parse(latestAuditOnlyState.timestamp)
    ? latestAcceptanceState
    : latestAuditOnlyState;
}
