import type { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { appendAuditEvent } from '../audit/auditLedger';
import {
  buildEmployerReviewPayload,
  type EmployerReviewCredentialRef,
  type EmployerReviewPayloadV1,
} from '../entity/employerReviewPayload';
import { sha256ForPayload } from '../../utils/deterministic';

export type VCVSnapshotDecision =
  | 'APPLY'
  | 'PROCEED'
  | 'REQUEST_REFRESH'
  | 'ROUTE_TO_REVIEW'
  | 'REJECT'
  | 'HOLD';

export interface TrustHistoryEvent {
  id: string;
  eventType: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface TrustHistoryDecision {
  id: string;
  decisionClass: string;
  occurredAt: string;
  confidence?: number | null;
  score?: number | null;
  metadata?: Record<string, unknown>;
}

export interface TrustHistoryEmployerAction {
  id: string;
  action: string;
  occurredAt: string;
  employerId?: string | null;
  organizationId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TrustHistory {
  events: TrustHistoryEvent[];
  decisions: TrustHistoryDecision[];
  employerActions: TrustHistoryEmployerAction[];
}

export interface VCVSnapshot {
  id: string;
  providerId: string;
  decision: VCVSnapshotDecision;
  verifiedData: {
    identity: {
      entityId: string;
      displayName: string;
      entityType: string;
      npi?: string;
      specialty?: string;
    };
    readiness: {
      status: string;
      score: number;
      level: string;
      estimatedStartDays: number | null;
    };
    authority: {
      exclusionStatus: string;
      licensureStatus: string;
      deaStatus: string;
      pecosStatus: string;
    };
    credentials: Array<{
      credentialId: string;
      domain: string;
      credentialType: string;
      status: string;
      verificationLevel: string;
      observedAt?: string;
      expiresAt?: string;
      artifactIds: string[];
      receiptIds: string[];
    }>;
    sourceCoverage: EmployerReviewPayloadV1['sourceCoverage']['summary'];
    receiptReferences: string[];
    proofReferences: string[];
  };
  missingCritical: string[];
  missingNonCritical: string[];
  history: TrustHistory;
  employerConfidence: number;
  trustScore: number;
  createdAt: string;
  lastValidatedAt: string;
}

export interface TrackSnapshotEventResult {
  snapshot: VCVSnapshot;
  reused: boolean;
  auditEventId: string;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundConfidence(value: number): number {
  return Number(clamp01(value).toFixed(2));
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((left, right) => left.localeCompare(right));
}

function emptyHistory(): TrustHistory {
  return {
    events: [],
    decisions: [],
    employerActions: [],
  };
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function compareHistoryEntries(left: { id: string; occurredAt: string }, right: { id: string; occurredAt: string }): number {
  const timeDelta = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
  if (timeDelta !== 0) {
    return timeDelta;
  }

  return left.id.localeCompare(right.id);
}

function mergeHistoryEntries<T extends { id: string; occurredAt: string }>(
  current: readonly T[],
  incoming: readonly T[],
): T[] {
  const merged = new Map<string, T>();
  current.forEach((entry) => merged.set(entry.id, entry));
  incoming.forEach((entry) => merged.set(entry.id, entry));
  return [...merged.values()].sort(compareHistoryEntries);
}

function mapCredential(credential: EmployerReviewCredentialRef): VCVSnapshot['verifiedData']['credentials'][number] {
  return {
    credentialId: credential.credentialId,
    domain: credential.domain,
    credentialType: credential.credentialType,
    status: credential.status,
    verificationLevel: credential.verificationLevel,
    observedAt: credential.observedAt,
    expiresAt: credential.expiresAt,
    artifactIds: [...credential.artifactIds].sort((left, right) => left.localeCompare(right)),
    receiptIds: [...credential.receiptIds].sort((left, right) => left.localeCompare(right)),
  };
}

function buildVerifiedData(profile: EmployerReviewPayloadV1): VCVSnapshot['verifiedData'] {
  return {
    identity: {
      entityId: profile.identitySummary.entityId,
      displayName: profile.identitySummary.displayName,
      entityType: profile.identitySummary.entityType,
      npi: profile.identitySummary.npi,
      specialty: profile.identitySummary.specialty,
    },
    readiness: {
      status: profile.readinessSummary.status,
      score: profile.readinessSummary.score,
      level: profile.readinessSummary.level,
      estimatedStartDays: profile.readinessSummary.estimatedStartDays,
    },
    authority: {
      exclusionStatus: profile.authorityStanding.exclusionStatus,
      licensureStatus: profile.authorityStanding.licensureStatus,
      deaStatus: profile.authorityStanding.deaStatus,
      pecosStatus: profile.authorityStanding.pecosStatus,
    },
    credentials: profile.credentialsIncluded
      .map(mapCredential)
      .sort((left, right) => {
        const byDomain = left.domain.localeCompare(right.domain);
        if (byDomain !== 0) return byDomain;
        const byType = left.credentialType.localeCompare(right.credentialType);
        if (byType !== 0) return byType;
        return left.credentialId.localeCompare(right.credentialId);
      }),
    sourceCoverage: profile.sourceCoverage.summary,
    receiptReferences: [...profile.receiptReferences].sort((left, right) => left.localeCompare(right)),
    proofReferences: [...profile.proofReferences].sort((left, right) => left.localeCompare(right)),
  };
}

function buildMissingCritical(profile: EmployerReviewPayloadV1): string[] {
  return uniqueSorted([
    ...profile.readinessSummary.blockers,
    ...profile.sourceCoverage.summary.stale.map((sourceId) => `SOURCE_STALE:${sourceId}`),
    ...profile.sourceCoverage.summary.gated.map((sourceId) => `SOURCE_GATED:${sourceId}`),
    ...profile.sourceCoverage.summary.unavailable.map((sourceId) => `SOURCE_UNAVAILABLE:${sourceId}`),
    ...profile.sourceCoverage.summary.accessRequired.map((sourceId) => `SOURCE_ACCESS_REQUIRED:${sourceId}`),
    ...profile.sourceCoverage.summary.notDecisionGrade.map((sourceId) => `SOURCE_NOT_DECISION_GRADE:${sourceId}`),
  ]);
}

function buildMissingNonCritical(profile: EmployerReviewPayloadV1): string[] {
  return uniqueSorted([
    ...profile.readinessSummary.gaps,
    ...profile.sourceCoverage.summary.pending.map((sourceId) => `SOURCE_PENDING:${sourceId}`),
    ...profile.sourceCoverage.summary.reviewRequired.map((sourceId) => `SOURCE_REVIEW_REQUIRED:${sourceId}`),
    ...profile.sourceCoverage.summary.previewOnly.map((sourceId) => `SOURCE_PREVIEW_ONLY:${sourceId}`),
  ]);
}

function buildSnapshotId(input: {
  providerId: string;
  decision: VCVSnapshotDecision;
  verifiedData: VCVSnapshot['verifiedData'];
  missingCritical: string[];
  missingNonCritical: string[];
}): string {
  return sha256ForPayload(input);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeHistoryEvent(value: unknown): TrustHistoryEvent | null {
  if (!isRecord(value)) return null;
  const occurredAt = normalizeTimestamp(value.occurredAt);
  if (typeof value.id !== 'string' || typeof value.eventType !== 'string' || !occurredAt) {
    return null;
  }

  return {
    id: value.id,
    eventType: value.eventType,
    occurredAt,
    metadata: isRecord(value.metadata) ? value.metadata : undefined,
  };
}

function normalizeHistoryDecision(value: unknown): TrustHistoryDecision | null {
  if (!isRecord(value)) return null;
  const occurredAt = normalizeTimestamp(value.occurredAt);
  if (typeof value.id !== 'string' || typeof value.decisionClass !== 'string' || !occurredAt) {
    return null;
  }

  return {
    id: value.id,
    decisionClass: value.decisionClass,
    occurredAt,
    confidence: typeof value.confidence === 'number' ? clamp01(value.confidence) : null,
    score: typeof value.score === 'number' ? clampScore(value.score) : null,
    metadata: isRecord(value.metadata) ? value.metadata : undefined,
  };
}

function normalizeHistoryEmployerAction(value: unknown): TrustHistoryEmployerAction | null {
  if (!isRecord(value)) return null;
  const occurredAt = normalizeTimestamp(value.occurredAt);
  if (typeof value.id !== 'string' || typeof value.action !== 'string' || !occurredAt) {
    return null;
  }

  return {
    id: value.id,
    action: value.action,
    occurredAt,
    employerId: typeof value.employerId === 'string' ? value.employerId : null,
    organizationId: typeof value.organizationId === 'string' ? value.organizationId : null,
    metadata: isRecord(value.metadata) ? value.metadata : undefined,
  };
}

function normalizeTrustHistory(value: unknown): TrustHistory {
  if (!isRecord(value)) {
    return emptyHistory();
  }

  const events = Array.isArray(value.events)
    ? value.events
      .map((entry) => normalizeHistoryEvent(entry))
      .filter((entry): entry is TrustHistoryEvent => entry !== null)
      .sort(compareHistoryEntries)
    : [];
  const decisions = Array.isArray(value.decisions)
    ? value.decisions
      .map((entry) => normalizeHistoryDecision(entry))
      .filter((entry): entry is TrustHistoryDecision => entry !== null)
      .sort(compareHistoryEntries)
    : [];
  const employerActions = Array.isArray(value.employerActions)
    ? value.employerActions
      .map((entry) => normalizeHistoryEmployerAction(entry))
      .filter((entry): entry is TrustHistoryEmployerAction => entry !== null)
      .sort(compareHistoryEntries)
    : [];

  return {
    events,
    decisions,
    employerActions,
  };
}

function normalizeEmployerAction(action: string): string {
  return action.trim().toLowerCase();
}

function isPositiveEmployerAction(action: string): boolean {
  return action === 'accept' || action === 'accepted' || action === 'proceed';
}

function employerActionPenalty(action: string): number {
  switch (action) {
    case 'request_refresh':
    case 'refresh':
      return 0.12;
    case 'route_to_review':
    case 'review':
      return 0.08;
    case 'hold':
      return 0.15;
    case 'reject':
    case 'rejected':
      return 0.25;
    default:
      return 0;
  }
}

function decisionClassScore(decisionClass: string): number | null {
  switch (decisionClass.trim().toUpperCase()) {
    case 'TRUSTED_CURRENT':
      return 90;
    case 'TRUSTED_BUT_STALE_SOON':
      return 78;
    case 'STALE_REVERIFY_REQUIRED':
      return 56;
    case 'CONFLICT_REQUIRES_REVIEW':
      return 34;
    case 'INSUFFICIENT_EVIDENCE':
      return 22;
    case 'NEGATIVE_FINDING_BLOCK':
      return 0;
    default:
      return null;
  }
}

export function computeEmployerConfidence(history: TrustHistory): number {
  if (history.employerActions.length === 0) {
    return 0;
  }

  const normalizedActions = history.employerActions.map((entry) => ({
    ...entry,
    normalizedAction: normalizeEmployerAction(entry.action),
  }));
  const positive = normalizedActions.filter((entry) => isPositiveEmployerAction(entry.normalizedAction));
  const distinctPositiveOrganizations = new Set(
    positive
      .map((entry) => entry.organizationId ?? entry.employerId)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
  ).size;
  const positiveBase = positive.length > 0 ? 1 - Math.pow(0.65, positive.length) : 0;
  const diversityBonus = Math.min(Math.max(distinctPositiveOrganizations - 1, 0) * 0.05, 0.15);
  const penalties = normalizedActions.reduce((total, entry) => total + employerActionPenalty(entry.normalizedAction), 0);

  return roundConfidence(positiveBase + diversityBonus - penalties);
}

export function computeTrustScore(
  history: TrustHistory,
  currentScore = 0,
): number {
  const baseScore = clampScore(currentScore);
  if (history.decisions.length === 0 && history.employerActions.length === 0) {
    return baseScore;
  }

  const employerConfidence = computeEmployerConfidence(history);
  const orderedDecisions = [...history.decisions].sort(compareHistoryEntries);
  const latestDecision = orderedDecisions[orderedDecisions.length - 1] ?? null;
  const latestDecisionScore = latestDecision
    ? (typeof latestDecision.score === 'number' ? clampScore(latestDecision.score) : decisionClassScore(latestDecision.decisionClass))
    : null;
  const latestDecisionConfidence = latestDecision?.confidence ?? 0;
  const positiveDecisionCount = orderedDecisions.filter((entry) => {
    const score = typeof entry.score === 'number' ? clampScore(entry.score) : decisionClassScore(entry.decisionClass);
    return typeof score === 'number' && score >= 70;
  }).length;
  const trailingScores = orderedDecisions
    .slice(-3)
    .map((entry) => (typeof entry.score === 'number' ? clampScore(entry.score) : decisionClassScore(entry.decisionClass)))
    .filter((score): score is number => typeof score === 'number');
  let trendAdjustment = 0;
  if (trailingScores.length >= 2) {
    const nonDecreasing = trailingScores.every((score, index, list) => index === 0 || score >= list[index - 1]);
    const nonIncreasing = trailingScores.every((score, index, list) => index === 0 || score <= list[index - 1]);
    if (nonDecreasing && trailingScores[trailingScores.length - 1] > trailingScores[0]) {
      trendAdjustment = 4;
    } else if (nonIncreasing && trailingScores[trailingScores.length - 1] < trailingScores[0]) {
      trendAdjustment = -4;
    }
  }

  const cautionPenalty = history.employerActions.reduce(
    (total, entry) => total + employerActionPenalty(normalizeEmployerAction(entry.action)),
    0,
  );
  let score = baseScore;

  if (typeof latestDecisionScore === 'number') {
    score = Math.round((baseScore * 0.65) + (latestDecisionScore * 0.35));
    score += Math.round(latestDecisionConfidence * 8);
  }

  score += Math.min(Math.max(positiveDecisionCount - 1, 0) * 3, 9);
  score += trendAdjustment;
  score += Math.round(employerConfidence * 12);
  score -= Math.round(cautionPenalty * 20);

  if (latestDecisionScore === 0) {
    return 0;
  }

  if (typeof latestDecisionScore === 'number' && latestDecisionScore < 30) {
    return Math.min(clampScore(score), 35);
  }

  if (typeof latestDecisionScore === 'number' && latestDecisionScore < 60) {
    return Math.min(clampScore(score), 65);
  }

  return clampScore(score);
}

function isSnapshot(value: unknown): value is VCVSnapshot {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.providerId === 'string'
    && typeof value.decision === 'string'
    && Array.isArray(value.missingCritical)
    && Array.isArray(value.missingNonCritical)
    && typeof value.createdAt === 'string'
    && typeof value.lastValidatedAt === 'string'
    && isRecord(value.verifiedData)
  );
}

function normalizeStoredSnapshot(
  stored: { snapshot: unknown } | null | undefined,
): VCVSnapshot | null {
  if (!isSnapshot(stored?.snapshot)) {
    return null;
  }

  const snapshot = stored.snapshot;
  const history = normalizeTrustHistory(snapshot.history);
  const readinessScore = isRecord(snapshot.verifiedData.readiness)
    && typeof snapshot.verifiedData.readiness.score === 'number'
    ? snapshot.verifiedData.readiness.score
    : 0;

  return {
    ...snapshot,
    history,
    employerConfidence:
      typeof snapshot.employerConfidence === 'number'
        ? roundConfidence(snapshot.employerConfidence)
        : computeEmployerConfidence(history),
    trustScore:
      typeof snapshot.trustScore === 'number'
        ? clampScore(snapshot.trustScore)
        : computeTrustScore(history, readinessScore),
  };
}

export function createSnapshot(
  profile: EmployerReviewPayloadV1,
  decision: VCVSnapshotDecision,
): VCVSnapshot {
  const verifiedData = buildVerifiedData(profile);
  const missingCritical = buildMissingCritical(profile);
  const missingNonCritical = buildMissingNonCritical(profile);
  const timestamp = profile.checkedAt;
  const history = emptyHistory();

  return {
    id: buildSnapshotId({
      providerId: profile.identitySummary.entityId,
      decision,
      verifiedData,
      missingCritical,
      missingNonCritical,
    }),
    providerId: profile.identitySummary.entityId,
    decision,
    verifiedData,
    missingCritical,
    missingNonCritical,
    history,
    employerConfidence: computeEmployerConfidence(history),
    trustScore: computeTrustScore(history, verifiedData.readiness.score),
    createdAt: timestamp,
    lastValidatedAt: timestamp,
  };
}

export function appendSnapshotHistory(
  snapshot: VCVSnapshot,
  history: Partial<TrustHistory>,
): VCVSnapshot {
  const incoming = normalizeTrustHistory(history);
  const mergedHistory: TrustHistory = {
    events: mergeHistoryEntries(snapshot.history.events, incoming.events),
    decisions: mergeHistoryEntries(snapshot.history.decisions, incoming.decisions),
    employerActions: mergeHistoryEntries(snapshot.history.employerActions, incoming.employerActions),
  };

  return {
    ...snapshot,
    history: mergedHistory,
    employerConfidence: computeEmployerConfidence(mergedHistory),
    trustScore: computeTrustScore(mergedHistory, snapshot.verifiedData.readiness.score),
  };
}

export async function revalidateSnapshot(
  snapshot: VCVSnapshot,
): Promise<VCVSnapshot> {
  const profile = await buildEmployerReviewPayload({
    entityId: snapshot.providerId,
  });
  const current = createSnapshot(profile, snapshot.decision);
  if (current.id === snapshot.id) {
    const next = appendSnapshotHistory(current, snapshot.history);
    return {
      ...next,
      createdAt: snapshot.createdAt,
      lastValidatedAt: profile.checkedAt,
    };
  }

  return appendSnapshotHistory(current, snapshot.history);
}

async function findStoredSnapshot(
  artifactId: string | null | undefined,
  providerId: string,
  decision: VCVSnapshotDecision,
): Promise<VCVSnapshot | null> {
  if (!artifactId) {
    return null;
  }

  const auditSnapshotClient = (prisma as unknown as {
    auditSnapshot?: {
      findMany?: (args: Record<string, unknown>) => Promise<Array<{ snapshot: unknown }>>;
    };
  }).auditSnapshot;

  if (!auditSnapshotClient?.findMany) {
    return null;
  }

  const rows = await auditSnapshotClient.findMany({
    where: { artifactId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  for (const row of rows) {
    const stored = normalizeStoredSnapshot(row);
    if (stored && stored.providerId === providerId && stored.decision === decision) {
      return stored;
    }
  }

  return null;
}

async function persistSnapshotIfNeeded(
  artifactId: string | null | undefined,
  snapshot: VCVSnapshot,
  existing: VCVSnapshot | null,
): Promise<boolean> {
  if (!artifactId) {
    return false;
  }

  if (existing?.id === snapshot.id) {
    return true;
  }

  const auditSnapshotClient = (prisma as unknown as {
    auditSnapshot?: {
      create?: (args: Record<string, unknown>) => Promise<unknown>;
    };
  }).auditSnapshot;

  if (!auditSnapshotClient?.create) {
    return false;
  }

  await auditSnapshotClient.create({
    data: {
      artifactId,
      snapshot: toJsonValue(snapshot),
    },
  });

  return false;
}

async function resolveLatestBundleId(providerId: string): Promise<string | null> {
  const share = await prisma.bundleShareEvent.findFirst({
    where: {
      subjectEntityId: providerId,
      revokedAt: null,
    },
    orderBy: { sharedAt: 'desc' },
    select: { bundleId: true },
  }).catch(() => null);

  return share?.bundleId ?? null;
}

export async function trackApplyEvent(input: {
  actorId: string;
  bundleId: string;
  profile: EmployerReviewPayloadV1;
  metadata?: Record<string, unknown>;
}): Promise<TrackSnapshotEventResult> {
  const snapshot = createSnapshot(input.profile, 'APPLY');
  const existing = await findStoredSnapshot(input.bundleId, snapshot.providerId, snapshot.decision);
  const reused = await persistSnapshotIfNeeded(input.bundleId, snapshot, existing);
  const audit = appendAuditEvent({
    category: ['BUNDLE_EXPORT', 'DECISION'],
    actor: input.actorId,
    resource: input.bundleId,
    requestFields: {
      providerId: snapshot.providerId,
      decision: snapshot.decision,
    },
    resultFields: {
      snapshotId: snapshot.id,
      reused,
      missingCriticalCount: snapshot.missingCritical.length,
      missingNonCriticalCount: snapshot.missingNonCritical.length,
      ...(input.metadata ?? {}),
    },
    severity: 'INFO',
  });

  log('info', 'vcv_snapshot_apply_tracked', {
    bundleId: input.bundleId,
    providerId: snapshot.providerId,
    reused,
    snapshotId: snapshot.id,
  });

  return {
    snapshot: reused && existing ? existing : snapshot,
    reused,
    auditEventId: audit.eventId,
  };
}

export async function trackEmployerAction(input: {
  actorId: string;
  providerId: string;
  decision: Exclude<VCVSnapshotDecision, 'APPLY'>;
  bundleId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<TrackSnapshotEventResult> {
  const artifactId = input.bundleId ?? await resolveLatestBundleId(input.providerId);
  const existing = await findStoredSnapshot(artifactId, input.providerId, input.decision);
  const snapshot = existing
    ? await revalidateSnapshot(existing)
    : createSnapshot(
        await buildEmployerReviewPayload({ entityId: input.providerId }),
        input.decision,
      );
  const reused = existing?.id === snapshot.id;
  await persistSnapshotIfNeeded(artifactId, snapshot, existing ?? null);

  const audit = appendAuditEvent({
    category: 'DECISION',
    actor: input.actorId,
    resource: input.providerId,
    requestFields: {
      providerId: snapshot.providerId,
      decision: snapshot.decision,
      bundleId: artifactId,
    },
    resultFields: {
      snapshotId: snapshot.id,
      reused,
      missingCriticalCount: snapshot.missingCritical.length,
      missingNonCriticalCount: snapshot.missingNonCritical.length,
      ...(input.metadata ?? {}),
    },
    severity: 'INFO',
  });

  log('info', 'vcv_snapshot_employer_action_tracked', {
    providerId: snapshot.providerId,
    decision: snapshot.decision,
    reused,
    snapshotId: snapshot.id,
  });

  return {
    snapshot,
    reused,
    auditEventId: audit.eventId,
  };
}
