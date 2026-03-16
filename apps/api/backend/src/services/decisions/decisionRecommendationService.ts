import { SpanStatusCode, trace } from '@opentelemetry/api';
import { Prisma, type PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import {
  createDecisionEngine,
  type DecisionGraphContext,
  type DecisionInputSignal,
  type DecisionRecommendation,
  type DecisionRecommendationState,
  type DecisionScoreBreakdown,
  type DecisionSeverity,
  type DecisionSignalReference,
  type DecisionTargetEntity,
  type DecisionTargetEntityType,
} from '../../../../../../services/decision-engine/src';

const decisionTracer = trace.getTracer('vitalcv.decision-engine');
const ACTIVE_FINDING_STATUSES = ['new', 'acknowledged', 'investigating', 'escalated'] as const;
const ACTIVE_STORYLINE_STATUSES = ['ACTIVE', 'QUIET', 'ESCALATED'] as const;
const DECISION_ID_PREFIX = 'decision_';

type ActionStatusEventRow = {
  fromStatus: string | null;
  toStatus: string;
  actorId: string | null;
  note: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
};

type ActionRecommendationRow = {
  actionId: string;
  actionType: string;
  storylineKey: string | null;
  sourceFindingIds: string[];
  predictionIds: string[];
  targetEntityType: string;
  targetEntityId: string;
  targetEntityLabel: string | null;
  recommendedAction: string;
  priority: string;
  priorityScore: number;
  confidence: number;
  explanation: string;
  evidence: Prisma.JsonValue;
  metadata: Prisma.JsonValue;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  statusEvents?: ActionStatusEventRow[];
};

export interface DecisionStatusEvent {
  fromState: DecisionRecommendationState | null;
  toState: DecisionRecommendationState;
  actorId: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface StoredDecisionRecommendation extends DecisionRecommendation {
  id: string;
  type: string;
  recommendation: DecisionRecommendation['actionType'];
  explanation: string;
  status: DecisionRecommendationState;
  supportingStorylineKeys: string[];
  sourceFindingIds: string[];
  predictionIds: string[];
  statusEvents?: DecisionStatusEvent[];
}

export interface DecisionListQuery {
  actionType?: string[] | string;
  priority?: string[] | string;
  entityType?: string[] | string;
  status?: string[] | string;
  minConfidence?: number | null;
  updatedAtFrom?: string | null;
  updatedAtTo?: string | null;
  limit?: number;
  offset?: number;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asRecordArray(value: Prisma.JsonValue): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asRecord(entry))
    .filter((entry) => Object.keys(entry).length > 0);
}

function normalizeList(value: string[] | string | undefined | null): string[] {
  if (!value) {
    return [];
  }

  const raw = Array.isArray(value) ? value : [value];
  return raw
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function daysAgo(nowIso: string, days: number): Date {
  return new Date(new Date(nowIso).getTime() - (days * 86_400_000));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCaseFromSlug(value: string): string {
  return value
    .split(/[-_]+/g)
    .filter((entry) => entry.length > 0)
    .map((entry) => entry[0]!.toUpperCase() + entry.slice(1))
    .join(' ');
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))];
}

function normalizeSeverity(value: string | null | undefined): DecisionSeverity {
  switch ((value ?? '').toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    case 'info':
    default:
      return 'info';
  }
}

function normalizeEntityType(value: string | null | undefined): DecisionTargetEntityType {
  switch ((value ?? '').toLowerCase()) {
    case 'provider':
      return 'provider';
    case 'storyline':
      return 'storyline';
    case 'institution':
      return 'institution';
    case 'specialty':
    case 'market':
      return 'specialty';
    case 'network':
    case 'network_cluster':
      return 'network_cluster';
    default:
      return 'provider';
  }
}

function normalizeDecisionState(value: string | null | undefined): DecisionRecommendationState {
  switch ((value ?? '').toLowerCase()) {
    case 'accepted':
    case 'saved':
    case 'in_progress':
      return 'accepted';
    case 'dismissed':
    case 'skipped':
      return 'dismissed';
    case 'deferred':
      return 'deferred';
    case 'completed':
    case 'executed':
      return 'completed';
    case 'new':
    case 'open':
    case 'pending':
    default:
      return 'new';
  }
}

export function isDecisionRecommendationState(value: unknown): value is DecisionRecommendationState {
  return ['new', 'accepted', 'dismissed', 'deferred', 'completed'].includes(String(value ?? '').toLowerCase());
}

