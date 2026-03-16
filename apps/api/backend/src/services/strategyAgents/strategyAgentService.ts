import { createHash } from 'node:crypto';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { Prisma, type PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { refreshPredictionInsights } from '../predictions/predictionEngineService';
import { computeExpertiseScarcity, type ScarcitySignal } from '../intelligence/workforceIntelligenceService';
import type {
  StrategyAgentCadence,
  StrategyAgentRunResult,
  StrategyAgentStatus,
  StrategyAgentType,
  StrategyDecision,
  StrategyEntity,
  StrategyFindingReference,
  StrategyImpactLevel,
  StrategyInsight,
  StrategyMemorySnapshot,
  StrategyPredictionReference,
  StrategyReasoningEntry,
  StrategyReport,
  StrategySignal,
} from './contracts';

const strategyAgentTracer = trace.getTracer('vitalcv.strategy-agents');

const AUDIT_EVENT_TYPES = {
  report: 'STRATEGY_AGENT_REPORT',
  insight: 'STRATEGY_AGENT_INSIGHT',
  decision: 'STRATEGY_AGENT_DECISION',
  memory: 'STRATEGY_AGENT_MEMORY',
} as const;

type StrategyAgentSpec = {
  agentType: StrategyAgentType;
  cadence: StrategyAgentCadence;
  reportName: string;
  description: string;
  defaultTimeRange: string;
  schedule: string;
};

type TimeWindow = {
  label: string;
  periodStart: string;
  periodEnd: string;
  since: Date;
  until: Date;
};

type ParsedPrediction = {
  predictionId: string;
  predictionType: string;
  targetEntity: StrategyEntity;
  probability: number;
  confidence: number;
  timeHorizon: string;
  evidenceSignals: StrategySignal[];
  explanation: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type ProviderActivity = {
  decisionCount: number;
};

type InstitutionActivity = {
  headcount: number;
  recentSignals: number;
};

type NetworkActivity = {
  findingCount: number;
};

type AgentEvaluation = {
  report: StrategyReport;
  insights: StrategyInsight[];
  memory: StrategyMemorySnapshot;
  findings: StrategyFindingReference[];
};

type RunStrategyAgentsOptions = {
  agentTypes?: StrategyAgentType[];
  timeRange?: string;
  trigger?: 'manual' | 'scheduled' | 'copilot';
  refreshPredictions?: boolean;
  persist?: boolean;
  prismaClient?: PrismaClient;
};

type StrategySearchMatch = {
  kind: 'report' | 'insight';
  score: number;
  report?: StrategyReport;
  insight?: StrategyInsight;
};

export const STRATEGY_AGENT_SPECS: readonly StrategyAgentSpec[] = [
  {
    agentType: 'NETWORK_EVOLUTION',
    cadence: 'daily',
    reportName: 'Network Evolution Report',
    description: 'Detects emerging collaboration clusters and bridge-provider shifts.',
    defaultTimeRange: '30d',
    schedule: 'daily 04:00 America/Los_Angeles',
  },
  {
    agentType: 'PROVIDER_TRAJECTORY',
    cadence: 'weekly',
    reportName: 'Weekly Provider Intelligence',
    description: 'Tracks provider influence acceleration and cooling trajectories.',
    defaultTimeRange: '90d',
    schedule: 'weekly Monday 06:00 America/Los_Angeles',
  },
  {
    agentType: 'INSTITUTION_MOMENTUM',
    cadence: 'weekly',
    reportName: 'Institution Growth Report',
    description: 'Tracks institutions expanding or contracting research momentum.',
    defaultTimeRange: '90d',
    schedule: 'weekly Monday 06:30 America/Los_Angeles',
  },
  {
    agentType: 'SPECIALTY_PRESSURE',
    cadence: 'monthly',
    reportName: 'Monthly Specialty Forecast',
    description: 'Forecasts specialty workforce pressure and shortage escalation.',
    defaultTimeRange: '180d',
    schedule: 'monthly day 1 07:00 America/Los_Angeles',
  },
] as const;

const HIGH_IMPACT_LEVELS = new Set<StrategyImpactLevel>(['HIGH', 'CRITICAL']);
const ACTIVE_FINDING_STATUSES = ['new', 'acknowledged', 'investigating', 'escalated'] as const;
const COLLABORATION_EDGE_TYPES = ['co_author', 'co_pi', 'co_investigator', 'published_with', 'related_to'];

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

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function sha256Hex(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function scoreForImpact(probability: number, confidence: number, delta: number, weight = 0): number {
  return clamp01((probability * 0.55) + (confidence * 0.3) + Math.min(Math.abs(delta) * 2.5, 0.25) + weight);
}

function impactLevelFromScore(score: number): StrategyImpactLevel {
  if (score >= 0.88) {
    return 'CRITICAL';
  }
  if (score >= 0.72) {
    return 'HIGH';
  }
  if (score >= 0.52) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function maxImpactLevel(levels: StrategyImpactLevel[]): StrategyImpactLevel {
  const order: StrategyImpactLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  let best: StrategyImpactLevel = 'LOW';
  for (const level of levels) {
    if (order.indexOf(level) > order.indexOf(best)) {
      best = level;
    }
  }
  return best;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10_000) / 10_000;
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter((entry) => entry.length > 0)
    .map((entry) => entry[0]!.toUpperCase() + entry.slice(1).toLowerCase())
    .join(' ');
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function timeWindowForRange(timeRange: string | undefined, nowIso: string): TimeWindow {
  const now = new Date(nowIso);
  const normalized = (timeRange ?? '').trim().toLowerCase();
  const days = normalized === '7d' ? 7
    : normalized === '30d' ? 30
      : normalized === '90d' || normalized === 'quarter' ? 90
        : normalized === '180d' ? 180
          : normalized === '365d' || normalized === 'year' ? 365
            : 90;
  const since = new Date(now.getTime() - (days * 86_400_000));
  return {
    label: normalized.length > 0 ? normalized : `${days}d`,
    periodStart: since.toISOString(),
    periodEnd: now.toISOString(),
    since,
    until: now,
  };
}

function buildStableId(prefix: string, seed: Record<string, unknown>): string {
  return `${prefix}_${sha256Hex(seed).slice(0, 24)}`;
}

function driverFromSignal(signal: StrategySignal): string {
  const source = signal.source.replace(/_/g, ' ').toLowerCase();
  switch (signal.label) {
    case 'publication_growth':
      return `${signal.value} publication-growth signal(s) moved ${signal.direction.toLowerCase()}`;
    case 'recent_trials':
      return `${signal.value} recent trial leadership signal(s) were present`;
    case 'recent_grants':
      return `${signal.value} recent grant signal(s) were present`;
    case 'citation_count':
      return `citation volume is ${signal.value}`;
    case 'graph_degree':
      return `network centrality registered at degree ${signal.value}`;
    case 'research_growth':
      return `research growth moved by ${signal.value}`;
    case 'contributing_providers':
      return `${signal.value} contributing provider(s) backed the institution`;
    case 'lead_investigators':
      return `${signal.value} lead investigator signal(s) were active`;
    case 'connection_growth':
      return `${signal.value} new collaboration edge(s) formed`;
    case 'peer_growth':
      return `${signal.value} new peer relationship(s) entered the cluster`;
    case 'anchor_count':
      return `${signal.value} shared collaboration anchor(s) were present`;
    case 'active_demand':
      return `active demand registered ${signal.value} open role(s)`;
    case 'demand_growth':
      return `demand grew by ${signal.value}`;
    case 'mapped_supply':
      return `mapped supply sat at ${signal.value}`;
    case 'shortage_ratio':
      return `shortage ratio reached ${signal.value}`;
    case 'pressure_score':
      return `pressure score reached ${signal.value}`;
    default:
      return `${titleCase(signal.label.replace(/_/g, ' '))} from ${source}`;
  }
}

function predictionReference(prediction: ParsedPrediction): StrategyPredictionReference {
  return {
    predictionId: prediction.predictionId,
    predictionType: prediction.predictionType,
    probability: prediction.probability,
    confidence: prediction.confidence,
    timeHorizon: prediction.timeHorizon,
  };
}

function scoreFromMemoryEntry(entry: StrategyMemorySnapshot['entries'][number] | undefined): number {
  return entry ? Number(entry.score) : 0;
}

function metadataFromMemoryEntry(
  entry: StrategyMemorySnapshot['entries'][number] | undefined,
): Record<string, string | number | boolean> {
  return entry?.metadata ?? {};
}

function parsePredictionSignals(value: Prisma.JsonValue): StrategySignal[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry, index) => {
    const record = asRecord(entry);
    const directionRaw = asString(record.direction);
    return {
      label: asString(record.label) ?? `signal_${index + 1}`,
      value: typeof record.value === 'number' || typeof record.value === 'string'
        ? record.value
        : String(record.value ?? ''),
      direction: directionRaw === 'DOWN' || directionRaw === 'FLAT' ? directionRaw : 'UP',
      source: asString(record.source) ?? 'INTERNAL',
      weight: clamp01(1 / Math.max(value.length, 1)),
      observedAt: asString(record.observedAt) ?? undefined,
    };
  });
}

function parsePredictionRow(row: {
  predictionId: string;
  predictionType: string;
  targetEntityType: string;
  targetEntityId: string;
  targetEntityLabel: string | null;
  probability: number;
  confidence: number;
  timeHorizon: string;
  evidenceSignals: Prisma.JsonValue;
  explanation: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): ParsedPrediction {
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
    evidenceSignals: parsePredictionSignals(row.evidenceSignals),
    explanation: row.explanation,
    metadata: asRecord(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function withStrategySpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  work: () => Promise<T>,
): Promise<T> {
  return strategyAgentTracer.startActiveSpan(name, async (span) => {
    span.setAttributes(attributes);
    try {
      const result = await work();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'strategy agent failure',
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

async function listPredictionsByType(
  predictionType: string,
  prismaClient: PrismaClient,
): Promise<ParsedPrediction[]> {
  const rows = await prismaClient.predictionInsight.findMany({
    where: { predictionType },
    orderBy: [{ probability: 'desc' }, { confidence: 'desc' }, { updatedAt: 'desc' }],
    take: 80,
  });

  return rows.map(parsePredictionRow);
}

async function loadProviderDecisionActivity(
  npis: string[],
  since: Date,
  prismaClient: PrismaClient,
): Promise<Map<string, ProviderActivity>> {
  if (npis.length === 0) {
    return new Map();
  }

  const groups = await prismaClient.decisionCapsule.groupBy({
    by: ['subjectNpi'],
    where: {
      subjectNpi: { in: npis },
      decisionTimestamp: { gte: since },
    },
    _count: { _all: true },
  });

  return new Map(groups.map((group) => [
    group.subjectNpi,
    { decisionCount: group._count._all },
  ]));
}

async function loadInstitutionActivity(
  institutions: string[],
  since: Date,
  prismaClient: PrismaClient,
): Promise<Map<string, InstitutionActivity>> {
  if (institutions.length === 0) {
    return new Map();
  }

  const institutionSet = new Set(institutions.map((institution) => institution.toLowerCase()));
  const rows = await prismaClient.claimRecord.findMany({
    where: {
      claimType: 'INSTITUTION_AFFILIATION',
      createdAt: { gte: since },
    },
    select: {
      subjectNpi: true,
      value: true,
    },
    take: 4_000,
  });

  const providerSets = new Map<string, Set<string>>();
  const recentSignals = new Map<string, number>();
  for (const row of rows) {
    const institution = asString(asRecord(row.value).institution)
      ?? asString(asRecord(row.value).organization)
      ?? asString(asRecord(row.value).affiliation);
    if (!institution || !institutionSet.has(institution.toLowerCase())) {
      continue;
    }

    const providers = providerSets.get(institution) ?? new Set<string>();
    providers.add(row.subjectNpi);
    providerSets.set(institution, providers);
    recentSignals.set(institution, (recentSignals.get(institution) ?? 0) + 1);
  }

  return new Map(institutions.map((institution) => [
    institution,
    {
      headcount: providerSets.get(institution)?.size ?? 0,
      recentSignals: recentSignals.get(institution) ?? 0,
    },
  ]));
}

async function loadNetworkActivity(
  entityIds: string[],
  since: Date,
  prismaClient: PrismaClient,
): Promise<Map<string, NetworkActivity>> {
  if (entityIds.length === 0) {
    return new Map();
  }

  const rows = await prismaClient.investigatorFinding.findMany({
    where: {
      findingType: 'network_emergence',
      status: { in: [...ACTIVE_FINDING_STATUSES] },
      lastSeenAt: { gte: since },
      entityIds: { hasSome: entityIds },
    },
    select: {
      entityIds: true,
    },
    take: 200,
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const entityId of row.entityIds) {
      if (entityIds.includes(entityId)) {
        counts.set(entityId, (counts.get(entityId) ?? 0) + 1);
      }
    }
  }

  return new Map(entityIds.map((entityId) => [
    entityId,
    { findingCount: counts.get(entityId) ?? 0 },
  ]));
}

async function persistAuditPayload(
  type: string,
  referenceId: string,
  agentType: StrategyAgentType,
  payload: unknown,
  prismaClient: PrismaClient,
): Promise<void> {
  await prismaClient.auditEvent.create({
    data: {
      type,
      hash: sha256Hex({ type, referenceId, payload }),
      referenceId,
      metadata: toJsonValue({
        schema: `${type.toLowerCase()}.v1`,
        agentType,
        payload,
      }),
      anchored: false,
    },
  });
}

function extractAuditPayload<T>(
  event: { metadata: Prisma.JsonValue },
): { agentType: StrategyAgentType | null; payload: T | null } {
  const metadata = asRecord(event.metadata);
  const agentTypeRaw = asString(metadata.agentType);
  const payload = metadata.payload;
  const agentType = agentTypeRaw === 'PROVIDER_TRAJECTORY'
    || agentTypeRaw === 'SPECIALTY_PRESSURE'
    || agentTypeRaw === 'INSTITUTION_MOMENTUM'
    || agentTypeRaw === 'NETWORK_EVOLUTION'
    ? agentTypeRaw
    : null;
  return {
    agentType,
    payload: payload ? payload as T : null,
  };
}

async function loadLatestMemorySnapshot(
  agentType: StrategyAgentType,
  prismaClient: PrismaClient,
): Promise<StrategyMemorySnapshot | null> {
  const rows = await prismaClient.auditEvent.findMany({
    where: {
      type: AUDIT_EVENT_TYPES.memory,
      referenceId: `strategy-agent:${agentType}`,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  for (const row of rows) {
    const extracted = extractAuditPayload<StrategyMemorySnapshot>(row);
    if (extracted.agentType === agentType && extracted.payload) {
      return extracted.payload;
    }
  }

  return null;
}

function filterByTimeRange<T extends { generatedAt: string }>(
  items: T[],
  since: Date,
): T[] {
  return items.filter((item) => new Date(item.generatedAt) >= since);
}

function dedupeLatestByKey<T extends { generatedAt: string }>(
  items: T[],
  keyOf: (item: T) => string,
): T[] {
  const latest = new Map<string, T>();
  const sorted = [...items].sort((left, right) => new Date(right.generatedAt).getTime() - new Date(left.generatedAt).getTime());
  for (const item of sorted) {
    const key = keyOf(item);
    if (!latest.has(key)) {
      latest.set(key, item);
    }
  }
  return [...latest.values()];
}

function dedupeByKey<T>(
  items: T[],
  keyOf: (item: T) => string,
): T[] {
  const seen = new Set<string>();
  const results: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push(item);
  }
  return results;
}

export async function listStrategyReports(input: {
  agentType?: StrategyAgentType;
  timeRange?: string;
  impactLevel?: StrategyImpactLevel;
  limit?: number;
  prismaClient?: PrismaClient;
} = {}): Promise<{ total: number; reports: StrategyReport[] }> {
  const prismaClient = input.prismaClient ?? prisma;
  const window = timeWindowForRange(input.timeRange, new Date().toISOString());
  const rows = await prismaClient.auditEvent.findMany({
    where: {
      type: AUDIT_EVENT_TYPES.report,
      createdAt: { gte: window.since },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.max((input.limit ?? 50) * 4, 80),
  });

  const reports = dedupeLatestByKey(
    rows
      .map((row) => extractAuditPayload<StrategyReport>(row))
      .filter((entry): entry is { agentType: StrategyAgentType; payload: StrategyReport } => (
        entry.agentType !== null && entry.payload !== null
      ))
      .filter((entry) => !input.agentType || entry.agentType === input.agentType)
      .map((entry) => entry.payload)
      .filter((report) => !input.impactLevel || report.impactLevel === input.impactLevel),
    (report) => report.reportId,
  );

  return {
    total: reports.length,
    reports: reports.slice(0, input.limit ?? 50),
  };
}

export async function listStrategyInsights(input: {
  agentType?: StrategyAgentType;
  timeRange?: string;
  impactLevel?: StrategyImpactLevel;
  limit?: number;
  prismaClient?: PrismaClient;
} = {}): Promise<{ total: number; insights: StrategyInsight[] }> {
  const prismaClient = input.prismaClient ?? prisma;
  const window = timeWindowForRange(input.timeRange, new Date().toISOString());
  const rows = await prismaClient.auditEvent.findMany({
    where: {
      type: AUDIT_EVENT_TYPES.insight,
      createdAt: { gte: window.since },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.max((input.limit ?? 50) * 4, 80),
  });

  const insights = dedupeLatestByKey(
    rows
      .map((row) => extractAuditPayload<StrategyInsight>(row))
      .filter((entry): entry is { agentType: StrategyAgentType; payload: StrategyInsight } => (
        entry.agentType !== null && entry.payload !== null
      ))
      .filter((entry) => !input.agentType || entry.agentType === input.agentType)
      .map((entry) => entry.payload)
      .filter((insight) => !input.impactLevel || insight.impactLevel === input.impactLevel),
    (insight) => insight.insightId,
  );

  return {
    total: insights.length,
    insights: insights.slice(0, input.limit ?? 50),
  };
}

async function upsertStrategyFinding(
  insight: StrategyInsight,
  report: StrategyReport,
  prismaClient: PrismaClient,
): Promise<StrategyFindingReference | null> {
  if (!HIGH_IMPACT_LEVELS.has(insight.impactLevel) || insight.insufficientEvidence) {
    return null;
  }

  const dedupeKey = buildStableId('strategy_finding', {
    agentType: insight.agentType,
    headline: insight.headline,
    entities: insight.entities.map((entity) => `${entity.entityType}:${entity.entityId}`),
    reportId: insight.reportId,
  });
  const existing = await prismaClient.investigatorFinding.findUnique({
    where: { dedupeKey },
    select: {
      id: true,
      findingId: true,
      occurrenceCount: true,
    },
  });

  const findingId = existing?.findingId ?? buildStableId('finding', {
    dedupeKey,
    generatedAt: report.generatedAt,
  });
  const severity = insight.impactLevel === 'CRITICAL' ? 'critical' : 'high';
  const entityIds = insight.entities.map((entity) => entity.entityId);
  const supportingEvidence = insight.signals.map((signal, index) => ({
    evidenceId: `${findingId}:signal:${index + 1}`,
    evidenceType: signal.label,
    sourceId: signal.source,
    sourceLabel: signal.source,
    snippet: driverFromSignal(signal),
    observedAt: signal.observedAt ?? report.generatedAt,
    metadata: {
      value: signal.value,
      direction: signal.direction,
      reportId: report.reportId,
      predictionIds: insight.predictions.map((prediction) => prediction.predictionId),
    },
  }));

  if (!existing) {
    const created = await prismaClient.investigatorFinding.create({
      data: {
        findingId,
        investigatorId: `strategy_${insight.agentType.toLowerCase()}`,
        findingType: `strategy_${insight.agentType.toLowerCase()}`,
        scope: insight.entities[0]?.entityType ?? 'strategy',
        severity,
        status: 'new',
        title: insight.headline,
        summary: insight.summary,
        explanation: insight.reasoningLog.map((entry) => `${entry.step}: ${entry.detail}`).join(' '),
        confidence: insight.confidence,
        priorityScore: clamp01((insight.confidence * 0.55) + (insight.impactLevel === 'CRITICAL' ? 0.4 : 0.25)),
        trustImpact: clamp01((insight.predictions[0]?.probability ?? 0.6)),
        freshness: 0.8,
        novelty: clamp01(Math.max(Math.abs(insight.delta ?? 0), 0.2)),
        entityImportance: clamp01(Math.min(insight.entities.length * 0.25, 1)),
        graphCentrality: clamp01(Math.min(insight.signals.length * 0.1, 1)),
        entityIds,
        audienceRoles: ['executive', 'operations', 'research'],
        supportingEvidence: toJsonValue(supportingEvidence),
        rankBreakdown: toJsonValue({
          severity: severity === 'critical' ? 0.95 : 0.82,
          confidence: insight.confidence,
          trustImpact: clamp01(insight.predictions[0]?.probability ?? 0.65),
          freshness: 0.8,
          novelty: clamp01(Math.max(Math.abs(insight.delta ?? 0), 0.2)),
          entityImportance: clamp01(Math.min(insight.entities.length * 0.25, 1)),
          graphCentrality: clamp01(Math.min(insight.signals.length * 0.1, 1)),
          total: clamp01((insight.confidence * 0.5) + (severity === 'critical' ? 0.45 : 0.35)),
          weights: {
            severity: 0.2,
            confidence: 0.2,
            trustImpact: 0.2,
            freshness: 0.1,
            novelty: 0.1,
            entityImportance: 0.1,
            graphCentrality: 0.1,
          },
        }),
        metadata: toJsonValue({
          reportId: report.reportId,
          insightId: insight.insightId,
          predictions: insight.predictions,
          decisions: insight.decisions,
        }),
        storylineKey: `strategy:${insight.agentType.toLowerCase()}:${entityIds.join(':') || 'global'}`,
        dedupeKey,
        firstSeenAt: new Date(report.generatedAt),
        lastSeenAt: new Date(report.generatedAt),
        occurrenceCount: 1,
        createdAt: new Date(report.generatedAt),
        updatedAt: new Date(report.generatedAt),
        entityLinks: {
          create: insight.entities.map((entity) => ({
            entityType: entity.entityType,
            entityId: entity.entityId,
            entityLabel: entity.entityLabel ?? null,
            relationship: 'subject',
            metadata: {},
          })),
        },
        evidenceLinks: {
          create: supportingEvidence.map((evidence) => ({
            evidenceId: evidence.evidenceId,
            evidenceType: evidence.evidenceType,
            sourceId: evidence.sourceId ?? null,
            sourceLabel: evidence.sourceLabel ?? null,
            recordType: 'strategy_signal',
            recordId: report.reportId,
            snippet: evidence.snippet ?? null,
            observedAt: evidence.observedAt ? new Date(evidence.observedAt) : null,
            metadata: evidence.metadata as Prisma.InputJsonValue,
          })),
        },
        statusEvents: {
          create: [{
            fromStatus: null,
            toStatus: 'new',
            note: `Published by ${insight.agentType} strategy agent.`,
            metadata: {},
          }],
        },
      },
      select: {
        findingId: true,
        severity: true,
        title: true,
      },
    });

    return created;
  }

  await prismaClient.$transaction(async (tx) => {
    await tx.investigatorFinding.update({
      where: { findingId: existing.findingId },
      data: {
        title: insight.headline,
        summary: insight.summary,
        explanation: insight.reasoningLog.map((entry) => `${entry.step}: ${entry.detail}`).join(' '),
        confidence: insight.confidence,
        severity,
        priorityScore: clamp01((insight.confidence * 0.55) + (insight.impactLevel === 'CRITICAL' ? 0.4 : 0.25)),
        trustImpact: clamp01((insight.predictions[0]?.probability ?? 0.6)),
        novelty: clamp01(Math.max(Math.abs(insight.delta ?? 0), 0.2)),
        entityIds,
        supportingEvidence: toJsonValue(supportingEvidence),
        metadata: toJsonValue({
          reportId: report.reportId,
          insightId: insight.insightId,
          predictions: insight.predictions,
          decisions: insight.decisions,
        }),
        lastSeenAt: new Date(report.generatedAt),
        updatedAt: new Date(report.generatedAt),
        occurrenceCount: existing.occurrenceCount + 1,
      },
    });
    await tx.findingEntityLink.deleteMany({
      where: { findingId: existing.id },
    });
    await tx.findingEvidenceLink.deleteMany({
      where: { findingId: existing.id },
    });
    if (insight.entities.length > 0) {
      await tx.findingEntityLink.createMany({
        data: insight.entities.map((entity) => ({
          findingId: existing.id,
          entityType: entity.entityType,
          entityId: entity.entityId,
          entityLabel: entity.entityLabel ?? null,
          relationship: 'subject',
          metadata: {} as Prisma.InputJsonValue,
        })),
      });
    }
    if (supportingEvidence.length > 0) {
      await tx.findingEvidenceLink.createMany({
        data: supportingEvidence.map((evidence) => ({
          findingId: existing.id,
          evidenceId: evidence.evidenceId,
          evidenceType: evidence.evidenceType,
          sourceId: evidence.sourceId ?? null,
          sourceLabel: evidence.sourceLabel ?? null,
          recordType: 'strategy_signal',
          recordId: report.reportId,
          url: null,
          snippet: evidence.snippet ?? null,
          observedAt: evidence.observedAt ? new Date(evidence.observedAt) : null,
          metadata: evidence.metadata as Prisma.InputJsonValue,
        })),
      });
    }
  });

  return {
    findingId,
    severity,
    title: insight.headline,
  };
}

function baseReasoning(
  agentType: StrategyAgentType,
  input: {
    scanned: number;
    baseline: StrategyMemorySnapshot | null;
    now: string;
  },
): StrategyReasoningEntry[] {
  return [
    {
      step: 'collect_signals',
      detail: `${agentType} scanned ${input.scanned} candidate signal set(s) as of ${input.now}.`,
    },
    {
      step: 'load_baseline',
      detail: input.baseline
        ? `Loaded prior memory snapshot from ${input.baseline.generatedAt} to detect change versus baseline.`
        : 'No prior memory snapshot was available; using current observations as the baseline seed.',
    },
    {
      step: 'publish_guardrail',
      detail: 'Claims remain probabilistic. When evidence is thin, the agent reports insufficient evidence instead of a deterministic claim.',
    },
  ];
}

function reportFromInsights(
  spec: StrategyAgentSpec,
  runId: string,
  window: TimeWindow,
  insights: StrategyInsight[],
  baseline: StrategyMemorySnapshot | null,
): StrategyReport {
  const reportId = buildStableId('report', {
    agentType: spec.agentType,
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
  });
  const allSignals = insights.flatMap((insight) => insight.signals);
  const allDrivers = dedupeStrings(insights.flatMap((insight) => insight.drivers)).slice(0, 8);
  const allDecisions = dedupeByKey(insights.flatMap((insight) => insight.decisions), (decision) => decision.decisionId);
  const allPredictions = dedupeByKey(insights.flatMap((insight) => insight.predictions), (prediction) => prediction.predictionId);
  const relatedFindingIds = dedupeStrings(insights.flatMap((insight) => insight.relatedFindingIds));
  const insufficientEvidence = insights.length === 0;

  return {
    reportId,
    runId,
    agentType: spec.agentType,
    cadence: spec.cadence,
    reportName: spec.reportName,
    timeRange: window.label,
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
    headline: insufficientEvidence
      ? `${spec.reportName}: insufficient evidence`
      : insights[0]!.headline,
    summary: insufficientEvidence
      ? `${spec.reportName} did not have enough signal coverage to make a reliable strategic claim.`
      : insights[0]!.summary,
    keyInsights: insufficientEvidence ? ['Insufficient evidence'] : insights.map((insight) => insight.headline),
    drivers: allDrivers,
    confidence: insufficientEvidence ? 0.35 : average(insights.map((insight) => insight.confidence)),
    impactLevel: insufficientEvidence ? 'LOW' : maxImpactLevel(insights.map((insight) => insight.impactLevel)),
    entities: dedupeByKey(insights.flatMap((insight) => insight.entities), (entity) => `${entity.entityType}:${entity.entityId}`),
    signals: allSignals.slice(0, 20),
    signalCount: allSignals.length,
    reasoningLog: [
      ...baseReasoning(spec.agentType, {
        scanned: allSignals.length,
        baseline,
        now: window.periodEnd,
      }),
      {
        step: 'aggregate_report',
        detail: insufficientEvidence
          ? 'Report generation halted at a guardrail because the evidence floor was not met.'
          : `Aggregated ${insights.length} insight(s) into ${spec.reportName}.`,
      },
    ],
    predictions: allPredictions,
    decisions: allDecisions,
    relatedFindingIds,
    insufficientEvidence,
    baselineGeneratedAt: baseline?.generatedAt ?? null,
    generatedAt: window.periodEnd,
  };
}

function insightDecision(
  insight: StrategyInsight,
  recommendation: string,
  rationale: string,
): StrategyDecision {
  return {
    decisionId: buildStableId('decision', {
      reportId: insight.reportId,
      insightId: insight.insightId,
      recommendation,
    }),
    agentType: insight.agentType,
    recommendation,
    rationale,
    confidence: insight.confidence,
    impactLevel: insight.impactLevel,
    entities: insight.entities,
    reportId: insight.reportId,
    insightId: insight.insightId,
    createdAt: insight.generatedAt,
  };
}

async function evaluateProviderTrajectory(
  runId: string,
  spec: StrategyAgentSpec,
  window: TimeWindow,
  baseline: StrategyMemorySnapshot | null,
  prismaClient: PrismaClient,
): Promise<AgentEvaluation> {
  const predictions = await listPredictionsByType('EMERGING_INVESTIGATOR', prismaClient);
  const baselineMap = new Map((baseline?.entries ?? []).map((entry) => [`${entry.entity.entityType}:${entry.entity.entityId}`, entry]));
  const providerActivity = await loadProviderDecisionActivity(
    predictions.map((prediction) => prediction.targetEntity.entityId).filter((entityId) => /^\d{10}$/.test(entityId)),
    window.since,
    prismaClient,
  );

  const ranked = predictions
    .slice(0, 12)
    .map((prediction) => {
      const key = `${prediction.targetEntity.entityType}:${prediction.targetEntity.entityId}`;
      const baselineEntry = baselineMap.get(key);
      const baselineValue = scoreFromMemoryEntry(baselineEntry);
      const delta = Number((prediction.probability - baselineValue).toFixed(4));
      const activityWeight = Math.min((providerActivity.get(prediction.targetEntity.entityId)?.decisionCount ?? 0) * 0.03, 0.12);
      const impact = impactLevelFromScore(scoreForImpact(prediction.probability, prediction.confidence, delta, activityWeight));
      return {
        prediction,
        baselineValue,
        delta,
        impact,
        score: prediction.probability + Math.abs(delta) + activityWeight,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  const reportId = buildStableId('report', {
    agentType: spec.agentType,
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
  });

  const insights: StrategyInsight[] = ranked.map(({ prediction, baselineValue, delta, impact }) => {
    const activity = providerActivity.get(prediction.targetEntity.entityId)?.decisionCount ?? 0;
    const drivers = dedupeStrings(prediction.evidenceSignals.map(driverFromSignal)).slice(0, 4);
    const headline = delta < -0.06
      ? `${prediction.targetEntity.entityLabel ?? prediction.targetEntity.entityId} is losing research influence`
      : `${prediction.targetEntity.entityLabel ?? prediction.targetEntity.entityId} is gaining research influence`;
    const summary = delta < -0.06
      ? `Provider trajectory cooled versus baseline. Current influence probability is ${(prediction.probability * 100).toFixed(0)}% after a ${(Math.abs(delta) * 100).toFixed(0)} point drop.`
      : `Provider trajectory strengthened. Current influence probability is ${(prediction.probability * 100).toFixed(0)}% with ${activity} recent decision signal(s) reinforcing impact.`;
    const generatedAt = window.periodEnd;
    const insightId = buildStableId('insight', {
      reportId,
      entityId: prediction.targetEntity.entityId,
      headline,
    });

    const insight: StrategyInsight = {
      insightId,
      reportId,
      agentType: spec.agentType,
      headline,
      summary,
      drivers,
      confidence: clamp01((prediction.confidence * 0.8) + 0.15),
      impactLevel: impact,
      entities: [prediction.targetEntity],
      signals: [
        ...prediction.evidenceSignals,
        {
          label: 'decision_activity',
          value: activity,
          direction: activity > 0 ? 'UP' : 'FLAT',
          source: 'DECISION_CAPSULES',
          weight: 0.2,
          observedAt: generatedAt,
        },
      ],
      predictions: [predictionReference(prediction)],
      reasoningLog: [
        ...baseReasoning(spec.agentType, {
          scanned: predictions.length,
          baseline,
          now: generatedAt,
        }),
        {
          step: 'score_trajectory',
          detail: `Compared provider influence probability ${(prediction.probability * 100).toFixed(0)}% against baseline ${(baselineValue * 100).toFixed(0)}% and observed delta ${(delta * 100).toFixed(0)} points.`,
        },
      ],
      decisions: [],
      insufficientEvidence: false,
      baselineValue,
      currentValue: prediction.probability,
      delta,
      relatedFindingIds: [],
      generatedAt,
    };
    insight.decisions = [
      insightDecision(
        insight,
        delta < -0.06
          ? `Monitor ${prediction.targetEntity.entityLabel ?? prediction.targetEntity.entityId} for sustained influence decline`
          : `Prioritize ${prediction.targetEntity.entityLabel ?? prediction.targetEntity.entityId} as a likely future leader`,
        delta < -0.06
          ? 'Trajectory weakened versus the previous baseline and should be re-checked before making deterministic conclusions.'
          : 'Trajectory strengthened across publication, grant, trial, and network signals.',
      ),
    ];
    return insight;
  });

  const report = reportFromInsights(spec, runId, window, insights, baseline);
  const memory: StrategyMemorySnapshot = {
    snapshotId: buildStableId('memory', {
      agentType: spec.agentType,
      generatedAt: window.periodEnd,
    }),
    agentType: spec.agentType,
    generatedAt: window.periodEnd,
    entries: ranked.map(({ prediction }) => ({
      entity: prediction.targetEntity,
      score: prediction.probability,
      confidence: prediction.confidence,
      metadata: {
        predictionId: prediction.predictionId,
      },
    })),
  };

  return {
    report,
    insights,
    memory,
    findings: [],
  };
}

function marketEntityFromScarcity(signal: ScarcitySignal): StrategyEntity {
  return {
    entityType: 'market',
    entityId: `market:${signal.state.toUpperCase()}:${signal.specialty.toLowerCase()}`,
    entityLabel: `${signal.state.toUpperCase()} ${titleCase(signal.specialty)}`,
  };
}

async function evaluateSpecialtyPressure(
  runId: string,
  spec: StrategyAgentSpec,
  window: TimeWindow,
  baseline: StrategyMemorySnapshot | null,
  prismaClient: PrismaClient,
): Promise<AgentEvaluation> {
  const predictions = await listPredictionsByType('WORKFORCE_SHORTAGE_ESCALATION', prismaClient);
  let scarcitySignals: ScarcitySignal[] = [];
  try {
    scarcitySignals = await computeExpertiseScarcity(12);
  } catch {
    scarcitySignals = [];
  }

  if (scarcitySignals.length === 0) {
    scarcitySignals = predictions.slice(0, 12).map((prediction) => {
      const label = prediction.targetEntity.entityLabel ?? prediction.targetEntity.entityId;
      const [state = 'NA', ...specialtyParts] = label.split(' ');
      return {
        specialty: specialtyParts.join(' ').toLowerCase() || 'unknown',
        state: state.toUpperCase(),
        availableClinicians: Number(prediction.metadata.supply ?? 0),
        l3Count: 0,
        l2Count: 0,
        l1Count: 0,
        l0Count: 0,
        immediateCount: 0,
        scarcityScore: Math.round(prediction.probability * 100),
        scarcityLabel: prediction.probability >= 0.8 ? 'CRITICAL' : prediction.probability >= 0.65 ? 'HIGH' : prediction.probability >= 0.45 ? 'MODERATE' : 'ADEQUATE',
        demandSignal: Number(prediction.metadata.demand ?? 0) >= 5 ? 'HIGH' : Number(prediction.metadata.demand ?? 0) >= 2 ? 'MEDIUM' : 'LOW',
      } satisfies ScarcitySignal;
    });
  }
  const predictionMap = new Map(predictions.map((prediction) => [prediction.targetEntity.entityId, prediction]));
  const baselineMap = new Map((baseline?.entries ?? []).map((entry) => [entry.entity.entityId, entry]));
  const reportId = buildStableId('report', {
    agentType: spec.agentType,
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
  });

  const ranked = scarcitySignals.slice(0, 8).map((signal) => {
    const entity = marketEntityFromScarcity(signal);
    const prediction = predictionMap.get(entity.entityId);
    const currentValue = Math.max((signal.scarcityScore / 100), prediction?.probability ?? 0);
    const baselineValue = scoreFromMemoryEntry(baselineMap.get(entity.entityId));
    const delta = Number((currentValue - baselineValue).toFixed(4));
    const impact = impactLevelFromScore(
      scoreForImpact(currentValue, prediction?.confidence ?? clamp01((signal.scarcityScore / 100) * 0.85), delta),
    );
    return {
      entity,
      signal,
      prediction,
      currentValue,
      baselineValue,
      delta,
      impact,
      score: currentValue + Math.abs(delta),
    };
  }).sort((left, right) => right.score - left.score).slice(0, 4);

  const insights: StrategyInsight[] = ranked.map(({ entity, signal, prediction, currentValue, baselineValue, delta, impact }) => {
    const generatedAt = window.periodEnd;
    const pressureSignals: StrategySignal[] = prediction?.evidenceSignals ?? [
      {
        label: 'pressure_score',
        value: signal.scarcityScore,
        direction: 'UP',
        source: 'WORKFORCE_INTELLIGENCE',
        weight: 0.35,
        observedAt: generatedAt,
      },
      {
        label: 'mapped_supply',
        value: signal.availableClinicians,
        direction: signal.availableClinicians <= 2 ? 'DOWN' : 'FLAT',
        source: 'PERSON_PROFILES',
        weight: 0.25,
        observedAt: generatedAt,
      },
    ];
    const drivers = dedupeStrings([
      ...pressureSignals.map(driverFromSignal),
      `${signal.scarcityLabel.toLowerCase()} scarcity with ${signal.availableClinicians} available clinician(s)`,
    ]).slice(0, 4);
    const headline = `${titleCase(signal.specialty)} in ${signal.state.toUpperCase()} is approaching a severe workforce shortage`;
    const insightId = buildStableId('insight', {
      reportId,
      entityId: entity.entityId,
      headline,
    });
    const insight: StrategyInsight = {
      insightId,
      reportId,
      agentType: spec.agentType,
      headline,
      summary: `Workforce pressure is ${signal.scarcityLabel.toLowerCase()} with ${signal.availableClinicians} mapped clinician(s), demand signal ${signal.demandSignal.toLowerCase()}, and a current forecast score of ${(currentValue * 100).toFixed(0)}%.`,
      drivers,
      confidence: clamp01((prediction?.confidence ?? 0.68) * 0.8 + 0.12),
      impactLevel: impact,
      entities: [entity],
      signals: pressureSignals,
      predictions: prediction ? [predictionReference(prediction)] : [],
      reasoningLog: [
        ...baseReasoning(spec.agentType, {
          scanned: scarcitySignals.length,
          baseline,
          now: generatedAt,
        }),
        {
          step: 'measure_pressure',
          detail: `Compared current specialty pressure ${(currentValue * 100).toFixed(0)}% against baseline ${(baselineValue * 100).toFixed(0)}% for ${entity.entityLabel}.`,
        },
      ],
      decisions: [],
      insufficientEvidence: false,
      baselineValue,
      currentValue,
      delta,
      relatedFindingIds: [],
      generatedAt,
    };
    insight.decisions = [
      insightDecision(
        insight,
        `Prioritize recruiting coverage for ${entity.entityLabel}`,
        'Shortage pressure remained elevated and the forecast stayed above the escalation threshold.',
      ),
    ];
    return insight;
  });

  const report = reportFromInsights(spec, runId, window, insights, baseline);
  const memory: StrategyMemorySnapshot = {
    snapshotId: buildStableId('memory', {
      agentType: spec.agentType,
      generatedAt: window.periodEnd,
    }),
    agentType: spec.agentType,
    generatedAt: window.periodEnd,
    entries: ranked.map(({ entity, currentValue, prediction }) => ({
      entity,
      score: currentValue,
      confidence: prediction?.confidence ?? 0.68,
      metadata: {
        scarcityScore: Math.round(currentValue * 100),
      },
    })),
  };

  return {
    report,
    insights,
    memory,
    findings: [],
  };
}

async function evaluateInstitutionMomentum(
  runId: string,
  spec: StrategyAgentSpec,
  window: TimeWindow,
  baseline: StrategyMemorySnapshot | null,
  prismaClient: PrismaClient,
): Promise<AgentEvaluation> {
  const predictions = await listPredictionsByType('INSTITUTION_RESEARCH_GROWTH', prismaClient);
  const institutions = predictions.map((prediction) => prediction.targetEntity.entityLabel).filter((value): value is string => Boolean(value));
  const institutionActivity = await loadInstitutionActivity(institutions, window.since, prismaClient);
  const baselineMap = new Map((baseline?.entries ?? []).map((entry) => [`${entry.entity.entityType}:${entry.entity.entityId}`, entry]));
  const reportId = buildStableId('report', {
    agentType: spec.agentType,
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
  });

  const ranked = predictions.slice(0, 10).map((prediction) => {
    const key = `${prediction.targetEntity.entityType}:${prediction.targetEntity.entityId}`;
    const baselineValue = scoreFromMemoryEntry(baselineMap.get(key));
    const delta = Number((prediction.probability - baselineValue).toFixed(4));
    const activity = institutionActivity.get(prediction.targetEntity.entityLabel ?? '');
    const weight = Math.min(((activity?.headcount ?? 0) * 0.02) + ((activity?.recentSignals ?? 0) * 0.01), 0.14);
    const impact = impactLevelFromScore(scoreForImpact(prediction.probability, prediction.confidence, delta, weight));
    return {
      prediction,
      baselineValue,
      delta,
      impact,
      activity,
      score: prediction.probability + Math.abs(delta) + weight,
    };
  }).sort((left, right) => right.score - left.score).slice(0, 4);

  const insights: StrategyInsight[] = ranked.map(({ prediction, baselineValue, delta, impact, activity }) => {
    const generatedAt = window.periodEnd;
    const institutionLabel = prediction.targetEntity.entityLabel ?? prediction.targetEntity.entityId;
    const drivers = dedupeStrings([
      ...prediction.evidenceSignals.map(driverFromSignal),
      activity?.headcount ? `${activity.headcount} affiliated provider(s) are currently mapped` : '',
    ]).slice(0, 4);
    const headline = delta < -0.06
      ? `${institutionLabel} is losing research momentum`
      : `${institutionLabel} is building research momentum`;
    const insightId = buildStableId('insight', {
      reportId,
      entityId: prediction.targetEntity.entityId,
      headline,
    });
    const insight: StrategyInsight = {
      insightId,
      reportId,
      agentType: spec.agentType,
      headline,
      summary: delta < -0.06
        ? `Institution momentum cooled to ${(prediction.probability * 100).toFixed(0)}% after a ${(Math.abs(delta) * 100).toFixed(0)} point decline versus baseline.`
        : `Institution momentum rose to ${(prediction.probability * 100).toFixed(0)}% with ${(activity?.recentSignals ?? 0)} recent institution-linked research signal(s).`,
      drivers,
      confidence: clamp01((prediction.confidence * 0.82) + 0.1),
      impactLevel: impact,
      entities: [prediction.targetEntity],
      signals: [
        ...prediction.evidenceSignals,
        {
          label: 'provider_headcount',
          value: activity?.headcount ?? 0,
          direction: (activity?.headcount ?? 0) > 0 ? 'UP' : 'FLAT',
          source: 'CLAIM_RECORDS',
          weight: 0.2,
          observedAt: generatedAt,
        },
      ],
      predictions: [predictionReference(prediction)],
      reasoningLog: [
        ...baseReasoning(spec.agentType, {
          scanned: predictions.length,
          baseline,
          now: generatedAt,
        }),
        {
          step: 'compare_institution_baseline',
          detail: `Compared current institution momentum ${(prediction.probability * 100).toFixed(0)}% against baseline ${(baselineValue * 100).toFixed(0)}% for ${institutionLabel}.`,
        },
      ],
      decisions: [],
      insufficientEvidence: false,
      baselineValue,
      currentValue: prediction.probability,
      delta,
      relatedFindingIds: [],
      generatedAt,
    };
    insight.decisions = [
      insightDecision(
        insight,
        delta < -0.06
          ? `Reassess partnership posture with ${institutionLabel}`
          : `Prioritize growth engagement with ${institutionLabel}`,
        delta < -0.06
          ? 'Institution-level research acceleration cooled materially versus baseline.'
          : 'Institution-level research acceleration strengthened across provider and signal counts.',
      ),
    ];
    return insight;
  });

  const report = reportFromInsights(spec, runId, window, insights, baseline);
  const memory: StrategyMemorySnapshot = {
    snapshotId: buildStableId('memory', {
      agentType: spec.agentType,
      generatedAt: window.periodEnd,
    }),
    agentType: spec.agentType,
    generatedAt: window.periodEnd,
    entries: ranked.map(({ prediction }) => ({
      entity: prediction.targetEntity,
      score: prediction.probability,
      confidence: prediction.confidence,
      metadata: {
        predictionId: prediction.predictionId,
      },
    })),
  };

  return {
    report,
    insights,
    memory,
    findings: [],
  };
}

async function evaluateNetworkEvolution(
  runId: string,
  spec: StrategyAgentSpec,
  window: TimeWindow,
  baseline: StrategyMemorySnapshot | null,
  prismaClient: PrismaClient,
): Promise<AgentEvaluation> {
  const predictions = await listPredictionsByType('NETWORK_CLUSTER_EXPANSION', prismaClient);
  const networkActivity = await loadNetworkActivity(
    predictions.map((prediction) => prediction.targetEntity.entityId),
    window.since,
    prismaClient,
  );
  const baselineMap = new Map((baseline?.entries ?? []).map((entry) => [entry.entity.entityId, entry]));
  const reportId = buildStableId('report', {
    agentType: spec.agentType,
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
  });

  const ranked = predictions.slice(0, 10).map((prediction) => {
    const baselineValue = scoreFromMemoryEntry(baselineMap.get(prediction.targetEntity.entityId));
    const delta = Number((prediction.probability - baselineValue).toFixed(4));
    const weight = Math.min((networkActivity.get(prediction.targetEntity.entityId)?.findingCount ?? 0) * 0.04, 0.16);
    const impact = impactLevelFromScore(scoreForImpact(prediction.probability, prediction.confidence, delta, weight));
    return {
      prediction,
      baselineValue,
      delta,
      impact,
      weight,
      score: prediction.probability + Math.abs(delta) + weight,
    };
  }).sort((left, right) => right.score - left.score).slice(0, 4);

  const insights: StrategyInsight[] = ranked.map(({ prediction, baselineValue, delta, impact }) => {
    const generatedAt = window.periodEnd;
    const findingCount = networkActivity.get(prediction.targetEntity.entityId)?.findingCount ?? 0;
    const drivers = dedupeStrings([
      ...prediction.evidenceSignals.map(driverFromSignal),
      findingCount > 0 ? `${findingCount} active network-emergence finding(s) reinforce the cluster signal` : '',
    ]).slice(0, 4);
    const label = prediction.targetEntity.entityLabel ?? prediction.targetEntity.entityId;
    const headline = `${label} is emerging as a bridge inside a fast-forming collaboration cluster`;
    const insightId = buildStableId('insight', {
      reportId,
      entityId: prediction.targetEntity.entityId,
      headline,
    });
    const insight: StrategyInsight = {
      insightId,
      reportId,
      agentType: spec.agentType,
      headline,
      summary: `Network expansion probability sits at ${(prediction.probability * 100).toFixed(0)}% with ${(delta * 100).toFixed(0)} point movement versus baseline and ${findingCount} active corroborating finding(s).`,
      drivers,
      confidence: clamp01((prediction.confidence * 0.84) + 0.1),
      impactLevel: impact,
      entities: [prediction.targetEntity],
      signals: [
        ...prediction.evidenceSignals,
        {
          label: 'network_findings',
          value: findingCount,
          direction: findingCount > 0 ? 'UP' : 'FLAT',
          source: 'INVESTIGATOR_FINDINGS',
          weight: 0.2,
          observedAt: generatedAt,
        },
      ],
      predictions: [predictionReference(prediction)],
      reasoningLog: [
        ...baseReasoning(spec.agentType, {
          scanned: predictions.length,
          baseline,
          now: generatedAt,
        }),
        {
          step: 'detect_cluster_shift',
          detail: `Compared current network expansion ${(prediction.probability * 100).toFixed(0)}% against baseline ${(baselineValue * 100).toFixed(0)}% for ${label}.`,
        },
      ],
      decisions: [],
      insufficientEvidence: false,
      baselineValue,
      currentValue: prediction.probability,
      delta,
      relatedFindingIds: [],
      generatedAt,
    };
    insight.decisions = [
      insightDecision(
        insight,
        `Review collaboration cluster centered on ${label}`,
        'Cluster expansion stayed elevated and the bridge-provider signal strengthened versus baseline.',
      ),
    ];
    return insight;
  });

  const report = reportFromInsights(spec, runId, window, insights, baseline);
  const memory: StrategyMemorySnapshot = {
    snapshotId: buildStableId('memory', {
      agentType: spec.agentType,
      generatedAt: window.periodEnd,
    }),
    agentType: spec.agentType,
    generatedAt: window.periodEnd,
    entries: ranked.map(({ prediction }) => ({
      entity: prediction.targetEntity,
      score: prediction.probability,
      confidence: prediction.confidence,
      metadata: {
        predictionId: prediction.predictionId,
      },
    })),
  };

  return {
    report,
    insights,
    memory,
    findings: [],
  };
}

async function evaluateAgent(
  spec: StrategyAgentSpec,
  runId: string,
  window: TimeWindow,
  baseline: StrategyMemorySnapshot | null,
  prismaClient: PrismaClient,
): Promise<AgentEvaluation> {
  switch (spec.agentType) {
    case 'PROVIDER_TRAJECTORY':
      return evaluateProviderTrajectory(runId, spec, window, baseline, prismaClient);
    case 'SPECIALTY_PRESSURE':
      return evaluateSpecialtyPressure(runId, spec, window, baseline, prismaClient);
    case 'INSTITUTION_MOMENTUM':
      return evaluateInstitutionMomentum(runId, spec, window, baseline, prismaClient);
    case 'NETWORK_EVOLUTION':
      return evaluateNetworkEvolution(runId, spec, window, baseline, prismaClient);
  }
}

export async function runStrategyAgents(
  options: RunStrategyAgentsOptions = {},
): Promise<StrategyAgentRunResult[]> {
  const prismaClient = options.prismaClient ?? prisma;
  const refreshPredictions = options.refreshPredictions !== false;
  const persist = options.persist !== false;
  const agentTypes = options.agentTypes?.length
    ? STRATEGY_AGENT_SPECS.filter((spec) => options.agentTypes!.includes(spec.agentType))
    : STRATEGY_AGENT_SPECS;
  const now = new Date().toISOString();

  return withStrategySpan(
    'strategy_agents.run',
    {
      'vitalcv.strategy_agents.count': agentTypes.length,
      'vitalcv.strategy_agents.trigger': options.trigger ?? 'manual',
      'vitalcv.strategy_agents.refresh_predictions': refreshPredictions,
    },
    async () => {
      if (refreshPredictions) {
        await refreshPredictionInsights(now, prismaClient);
      }

      const results: StrategyAgentRunResult[] = [];
      for (const spec of agentTypes) {
        const window = timeWindowForRange(options.timeRange ?? spec.defaultTimeRange, now);
        const runId = buildStableId('run', {
          agentType: spec.agentType,
          generatedAt: now,
          trigger: options.trigger ?? 'manual',
        });
        const baseline = await loadLatestMemorySnapshot(spec.agentType, prismaClient);
        const evaluation = await evaluateAgent(spec, runId, window, baseline, prismaClient);
        const publishedFindings: StrategyFindingReference[] = [];

        if (persist) {
          await persistAuditPayload(AUDIT_EVENT_TYPES.report, evaluation.report.reportId, spec.agentType, evaluation.report, prismaClient);
          for (const insight of evaluation.insights) {
            await persistAuditPayload(AUDIT_EVENT_TYPES.insight, insight.insightId, spec.agentType, insight, prismaClient);
            for (const decision of insight.decisions) {
              await persistAuditPayload(AUDIT_EVENT_TYPES.decision, decision.decisionId, spec.agentType, decision, prismaClient);
            }
            const finding = await upsertStrategyFinding(insight, evaluation.report, prismaClient);
            if (finding) {
              insight.relatedFindingIds = dedupeStrings([...insight.relatedFindingIds, finding.findingId]);
              publishedFindings.push(finding);
            }
          }
          evaluation.report.relatedFindingIds = dedupeStrings([
            ...evaluation.report.relatedFindingIds,
            ...publishedFindings.map((finding) => finding.findingId),
          ]);
          await persistAuditPayload(AUDIT_EVENT_TYPES.memory, `strategy-agent:${spec.agentType}`, spec.agentType, evaluation.memory, prismaClient);
        }

        results.push({
          agentType: spec.agentType,
          runId,
          report: evaluation.report,
          insights: evaluation.insights,
          publishedFindings,
        });
      }

      return results;
    },
  );
}

export async function searchStrategyAgentArtifacts(
  query: string,
  limit = 3,
  prismaClient: PrismaClient = prisma,
): Promise<StrategySearchMatch[]> {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return [];
  }

  const [reportsResult, insightsResult] = await Promise.all([
    listStrategyReports({ timeRange: '180d', limit: 40, prismaClient }),
    listStrategyInsights({ timeRange: '180d', limit: 40, prismaClient }),
  ]);

  const scoreText = (text: string, agentType: StrategyAgentType): number => {
    const haystack = tokenize(text);
    if (haystack.length === 0) {
      return 0;
    }
    const overlap = tokens.filter((token) => haystack.includes(token)).length;
    const keywords = agentType === 'PROVIDER_TRAJECTORY'
      ? ['provider', 'trajectory', 'leader', 'leaders', 'influence', 'rising']
      : agentType === 'SPECIALTY_PRESSURE'
        ? ['specialty', 'pressure', 'shortage', 'workforce', 'forecast']
        : agentType === 'INSTITUTION_MOMENTUM'
          ? ['institution', 'momentum', 'growth', 'research']
          : ['network', 'cluster', 'collaboration', 'bridge'];
    const keywordOverlap = tokens.filter((token) => keywords.includes(token)).length;
    return overlap + (keywordOverlap * 1.5);
  };

  const matches: StrategySearchMatch[] = [
    ...reportsResult.reports.map((report) => ({
      kind: 'report' as const,
      score: scoreText(
        `${report.reportName} ${report.headline} ${report.summary} ${report.keyInsights.join(' ')} ${report.entities.map((entity) => entity.entityLabel ?? entity.entityId).join(' ')}`,
        report.agentType,
      ),
      report,
    })),
    ...insightsResult.insights.map((insight) => ({
      kind: 'insight' as const,
      score: scoreText(
        `${insight.headline} ${insight.summary} ${insight.drivers.join(' ')} ${insight.entities.map((entity) => entity.entityLabel ?? entity.entityId).join(' ')}`,
        insight.agentType,
      ),
      insight,
    })),
  ]
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  return matches;
}

export async function listStrategyAgentStatuses(
  schedulerState: Record<StrategyAgentType, {
    inProgress: boolean;
    lastRunAt: string | null;
    nextRunAt: string | null;
    lastError: string | null;
  }>,
  prismaClient: PrismaClient = prisma,
): Promise<StrategyAgentStatus[]> {
  const recentReports = await listStrategyReports({ timeRange: '365d', limit: 100, prismaClient });
  const reportByAgent = new Map<StrategyAgentType, StrategyReport>();
  for (const report of recentReports.reports) {
    if (!reportByAgent.has(report.agentType)) {
      reportByAgent.set(report.agentType, report);
    }
  }

  return STRATEGY_AGENT_SPECS.map((spec) => {
    const report = reportByAgent.get(spec.agentType);
    const state = schedulerState[spec.agentType];
    return {
      agentType: spec.agentType,
      cadence: spec.cadence,
      description: spec.description,
      defaultTimeRange: spec.defaultTimeRange,
      schedule: spec.schedule,
      inProgress: state?.inProgress ?? false,
      lastRunAt: state?.lastRunAt ?? report?.generatedAt ?? null,
      nextRunAt: state?.nextRunAt ?? null,
      lastReportId: report?.reportId ?? null,
      lastImpactLevel: report?.impactLevel ?? null,
      lastError: state?.lastError ?? null,
    };
  });
}
