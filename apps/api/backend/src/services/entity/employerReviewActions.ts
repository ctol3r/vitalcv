// @ts-nocheck
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
} from '@vitalcv/trust-state';
import type { EmployerReviewAttribution } from './employerReviewAttribution';
import {
  matchesEmployerReviewAttribution,
  normalizeEmployerReviewAttribution,
  resolveEmployerReviewAttribution,
} from './employerReviewAttribution';
import {
  buildEmployerAcceptanceMetadata,
  type AcceptanceSourceSnapshotCheck,
} from './acceptanceSourceSnapshot';
import {
  buildRuntimeMutationMetadata,
  type RuntimeTrustActor,
  type RuntimeTrustMetadata,
  type RuntimeMutationClassification,
  type RuntimeReplayCategory,
} from '../runtimeTrustCohesion';

export type EmployerReviewActionIntent = 'accept' | 'refresh' | 'review';
export type EmployerReviewPriority = 'LOW' | 'NORMAL' | 'HIGH';
export type EmployerReviewPersistenceMode = 'durable_record' | 'audit_only';
export type EmployerReviewPersistenceTarget =
  | 'employer_acceptance'
  | 'review_queue_item'
  | 'outbox_event'
  | 'audit_event';
export type EmployerAcceptanceScope = 'pilot' | 'full' | 'partial';

/**
 * Canonical public copy for an acceptance with no employer-provided reason.
 * Private review notes (context.notes) must never stand in for it: the
 * acceptance record feeds the anonymous acceptance-history read that renders
 * on /verify/[npi] and /holder/recognition.
 */
export const DEFAULT_ACCEPTANCE_REASON = 'Accepted as head start using VitalCV verification.';

export interface EmployerReviewAcceptanceRecord {
  acceptedByOrgId: string | null;
  acceptedAt: string;
  acceptanceScope: EmployerAcceptanceScope;
  acceptanceReason: string | null;
}

export interface EmployerAcceptanceHistoryEntry extends EmployerReviewAcceptanceRecord {
  acceptanceId: string | null;
  orgLabel: string;
  isAnonymized: boolean;
}

export interface EmployerAcceptanceHistoryResponse {
  ok: true;
  summary: {
    acceptedOrganizationCount: number;
    hasPriorAcceptances: boolean;
    headline: string;
    trustCopy: string | null;
  };
  history: EmployerAcceptanceHistoryEntry[];
}

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
    if (passport.truth.authority.status === 'ACCESS_REQUIRED') gatedDomains.push('STATE_LICENSE');
    if (passport.truth.eligibility.status === 'ACCESS_REQUIRED') gatedDomains.push('MEDICARE_ENROLLMENT');

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
  correlationId: string;
  mutationFingerprint: string;
  actor: RuntimeTrustActor;
  mutationClassification: RuntimeMutationClassification;
  replayCategory: RuntimeReplayCategory;
  payloadHash: string;
  runtimeTrust: RuntimeTrustMetadata;
  persistence: EmployerReviewActionPersistence;
  summary: EmployerReviewActionSummary;
  details: EmployerReviewActionDetails;
  context: {
    role: string | null;
    facility: string | null;
    notes: string | null;
  };
  attribution: EmployerReviewAttribution;
  /** Immutable trust state at time of decision — core of the audit trail.
   *  Optional for backwards compat: records written before a43b82d0 won't have it. */
  trustSnapshot?: DecisionTrustSnapshot;
  /** Acceptance payload for portable acceptance history. Present only for accept actions. */
  acceptance?: EmployerReviewAcceptanceRecord;
}