function canTransitionDecisionState(
  fromState: DecisionRecommendationState,
  toState: DecisionRecommendationState,
): boolean {
  if (fromState === toState) {
    return true;
  }

  const allowed: Record<DecisionRecommendationState, DecisionRecommendationState[]> = {
    new: ['accepted', 'dismissed', 'deferred', 'completed'],
    accepted: ['dismissed', 'deferred', 'completed'],
    deferred: ['accepted', 'dismissed', 'completed'],
    dismissed: ['accepted', 'deferred'],
    completed: ['accepted', 'deferred'],
  };

  return allowed[fromState].includes(toState);
}

function parseSignals(value: Prisma.JsonValue): DecisionSignalReference[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      const legacySource = asString(record.source);
      const sources = Array.isArray(record.sources)
        ? record.sources.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : legacySource
          ? [legacySource]
          : [];

      return {
        signalId: asString(record.signalId) ?? 'signal',
        kind: (asString(record.kind) as DecisionSignalReference['kind']) ?? 'finding',
        signalType: asString(record.signalType) ?? 'signal',
        label: asString(record.label) ?? 'signal',
        value: typeof record.value === 'number' || typeof record.value === 'string' ? record.value : null,
        confidence: clamp01(asNumber(record.confidence) ?? 0.5),
        observedAt: asString(record.observedAt) ?? new Date().toISOString(),
        severity: normalizeSeverity(asString(record.severity)),
        direction: (asString(record.direction) as DecisionSignalReference['direction']) ?? undefined,
        corroboration: asNumber(record.corroboration) ?? undefined,
        sources,
        sourceIds: Array.isArray(record.sourceIds)
          ? record.sourceIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : undefined,
        metadata: asRecord(record.metadata),
      };
    });
}

function parseScoreBreakdown(value: unknown, fallbackTotal: number): DecisionScoreBreakdown {
  const record = asRecord(value);
  const total = asNumber(record.total) ?? fallbackTotal;

  return {
    severity: asNumber(record.severity) ?? 0,
    novelty: asNumber(record.novelty) ?? 0,
    predictionDirection: asNumber(record.predictionDirection) ?? 0,
    centrality: asNumber(record.centrality) ?? 0,
    confidence: asNumber(record.confidence) ?? 0,
    corroboration: asNumber(record.corroboration) ?? 0,
    recency: asNumber(record.recency) ?? 0,
    historicalTruthRate: asNumber(record.historicalTruthRate) ?? 0,
    ruleAdjustment: asNumber(record.ruleAdjustment) ?? 0,
    total,
  };
}

function parseExplainability(value: unknown, rationale: string) {
  const record = asRecord(value);
  const observedFacts = Array.isArray(record.observedFacts)
    ? record.observedFacts.filter((item): item is string => typeof item === 'string')
    : [];
  const predictions = Array.isArray(record.predictions)
    ? record.predictions.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    why: asString(record.why) ?? rationale,
    urgency: asString(record.urgency) ?? 'medium',
    watchNext: asString(record.watchNext) ?? 'Watch for corroboration, confidence changes, and new linked findings.',
    heuristic: record.heuristic === true,
    observedFacts,
    predictions,
  };
}

function parseStatusEvents(rows: ActionStatusEventRow[]): DecisionStatusEvent[] {
  return rows.map((row) => ({
    fromState: row.fromStatus ? normalizeDecisionState(row.fromStatus) : null,
    toState: normalizeDecisionState(row.toStatus),
    actorId: row.actorId,
    note: row.note,
    metadata: asRecord(row.metadata),
    createdAt: row.createdAt.toISOString(),
  }));
}

function targetEntityFromRow(row: ActionRecommendationRow): DecisionTargetEntity {
  return {
    entityType: normalizeEntityType(row.targetEntityType),
    entityId: row.targetEntityId,
    entityLabel: row.targetEntityLabel,
  };
}

function mapRecommendationRow(row: ActionRecommendationRow): StoredDecisionRecommendation {
  const metadata = asRecord(row.metadata);
  const state = normalizeDecisionState(row.status);
  const rationale = row.explanation;
  const supportingStorylineKeys = row.storylineKey ? [row.storylineKey] : [];

  return {
    id: row.actionId,
    type: row.actionType,
    recommendation: row.actionType as DecisionRecommendation['actionType'],
    explanation: rationale,
    status: state,
    supportingStorylineKeys,
    decisionId: row.actionId,
    actionType: row.actionType as DecisionRecommendation['actionType'],
    targetEntity: targetEntityFromRow(row),
    priority: row.priority as DecisionRecommendation['priority'],
    priorityScore: row.priorityScore,
    confidence: row.confidence,
    title: asString(metadata.title) ?? row.recommendedAction,
    rationale,
    supportingSignals: parseSignals(row.evidence),
    recommendedTiming: asString(metadata.recommendedTiming) ?? 'next refresh cycle',
    state,
    explainability: parseExplainability(metadata.explainability, rationale),
    scoreBreakdown: parseScoreBreakdown(metadata.scoreBreakdown, row.priorityScore),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    actedOnAt: asString(metadata.actedOnAt),
    feedbackNote: asString(metadata.feedbackNote),
    metadata: asRecord(metadata.decisionMetadata),
    sourceFindingIds: [...row.sourceFindingIds],
    predictionIds: [...row.predictionIds],
    statusEvents: row.statusEvents ? parseStatusEvents(row.statusEvents) : undefined,
  };
}

