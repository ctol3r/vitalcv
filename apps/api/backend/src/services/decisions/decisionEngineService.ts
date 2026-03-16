import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import {
  createDecisionEngine,
  type DecisionPrediction,
  type DecisionPriority,
  type DecisionRecommendation,
  type DecisionResult,
} from '../../../../../../core/decisions/decisionEngine';
import { log } from '../../obs/logger';
import { refreshPredictionInsights } from '../predictions/predictionEngineService';
import { buildDecisionStorylines, loadDecisionFindings } from './decisionInputLoader';

const decisionTracer = trace.getTracer('vitalcv.decisions');
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeList(value: string[] | string | undefined): string[] {
  if (!value) {
    return [];
  }

  const raw = Array.isArray(value) ? value : [value];
  return raw
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseDateBoundary(value: string | null | undefined, boundary: 'start' | 'end'): Date | null {
  if (!value) {
    return null;
  }

  if (DATE_ONLY_RE.test(value)) {
    const suffix = boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
    const parsed = new Date(`${value}${suffix}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function daysAgo(nowIso: string, days: number): Date {
  return new Date(new Date(nowIso).getTime() - (days * 86_400_000));
}

function matchesEntityReference(decision: DecisionResult, reference: string): boolean {
  const normalized = reference.trim().toLowerCase();
  if (normalized.length === 0) {
    return true;
  }

  const entityId = decision.targetEntity.entityId.toLowerCase();
  const entityLabel = decision.targetEntity.entityLabel?.toLowerCase() ?? '';
  return entityId === normalized
    || entityId.endsWith(`:${normalized}`)
    || entityId.includes(normalized)
    || slugify(entityLabel) === normalized
    || entityLabel.includes(normalized.replace(/-/g, ' '));
}

function matchesEntityType(decision: DecisionResult, entityType: string): boolean {
  if (decision.targetEntity.entityType === entityType) {
    return true;
  }

  return ['market', 'specialty'].includes(decision.targetEntity.entityType)
    && ['market', 'specialty'].includes(entityType);
}

function toPublicDecision(decision: DecisionResult) {
  return {
    id: decision.id,
    type: decision.type,
    targetEntityType: decision.targetEntity.entityType,
    targetEntityId: decision.targetEntity.entityId,
    recommendation: decision.recommendation,
    priority: decision.priority,
    confidence: decision.confidence,
    explanation: decision.explanation,
    supportingSignals: decision.supportingSignals,
    createdAt: decision.createdAt,
    updatedAt: decision.updatedAt,
    status: decision.status,
  };
}

function mapStoredPrediction(row: {
  predictionId: string;
  predictionType: string;
  targetEntityType: string;
  targetEntityId: string;
  targetEntityLabel: string | null;
  probability: number;
  confidence: number;
  timeHorizon: string;
  explanation: string;
  evidenceSignals: unknown;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): DecisionPrediction {
  return {
    predictionId: row.predictionId,
    predictionType: row.predictionType,
    targetEntity: {
      entityType: row.targetEntityType,
      entityId: row.targetEntityId,
      entityLabel: row.targetEntityLabel,
    },
    probability: row.probability,
    confidence: row.confidence,
    timeHorizon: row.timeHorizon,
    explanation: row.explanation,
    evidenceSignals: Array.isArray(row.evidenceSignals)
      ? row.evidenceSignals
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
        .map((entry) => ({
          label: asString(entry.label) ?? 'signal',
          value: typeof entry.value === 'number' || typeof entry.value === 'string' ? entry.value : '',
          direction: asString(entry.direction) === 'DOWN'
            ? 'DOWN'
            : asString(entry.direction) === 'FLAT'
              ? 'FLAT'
              : 'UP',
          source: asString(entry.source),
        }))
      : [],
    metadata: asRecord(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadDecisionPredictions(
  nowIso: string,
  prismaClient: PrismaClient,
): Promise<DecisionPrediction[]> {
  const existing = await prismaClient.predictionInsight.findMany({
    where: {
      updatedAt: { gte: daysAgo(nowIso, 180) },
    },
    orderBy: [{ probability: 'desc' }, { confidence: 'desc' }],
    take: 400,
  });

  if (existing.length > 0) {
    return existing.map((row) => mapStoredPrediction(row));
  }

  try {
    const refreshed = await refreshPredictionInsights(nowIso, prismaClient);
    return refreshed.map((row) => ({
      predictionId: row.predictionId,
      predictionType: row.predictionType,
      targetEntity: row.targetEntity,
      probability: row.probability,
      confidence: row.confidence,
      timeHorizon: row.timeHorizon,
      explanation: row.explanation,
      evidenceSignals: row.evidenceSignals,
      metadata: row.metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  } catch (error) {
    log('warn', 'decisions.predictions_unavailable', {
      error: error instanceof Error ? error.message : String(error),
      fallback: 'findings_storylines_only',
    });
    return [];
  }
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
        message: error instanceof Error ? error.message : 'decision failure',
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

export interface DecisionListQuery {
  priority?: string[] | string;
  entityType?: string | null;
  recommendation?: string[] | string;
  confidence?: number | null;
  createdAt?: string | null;
  entityRef?: string | null;
  limit?: number;
  offset?: number;
}

export async function refreshDecisionRecommendations(
  now = new Date().toISOString(),
  prismaClient: PrismaClient = prisma,
): Promise<DecisionResult[]> {
  return withDecisionSpan(
    'decisions.refresh',
    { 'vitalcv.decisions.refresh': true },
    async () => {
      const [predictions, findings] = await Promise.all([
        loadDecisionPredictions(now, prismaClient),
        loadDecisionFindings(prismaClient, now),
      ]);
      const storylines = buildDecisionStorylines(findings);
      return createDecisionEngine().generate({
        findings,
        storylines,
        predictions,
        now,
      });
    },
  );
}

export async function listDecisionRecommendations(
  query: DecisionListQuery = {},
  prismaClient: PrismaClient = prisma,
): Promise<{ total: number; decisions: DecisionResult[] }> {
  return withDecisionSpan(
    'decisions.list',
    {
      'vitalcv.decisions.entity_filter': Boolean(query.entityType),
      'vitalcv.decisions.recommendation_filter': normalizeList(query.recommendation).length,
    },
    async () => {
      const decisions = await refreshDecisionRecommendations(new Date().toISOString(), prismaClient);
      const priorities = new Set(normalizeList(query.priority).map((value) => value.toLowerCase()));
      const recommendations = new Set(normalizeList(query.recommendation).map((value) => value.toUpperCase()));
      const minConfidence = typeof query.confidence === 'number' && Number.isFinite(query.confidence)
        ? Math.max(0, Math.min(query.confidence, 1))
        : null;
      const [createdFromRaw, createdToRaw] = typeof query.createdAt === 'string'
        ? query.createdAt.split(',').map((entry) => entry.trim())
        : [null, null];
      const createdFrom = parseDateBoundary(createdFromRaw, 'start');
      const createdTo = parseDateBoundary(createdToRaw, 'end');
      const filtered = decisions.filter((decision) => {
        if (priorities.size > 0 && !priorities.has(decision.priority.toLowerCase())) {
          return false;
        }
        if (query.entityType && !matchesEntityType(decision, query.entityType)) {
          return false;
        }
        if (recommendations.size > 0 && !recommendations.has(decision.recommendation)) {
          return false;
        }
        if (minConfidence !== null && decision.confidence < minConfidence) {
          return false;
        }
        if (query.entityRef && !matchesEntityReference(decision, query.entityRef)) {
          return false;
        }
        const createdAt = new Date(decision.createdAt);
        if (createdFrom && createdAt < createdFrom) {
          return false;
        }
        if (createdTo && createdAt > createdTo) {
          return false;
        }
        return true;
      });

      const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
      const offset = Math.max(query.offset ?? 0, 0);

      return {
        total: filtered.length,
        decisions: filtered.slice(offset, offset + limit),
      };
    },
  );
}

export async function listProviderDecisionRecommendations(
  providerId: string,
  query: Omit<DecisionListQuery, 'entityType' | 'entityRef'> = {},
  prismaClient: PrismaClient = prisma,
): Promise<{ total: number; decisions: DecisionResult[] }> {
  return listDecisionRecommendations({
    ...query,
    entityType: 'provider',
    entityRef: providerId,
  }, prismaClient);
}

export async function listInstitutionDecisionRecommendations(
  institutionId: string,
  query: Omit<DecisionListQuery, 'entityType' | 'entityRef'> = {},
  prismaClient: PrismaClient = prisma,
): Promise<{ total: number; decisions: DecisionResult[] }> {
  return listDecisionRecommendations({
    ...query,
    entityType: 'institution',
    entityRef: institutionId,
  }, prismaClient);
}

export async function listSpecialtyDecisionRecommendations(
  specialtySlug: string,
  query: Omit<DecisionListQuery, 'entityType' | 'entityRef' | 'recommendation'> = {},
  prismaClient: PrismaClient = prisma,
): Promise<{ total: number; decisions: DecisionResult[] }> {
  const result = await listDecisionRecommendations({
    ...query,
    entityRef: specialtySlug,
    recommendation: 'TRACK_SPECIALTY',
  }, prismaClient);

  const decisions = result.decisions.filter((decision) =>
    matchesEntityType(decision, 'specialty'));

  return {
    total: decisions.length,
    decisions,
  };
}

export function decisionRecommendationToActionLabel(
  recommendation: DecisionRecommendation,
  entityLabel: string,
): string {
  switch (recommendation) {
    case 'VERIFY_CREDENTIAL':
      return `Verify credential for ${entityLabel}`;
    case 'ESCALATE_RISK':
      return `Escalate risk for ${entityLabel}`;
    case 'MONITOR_PROVIDER':
      return `Monitor ${entityLabel}`;
    case 'INVESTIGATE_NETWORK':
      return `Investigate the network around ${entityLabel}`;
    case 'REVIEW_INSTITUTION':
      return `Review institution ${entityLabel}`;
    case 'TRACK_SPECIALTY':
      return `Track specialty pressure for ${entityLabel}`;
  }
}

export function decisionPriorityToActionPriority(priority: DecisionPriority): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  switch (priority) {
    case 'urgent':
      return 'CRITICAL';
    case 'high':
      return 'HIGH';
    case 'medium':
      return 'MEDIUM';
    case 'low':
    default:
      return 'LOW';
  }
}

export function decisionPriorityToActionScore(priority: DecisionPriority): number {
  switch (priority) {
    case 'urgent':
      return 0.9;
    case 'high':
      return 0.72;
    case 'medium':
      return 0.52;
    case 'low':
    default:
      return 0.31;
  }
}

export function decisionActionEvidence(decision: DecisionResult) {
  return decision.supportingSignals.map((signal) => ({
    label: signal.label,
    snippet: signal.value === undefined || signal.value === null ? undefined : String(signal.value),
    source: signal.source ?? undefined,
  }));
}

export function publicDecisionListPayload(result: { total: number; decisions: DecisionResult[] }, filters: {
  priority: string[];
  entityType: string | null;
  recommendation: string[];
  confidence: number | null;
  createdAt: string | null;
}) {
  return {
    schema: 'https://vitalcv.com/decisions/v1',
    total: result.total,
    decisions: result.decisions.map(toPublicDecision),
    filters,
  };
}

export function logDecisionRouteFailure(event: string, error: unknown, metadata: Record<string, unknown> = {}) {
  log('error', event, {
    error: error instanceof Error ? error.message : String(error),
    ...metadata,
  });
}