export interface EmployerReviewActionState {
  action: EmployerReviewActionIntent;
  entityId: string;
  clinicianNpi: string;
  auditEventId: string;
  timestamp: string;
  attribution: EmployerReviewAttribution;
  persistence: EmployerReviewActionPersistence;
  summary: EmployerReviewActionSummary;
  details: EmployerReviewActionDetails;
  /** Trust state captured at the moment of this action — immutable audit record.
   *  Optional for backwards compat: records written before a43b82d0 won't have it. */
  trustSnapshot?: DecisionTrustSnapshot;
  /** Portable acceptance payload. Present only for accept actions. */
  acceptance?: EmployerReviewAcceptanceRecord;
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

/**
 * Who the reviewer is, in acceptance-row terms.
 *
 * `EmployerAcceptance.employerId` means ORGANIZATION id (ADR 0007): door A
 * (runEmployerWorkflowAction, PR #1378) writes it as the employer's
 * organization id, and door B converges by resolving the reviewer's
 * `User.organizationId` here. Rows written before the convergence — and rows
 * for reviewers with no organization binding — carry the Clerk user id
 * instead, so every lookup keyed on employerId must check BOTH ids via
 * `acceptanceEmployerIds`.
 */
export interface ReviewerAcceptanceIdentity {
  clerkUserId: string;
  organizationId: string | null;
  /**
   * Every id that may occupy EmployerAcceptance.employerId for this reviewer:
   * the resolved organization id (org semantics) plus the Clerk user id
   * (legacy rows written before the convergence, and org-less reviewers).
   */
  acceptanceEmployerIds: string[];
}

/**
 * Resolve the reviewer's organization binding server-side from their verified
 * Clerk user id. The caller must never supply the organization id — the
 * binding is derived from the User row in exactly one place so a caller
 * cannot act for an organization they are not bound to.
 */
export async function resolveReviewerAcceptanceIdentity(
  clerkUserId: string,
): Promise<ReviewerAcceptanceIdentity> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { organizationId: true },
  });
  const organizationId = user?.organizationId ?? null;
  return {
    clerkUserId,
    organizationId,
    acceptanceEmployerIds: organizationId ? [organizationId, clerkUserId] : [clerkUserId],
  };
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
    findMany?: (args: Record<string, unknown>) => Promise<EmployerAuditEventRecord[]>;
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

