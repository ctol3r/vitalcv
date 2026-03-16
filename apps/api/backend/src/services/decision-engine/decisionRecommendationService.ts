import { SpanStatusCode, trace } from '@opentelemetry/api';
import { Prisma, type PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import type { DecisionResult, DecisionSupportingSignal } from '../../../../../../core/decisions/decisionEngine';
import {
  decisionRecommendationToActionLabel,
  refreshDecisionRecommendations as computeDecisionRecommendations,
} from '../decisions/decisionEngineService';

const decisionTracer = trace.getTracer('vitalcv.decision-engine');
const DECISION_ID_PREFIX = 'decision_';

export type DecisionRecommendationStatus =
  | 'open'
  | 'accepted'
  | 'dismissed'
  | 'deferred'
  | 'completed';

export interface DecisionStatusEvent {
  fromStatus: DecisionRecommendationStatus | null;
  toStatus: DecisionRecommendationStatus;
  actorId: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface StoredDecisionRecommendation extends Omit<DecisionResult, 'status'> {
  status: DecisionRecommendationStatus;
  sourceFindingIds: string[];
  predictionIds: string[];
  supportingStorylineKeys: string[];
  statusEvents?: DecisionStatusEvent[];
}

export interface DecisionListQuery {
  priority?: string[] | string;
  recommendation?: string[] | string;
  entityType?: string[] | string;
  status?: string[] | string;
  minConfidence?: number | null;
  createdAtFrom?: string | null;
  createdAtTo?: string | null;
  limit?: number;
  offset?: number;
}

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

function parseSignals(value: Prisma.JsonValue): DecisionSupportingSignal[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      return {
        kind: (asString(record.kind) as DecisionSupportingSignal['kind']) ?? 'finding',
        signalId: asString(record.signalId) ?? 'signal',
        label: asString(record.label) ?? 'signal',
        value: typeof record.value === 'number' || typeof record.value === 'string' ? record.value : null,
        source: asString(record.source),
        observedAt: asString(record.observedAt),
        confidence: typeof record.confidence === 'number' ? record.confidence : undefined,
      };
    });
}

function normalizeDecisionStatus(value: string | null | undefined): DecisionRecommendationStatus {
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
    case 'open':
    case 'pending':
    default:
      return 'open';
  }
}

export function isDecisionRecommendationState(value: unknown): value is DecisionRecommendationStatus {
  return ['open', 'accepted', 'dismissed', 'deferred', 'completed'].includes(String(value ?? '').toLowerCase());
}

function canTransitionDecisionStatus(
  fromStatus: DecisionRecommendationStatus,
  toStatus: DecisionRecommendationStatus,
): boolean {
  if (fromStatus === toStatus) {
    return true;
  }

  const allowed: Record<DecisionRecommendationStatus, DecisionRecommendationStatus[]> = {
    open: ['accepted', 'dismissed', 'deferred', 'completed'],
    accepted: ['open', 'deferred', 'dismissed', 'completed'],
    deferred: ['open', 'accepted', 'dismissed', 'completed'],
    dismissed: ['open', 'accepted', 'deferred'],
    completed: ['open', 'accepted', 'deferred'],
  };

  return allowed[fromStatus].includes(toStatus);
}

function parseStatusEvents(rows: ActionStatusEventRow[]): DecisionStatusEvent[] {
  return rows.map((row) => ({
    fromStatus: row.fromStatus ? normalizeDecisionStatus(row.fromStatus) : null,
    toStatus: normalizeDecisionStatus(row.toStatus),
    actorId: row.actorId,
    note: row.note,
    metadata: asRecord(row.metadata),
    createdAt: row.createdAt.toISOString(),
  }));
}

function metadataForDecision(decision: DecisionResult, status: DecisionRecommendationStatus): Record<string, unknown> {
  return {
    decisionType: decision.type,
    supportingStorylineKeys: decision.supportingStorylineKeys,
    decisionMetadata: decision.metadata,
    status,
  };
}

