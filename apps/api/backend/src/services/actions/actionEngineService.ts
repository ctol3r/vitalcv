import { SpanStatusCode, trace } from '@opentelemetry/api';
import { Prisma, type PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import {
  createActionEngine,
  type ActionEvidence,
  type ActionPriority,
  type ActionStoryline,
  type ActionTargetEntity,
  type ActionType,
  type RecommendedAction,
} from '../../../../../../core/actions/actionEngine';
import {
  buildActionHistoryEvent,
  canTransitionActionStatus,
  isActionStatus,
  normalizeActionStatus,
  type ActionHistoryEvent,
  type ActionStatus,
  type ActionStatusInput,
} from '../../../../../../core/actions/actionHistory';
import {
  listPredictionInsightsByIds,
  refreshPredictionInsights,
  type StoredPredictionInsight,
} from '../predictions/predictionEngineService';

const actionTracer = trace.getTracer('vitalcv.actions');
const ACTIVE_FINDING_STATUSES = ['new', 'acknowledged', 'investigating', 'escalated'] as const;
const NPI_RE = /^\d{10}$/;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asRecord(value: Prisma.JsonValue | Record<string, unknown> | undefined | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
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

function storylineTypeFromFindingTypes(findingTypes: string[]): string {
  if (findingTypes.some((type) => ['trust_decline', 'divergence'].includes(type))) {
    return 'TRUST_RISK';
  }
  if (findingTypes.includes('research_momentum')) {
    return 'RISING_INVESTIGATOR';
  }
  if (findingTypes.includes('network_emergence')) {
    return 'NETWORK_EMERGENCE';
  }
  if (findingTypes.includes('workforce_pressure')) {
    return 'WORKFORCE_OPPORTUNITY';
  }
  if (findingTypes.includes('industry_influence')) {
    return 'INDUSTRY_INFLUENCE';
  }
  return 'TRUST_RISK';
}

function evidenceList(value: Prisma.JsonValue): ActionEvidence[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => {
    const record = asRecord(entry);
    const label = asString(record.evidenceType) ?? 'evidence';
    const snippet = asString(record.snippet);
    const source = asString(record.sourceLabel) ?? asString(record.sourceId);
    return {
      label,
      snippet,
      source,
    };
  });
}

function severityRank(value: string): number {
  switch (value.toLowerCase()) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

function parseActionEvidence(value: Prisma.JsonValue): ActionEvidence[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => {
    const record = asRecord(entry);
    return {
      label: asString(record.label) ?? 'evidence',
      snippet: asString(record.snippet),
      source: asString(record.source),
    };
  });
}

function parseActionStatusEvents(value: Array<{
  fromStatus: string | null;
  toStatus: string;
  actorId: string | null;
  note: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}>): ActionHistoryEvent[] {
  return value.map((event) => ({
    fromStatus: event.fromStatus ? normalizeActionStatus(event.fromStatus) : null,
    toStatus: normalizeActionStatus(event.toStatus),
    actorId: event.actorId,
    note: event.note,
    metadata: asRecord(event.metadata),
    createdAt: event.createdAt.toISOString(),
  }));
}

function selectTargetEntity(row: {
  entityLinks: Array<{
    entityType: string;
    entityId: string;
    entityLabel: string | null;
    relationship: string | null;
  }>;
  entityIds: string[];
  metadata: Prisma.JsonValue;
}): ActionTargetEntity {
  const subject = row.entityLinks.find((entity) => entity.relationship === 'subject')
    ?? row.entityLinks.find((entity) => entity.entityType === 'provider')
    ?? row.entityLinks[0];
  if (subject) {
    return {
      entityType: subject.entityType,
      entityId: subject.entityId,
      entityLabel: subject.entityLabel,
    };
  }

  const metadata = asRecord(row.metadata);
  const npi = asString(metadata.npi);
  if (npi && NPI_RE.test(npi)) {
    return {
      entityType: 'provider',
      entityId: npi,
      entityLabel: asString(metadata.providerLabel) ?? `Provider ${npi}`,
    };
  }

  const fallbackId = row.entityIds[0] ?? 'unknown';
  return {
    entityType: 'entity',
    entityId: fallbackId,
    entityLabel: fallbackId,
  };
}

function combineNarrative(rows: Array<{ title: string; summary: string; explanation: string }>): string {
  return rows
    .slice(0, 2)
    .map((row) => row.summary || row.explanation || row.title)
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index)
    .join(' ');
}