function normalizeAcceptanceScope(value: unknown): EmployerAcceptanceScope {
  if (typeof value !== 'string') return 'pilot';

  switch (value.trim().toLowerCase()) {
    case 'full':
      return 'full';
    case 'partial':
      return 'partial';
    default:
      return 'pilot';
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
    attribution: input.metadata.attribution,
    persistence: input.metadata.persistence,
    summary: input.metadata.summary,
    details: input.metadata.details,
    trustSnapshot: input.metadata.trustSnapshot,
    acceptance: input.metadata.acceptance,
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

  const fallbackRuntime = buildEmployerActionRuntimeTrust({
    action: record.action,
    employerId: record.employerId,
    entityId: record.entityId,
    clinicianNpi: record.clinicianNpi,
    requestId: typeof record.requestId === 'string' ? record.requestId : 'unknown',
  });

  return {
    action: record.action,
    employerId: record.employerId,
    entityId: record.entityId,
    clinicianNpi: record.clinicianNpi,
    requestId: typeof record.requestId === 'string' ? record.requestId : 'unknown',
    correlationId:
      typeof record.correlationId === 'string'
        ? record.correlationId
        : fallbackRuntime.correlationId,
    mutationFingerprint:
      typeof record.mutationFingerprint === 'string'
        ? record.mutationFingerprint
        : fallbackRuntime.mutationFingerprint,
    actor:
      record.actor && typeof record.actor === 'object'
        ? record.actor as RuntimeTrustActor
        : fallbackRuntime.actor,
    mutationClassification:
      typeof record.mutationClassification === 'string'
        ? record.mutationClassification as RuntimeMutationClassification
        : fallbackRuntime.mutationClassification,
    replayCategory:
      typeof record.replayCategory === 'string'
        ? record.replayCategory as RuntimeReplayCategory
        : fallbackRuntime.replayCategory,
    payloadHash:
      typeof record.payloadHash === 'string'
        ? record.payloadHash
        : fallbackRuntime.payloadHash,
    runtimeTrust:
      record.runtimeTrust && typeof record.runtimeTrust === 'object'
        ? record.runtimeTrust as RuntimeTrustMetadata
        : fallbackRuntime.runtimeTrust,
    persistence: {
      ...record.persistence,
      outboxEventId: record.persistence.outboxEventId ?? null,
    },
    summary: record.summary,
    details: record.details,
    context: record.context ?? { role: null, facility: null, notes: null },
    attribution: normalizeEmployerReviewAttribution(record.attribution),
    trustSnapshot:
      record.trustSnapshot && typeof record.trustSnapshot === 'object'
        ? record.trustSnapshot
        : undefined,
    acceptance:
      record.acceptance && typeof record.acceptance === 'object'
        ? {
            acceptedByOrgId:
              typeof record.acceptance.acceptedByOrgId === 'string'
                ? record.acceptance.acceptedByOrgId
                : null,
            acceptedAt:
              typeof record.acceptance.acceptedAt === 'string'
                ? record.acceptance.acceptedAt
                : new Date(0).toISOString(),
            acceptanceScope: normalizeAcceptanceScope(record.acceptance.acceptanceScope),
            acceptanceReason:
              typeof record.acceptance.acceptanceReason === 'string'
                ? record.acceptance.acceptanceReason
                : null,
          }
        : undefined,
  };
}

function buildAcceptanceHistoryHeadline(count: number): string {
  if (count <= 0) return 'No prior acceptances';
  if (count === 1) return 'Accepted by 1 organization';
  return `Accepted by ${count} organizations`;
}

function buildAcceptanceHistoryTrustCopy(count: number): string | null {
  if (count <= 0) return null;

  return 'This clinician has already been accepted using VitalCV verification. Each acceptance remains scoped to the organization and scope shown below.';
}

function buildAcceptanceHistoryOrgLabel(input: {
  acceptanceScope: EmployerAcceptanceScope;
  organizationName: string | null;
  anonymizedIndex: number;
}): { orgLabel: string; isAnonymized: boolean } {
  if (input.acceptanceScope !== 'pilot' && input.organizationName) {
    return {
      orgLabel: input.organizationName,
      isAnonymized: false,
    };
  }

  return {
    orgLabel: `Pilot organization ${input.anonymizedIndex}`,
    isAnonymized: true,
  };
}

function runtimeActionForEmployerAction(action: EmployerReviewActionIntent) {
  switch (action) {
    case 'accept':
      return 'accept';
    case 'refresh':
      return 'request-refresh';
    case 'review':
      return 'route-to-review';
    default:
      return 'denied-mutation';
  }
}

function buildEmployerActionRuntimeTrust(input: {
  action: EmployerReviewActionIntent;
  employerId: string;
  entityId: string;
  clinicianNpi: string;
  requestId: string;
  correlationId?: string | null;
  payload?: unknown;
}): Pick<
  EmployerReviewActionAuditMetadata,
  | 'correlationId'
  | 'mutationFingerprint'
  | 'actor'
  | 'mutationClassification'
  | 'replayCategory'
  | 'payloadHash'
  | 'runtimeTrust'
> {
  const runtimeTrust = buildRuntimeMutationMetadata({
    action: runtimeActionForEmployerAction(input.action),
    actorId: input.employerId,
    entityId: input.entityId,
    clinicianNpi: input.clinicianNpi,
    correlationId: input.correlationId ?? input.requestId,
    payload: input.payload ?? {},
    outcome: 'allowed',
  });

  return {
    correlationId: runtimeTrust.correlationId,
    mutationFingerprint: runtimeTrust.mutationFingerprint,
    actor: runtimeTrust.actor,
    mutationClassification: runtimeTrust.mutationClassification,
    replayCategory: runtimeTrust.replayCategory,
    payloadHash: runtimeTrust.payloadHash,
    runtimeTrust,
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
    correlationId: metadata.correlationId,
    mutationFingerprint: metadata.mutationFingerprint,
    actor: metadata.actor,
    mutationClassification: metadata.mutationClassification,
    replayCategory: metadata.replayCategory,
    payloadHash: metadata.payloadHash,
    runtimeTrust: metadata.runtimeTrust,
    summary: metadata.summary,
    details: metadata.details,
    context: metadata.context,
    attribution: metadata.attribution,
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
      organizationId: input.metadata.attribution.organizationId ?? undefined,
      anchored: false,
      metadata: toJsonValue({
        employerReviewAction: input.metadata,
        actionHash,
      }),
    },
  });
}