function mapRecommendationRow(row: ActionRecommendationRow): StoredDecisionRecommendation {
  const metadata = asRecord(row.metadata);
  const decisionMetadata = asRecord(metadata.decisionMetadata);
  const supportingStorylineKeys = Array.isArray(metadata.supportingStorylineKeys)
    ? metadata.supportingStorylineKeys.filter((value): value is string => typeof value === 'string')
    : row.storylineKey
      ? [row.storylineKey]
      : [];

  return {
    id: row.actionId,
    type: (asString(metadata.decisionType) as DecisionResult['type']) ?? 'PROVIDER_RISK_ESCALATION',
    targetEntity: {
      entityType: row.targetEntityType,
      entityId: row.targetEntityId,
      entityLabel: row.targetEntityLabel,
    },
    recommendation: row.actionType as DecisionResult['recommendation'],
    priority: row.priority as DecisionResult['priority'],
    priorityScore: row.priorityScore,
    confidence: row.confidence,
    explanation: row.explanation,
    supportingSignals: parseSignals(row.evidence),
    supportingFindingIds: [...row.sourceFindingIds],
    supportingStorylineKeys,
    supportingPredictionIds: [...row.predictionIds],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    status: normalizeDecisionStatus(row.status),
    metadata: decisionMetadata,
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
        message: error instanceof Error ? error.message : 'decision recommendation failure',
      });
      throw error;
    } finally {
      span.end();
    }
  });
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

