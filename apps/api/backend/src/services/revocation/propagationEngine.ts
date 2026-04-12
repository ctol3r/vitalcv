import { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { propagateRevocation as propagateBidirectionalRevocation } from '../graph/bidirectional';
import { refreshTrustState, type ClinicianTrustState } from '../trust/trustStateEngine';
import {
  findDecisionCapsulesByCredential,
  type DependentDecisionCapsule,
} from './authorityGraph';

export type RevocationPropagationTrigger =
  | 'credential.revoked'
  | 'credential.expired'
  | 'verification.invalidated';

export interface AffectedCapsule {
  capsuleId: string;
  previousStatus: string;
  newStatus: string;
  subjectNpi: string;
  decisionType: string;
}

export interface TrustStateRecomputeSummary {
  previousBand: string | null;
  newBand: string;
  snapshotArtifactId: string | null;
  computedAt: string;
}

export interface RevocationOutboxSummary {
  outboxIds: string[];
  totalEnqueued: number;
}

export interface PropagationResult {
  trigger: RevocationPropagationTrigger;
  credentialId: string;
  subjectNpi: string;
  affectedCapsules: AffectedCapsule[];
  totalAffected: number;
  invalidatedCount: number;
  atRiskCount: number;
  auditEventIds: string[];
  outbox: RevocationOutboxSummary;
  trustState: TrustStateRecomputeSummary | null;
  bidirectionalFlagged: number;
  bidirectionalAcceptancesFlagged: number;
  bidirectionalStartsFlagged: number;
  bidirectionalTraversalHash: string | null;
  cascadedAt: string;
}

export interface PropagationInput {
  credentialId: string;
  trigger: RevocationPropagationTrigger;
  occurredAt?: Date;
  reason?: string;
  metadata?: Record<string, unknown>;
}

type PersistedTrustStateSnapshot = {
  id: string;
  trustBand: string | null;
  computedAt: string | null;
};

type ArtifactContext = {
  id: string;
  npi: string;
  source: string;
  status: string;
  lifecycleState: string;
  organizationId: string | null;
  rawPayload: unknown;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revocationReason: string | null;
};

export type RevocationOutboxPayload = {
  event: RevocationPropagationTrigger;
  artifactId: string;
  employerId: string;
  acceptanceId: string;
  source: string;
  npiPrefix: string;
  lifecycleState: string;
  changedAt: string;
  reason: string | null;
  impactedCapsules: {
    total: number;
    invalidated: number;
    atRisk: number;
    capsuleIds: string[];
  };
  trustState: {
    previousBand: string | null;
    newBand: string | null;
    snapshotArtifactId: string | null;
    computedAt: string | null;
  };
};

const TERMINAL_TRIGGERS = new Set<RevocationPropagationTrigger>([
  'credential.revoked',
  'credential.expired',
]);

function isTerminalTrigger(trigger: RevocationPropagationTrigger): boolean {
  return TERMINAL_TRIGGERS.has(trigger);
}

function toJsonRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function clonePayload(value: unknown): Record<string, unknown> {
  return toJsonRecord(value);
}

function parseTrustBand(rawPayload: unknown, fallback: string | null): string | null {
  const payload = toJsonRecord(rawPayload);
  const readinessLevel = payload.readiness_level;
  if (typeof readinessLevel === 'string' && readinessLevel.trim()) {
    return readinessLevel;
  }

  const trustBand = payload.trustBand;
  if (typeof trustBand === 'string' && trustBand.trim()) {
    return trustBand;
  }

  return fallback;
}

function normalizeReason(input?: string): string | null {
  if (typeof input !== 'string') {
    return null;
  }

  const normalized = input.trim();
  return normalized.length > 0 ? normalized : null;
}

function prefixNpi(npi: string): string {
  return `${npi.slice(0, 4)}······`;
}

function nextCapsuleStatus(
  trigger: RevocationPropagationTrigger,
  currentStatus: string,
): string | null {
  if (currentStatus === 'INVALID') {
    return null;
  }

  if (isTerminalTrigger(trigger)) {
    if (currentStatus === 'VALID' || currentStatus === 'AT_RISK') {
      return 'INVALID';
    }
    return null;
  }

  if (currentStatus === 'VALID') {
    return 'AT_RISK';
  }
  if (currentStatus === 'AT_RISK') {
    return 'INVALID';
  }

  return null;
}

async function getArtifactContext(credentialId: string): Promise<ArtifactContext> {
  const artifact = await prisma.verificationArtifact.findUnique({
    where: { id: credentialId },
    select: {
      id: true,
      npi: true,
      source: true,
      status: true,
      lifecycleState: true,
      organizationId: true,
      rawPayload: true,
      expiresAt: true,
      revokedAt: true,
      revocationReason: true,
    },
  });

  if (!artifact) {
    throw new Error(`VerificationArtifact ${credentialId} not found.`);
  }

  return artifact;
}

async function getLatestPersistedTrustStateSnapshot(
  npi: string,
): Promise<PersistedTrustStateSnapshot | null> {
  const snapshot = await prisma.verificationArtifact.findFirst({
    where: {
      npi,
      source: 'TRUST_STATE_ENGINE',
    },
    orderBy: [
      { verifiedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    select: {
      id: true,
      trustState: true,
      rawPayload: true,
      verifiedAt: true,
    },
  });

  if (!snapshot) {
    return null;
  }

  const computedAt = toJsonRecord(snapshot.rawPayload).computed_at;
  return {
    id: snapshot.id,
    trustBand: parseTrustBand(snapshot.rawPayload, snapshot.trustState),
    computedAt: typeof computedAt === 'string' ? computedAt : snapshot.verifiedAt.toISOString(),
  };
}

async function normalizeArtifactState(
  artifact: ArtifactContext,
  input: PropagationInput,
  occurredAt: Date,
): Promise<ArtifactContext> {
  const payload = clonePayload(artifact.rawPayload);
  const reason = normalizeReason(input.reason) ?? artifact.revocationReason;

  let status = artifact.status;
  let lifecycleState = artifact.lifecycleState;
  let trustState = artifact.lifecycleState === 'expired' ? 'expired' : undefined;
  let revokedAt = artifact.revokedAt;

  if (input.trigger === 'credential.revoked') {
    status = 'REVOKED';
    lifecycleState = 'revoked';
    trustState = 'revoked';
    revokedAt = artifact.revokedAt ?? occurredAt;
    payload.status = 'REVOKED';
    payload.revokedAt = revokedAt.toISOString();
    payload.revocationReason = reason;
  } else if (input.trigger === 'credential.expired') {
    if (artifact.status !== 'REVOKED') {
      status = 'EXPIRED';
      payload.status = 'EXPIRED';
    }
    if (artifact.lifecycleState !== 'revoked') {
      lifecycleState = 'expired';
    }
    trustState = 'expired';
    payload.expiredAt = occurredAt.toISOString();
  } else {
    if (artifact.status !== 'REVOKED' && artifact.status !== 'EXPIRED') {
      status = 'INVALIDATED';
      payload.status = 'INVALIDATED';
    }
    trustState = 'needs_review';
    payload.invalidatedAt = occurredAt.toISOString();
    if (reason) {
      payload.invalidationReason = reason;
    }
  }

  const updated = await prisma.verificationArtifact.update({
    where: { id: artifact.id },
    data: {
      status,
      lifecycleState,
      trustState,
      revokedAt,
      revocationReason: reason,
      rawPayload: payload as Prisma.InputJsonValue,
      statusLastChecked: occurredAt,
    },
    select: {
      id: true,
      npi: true,
      source: true,
      status: true,
      lifecycleState: true,
      organizationId: true,
      rawPayload: true,
      expiresAt: true,
      revokedAt: true,
      revocationReason: true,
    },
  });

  return updated;
}

export async function updateDecisionCapsuleStatus(params: {
  capsule: DependentDecisionCapsule;
  trigger: RevocationPropagationTrigger;
  credentialId: string;
  occurredAt: Date;
  reason: string | null;
}): Promise<{ affected: AffectedCapsule | null; auditEventId: string | null }> {
  const nextStatus = nextCapsuleStatus(params.trigger, params.capsule.status);
  if (!nextStatus) {
    return { affected: null, auditEventId: null };
  }

  const metadata = {
    ...params.capsule.metadata,
    trust_state_snapshot_invalidated: true,
    revocation_trigger: params.trigger,
    revocation_artifact_id: params.credentialId,
    revocation_reason: params.reason,
  };

  await prisma.decisionCapsule.update({
    where: { id: params.capsule.id },
    data: {
      status: nextStatus,
      impactedByRevocation: true,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });

  const auditEvent = await prisma.auditEvent.create({
    data: {
      type: 'DECISION_CASCADE_TRIGGERED',
      hash: `${params.capsule.id}:${params.credentialId}:${params.trigger}:${params.occurredAt.toISOString()}`,
      referenceId: params.capsule.id,
      clinicianId: params.capsule.subjectNpi,
      metadata: {
        capsuleId: params.capsule.id,
        credentialId: params.credentialId,
        trigger: params.trigger,
        previousStatus: params.capsule.status,
        newStatus: nextStatus,
        decisionType: params.capsule.decisionType,
        occurredAt: params.occurredAt.toISOString(),
        reason: params.reason,
      },
    },
  });

  return {
    affected: {
      capsuleId: params.capsule.id,
      previousStatus: params.capsule.status,
      newStatus: nextStatus,
      subjectNpi: params.capsule.subjectNpi,
      decisionType: params.capsule.decisionType,
    },
    auditEventId: auditEvent.id,
  };
}

export async function recomputeTrustState(params: {
  npi: string;
  impactedCapsules: AffectedCapsule[];
  trigger: RevocationPropagationTrigger;
  credentialId: string;
  previousBand: string | null;
}): Promise<TrustStateRecomputeSummary> {
  const state = await refreshTrustState(params.npi);
  const latestSnapshot = await getLatestPersistedTrustStateSnapshot(params.npi);

  const metadataPatch = {
    revocation_recomputed_trust_state: state as unknown as Record<string, unknown>,
    revocation_recomputed_at: state.computed_at,
    revocation_trigger: params.trigger,
    revocation_artifact_id: params.credentialId,
    trust_state_snapshot_invalidated: true,
  };

  for (const affected of params.impactedCapsules) {
    const current = await prisma.decisionCapsule.findUnique({
      where: { id: affected.capsuleId },
      select: { metadata: true },
    });
    const metadata = {
      ...toJsonRecord(current?.metadata),
      ...metadataPatch,
    };

    await prisma.decisionCapsule.update({
      where: { id: affected.capsuleId },
      data: { metadata: metadata as Prisma.InputJsonValue },
    });
  }

  return {
    previousBand: params.previousBand,
    newBand: state.readiness_level,
    snapshotArtifactId: latestSnapshot?.id ?? null,
    computedAt: latestSnapshot?.computedAt ?? state.computed_at,
  };
}

export async function enqueueRevocationEvent(params: {
  artifact: ArtifactContext;
  trigger: RevocationPropagationTrigger;
  affectedCapsules: AffectedCapsule[];
  trustState: TrustStateRecomputeSummary | null;
  occurredAt: Date;
  reason: string | null;
}): Promise<RevocationOutboxSummary> {
  const acceptances = await prisma.acceptance.findMany({
    where: { subjectId: params.artifact.npi },
    select: {
      acceptanceId: true,
      employerId: true,
    },
  });

  const dedupedTargets = new Map<string, string>();
  for (const acceptance of acceptances) {
    if (!dedupedTargets.has(acceptance.employerId)) {
      dedupedTargets.set(acceptance.employerId, acceptance.acceptanceId);
    }
  }

  const invalidatedCount = params.affectedCapsules.filter((capsule) => capsule.newStatus === 'INVALID').length;
  const atRiskCount = params.affectedCapsules.filter((capsule) => capsule.newStatus === 'AT_RISK').length;
  const outboxIds: string[] = [];

  for (const [employerId, acceptanceId] of dedupedTargets.entries()) {
    const payload: RevocationOutboxPayload = {
      event: params.trigger,
      artifactId: params.artifact.id,
      employerId,
      acceptanceId,
      source: params.artifact.source,
      npiPrefix: prefixNpi(params.artifact.npi),
      lifecycleState: params.artifact.lifecycleState,
      changedAt: params.occurredAt.toISOString(),
      reason: params.reason,
      impactedCapsules: {
        total: params.affectedCapsules.length,
        invalidated: invalidatedCount,
        atRisk: atRiskCount,
        capsuleIds: params.affectedCapsules.map((capsule) => capsule.capsuleId),
      },
      trustState: {
        previousBand: params.trustState?.previousBand ?? null,
        newBand: params.trustState?.newBand ?? null,
        snapshotArtifactId: params.trustState?.snapshotArtifactId ?? null,
        computedAt: params.trustState?.computedAt ?? null,
      },
    };

    const dedupeKey = [
      params.trigger,
      params.artifact.id,
      employerId,
      params.occurredAt.toISOString(),
    ].join(':');

    const outbox = await prisma.revocationOutboxEvent.upsert({
      where: { dedupeKey },
      create: {
        eventType: params.trigger,
        artifactId: params.artifact.id,
        employerId,
        organizationId: params.artifact.organizationId,
        payload: payload as Prisma.InputJsonValue,
        dedupeKey,
        status: 'PENDING',
        attemptCount: 0,
        availableAt: params.occurredAt,
      },
      update: {
        payload: payload as Prisma.InputJsonValue,
        status: 'PENDING',
        availableAt: params.occurredAt,
        lastError: null,
      },
      select: { id: true },
    });

    outboxIds.push(outbox.id);
  }

  return {
    outboxIds,
    totalEnqueued: outboxIds.length,
  };
}

export async function propagateCredentialLifecycleChange(
  input: PropagationInput,
): Promise<PropagationResult> {
  const occurredAt = input.occurredAt ?? new Date();
  const normalizedReason = normalizeReason(input.reason);

  const artifactBefore = await getArtifactContext(input.credentialId);
  const previousTrustState = await getLatestPersistedTrustStateSnapshot(artifactBefore.npi);
  const artifact = await normalizeArtifactState(artifactBefore, input, occurredAt);
  const dependentCapsules = await findDecisionCapsulesByCredential(input.credentialId);

  const affectedCapsules: AffectedCapsule[] = [];
  const auditEventIds: string[] = [];

  for (const capsule of dependentCapsules) {
    const result = await updateDecisionCapsuleStatus({
      capsule,
      trigger: input.trigger,
      credentialId: input.credentialId,
      occurredAt,
      reason: normalizedReason,
    });

    if (result.affected) {
      affectedCapsules.push(result.affected);
    }
    if (result.auditEventId) {
      auditEventIds.push(result.auditEventId);
    }
  }

  let bidirectionalFlagged = 0;
  let bidirectionalAcceptancesFlagged = 0;
  let bidirectionalStartsFlagged = 0;
  let bidirectionalTraversalHash: string | null = null;
  if (isTerminalTrigger(input.trigger)) {
    try {
      const traversal = await propagateBidirectionalRevocation(input.credentialId);
      bidirectionalFlagged = traversal.totalFlagged;
      bidirectionalAcceptancesFlagged = traversal.flaggedAcceptances.length;
      bidirectionalStartsFlagged = traversal.flaggedStarts.length;
      bidirectionalTraversalHash = traversal.traversalHash;
    } catch (error) {
      log('warn', 'revocation_propagation_bidirectional_failed', {
        credentialId: input.credentialId,
        trigger: input.trigger,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const trustState = await recomputeTrustState({
    npi: artifact.npi,
    impactedCapsules: affectedCapsules,
    trigger: input.trigger,
    credentialId: input.credentialId,
    previousBand: previousTrustState?.trustBand ?? null,
  });

  const outbox = await enqueueRevocationEvent({
    artifact,
    trigger: input.trigger,
    affectedCapsules,
    trustState,
    occurredAt,
    reason: normalizedReason,
  });

  const invalidatedCount = affectedCapsules.filter((capsule) => capsule.newStatus === 'INVALID').length;
  const atRiskCount = affectedCapsules.filter((capsule) => capsule.newStatus === 'AT_RISK').length;

  log('info', 'revocation_propagation_complete', {
    credentialId: input.credentialId,
    trigger: input.trigger,
    npi: artifact.npi,
    totalAffected: affectedCapsules.length,
    invalidatedCount,
    atRiskCount,
    outboxCount: outbox.totalEnqueued,
  });

  return {
    trigger: input.trigger,
    credentialId: input.credentialId,
    subjectNpi: artifact.npi,
    affectedCapsules,
    totalAffected: affectedCapsules.length,
    invalidatedCount,
    atRiskCount,
    auditEventIds,
    outbox,
    trustState,
    bidirectionalFlagged,
    bidirectionalAcceptancesFlagged,
    bidirectionalStartsFlagged,
    bidirectionalTraversalHash,
    cascadedAt: occurredAt.toISOString(),
  };
}