async function withActionSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  work: () => Promise<T>,
): Promise<T> {
  return actionTracer.startActiveSpan(name, async (span) => {
    span.setAttributes(attributes);
    try {
      const result = await work();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'action failure',
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

async function loadActionStorylines(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<ActionStoryline[]> {
  const rows = await prismaClient.investigatorFinding.findMany({
    where: {
      status: { in: [...ACTIVE_FINDING_STATUSES] },
      lastSeenAt: { gte: daysAgo(nowIso, 180) },
    },
    include: {
      entityLinks: true,
    },
    orderBy: [
      { storylineKey: 'asc' },
      { lastSeenAt: 'desc' },
    ],
    take: 600,
  });

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = grouped.get(row.storylineKey) ?? [];
    list.push(row);
    grouped.set(row.storylineKey, list);
  }

  const storylines: ActionStoryline[] = [];
  for (const [storylineKey, storylineRows] of grouped) {
    const sorted = [...storylineRows].sort((left, right) => right.lastSeenAt.getTime() - left.lastSeenAt.getTime());
    const latest = sorted[0];
    if (!latest) {
      continue;
    }

    const findingTypes = [...new Set(sorted.map((row) => row.findingType))];
    const targetEntity = selectTargetEntity(latest);
    const supportingEvidence = sorted
      .flatMap((row) => evidenceList(row.supportingEvidence))
      .filter((value, index, array) => array.findIndex((entry) => entry.label === value.label && entry.snippet === value.snippet) === index)
      .slice(0, 5);
    const highestSeverity = sorted.reduce(
      (current, row) => severityRank(row.severity) > severityRank(current) ? row.severity : current,
      latest.severity,
    );
    const confidence = Math.max(...sorted.map((row) => row.confidence));

    storylines.push({
      storylineKey,
      storylineType: storylineTypeFromFindingTypes(findingTypes),
      title: latest.title,
      narrative: combineNarrative(sorted),
      severity: highestSeverity,
      confidence,
      targetEntity,
      findingIds: sorted.map((row) => row.findingId),
      findingTypes,
      supportingEvidence,
      updatedAt: latest.lastSeenAt.toISOString(),
      metadata: {
        ...asRecord(latest.metadata),
        graphCentrality: latest.graphCentrality,
        entityImportance: latest.entityImportance,
        activeFindingCount: sorted.length,
      },
    });
  }

  return storylines;
}

function actionCreateData(action: RecommendedAction): Prisma.ActionRecommendationCreateInput {
  const initialEvent = buildActionHistoryEvent({
    fromStatus: null,
    toStatus: action.status,
    note: 'Action created by action engine refresh.',
    createdAt: action.createdAt,
  });

  return {
    actionId: action.actionId,
    actionType: action.actionType,
    storylineKey: action.storylineKey ?? null,
    sourceFindingIds: action.sourceFindingIds,
    predictionIds: action.predictionIds,
    targetEntityType: action.targetEntity.entityType,
    targetEntityId: action.targetEntity.entityId,
    targetEntityLabel: action.targetEntity.entityLabel ?? null,
    recommendedAction: action.recommendedAction,
    priority: action.priority,
    priorityScore: action.priorityScore,
    confidence: action.confidence,
    explanation: action.explanation,
    evidence: toJsonValue(action.evidence),
    metadata: toJsonValue(action.metadata),
    status: action.status,
    createdAt: new Date(action.createdAt),
    statusEvents: {
      create: [{
        fromStatus: initialEvent.fromStatus,
        toStatus: initialEvent.toStatus,
        actorId: initialEvent.actorId ?? null,
        note: initialEvent.note ?? null,
        metadata: toJsonValue(initialEvent.metadata ?? {}),
        createdAt: new Date(initialEvent.createdAt),
      }],
    },
  };
}

function mapActionRow(row: {
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
  executedAt: Date | null;
  dismissedAt: Date | null;
  savedAt: Date | null;
  statusEvents?: Array<{
    fromStatus: string | null;
    toStatus: string;
    actorId: string | null;
    note: string | null;
    metadata: Prisma.JsonValue;
    createdAt: Date;
  }>;
}): StoredActionRecommendation {
  return {
    actionId: row.actionId,
    actionType: row.actionType as ActionType,
    targetEntity: {
      entityType: row.targetEntityType,
      entityId: row.targetEntityId,
      entityLabel: row.targetEntityLabel,
    },
    recommendedAction: row.recommendedAction,
    priority: row.priority as ActionPriority,
    priorityScore: row.priorityScore,
    confidence: row.confidence,
    explanation: row.explanation,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    status: normalizeActionStatus(row.status),
    storylineKey: row.storylineKey ?? null,
    sourceFindingIds: [...row.sourceFindingIds],
    predictionIds: [...row.predictionIds],
    evidence: parseActionEvidence(row.evidence),
    metadata: asRecord(row.metadata),
    executedAt: row.executedAt?.toISOString() ?? null,
    dismissedAt: row.dismissedAt?.toISOString() ?? null,
    savedAt: row.savedAt?.toISOString() ?? null,
    statusEvents: row.statusEvents ? parseActionStatusEvents(row.statusEvents) : undefined,
  };
}

async function persistActionRecommendations(
  actions: RecommendedAction[],
  prismaClient: PrismaClient,
): Promise<StoredActionRecommendation[]> {
  if (actions.length === 0) {
    return [];
  }

  const existingRows = await prismaClient.actionRecommendation.findMany({
    where: {
      actionId: { in: actions.map((action) => action.actionId) },
    },
  });
  const existingByActionId = new Map(existingRows.map((row) => [row.actionId, row]));
  const persisted: StoredActionRecommendation[] = [];

  for (const action of actions) {
    const existing = existingByActionId.get(action.actionId);
    if (!existing) {
      const created = await prismaClient.actionRecommendation.create({
        data: actionCreateData(action),
      });
      persisted.push(mapActionRow(created));
      continue;
    }

    const updated = await prismaClient.actionRecommendation.update({
      where: { actionId: action.actionId },
      data: {
        actionType: action.actionType,
        storylineKey: action.storylineKey ?? null,
        sourceFindingIds: action.sourceFindingIds,
        predictionIds: action.predictionIds,
        targetEntityType: action.targetEntity.entityType,
        targetEntityId: action.targetEntity.entityId,
        targetEntityLabel: action.targetEntity.entityLabel ?? null,
        recommendedAction: action.recommendedAction,
        priority: action.priority,
        priorityScore: action.priorityScore,
        confidence: action.confidence,
        explanation: action.explanation,
        evidence: toJsonValue(action.evidence),
        metadata: toJsonValue({
          ...asRecord(existing.metadata),
          ...action.metadata,
        }),
      },
    });
    persisted.push(mapActionRow(updated));
  }

  return persisted.sort((left, right) => right.priorityScore - left.priorityScore || left.actionId.localeCompare(right.actionId));
}

function buildActionWhere(
  query: ActionListQuery,
  actionIds: string[],
): Prisma.ActionRecommendationWhereInput {
  const and: Prisma.ActionRecommendationWhereInput[] = [{
    actionId: { in: actionIds },
  }];

  const priorities = normalizeList(query.priority);
  if (priorities.length > 0) {
    and.push({ priority: { in: priorities } });
  }

  const actionTypes = normalizeList(query.actionType);
  if (actionTypes.length > 0) {
    and.push({ actionType: { in: actionTypes } });
  }

  const statuses = normalizeList(query.status)
    .filter((status) => isActionStatus(status))
    .map((status) => normalizeActionStatus(status));
  if (statuses.length > 0) {
    and.push({
      status: {
        in: [...new Set(statuses.flatMap((status) => {
          switch (status) {
            case 'in_progress':
              return ['in_progress', 'SAVED'];
            case 'completed':
              return ['completed', 'EXECUTED'];
            case 'skipped':
              return ['skipped', 'DISMISSED'];
            case 'pending':
            default:
              return ['pending', 'OPEN'];
          }
        }))],
      },
    });
  }

  if (query.entity) {
    and.push({
      OR: [
        { targetEntityId: query.entity },
        { targetEntityLabel: { contains: query.entity, mode: 'insensitive' } },
      ],
    });
  }

  if (query.dateFrom || query.dateTo) {
    and.push({
      createdAt: {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      },
    });
  }

  return { AND: and };
}

async function hydrateActionDetail(
  action: StoredActionRecommendation,
  prismaClient: PrismaClient,
): Promise<StoredActionRecommendation> {
  const linkedPredictions = await listPredictionInsightsByIds(action.predictionIds, prismaClient);
  return {
    ...action,
    linkedPredictions,
  };
}

export interface StoredActionRecommendation extends Omit<RecommendedAction, 'createdAt'> {
  createdAt: string;
  updatedAt: string;
  executedAt: string | null;
  dismissedAt: string | null;
  savedAt: string | null;
  statusEvents?: ActionHistoryEvent[];
  linkedPredictions?: StoredPredictionInsight[];
}

export interface ActionListQuery {
  priority?: string[] | string;
  entity?: string | null;
  actionType?: string[] | string;
  status?: string[] | string;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
  offset?: number;
}

export async function refreshActionRecommendations(
  now = new Date().toISOString(),
  prismaClient: PrismaClient = prisma,
): Promise<StoredActionRecommendation[]> {
  return withActionSpan(
    'actions.refresh',
    { 'vitalcv.actions.refresh': true },
    async () => {
      const [predictions, storylines] = await Promise.all([
        refreshPredictionInsights(now, prismaClient),
        loadActionStorylines(prismaClient, now),
      ]);

      const actions = createActionEngine().generate({
        storylines,
        predictions,
        now,
      });

      return persistActionRecommendations(actions, prismaClient);
    },
  );
}

export async function listActionRecommendations(
  query: ActionListQuery,
  prismaClient: PrismaClient = prisma,
): Promise<{ total: number; actions: StoredActionRecommendation[] }> {
  return withActionSpan(
    'actions.list',
    {
      'vitalcv.actions.entity_filter': Boolean(query.entity),
      'vitalcv.actions.priority_filter': normalizeList(query.priority).length,
    },
    async () => {
      const currentActions = await refreshActionRecommendations(new Date().toISOString(), prismaClient);
      const actionIds = currentActions.map((action) => action.actionId);
      if (actionIds.length === 0) {
        return { total: 0, actions: [] };
      }

      const where = buildActionWhere(query, actionIds);
      const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
      const offset = Math.max(query.offset ?? 0, 0);

      const [total, rows] = await Promise.all([
        prismaClient.actionRecommendation.count({ where }),
        prismaClient.actionRecommendation.findMany({
          where,
          orderBy: [
            { priorityScore: 'desc' },
            { createdAt: 'desc' },
          ],
          skip: offset,
          take: limit,
        }),
      ]);

      return {
        total,
        actions: rows.map((row) => mapActionRow(row)),
      };
    },
  );
}

export async function getActionRecommendation(
  actionId: string,
  prismaClient: PrismaClient = prisma,
): Promise<StoredActionRecommendation | null> {
  return withActionSpan(
    'actions.get',
    { 'vitalcv.actions.action_id': actionId },
    async () => {
      const row = await prismaClient.actionRecommendation.findUnique({
        where: { actionId },
        include: {
          statusEvents: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      if (!row) {
        return null;
      }

      return hydrateActionDetail(mapActionRow(row), prismaClient);
    },
  );
}

async function updateActionStatus(
  actionId: string,
  status: ActionStatusInput,
  input: {
    actorId?: string | null;
    note?: string | null;
    metadata?: Record<string, unknown>;
  },
  prismaClient: PrismaClient,
): Promise<StoredActionRecommendation> {
  const existing = await prismaClient.actionRecommendation.findUnique({
    where: { actionId },
    include: {
      statusEvents: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!existing) {
    throw new Error(`Action not found: ${actionId}`);
  }

  const existingStatus = normalizeActionStatus(existing.status);
  const nextStatus = normalizeActionStatus(status);

  if (!canTransitionActionStatus(existingStatus, nextStatus)) {
    throw new Error(`Invalid action status transition from ${existingStatus} to ${nextStatus}`);
  }

  const changedAt = new Date().toISOString();
  const event = buildActionHistoryEvent({
    fromStatus: existingStatus,
    toStatus: nextStatus,
    actorId: input.actorId ?? null,
    note: input.note ?? null,
    metadata: input.metadata ?? {},
    createdAt: changedAt,
  });

  const updated = await prismaClient.actionRecommendation.update({
    where: { actionId },
    data: {
      status: nextStatus,
      executedAt: nextStatus === 'completed' ? new Date(changedAt) : existing.executedAt,
      dismissedAt: nextStatus === 'skipped' ? new Date(changedAt) : existing.dismissedAt,
      savedAt: nextStatus === 'in_progress' ? new Date(changedAt) : existing.savedAt,
      statusEvents: {
        create: [{
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          actorId: event.actorId ?? null,
          note: event.note ?? null,
          metadata: toJsonValue(event.metadata ?? {}),
          createdAt: new Date(event.createdAt),
        }],
      },
    },
    include: {
      statusEvents: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return hydrateActionDetail(mapActionRow(updated), prismaClient);
}

export async function setActionRecommendationStatus(
  actionId: string,
  status: ActionStatusInput,
  input: { actorId?: string | null; note?: string | null },
  prismaClient: PrismaClient = prisma,
): Promise<StoredActionRecommendation> {
  return withActionSpan(
    'actions.set_status',
    { 'vitalcv.actions.action_id': actionId, 'vitalcv.actions.status': normalizeActionStatus(status) },
    async () => updateActionStatus(actionId, status, input, prismaClient),
  );
}

export async function executeActionRecommendation(
  actionId: string,
  input: { actorId?: string | null; note?: string | null },
  prismaClient: PrismaClient = prisma,
): Promise<StoredActionRecommendation> {
  return withActionSpan(
    'actions.execute',
    { 'vitalcv.actions.action_id': actionId },
    async () => updateActionStatus(actionId, 'completed', input, prismaClient),
  );
}

export async function dismissActionRecommendation(
  actionId: string,
  input: { actorId?: string | null; note?: string | null },
  prismaClient: PrismaClient = prisma,
): Promise<StoredActionRecommendation> {
  return withActionSpan(
    'actions.dismiss',
    { 'vitalcv.actions.action_id': actionId },
    async () => updateActionStatus(actionId, 'skipped', input, prismaClient),
  );
}

export async function saveActionRecommendation(
  actionId: string,
  input: { actorId?: string | null; note?: string | null },
  prismaClient: PrismaClient = prisma,
): Promise<StoredActionRecommendation> {
  return withActionSpan(
    'actions.save',
    { 'vitalcv.actions.action_id': actionId },
    async () => updateActionStatus(actionId, 'in_progress', input, prismaClient),
  );
}