function targetEntityTypeMatches(actual: string, expected: string): boolean {
  if (actual.toLowerCase() === expected.toLowerCase()) {
    return true;
  }

  return ['market', 'specialty'].includes(actual.toLowerCase())
    && ['market', 'specialty'].includes(expected.toLowerCase());
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
  const priorities = normalizeList(query.priority).map((value) => value.toLowerCase());
  const recommendationsFilter = normalizeList(query.recommendation).map((value) => value.toUpperCase());
  const entityTypes = normalizeList(query.entityType).map((value) => value.toLowerCase());
  const statuses = normalizeList(query.status).map((value) => value.toLowerCase());

  return recommendations.filter((recommendation) => {
    if (priorities.length > 0 && !priorities.includes(recommendation.priority.toLowerCase())) {
      return false;
    }
    if (recommendationsFilter.length > 0 && !recommendationsFilter.includes(recommendation.recommendation)) {
      return false;
    }
    if (
      entityTypes.length > 0
      && !entityTypes.some((entityType) => targetEntityTypeMatches(recommendation.targetEntity.entityType, entityType))
    ) {
      return false;
    }
    if (statuses.length > 0 && !statuses.includes(recommendation.status.toLowerCase())) {
      return false;
    }
    if (typeof query.minConfidence === 'number' && recommendation.confidence < query.minConfidence) {
      return false;
    }
    if (!withinDateRange(recommendation.createdAt, query.createdAtFrom, query.createdAtTo)) {
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

function createRowData(
  decision: DecisionResult,
  status: DecisionRecommendationStatus,
): Prisma.ActionRecommendationCreateInput {
  return {
    actionId: decision.id,
    actionType: decision.recommendation,
    storylineKey: decision.supportingStorylineKeys[0] ?? null,
    sourceFindingIds: decision.supportingFindingIds,
    predictionIds: decision.supportingPredictionIds,
    targetEntityType: decision.targetEntity.entityType,
    targetEntityId: decision.targetEntity.entityId,
    targetEntityLabel: decision.targetEntity.entityLabel ?? null,
    recommendedAction: decisionRecommendationToActionLabel(
      decision.recommendation,
      decision.targetEntity.entityLabel ?? decision.targetEntity.entityId,
    ),
    priority: decision.priority,
    priorityScore: decision.priorityScore,
    confidence: decision.confidence,
    explanation: decision.explanation,
    evidence: toJsonValue(decision.supportingSignals),
    metadata: toJsonValue(metadataForDecision(decision, status)),
    status,
    createdAt: new Date(decision.createdAt),
    statusEvents: {
      create: [{
        fromStatus: null,
        toStatus: status,
        actorId: null,
        note: 'Decision recommendation created by FE19 decision engine.',
        metadata: toJsonValue({ decisionType: decision.type }),
        createdAt: new Date(decision.createdAt),
      }],
    },
  };
}

async function persistDecisionRecommendations(
  decisions: DecisionResult[],
  prismaClient: PrismaClient,
): Promise<StoredDecisionRecommendation[]> {
  const ids = decisions.map((decision) => decision.id);

  await prismaClient.actionRecommendation.deleteMany({
    where: {
      actionId: { startsWith: DECISION_ID_PREFIX, notIn: ids.length > 0 ? ids : ['__none__'] },
    },
  });

  if (decisions.length === 0) {
    return [];
  }

  const existingRows = await prismaClient.actionRecommendation.findMany({
    where: {
      actionId: { in: ids },
    },
    include: {
      statusEvents: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  const existingById = new Map(existingRows.map((row) => [row.actionId, row]));
  const stored: StoredDecisionRecommendation[] = [];

  for (const decision of decisions) {
    const existing = existingById.get(decision.id);
    const currentStatus = existing ? normalizeDecisionStatus(existing.status) : 'open';
    if (!existing) {
      const created = await prismaClient.actionRecommendation.create({
        data: createRowData(decision, currentStatus),
        include: {
          statusEvents: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      stored.push(mapRecommendationRow(created));
      continue;
    }

    const updated = await prismaClient.actionRecommendation.update({
      where: { actionId: decision.id },
      data: {
        actionType: decision.recommendation,
        storylineKey: decision.supportingStorylineKeys[0] ?? null,
        sourceFindingIds: decision.supportingFindingIds,
        predictionIds: decision.supportingPredictionIds,
        targetEntityType: decision.targetEntity.entityType,
        targetEntityId: decision.targetEntity.entityId,
        targetEntityLabel: decision.targetEntity.entityLabel ?? null,
        recommendedAction: decisionRecommendationToActionLabel(
          decision.recommendation,
          decision.targetEntity.entityLabel ?? decision.targetEntity.entityId,
        ),
        priority: decision.priority,
        priorityScore: decision.priorityScore,
        confidence: decision.confidence,
        explanation: decision.explanation,
        evidence: toJsonValue(decision.supportingSignals),
        metadata: toJsonValue(metadataForDecision(decision, currentStatus)),
        status: currentStatus,
      },
      include: {
        statusEvents: {
          orderBy: { createdAt: 'desc' },
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
    return left.id.localeCompare(right.id);
  });
}

export async function refreshDecisionRecommendations(
  now = new Date().toISOString(),
  prismaClient: PrismaClient = prisma,
): Promise<StoredDecisionRecommendation[]> {
  return withDecisionSpan(
    'decision_recommendations.refresh',
    { 'vitalcv.decision_recommendations.refresh': true },
    async () => {
      const decisions = await computeDecisionRecommendations(now, prismaClient);
      return persistDecisionRecommendations(decisions, prismaClient);
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
      'vitalcv.decision_recommendations.entity_filters': normalizeList(query.entityType).length,
      'vitalcv.decision_recommendations.recommendation_filters': normalizeList(query.recommendation).length,
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
  targetEntityType: string,
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
    targetEntityTypeMatches(recommendation.targetEntity.entityType, targetEntityType)
      && targetMatches(recommendation, identifier),
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
            orderBy: { createdAt: 'desc' },
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
  state: DecisionRecommendationStatus,
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
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      if (!existing || !existing.actionId.startsWith(DECISION_ID_PREFIX)) {
        throw new Error(`Decision recommendation not found: ${decisionId}`);
      }

      const fromStatus = normalizeDecisionStatus(existing.status);
      if (!canTransitionDecisionStatus(fromStatus, state)) {
        throw new Error(`Invalid decision state transition from ${fromStatus} to ${state}`);
      }

      const existingMetadata = asRecord(existing.metadata);
      const updated = await prismaClient.actionRecommendation.update({
        where: { actionId: decisionId },
        data: {
          status: state,
          metadata: toJsonValue({
            ...existingMetadata,
            status: state,
            feedbackNote: input.note ?? asString(existingMetadata.feedbackNote),
            actedOnAt: state === 'open' ? asString(existingMetadata.actedOnAt) : new Date().toISOString(),
          }),
          statusEvents: {
            create: [{
              fromStatus,
              toStatus: state,
              actorId: input.actorId ?? null,
              note: input.note ?? null,
              metadata: toJsonValue({ status: state }),
              createdAt: new Date(),
            }],
          },
        },
        include: {
          statusEvents: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      return mapRecommendationRow(updated);
    },
  );
}

export async function topDecisionRecommendationsForCopilot(
  target: {
    entityType: string;
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
  return `${recommendation.recommendation}: ${recommendation.explanation}`;
}