async function withDecisionSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  work: () => Promise<T>,
): Promise<T> {
  return decisionTracer.startActiveSpan(name, async (span) => {
    span.setAttributes(attributes);
    try {
      const result = await work();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'decision engine failure',
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

function primaryTargetFromFinding(row: {
  entityIds: string[];
  metadata: Prisma.JsonValue;
  entityLinks: Array<{
    entityType: string;
    entityId: string;
    entityLabel: string | null;
    relationship: string | null;
  }>;
}): DecisionTargetEntity {
  const subject = row.entityLinks.find((entry) => entry.relationship === 'subject')
    ?? row.entityLinks.find((entry) => normalizeEntityType(entry.entityType) === 'provider')
    ?? row.entityLinks[0];

  if (subject) {
    return {
      entityType: normalizeEntityType(subject.entityType),
      entityId: subject.entityId,
      entityLabel: subject.entityLabel,
    };
  }

  const metadata = asRecord(row.metadata);
  const npi = asString(metadata.npi);
  if (npi) {
    return {
      entityType: 'provider',
      entityId: npi,
      entityLabel: asString(metadata.providerLabel) ?? `Provider ${npi}`,
    };
  }

  const entityId = row.entityIds[0] ?? 'unknown';
  return {
    entityType: 'provider',
    entityId,
    entityLabel: entityId,
  };
}

async function loadFindingSignals(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<DecisionInputSignal[]> {
  const rows = await prismaClient.investigatorFinding.findMany({
    where: {
      status: { in: [...ACTIVE_FINDING_STATUSES] },
      lastSeenAt: { gte: daysAgo(nowIso, 180) },
    },
    select: {
      findingId: true,
      findingType: true,
      severity: true,
      title: true,
      confidence: true,
      novelty: true,
      metadata: true,
      supportingEvidence: true,
      createdAt: true,
      updatedAt: true,
      lastSeenAt: true,
      entityIds: true,
      entityLinks: {
        select: {
          entityType: true,
          entityId: true,
          entityLabel: true,
          relationship: true,
        },
      },
    },
    orderBy: [
      { priorityScore: 'desc' },
      { lastSeenAt: 'desc' },
    ],
    take: 600,
  });

  return rows.map((row) => {
    const evidence = asRecordArray(row.supportingEvidence);
    const sources = uniqueStrings(evidence.map((entry) => asString(entry.sourceId) ?? asString(entry.sourceLabel)));
    const targetEntity = primaryTargetFromFinding(row);
    const metadata = asRecord(row.metadata);

    return {
      signalId: row.findingId,
      kind: 'finding' as const,
      signalType: row.findingType.toUpperCase(),
      label: row.title,
      targetEntity,
      confidence: clamp01(row.confidence),
      observedAt: row.lastSeenAt.toISOString(),
      severity: normalizeSeverity(row.severity),
      corroboration: Math.max(evidence.length, sources.length, 1),
      sources,
      sourceIds: sources,
      novelty: clamp01(row.novelty),
      historicalTruthRate: clamp01(asNumber(metadata.historicalTruthRate) ?? 0.5),
      metadata: {
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        ...metadata,
      },
    };
  });
}

function specialtyTarget(entityId: string, entityLabel: string | null): {
  targetEntity: DecisionTargetEntity;
  state: string | null;
  specialtySlug: string;
} {
  if (entityId.startsWith('market:')) {
    const [, stateRaw, specialtyRaw] = entityId.split(':');
    const state = stateRaw?.toUpperCase() ?? null;
    const specialtySlug = slugify(specialtyRaw ?? entityLabel ?? entityId);
    return {
      targetEntity: {
        entityType: 'specialty',
        entityId: state ? `${state.toLowerCase()}-${specialtySlug}` : specialtySlug,
        entityLabel: entityLabel ?? [state, titleCaseFromSlug(specialtySlug)].filter(Boolean).join(' '),
      },
      state,
      specialtySlug,
    };
  }

  const label = entityLabel ?? titleCaseFromSlug(entityId);
  const stateMatch = label.match(/^([A-Z]{2})\s+(.+)$/);
  return {
    targetEntity: {
      entityType: 'specialty',
      entityId: slugify(label),
      entityLabel: label,
    },
    state: stateMatch?.[1] ?? null,
    specialtySlug: slugify(stateMatch?.[2] ?? label),
  };
}

function predictionDirection(predictionType: string): DecisionSignalReference['direction'] {
  switch (predictionType) {
    case 'TRUST_RISK_ACCELERATION':
    case 'TRUST_SCORE_DECLINE':
      return 'DOWN';
    case 'NETWORK_SHIFT':
    case 'NETWORK_CLUSTER_EXPANSION':
      return 'SHIFT';
    default:
      return 'UP';
  }
}

function predictionObservedAt(row: {
  metadata: Prisma.JsonValue;
  updatedAt: Date;
  createdAt: Date;
}): string {
  const metadata = asRecord(row.metadata);
  return asString(metadata.lastObservedAt)
    ?? asString(metadata.observedAt)
    ?? row.updatedAt.toISOString()
    ?? row.createdAt.toISOString();
}

async function loadProviderProfiles(prismaClient: PrismaClient): Promise<Array<{
  npi: string;
  label: string;
  specialty: string | null;
  state: string | null;
}>> {
  const rows = await prismaClient.personProfile.findMany({
    select: {
      npi: true,
      firstName: true,
      lastName: true,
      specialty: true,
      stateOfPractice: true,
    },
    take: 2_000,
  });

  return rows
    .filter((row): row is typeof rows[number] & { npi: string } => typeof row.npi === 'string' && row.npi.length > 0)
    .map((row) => ({
      npi: row.npi,
      label: [row.firstName, row.lastName].filter((value): value is string => Boolean(value)).join(' ') || `Provider ${row.npi}`,
      specialty: row.specialty,
      state: row.stateOfPractice,
    }));
}

async function loadPredictionSignals(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<DecisionInputSignal[]> {
  const [rows, providerProfiles] = await Promise.all([
    prismaClient.predictionInsight.findMany({
      where: {
        updatedAt: { gte: daysAgo(nowIso, 365) },
      },
      select: {
        predictionId: true,
        predictionType: true,
        targetEntityType: true,
        targetEntityId: true,
        targetEntityLabel: true,
        probability: true,
        confidence: true,
        evidenceSignals: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { probability: 'desc' },
        { confidence: 'desc' },
      ],
      take: 400,
    }),
    loadProviderProfiles(prismaClient),
  ]);

  const projected: DecisionInputSignal[] = [];
  const direct = rows.map((row) => {
    const metadata = asRecord(row.metadata);
    const evidenceSignals = asRecordArray(row.evidenceSignals);
    const sources = uniqueStrings(evidenceSignals.map((entry) => asString(entry.source)));

    let targetEntity: DecisionTargetEntity;
    let specialtySlug: string | null = null;
    let state: string | null = null;

    if (normalizeEntityType(row.targetEntityType) === 'specialty') {
      const normalized = specialtyTarget(row.targetEntityId, row.targetEntityLabel);
      targetEntity = normalized.targetEntity;
      specialtySlug = normalized.specialtySlug;
      state = normalized.state;
    } else {
      targetEntity = {
        entityType: normalizeEntityType(row.targetEntityType),
        entityId: row.targetEntityId,
        entityLabel: row.targetEntityLabel,
      };
    }

    const signal: DecisionInputSignal = {
      signalId: row.predictionId,
      kind: 'prediction',
      signalType: row.predictionType,
      label: row.targetEntityLabel ?? row.predictionType.replace(/_/g, ' '),
      targetEntity,
      confidence: clamp01(row.confidence),
      observedAt: predictionObservedAt(row),
      direction: predictionDirection(row.predictionType),
      corroboration: Math.max(evidenceSignals.length, sources.length, 1),
      sources,
      sourceIds: sources,
      novelty: 0.46,
      historicalTruthRate: clamp01(asNumber(metadata.historicalTruthRate) ?? 0.5),
      metadata,
    };

    const isSpecialtyPressure = row.predictionType === 'SPECIALTY_PRESSURE'
      || row.predictionType === 'WORKFORCE_SHORTAGE_ESCALATION';

    if (isSpecialtyPressure && specialtySlug) {
      for (const profile of providerProfiles) {
        if (slugify(profile.specialty ?? '') !== specialtySlug) {
          continue;
        }
        if (state && profile.state !== state) {
          continue;
        }

        projected.push({
          ...signal,
          signalId: `${row.predictionId}:provider:${profile.npi}`,
          label: `${profile.label} specialty pressure`,
          targetEntity: {
            entityType: 'provider',
            entityId: profile.npi,
            entityLabel: profile.label,
          },
          metadata: {
            ...metadata,
            projectedFrom: targetEntity.entityId,
          },
        });
      }
    }

    return signal;
  });

  return [...direct, ...projected];
}

async function loadStorylineSignals(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<DecisionInputSignal[]> {
  const rows = await prismaClient.storyline.findMany({
    where: {
      status: { in: [...ACTIVE_STORYLINE_STATUSES] },
      lastActivityAt: { gte: daysAgo(nowIso, 180) },
    },
    select: {
      storylineId: true,
      storylineType: true,
      title: true,
      severity: true,
      confidence: true,
      findingIds: true,
      supportingEvidence: true,
      metadata: true,
      progressionScore: true,
      lastActivityAt: true,
      entityLinks: {
        select: {
          entityType: true,
          entityKey: true,
          entityLabel: true,
        },
      },
    },
    orderBy: [
      { confidence: 'desc' },
      { lastActivityAt: 'desc' },
    ],
    take: 250,
  });

  return rows.map((row) => {
    const evidence = asRecordArray(row.supportingEvidence);
    const metadata = asRecord(row.metadata);
    const stage = asString(metadata.stage)
      ?? (row.progressionScore >= 0.5 ? 'developing' : 'emerging');
    const sources = uniqueStrings(evidence.map((entry) => asString(entry.source)));

    return {
      signalId: row.storylineId,
      kind: 'storyline' as const,
      signalType: row.storylineType,
      label: row.title,
      targetEntity: {
        entityType: 'storyline',
        entityId: row.storylineId,
        entityLabel: row.title,
      },
      confidence: clamp01(row.confidence),
      observedAt: row.lastActivityAt.toISOString(),
      severity: normalizeSeverity(row.severity),
      corroboration: Math.max(row.findingIds.length + evidence.length, 1),
      sources,
      sourceIds: sources,
      novelty: clamp01(asNumber(metadata.noveltyScore) ?? 0.5),
      metadata: {
        ...metadata,
        stage,
        linkedEntities: row.entityLinks.map((entry) => ({
          entityType: normalizeEntityType(entry.entityType),
          entityId: entry.entityKey,
          entityLabel: entry.entityLabel,
        })),
      },
    };
  });
}

async function loadGraphContext(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<DecisionGraphContext[]> {
  const [nodes, clusterAssignments, recentEdges] = await Promise.all([
    prismaClient.graphNode.findMany({
      select: {
        id: true,
        canonicalKey: true,
        label: true,
        degree: true,
        metadata: true,
        sourceRefs: true,
      },
      take: 2_000,
    }),
    prismaClient.graphClusterAssignment.findMany({
      select: {
        nodeId: true,
        clusterKey: true,
      },
      take: 4_000,
    }),
    prismaClient.graphEdge.findMany({
      where: {
        createdAt: { gte: daysAgo(nowIso, 30) },
      },
      select: {
        sourceNodeId: true,
        targetNodeId: true,
        createdAt: true,
      },
      take: 6_000,
    }),
  ]);

  const clustersByNode = new Map<string, Set<string>>();
  for (const row of clusterAssignments) {
    const current = clustersByNode.get(row.nodeId) ?? new Set<string>();
    current.add(row.clusterKey);
    clustersByNode.set(row.nodeId, current);
  }

  const edgeCountsByNode = new Map<string, number>();
  const observedAtByNode = new Map<string, string>();
  for (const row of recentEdges) {
    edgeCountsByNode.set(row.sourceNodeId, (edgeCountsByNode.get(row.sourceNodeId) ?? 0) + 1);
    edgeCountsByNode.set(row.targetNodeId, (edgeCountsByNode.get(row.targetNodeId) ?? 0) + 1);
    const observedAt = row.createdAt.toISOString();
    observedAtByNode.set(row.sourceNodeId, observedAt);
    observedAtByNode.set(row.targetNodeId, observedAt);
  }

  return nodes.flatMap((row) => {
    const metadata = asRecord(row.metadata);
    const npi = asString(metadata.npi) ?? row.canonicalKey.match(/(\d{10})/)?.[1] ?? null;
    if (!npi) {
      return [];
    }

    const clusterCount = clustersByNode.get(row.id)?.size ?? 0;
    const sourceCoverage = Array.isArray(row.sourceRefs) ? row.sourceRefs.length : 0;

    return [{
      targetEntity: {
        entityType: 'provider' as const,
        entityId: npi,
        entityLabel: row.label,
      },
      centrality: clamp01(row.degree / 20),
      clusterCount,
      recentConnectionDelta: edgeCountsByNode.get(row.id) ?? 0,
      corroboration: clamp01((sourceCoverage + clusterCount) / 4),
      observedAt: observedAtByNode.get(row.id) ?? nowIso,
      metadata: {
        nodeId: row.id,
        degree: row.degree,
      },
    }];
  });
}

function sourceFindingIds(recommendation: DecisionRecommendation): string[] {
  return recommendation.supportingSignals
    .filter((signal) => signal.kind === 'finding')
    .map((signal) => signal.signalId);
}

function predictionIds(recommendation: DecisionRecommendation): string[] {
  return recommendation.supportingSignals
    .filter((signal) => signal.kind === 'prediction')
    .map((signal) => signal.signalId);
}

function storylineKey(recommendation: DecisionRecommendation): string | null {
  if (recommendation.targetEntity.entityType === 'storyline') {
    return recommendation.targetEntity.entityId;
  }

  return recommendation.supportingSignals.find((signal) => signal.kind === 'storyline')?.signalId ?? null;
}

function recommendationMetadata(recommendation: DecisionRecommendation): Record<string, unknown> {
  return {
    title: recommendation.title,
    recommendedTiming: recommendation.recommendedTiming,
    explainability: recommendation.explainability,
    scoreBreakdown: recommendation.scoreBreakdown,
    feedbackNote: recommendation.feedbackNote,
    actedOnAt: recommendation.actedOnAt,
    decisionMetadata: recommendation.metadata,
  };
}

function actionCreateData(recommendation: DecisionRecommendation): Prisma.ActionRecommendationCreateInput {
  return {
    actionId: recommendation.decisionId,
    actionType: recommendation.actionType,
    storylineKey: storylineKey(recommendation),
    sourceFindingIds: sourceFindingIds(recommendation),
    predictionIds: predictionIds(recommendation),
    targetEntityType: recommendation.targetEntity.entityType,
    targetEntityId: recommendation.targetEntity.entityId,
    targetEntityLabel: recommendation.targetEntity.entityLabel ?? null,
    recommendedAction: recommendation.title,
    priority: recommendation.priority,
    priorityScore: recommendation.priorityScore,
    confidence: recommendation.confidence,
    explanation: recommendation.rationale,
    evidence: toJsonValue(recommendation.supportingSignals),
    metadata: toJsonValue(recommendationMetadata(recommendation)),
    status: recommendation.state,
    createdAt: new Date(recommendation.createdAt),
    statusEvents: {
      create: [{
        fromStatus: null,
        toStatus: recommendation.state,
        actorId: null,
        note: 'Decision recommendation created by FE18-A decision engine.',
        metadata: toJsonValue({ actionType: recommendation.actionType }),
      }],
    },
  };
}

async function persistDecisionRecommendations(
  recommendations: DecisionRecommendation[],
  prismaClient: PrismaClient,
): Promise<StoredDecisionRecommendation[]> {
  const ids = recommendations.map((recommendation) => recommendation.decisionId);

  await prismaClient.actionRecommendation.deleteMany({
    where: {
      actionId: {
        startsWith: DECISION_ID_PREFIX,
        notIn: ids.length > 0 ? ids : ['__none__'],
      },
    },
  });

  if (recommendations.length === 0) {
    return [];
  }

  const existingRows = await prismaClient.actionRecommendation.findMany({
    where: {
      actionId: { in: ids },
    },
    include: {
      statusEvents: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  const existingById = new Map(existingRows.map((row) => [row.actionId, row]));
  const stored: StoredDecisionRecommendation[] = [];

  for (const recommendation of recommendations) {
    const existing = existingById.get(recommendation.decisionId);
    if (!existing) {
      const created = await prismaClient.actionRecommendation.create({
        data: actionCreateData(recommendation),
        include: {
          statusEvents: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      stored.push(mapRecommendationRow(created));
      continue;
    }

    const existingMetadata = asRecord(existing.metadata);
    const currentState = normalizeDecisionState(existing.status);
    const updated = await prismaClient.actionRecommendation.update({
      where: { actionId: recommendation.decisionId },
      data: {
        actionType: recommendation.actionType,
        storylineKey: storylineKey(recommendation),
        sourceFindingIds: sourceFindingIds(recommendation),
        predictionIds: predictionIds(recommendation),
        targetEntityType: recommendation.targetEntity.entityType,
        targetEntityId: recommendation.targetEntity.entityId,
        targetEntityLabel: recommendation.targetEntity.entityLabel ?? null,
        recommendedAction: recommendation.title,
        priority: recommendation.priority,
        priorityScore: recommendation.priorityScore,
        confidence: recommendation.confidence,
        explanation: recommendation.rationale,
        evidence: toJsonValue(recommendation.supportingSignals),
        metadata: toJsonValue({
          ...recommendationMetadata({
            ...recommendation,
            state: currentState,
            feedbackNote: asString(existingMetadata.feedbackNote) ?? recommendation.feedbackNote,
            actedOnAt: asString(existingMetadata.actedOnAt) ?? recommendation.actedOnAt,
          }),
        }),
        status: currentState,
      },
      include: {
        statusEvents: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    stored.push(mapRecommendationRow(updated));
  }

  return stored.sort((left, right) => {
    if (right.priorityScore !== left.priorityScore) {
      return right.priorityScore - left.priorityScore;
    }
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }
    return left.decisionId.localeCompare(right.decisionId);
  });
}

function withinDateRange(
  value: string,
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (!from && !to) {
    return true;
  }

  if (from && value < from) {
    return false;
  }
  if (to && value > to) {
    return false;
  }
  return true;
}

function filterRecommendations(
  recommendations: StoredDecisionRecommendation[],
  query: DecisionListQuery,
): StoredDecisionRecommendation[] {
  const actionTypes = normalizeList(query.actionType).map((value) => value.toUpperCase());
  const priorities = normalizeList(query.priority).map((value) => value.toLowerCase());
  const entityTypes = normalizeList(query.entityType).map((value) => value.toLowerCase());
  const statuses = normalizeList(query.status).map((value) => value.toLowerCase());

  return recommendations.filter((recommendation) => {
    if (actionTypes.length > 0 && !actionTypes.includes(recommendation.actionType)) {
      return false;
    }
    if (priorities.length > 0 && !priorities.includes(recommendation.priority.toLowerCase())) {
      return false;
    }
    if (entityTypes.length > 0 && !entityTypes.includes(recommendation.targetEntity.entityType.toLowerCase())) {
      return false;
    }
    if (statuses.length > 0 && !statuses.includes(recommendation.state.toLowerCase())) {
      return false;
    }
    if (typeof query.minConfidence === 'number' && recommendation.confidence < query.minConfidence) {
      return false;
    }
    if (!withinDateRange(recommendation.updatedAt, query.updatedAtFrom, query.updatedAtTo)) {
      return false;
    }
    return true;
  });
}

function targetMatches(recommendation: StoredDecisionRecommendation, identifier: string): boolean {
  const normalized = identifier.trim().toLowerCase();
  if (normalized.length === 0) {
    return true;
  }

  const entityId = recommendation.targetEntity.entityId.toLowerCase();
  const entityLabel = recommendation.targetEntity.entityLabel?.toLowerCase() ?? '';
  return entityId === normalized
    || entityId.endsWith(`:${normalized}`)
    || entityId.includes(normalized)
    || entityLabel.includes(normalized.replace(/-/g, ' '));
}

async function buildDecisionSignals(
  nowIso: string,
  prismaClient: PrismaClient,
): Promise<{
  findings: DecisionInputSignal[];
  storylines: DecisionInputSignal[];
  predictions: DecisionInputSignal[];
  graphContext: DecisionGraphContext[];
}> {
  const [findings, storylines, predictions, graphContext] = await Promise.all([
    loadFindingSignals(prismaClient, nowIso),
    loadStorylineSignals(prismaClient, nowIso),
    loadPredictionSignals(prismaClient, nowIso),
    loadGraphContext(prismaClient, nowIso),
  ]);

  return {
    findings,
    storylines,
    predictions,
    graphContext,
  };
}

export async function refreshDecisionRecommendations(
  now = new Date().toISOString(),
  prismaClient: PrismaClient = prisma,
): Promise<StoredDecisionRecommendation[]> {
  return withDecisionSpan(
    'decision_recommendations.refresh',
    { 'vitalcv.decision_recommendations.refresh': true },
    async () => {
      const input = await buildDecisionSignals(now, prismaClient);
      const recommendations = createDecisionEngine().generate({
        findings: input.findings,
        storylines: input.storylines,
        predictions: input.predictions,
        graphContext: input.graphContext,
        now,
      });
      return persistDecisionRecommendations(recommendations, prismaClient);
    },
  );
}

export async function listDecisionRecommendations(
  query: DecisionListQuery = {},
  prismaClient: PrismaClient = prisma,
): Promise<{ total: number; recommendations: StoredDecisionRecommendation[]; generatedAt: string }> {
  return withDecisionSpan(
    'decision_recommendations.list',
    {
      'vitalcv.decision_recommendations.action_filters': normalizeList(query.actionType).length,
      'vitalcv.decision_recommendations.entity_filters': normalizeList(query.entityType).length,
    },
    async () => {
      const generatedAt = new Date().toISOString();
      const current = await refreshDecisionRecommendations(generatedAt, prismaClient);
      const filtered = filterRecommendations(current, query);
      const offset = Math.max(query.offset ?? 0, 0);
      const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);

      return {
        total: filtered.length,
        recommendations: filtered.slice(offset, offset + limit),
        generatedAt,
      };
    },
  );
}

export async function listDecisionRecommendationsForTarget(
  targetEntityType: DecisionTargetEntityType,
  identifier: string,
  query: Omit<DecisionListQuery, 'entityType'> = {},
  prismaClient: PrismaClient = prisma,
): Promise<{ total: number; recommendations: StoredDecisionRecommendation[]; generatedAt: string }> {
  const result = await listDecisionRecommendations({
    ...query,
    entityType: [targetEntityType],
    limit: query.limit ?? 50,
  }, prismaClient);

  const recommendations = result.recommendations.filter((recommendation) =>
    recommendation.targetEntity.entityType === targetEntityType && targetMatches(recommendation, identifier),
  );

  return {
    total: recommendations.length,
    recommendations,
    generatedAt: result.generatedAt,
  };
}

export async function getDecisionRecommendation(
  decisionId: string,
  prismaClient: PrismaClient = prisma,
): Promise<StoredDecisionRecommendation | null> {
  return withDecisionSpan(
    'decision_recommendations.get',
    { 'vitalcv.decision_recommendations.decision_id': decisionId },
    async () => {
      const row = await prismaClient.actionRecommendation.findUnique({
        where: { actionId: decisionId },
        include: {
          statusEvents: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      if (!row || !row.actionId.startsWith(DECISION_ID_PREFIX)) {
        return null;
      }
      return mapRecommendationRow(row);
    },
  );
}

export async function setDecisionRecommendationState(
  decisionId: string,
  state: DecisionRecommendationState,
  input: {
    actorId?: string | null;
    note?: string | null;
  },
  prismaClient: PrismaClient = prisma,
): Promise<StoredDecisionRecommendation> {
  return withDecisionSpan(
    'decision_recommendations.set_state',
    {
      'vitalcv.decision_recommendations.decision_id': decisionId,
      'vitalcv.decision_recommendations.state': state,
    },
    async () => {
      const existing = await prismaClient.actionRecommendation.findUnique({
        where: { actionId: decisionId },
        include: {
          statusEvents: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      if (!existing || !existing.actionId.startsWith(DECISION_ID_PREFIX)) {
        throw new Error(`Decision recommendation not found: ${decisionId}`);
      }

      const fromState = normalizeDecisionState(existing.status);
      if (!canTransitionDecisionState(fromState, state)) {
        throw new Error(`Invalid decision state transition from ${fromState} to ${state}`);
      }

      const existingMetadata = asRecord(existing.metadata);
      const actedOnAt = state === 'completed'
        ? new Date().toISOString()
        : asString(existingMetadata.actedOnAt);
      const updated = await prismaClient.actionRecommendation.update({
        where: { actionId: decisionId },
        data: {
          status: state,
          metadata: toJsonValue({
            ...existingMetadata,
            feedbackNote: input.note ?? asString(existingMetadata.feedbackNote),
            actedOnAt,
          }),
          statusEvents: {
            create: [{
              fromStatus: fromState,
              toStatus: state,
              actorId: input.actorId ?? null,
              note: input.note ?? null,
              metadata: toJsonValue({ state }),
            }],
          },
        },
        include: {
          statusEvents: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      return mapRecommendationRow(updated);
    },
  );
}

export async function topDecisionRecommendationsForCopilot(
  target: {
    entityType: DecisionTargetEntityType;
    entityId: string;
  },
  prismaClient: PrismaClient = prisma,
): Promise<StoredDecisionRecommendation[]> {
  const result = await listDecisionRecommendationsForTarget(target.entityType, target.entityId, {
    limit: 3,
  }, prismaClient);
  return result.recommendations.slice(0, 3);
}

export function summarizeDecisionForCopilot(recommendation: StoredDecisionRecommendation): string {
  return `${recommendation.actionType}: ${recommendation.rationale}`;
}