// VcvEntity.id is a Postgres uuid column — querying it with a non-uuid string
// makes Prisma throw (a 500) instead of returning null.
const ENTITY_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveEmployerReviewSubject(
  entityId: string,
): Promise<EmployerReviewSubject | null> {
  // Test the raw value — it is what the query below receives, so a padded
  // uuid must fail here rather than reach Prisma.
  if (!ENTITY_UUID_RE.test(entityId)) return null;

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

/**
 * Resolve a clinician NPI to the same subject shape used by entity-id lookups.
 * Earliest entity row wins when an NPI has more than one (deterministic).
 * Read-only: never creates an entity, unlike resolveEntityFromNpi.
 */
export async function resolveEmployerReviewSubjectByNpi(
  npi: string,
): Promise<EmployerReviewSubject | null> {
  if (!npi.trim()) return null;

  const entity = await prisma.vcvEntity.findFirst({
    where: { npi },
    orderBy: { createdAt: 'asc' },
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
  correlationId?: string | null;
  organizationContextId?: unknown;
  bundleId?: unknown;
  role?: unknown;
  facility?: unknown;
  notes?: unknown;
  acceptanceScope?: unknown;
  acceptanceReason?: unknown;
  organizationName?: string | null;
  // ACT-1.2 — link this acceptance to the exact sealed packet it accepted. Both
  // optional: the NPI-keyed accept path (no application in hand) omits them and
  // is unaffected. The route verifies the hash against the live packet first.
  applicationId?: string | null;
  packetHash?: string | null;
  // Accept-time source-coverage snapshot ({sourceId,label,state,checkedAt}[]),
  // frozen into EmployerAcceptance.metadata so the W6 "what changed since you
  // accepted" diff has an accepted side to replay against.
  acceptedSourceSnapshot?: readonly AcceptanceSourceSnapshotCheck[] | null;
}): Promise<EmployerReviewActionState> {
  const now = new Date();
  const requestId = randomUUID();
  // ADR 0007 — EmployerAcceptance.employerId means ORGANIZATION id. The
  // reviewer's org binding is resolved server-side from their Clerk user id
  // (never caller-supplied); reviewers with no binding keep the legacy
  // clerk-id semantics, marked as such in the row metadata below.
  const reviewer = await resolveReviewerAcceptanceIdentity(input.employerId);
  const attribution = await resolveEmployerReviewAttribution({
    entityId: input.entityId,
    organizationContextId: input.organizationContextId,
    bundleId: input.bundleId,
  });
  const context = {
    role: sanitizeString(input.role, 80),
    facility: sanitizeString(input.facility, 120),
    notes: sanitizeString(input.notes, 500),
  };
  const acceptance: EmployerReviewAcceptanceRecord = {
    acceptedByOrgId: attribution.organizationId ?? null,
    acceptedAt: now.toISOString(),
    acceptanceScope: normalizeAcceptanceScope(input.acceptanceScope),
    acceptanceReason:
      sanitizeString(input.acceptanceReason, 280)
      ?? DEFAULT_ACCEPTANCE_REASON,
  };

  // ── Capture trust snapshot BEFORE transaction — immutable audit record ──
  const trustSnapshot = await buildDecisionTrustSnapshot(input.clinicianNpi);
  const runtimeTrust = buildEmployerActionRuntimeTrust({
    action: 'accept',
    employerId: input.employerId,
    entityId: input.entityId,
    clinicianNpi: input.clinicianNpi,
    requestId,
    correlationId: input.correlationId,
    payload: {
      organizationContextId: input.organizationContextId,
      bundleId: input.bundleId,
      role: input.role,
      facility: input.facility,
      notes: input.notes,
      acceptanceScope: input.acceptanceScope,
      acceptanceReason: input.acceptanceReason,
    },
  });

  const persistenceBase: EmployerReviewActionPersistence = {
    mode: 'durable_record',
    target: 'employer_acceptance',
    acceptanceId: null,
    reviewItemId: null,
    outboxEventId: null,
    reviewItemCreated: false,
  };

  // Accept-time coverage snapshot, stored on the acceptance row itself (not
  // only in audit metadata) — this is the durable "accepted" side the re-share
  // diff reads. Null when the caller had no coverage in hand: the column stays
  // NULL rather than recording an empty snapshot that would diff as "every
  // current source is new".
  const acceptanceRowMetadata = buildEmployerAcceptanceMetadata({
    capturedAt: now.toISOString(),
    checks: input.acceptedSourceSnapshot ?? [],
  });

  // Reviewer provenance stored beside the snapshot (ADR 0007): the row's
  // employerId column now means ORGANIZATION id when the reviewer is bound to
  // one, so the metadata keeps the acting Clerk user id and names which
  // semantic the row was written under. `employerIdSemantics` is the
  // discriminator that keeps legacy rows distinguishable from org rows.
  const rowMetadata = {
    ...(acceptanceRowMetadata ?? {}),
    acceptedByClerkUserId: input.employerId,
    employerIdSemantics: reviewer.organizationId ? 'organization' : 'legacy_clerk_user',
  };

  const { auditEvent, metadata } = await prisma.$transaction(async (tx) => {
    const acceptanceRow = await tx.employerAcceptance.create({
      data: {
        id: randomUUID(),
        // The review path has a real entity and org in hand — record them, so
        // the acceptance ties to the VcvEntity that was reviewed. (Both columns
        // are nullable; hiring.ts, which has neither, legitimately omits them.)
        entityId: input.entityId,
        organization: input.organizationName ?? input.employerId,
        // ADR 0007 — organization id when bound; Clerk user id only for
        // reviewers with no organization (today's behavior, marked in
        // metadata). Door A's readers query this column as an org id.
        employerId: reviewer.organizationId ?? input.employerId,
        // The acting human, in every mode — employerId no longer carries the
        // actor once org semantics apply.
        acceptedBy: input.employerId,
        clinicianNpi: input.clinicianNpi,
        artifactId: null,
        // ACT-1.2 linkage — the exact packet this acceptance accepted (null on
        // the NPI-keyed path that has no application in hand).
        applicationId: input.applicationId ?? null,
        packetHash: input.packetHash ?? null,
        metadata: toJsonValue(rowMetadata),
        status: 'ACCEPTED',
        acceptedAt: now,
      },
    });

    const seededPersistence: EmployerReviewActionPersistence = {
      ...persistenceBase,
      acceptanceId: acceptanceRow.id,
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
          applicationId: input.applicationId ?? null,
          packetHash: input.packetHash ?? null,
          requestId,
          ...runtimeTrust,
          persistence: seededPersistence,
          summary: buildActionSummary('accept', seededPersistence),
          details: buildEmptyDetails(),
          context,
          attribution,
          trustSnapshot,
          acceptance,
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
      ...runtimeTrust,
      persistence,
      summary: buildActionSummary('accept', persistence),
      details: buildEmptyDetails(),
      context,
      attribution,
      trustSnapshot,
      acceptance,
    };

    const auditEvent = await writeEmployerReviewAuditEvent(
      tx as unknown as AuditWriter,
      {
        type: 'EMPLOYER_REVIEW_ACCEPTED',
        referenceId: acceptanceRow.id,
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
  correlationId?: string | null;
  organizationContextId?: unknown;
  bundleId?: unknown;
  staleSources?: unknown;
  missingDomains?: unknown;
  message?: unknown;
}): Promise<EmployerReviewActionState> {
  // Capture snapshot before write
  const trustSnapshot = await buildDecisionTrustSnapshot(input.clinicianNpi);
  const requestId = randomUUID();
  const attribution = await resolveEmployerReviewAttribution({
    entityId: input.entityId,
    organizationContextId: input.organizationContextId,
    bundleId: input.bundleId,
  });
  const details = buildEmptyDetails({
    staleSources: sanitizeStringList(input.staleSources),
    missingDomains: sanitizeStringList(input.missingDomains),
    reason: sanitizeString(input.message, 500),
  });
  const runtimeTrust = buildEmployerActionRuntimeTrust({
    action: 'refresh',
    employerId: input.employerId,
    entityId: input.entityId,
    clinicianNpi: input.clinicianNpi,
    requestId,
    correlationId: input.correlationId,
    payload: {
      organizationContextId: input.organizationContextId,
      bundleId: input.bundleId,
      staleSources: details.staleSources,
      missingDomains: details.missingDomains,
      message: input.message,
    },
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
      ...runtimeTrust,
      persistence: basePersistence,
      summary: buildActionSummary('refresh', basePersistence),
      details,
      context: {
        role: null,
        facility: null,
        notes: null,
      },
      attribution,
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
  correlationId?: string | null;
  organizationContextId?: unknown;
  bundleId?: unknown;
  reason?: unknown;
  priority?: unknown;
}): Promise<EmployerReviewActionState> {
  const now = new Date();
  const requestId = randomUUID();
  const attribution = await resolveEmployerReviewAttribution({
    entityId: input.entityId,
    organizationContextId: input.organizationContextId,
    bundleId: input.bundleId,
  });
  const normalizedPriority = normalizePriority(input.priority);
  const normalizedReason =
    sanitizeString(input.reason, 500)
    ?? 'Employer routed for manual review.';

  // Capture snapshot before transaction
  const trustSnapshot = await buildDecisionTrustSnapshot(input.clinicianNpi);
  const runtimeTrust = buildEmployerActionRuntimeTrust({
    action: 'review',
    employerId: input.employerId,
    entityId: input.entityId,
    clinicianNpi: input.clinicianNpi,
    requestId,
    correlationId: input.correlationId,
    payload: {
      organizationContextId: input.organizationContextId,
      bundleId: input.bundleId,
      reason: normalizedReason,
      priority: normalizedPriority,
    },
  });

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
      ...runtimeTrust,
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
      attribution,
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
  organizationContextId?: unknown;
  bundleId?: unknown;
}): Promise<EmployerReviewActionState | null> {
  const requestedAttribution = await resolveEmployerReviewAttribution({
    entityId: input.entityId,
    organizationContextId: input.organizationContextId,
    bundleId: input.bundleId,
  });

  const auditEvents = await prisma.auditEvent.findMany({
    where: {
      type: {
        in: [
          'EMPLOYER_REVIEW_ACCEPTED',
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
    take: 25,
  });

  for (const auditEvent of auditEvents) {
    const metadata = readMetadata(auditEvent.metadata);
    if (!metadata) {
      continue;
    }

    if (
      metadata.employerId !== input.employerId
      || metadata.entityId !== input.entityId
      || metadata.clinicianNpi !== input.clinicianNpi
      || !matchesEmployerReviewAttribution(requestedAttribution, metadata.attribution)
    ) {
      continue;
    }

    return buildState({
      auditEventId: auditEvent.id,
      timestamp: auditEvent.createdAt.toISOString(),
      metadata,
    });
  }

  return null;
}

/**
 * Acceptance reason as served on the anonymous acceptance-history read.
 * Records written before the write path stopped copying context.notes into
 * acceptanceReason may still carry the private note — when the stored reason
 * matches the note it is suppressed and the canonical copy served instead.
 */
function publicAcceptanceReason(metadata: EmployerReviewActionAuditMetadata): string | null {
  const storedReason = metadata.acceptance?.acceptanceReason ?? null;
  if (storedReason === null) {
    return null;
  }

  const privateNotes = metadata.context.notes ?? null;
  if (privateNotes !== null && storedReason === privateNotes) {
    return DEFAULT_ACCEPTANCE_REASON;
  }

  return storedReason;
}

export async function loadEmployerAcceptanceHistory(input: {
  entityId: string;
  clinicianNpi: string;
}): Promise<EmployerAcceptanceHistoryResponse> {
  const auditEvents = await prisma.auditEvent.findMany({
    where: {
      type: 'EMPLOYER_REVIEW_ACCEPTED',
      clinicianId: input.clinicianNpi,
    },
    select: {
      id: true,
      createdAt: true,
      metadata: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 50,
  });

  const rawEntries = auditEvents.flatMap((auditEvent) => {
    const metadata = readMetadata(auditEvent.metadata);
    if (!metadata || metadata.action !== 'accept' || metadata.clinicianNpi !== input.clinicianNpi) {
      return [];
    }

    const acceptedByOrgId = metadata.acceptance?.acceptedByOrgId
      ?? metadata.attribution.organizationId
      ?? metadata.employerId
      ?? null;
    const acceptedAt = metadata.acceptance?.acceptedAt ?? auditEvent.createdAt.toISOString();
    const acceptanceScope = metadata.acceptance?.acceptanceScope ?? 'pilot';

    return [{
      acceptanceId: metadata.persistence.acceptanceId,
      orgKey: acceptedByOrgId ?? `employer:${metadata.employerId}:${metadata.requestId}`,
      organizationName: metadata.attribution.organizationName ?? null,
      acceptedByOrgId,
      acceptedAt,
      acceptanceScope,
      acceptanceReason: publicAcceptanceReason(metadata),
    }];
  }).sort((left, right) => Date.parse(right.acceptedAt) - Date.parse(left.acceptedAt));

  const anonymizedOrgIndex = new Map<string, number>();
  let nextAnonymizedIndex = 1;

  const history: EmployerAcceptanceHistoryEntry[] = rawEntries.map((entry) => {
    let anonymizedIndex = anonymizedOrgIndex.get(entry.orgKey);
    if (!anonymizedIndex) {
      anonymizedIndex = nextAnonymizedIndex++;
      anonymizedOrgIndex.set(entry.orgKey, anonymizedIndex);
    }

    const org = buildAcceptanceHistoryOrgLabel({
      acceptanceScope: entry.acceptanceScope,
      organizationName: entry.organizationName,
      anonymizedIndex,
    });

    return {
      acceptanceId: entry.acceptanceId,
      orgLabel: org.orgLabel,
      isAnonymized: org.isAnonymized,
      // An anonymized label with the raw org id beside it would defeat the
      // anonymization on this anonymous read; the id ships only when the
      // organization is already named.
      acceptedByOrgId: org.isAnonymized ? null : entry.acceptedByOrgId,
      acceptedAt: entry.acceptedAt,
      acceptanceScope: entry.acceptanceScope,
      acceptanceReason: entry.acceptanceReason,
    };
  });

  const acceptedOrganizationCount = new Set(rawEntries.map((entry) => entry.orgKey)).size;

  return {
    ok: true,
    summary: {
      acceptedOrganizationCount,
      hasPriorAcceptances: acceptedOrganizationCount > 0,
      headline: buildAcceptanceHistoryHeadline(acceptedOrganizationCount),
      trustCopy: buildAcceptanceHistoryTrustCopy(acceptedOrganizationCount),
    },
    history,
  };
}
