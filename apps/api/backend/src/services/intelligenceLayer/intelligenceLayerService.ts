import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { listInvestigatorFindings } from '../investigators/investigatorEngineService';
import { listStorylines } from '../storylines/storylineService';

export type IntelligenceSignalType =
  | 'trust_score'
  | 'influence_score'
  | 'workforce_pressure'
  | 'institution_momentum'
  | 'early_warning'
  | 'key_provider_event'
  | 'data_coverage';

export type TrajectoryType =
  | 'influence_rising'
  | 'influence_falling'
  | 'trust_deteriorating'
  | 'trust_improving'
  | 'network_expansion'
  | 'network_contraction';

export type NetworkChangeType =
  | 'new_collaborator'
  | 'lost_collaborator'
  | 'new_institution_affiliation'
  | 'trial_network_expansion'
  | 'grant_network_formation';

export type SignalCorrelationType =
  | 'research_program_expansion'
  | 'collaboration_cluster_formation'
  | 'institution_research_acceleration';

export type IntelligenceFeedItemType =
  | 'finding'
  | 'storyline'
  | 'prediction'
  | 'network_change'
  | 'correlation'
  | 'watch_alert';

export type IntelligenceWatchTargetType =
  | 'provider'
  | 'institution'
  | 'specialty'
  | 'network_cluster';

export interface IntelligenceDriver {
  label: string;
  value: number | string;
  source: string;
  direction?: 'UP' | 'DOWN' | 'FLAT';
  explanation?: string;
}

export interface SignalHistoryPoint {
  entityType: string;
  entityId: string;
  signalType: IntelligenceSignalType;
  value: number | string;
  confidence: number;
  drivers: IntelligenceDriver[];
  timestamp: string;
}

export interface TrajectoryDetection {
  trajectoryType: TrajectoryType;
  confidence: number;
  explanation: string;
  supportingSignals: SignalHistoryPoint[];
}

export interface NetworkChangeEvent {
  id: string;
  changeType: NetworkChangeType;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  counterpartType: string | null;
  counterpartId: string | null;
  counterpartLabel: string | null;
  confidence: number;
  explanation: string;
  supportingSignals: Array<{
    label: string;
    value: number | string;
    source: string;
  }>;
  observedAt: string;
}

export interface DataCoverageScore {
  coverageScore: number;
  sourceCount: number;
  missingSources: string[];
  confidence: number;
  coveredSources: string[];
  updatedAt: string;
}

export interface SignalCorrelation {
  id: string;
  correlationType: SignalCorrelationType;
  entities: Array<{
    entityType: string;
    entityId: string;
    entityLabel?: string | null;
  }>;
  signals: Array<{
    signalType: string;
    value: number | string;
    source: string;
    observedAt: string;
  }>;
  explanation: string;
  confidence: number;
  observedAt: string;
}

export interface IntelligenceFeedItem {
  id: string;
  itemType: IntelligenceFeedItemType;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  title: string;
  summary: string;
  confidence: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  timestamp: string;
  sources: string[];
  metadata: Record<string, unknown>;
}

export interface IntelligenceWatchRecord {
  id: string;
  name: string;
  active: boolean;
  ownerOrganizationId: string | null;
  targetType: IntelligenceWatchTargetType;
  targetValue: string;
  subscribedSignals: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IntelligenceWatchDetail extends IntelligenceWatchRecord {
  alerts: IntelligenceFeedItem[];
  earlyWarnings: SignalHistoryPoint[];
}

type PersistablePredictionInsight = {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  state: string;
  score: number;
  confidence: number;
  summary: string;
  explanation: string;
  updatedAt: string;
  createdAt: string;
  signals: IntelligenceDriver[];
  metadata: Record<string, unknown>;
};

type PredictionSignalHistoryInput = Omit<PersistablePredictionInsight, 'signals'> & {
  signals: Array<{
    label: string;
    value: number | string;
    source?: string | null;
    direction?: 'UP' | 'DOWN' | 'FLAT';
    explanation?: string;
    observedAt?: string;
  }>;
};

type ClaimRow = {
  claimId: string;
  subjectNpi: string;
  claimType: string;
  sourceId: string;
  value: Prisma.JsonValue;
  createdAt: Date;
  observedAt: Date;
};

type AlertRow = {
  alertId: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  subject: string | null;
  createdAt: Date;
};

type GraphNodeRow = {
  id: string;
  label: string;
  metadata: Prisma.JsonValue;
};

type GraphEdgeRow = {
  id: string;
  edgeType: string;
  createdAt: Date;
  sourceNode: GraphNodeRow;
  targetNode: GraphNodeRow;
};

type LearningEventRow = {
  id: string;
  eventType: string;
  subjectType: string;
  subjectId: string;
  relatedId: string | null;
  confidence: number | null;
  signalStrength: number | null;
  metadata: Prisma.JsonValue;
  occurredAt: Date;
};

type WatchlistRow = {
  id: string;
  name: string;
  ownerOrganizationId: string | null;
  targetType: 'PROVIDER' | 'INSTITUTION' | 'CLAIM_CLASS';
  targetValue: string;
  active: boolean;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

const INTELLIGENCE_SIGNAL_EVENT = 'INTELLIGENCE_SIGNAL_SNAPSHOT';
const NETWORK_DELTA_EVENT = 'NETWORK_DELTA_DETECTED';
const SIGNAL_CORRELATION_EVENT = 'SIGNAL_CORRELATION_DETECTED';

const WATCHLIST_FALLBACK_TARGET_TYPE = 'CLAIM_CLASS';
const COLLABORATION_EDGE_TYPES = ['co_author', 'co_pi', 'co_investigator', 'published_with', 'related_to'];
const EARLY_WARNING_FINDING_TYPES = ['trust_decline', 'divergence', 'compliance', 'exclusion', 'network_emergence'];
const COVERAGE_SOURCES = [
  { key: 'NPPES', label: 'NPPES', match: (sourceId: string, claimType: string) => sourceId === 'NPPES_API' || sourceId === 'NPPES' || claimType === 'INSTITUTION_AFFILIATION' },
  { key: 'OPENALEX', label: 'OpenAlex', match: (sourceId: string) => sourceId === 'OPENALEX' },
  { key: 'REPORTER', label: 'RePORTER', match: (sourceId: string, claimType: string) => sourceId === 'NIH_REPORTER' || claimType.includes('GRANT') },
  { key: 'CLINICAL_TRIALS', label: 'ClinicalTrials', match: (sourceId: string, claimType: string) => sourceId === 'CLINICAL_TRIALS' || claimType === 'CLINICAL_TRIAL' },
  { key: 'OPEN_PAYMENTS', label: 'Open Payments', match: (sourceId: string, claimType: string) => sourceId === 'OPEN_PAYMENTS' || claimType.includes('PAYMENT') },
  { key: 'SANCTIONS', label: 'sanctions feeds', match: (sourceId: string) => ['OIG_LEIE', 'SAM_GOV', 'LEIE'].includes(sourceId) },
  { key: 'INTERNAL_FINDINGS', label: 'internal findings', match: () => false },
] as const;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function sha256Hex(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeEntityType(entityType: string): string {
  return entityType.trim().toUpperCase();
}

function severityRank(severity: string): number {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 5;
    case 'high':
      return 4;
    case 'medium':
      return 3;
    case 'low':
      return 2;
    default:
      return 1;
  }
}

function normalizeFeedSeverity(severity: string): IntelligenceFeedItem['severity'] {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'info';
  }
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeSignalValue(value: number | string): number | string {
  return typeof value === 'number' ? roundScore(value) : value;
}

function normalizeSignalStrength(value: number | string | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  if (value <= 1) {
    return clamp01(value);
  }

  return clamp01(value / 100);
}

function predictionSignals(value: Prisma.JsonValue): IntelligenceDriver[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => {
    const record = asRecord(entry);
    return {
      label: asString(record.label) ?? 'signal',
      value: asNumber(record.value) ?? asString(record.value) ?? 'n/a',
      source: asString(record.source) ?? 'derived',
      direction: asString(record.direction) === 'DOWN'
        ? 'DOWN'
        : asString(record.direction) === 'FLAT'
          ? 'FLAT'
          : 'UP',
      explanation: asString(record.explanation) ?? undefined,
    };
  });
}

function predictionRowToSurface(row: {
  predictionId: string;
  predictionType: string;
  targetEntityType: string;
  targetEntityId: string;
  targetEntityLabel: string | null;
  probability: number;
  confidence: number;
  evidenceSignals: Prisma.JsonValue;
  explanation: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): PersistablePredictionInsight {
  const metadata = asRecord(row.metadata);

  return {
    id: row.predictionId,
    type: row.predictionType,
    entityType: row.targetEntityType,
    entityId: row.targetEntityId,
    entityLabel: row.targetEntityLabel,
    state: asString(metadata.state) ?? 'insufficient_signal',
    score: row.probability,
    confidence: row.confidence,
    summary: asString(metadata.summary) ?? row.explanation,
    explanation: row.explanation,
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    signals: predictionSignals(row.evidenceSignals),
    metadata,
  };
}

function metadataWatchTargetType(metadata: Prisma.JsonValue | null): IntelligenceWatchTargetType | null {
  const targetType = asString(asRecord(metadata).watchTargetType);
  if (targetType === 'provider' || targetType === 'institution' || targetType === 'specialty' || targetType === 'network_cluster') {
    return targetType;
  }

  return null;
}

function watchSubscribedSignals(targetType: IntelligenceWatchTargetType): string[] {
  switch (targetType) {
    case 'provider':
      return ['trust_score', 'influence_score', 'early_warning', 'network_change', 'prediction', 'correlation'];
    case 'institution':
      return ['institution_momentum', 'network_change', 'prediction', 'correlation', 'early_warning'];
    case 'specialty':
      return ['workforce_pressure', 'prediction', 'correlation', 'early_warning'];
    case 'network_cluster':
      return ['network_change', 'correlation', 'prediction'];
  }
}

function watchRowToRecord(row: WatchlistRow): IntelligenceWatchRecord {
  const metadata = asRecord(row.metadata);
  const targetType = metadataWatchTargetType(row.metadata)
    ?? (row.targetType === 'PROVIDER'
      ? 'provider'
      : row.targetType === 'INSTITUTION'
        ? 'institution'
        : 'specialty');

  return {
    id: row.id,
    name: row.name,
    active: row.active,
    ownerOrganizationId: row.ownerOrganizationId,
    targetType,
    targetValue: row.targetValue,
    subscribedSignals: asStringArray(metadata.subscribedSignals).length > 0
      ? asStringArray(metadata.subscribedSignals)
      : watchSubscribedSignals(targetType),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function learningEventToSignalPoint(row: LearningEventRow): SignalHistoryPoint | null {
  const metadata = asRecord(row.metadata);
  const signalType = asString(metadata.signalType);
  if (
    signalType !== 'influence_score'
    && signalType !== 'workforce_pressure'
    && signalType !== 'institution_momentum'
    && signalType !== 'early_warning'
    && signalType !== 'key_provider_event'
    && signalType !== 'data_coverage'
  ) {
    return null;
  }

  const drivers = Array.isArray(metadata.drivers)
    ? metadata.drivers.map((entry) => {
      const record = asRecord(entry);
      return {
        label: asString(record.label) ?? 'driver',
        value: asNumber(record.value) ?? asString(record.value) ?? 'n/a',
        source: asString(record.source) ?? 'derived',
        direction: asString(record.direction) === 'DOWN'
          ? 'DOWN'
          : asString(record.direction) === 'FLAT'
            ? 'FLAT'
            : 'UP',
        explanation: asString(record.explanation) ?? undefined,
      } satisfies IntelligenceDriver;
    })
    : [];

  const rawValue = metadata.value;
  const value = asNumber(rawValue) ?? asString(rawValue);
  if (value === null) {
    return null;
  }

  return {
    entityType: row.subjectType.toLowerCase(),
    entityId: row.subjectId,
    signalType,
    value: normalizeSignalValue(value),
    confidence: clamp01(row.confidence ?? 0.5),
    drivers,
    timestamp: row.occurredAt.toISOString(),
  };
}

function learningEventToNetworkChange(row: LearningEventRow): NetworkChangeEvent | null {
  if (row.eventType !== NETWORK_DELTA_EVENT) {
    return null;
  }

  const metadata = asRecord(row.metadata);
  const changeType = asString(metadata.changeType);
  if (
    changeType !== 'new_collaborator'
    && changeType !== 'lost_collaborator'
    && changeType !== 'new_institution_affiliation'
    && changeType !== 'trial_network_expansion'
    && changeType !== 'grant_network_formation'
  ) {
    return null;
  }

  const supportingSignals = Array.isArray(metadata.supportingSignals)
    ? metadata.supportingSignals.map((entry) => {
      const record = asRecord(entry);
      return {
        label: asString(record.label) ?? 'signal',
        value: asNumber(record.value) ?? asString(record.value) ?? 'n/a',
        source: asString(record.source) ?? 'derived',
      };
    })
    : [];

  return {
    id: row.id,
    changeType,
    entityType: row.subjectType.toLowerCase(),
    entityId: row.subjectId,
    entityLabel: asString(metadata.entityLabel),
    counterpartType: asString(metadata.counterpartType),
    counterpartId: asString(metadata.counterpartId),
    counterpartLabel: asString(metadata.counterpartLabel),
    confidence: clamp01(row.confidence ?? 0.5),
    explanation: asString(metadata.explanation) ?? 'Network change detected.',
    supportingSignals,
    observedAt: row.occurredAt.toISOString(),
  };
}

function learningEventToCorrelation(row: LearningEventRow): SignalCorrelation | null {
  if (row.eventType !== SIGNAL_CORRELATION_EVENT) {
    return null;
  }

  const metadata = asRecord(row.metadata);
  const correlationType = asString(metadata.correlationType);
  if (
    correlationType !== 'research_program_expansion'
    && correlationType !== 'collaboration_cluster_formation'
    && correlationType !== 'institution_research_acceleration'
  ) {
    return null;
  }

  const entities = Array.isArray(metadata.entities)
    ? metadata.entities.map((entry) => {
      const record = asRecord(entry);
      return {
        entityType: asString(record.entityType) ?? 'entity',
        entityId: asString(record.entityId) ?? 'unknown',
        entityLabel: asString(record.entityLabel),
      };
    })
    : [];

  const signals = Array.isArray(metadata.signals)
    ? metadata.signals.map((entry) => {
      const record = asRecord(entry);
      return {
        signalType: asString(record.signalType) ?? 'signal',
        value: asNumber(record.value) ?? asString(record.value) ?? 'n/a',
        source: asString(record.source) ?? 'derived',
        observedAt: asString(record.observedAt) ?? row.occurredAt.toISOString(),
      };
    })
    : [];

  return {
    id: row.id,
    correlationType,
    entities,
    signals,
    explanation: asString(metadata.explanation) ?? 'Signals aligned into a deterministic correlation.',
    confidence: clamp01(row.confidence ?? 0.5),
    observedAt: row.occurredAt.toISOString(),
  };
}

async function upsertLearningEvent(params: {
  prismaClient: PrismaClient;
  eventType: string;
  subjectType: string;
  subjectId: string;
  occurredAt: string;
  confidence?: number;
  signalStrength?: number | string | null;
  scoreDelta?: number | null;
  relatedId?: string | null;
  metadata: Record<string, unknown>;
  dedupeSeed: Record<string, unknown>;
}): Promise<void> {
  const dedupeKey = sha256Hex({
    eventType: params.eventType,
    subjectType: normalizeEntityType(params.subjectType),
    subjectId: params.subjectId,
    occurredAt: params.occurredAt,
    ...params.dedupeSeed,
  });

  await params.prismaClient.learningEvent.upsert({
    where: { dedupeKey },
    update: {
      confidence: params.confidence ?? null,
      signalStrength: normalizeSignalStrength(params.signalStrength ?? null),
      scoreDelta: params.scoreDelta ?? null,
      relatedId: params.relatedId ?? null,
      metadata: toJsonValue(params.metadata),
      occurredAt: new Date(params.occurredAt),
      status: 'RECORDED',
    },
    create: {
      dedupeKey,
      eventType: params.eventType,
      loopType: 'INTELLIGENCE_LAYER',
      subjectType: normalizeEntityType(params.subjectType),
      subjectId: params.subjectId,
      relatedId: params.relatedId ?? null,
      status: 'RECORDED',
      confidence: params.confidence ?? null,
      signalStrength: normalizeSignalStrength(params.signalStrength ?? null),
      scoreDelta: params.scoreDelta ?? null,
      metadata: toJsonValue(params.metadata),
      occurredAt: new Date(params.occurredAt),
    },
  });
}

async function loadStoredPredictions(
  prismaClient: PrismaClient,
  options?: {
    entityType?: string;
    entityId?: string;
  },
): Promise<PersistablePredictionInsight[]> {
  const rows = await prismaClient.predictionInsight.findMany({
    where: {
      ...(options?.entityType ? { targetEntityType: options.entityType } : {}),
      ...(options?.entityId ? { targetEntityId: options.entityId } : {}),
    },
    orderBy: [
      { probability: 'desc' },
      { confidence: 'desc' },
      { updatedAt: 'desc' },
    ],
  });

  return rows.map((row) => predictionRowToSurface({
    predictionId: row.predictionId,
    predictionType: row.predictionType,
    targetEntityType: row.targetEntityType,
    targetEntityId: row.targetEntityId,
    targetEntityLabel: row.targetEntityLabel,
    probability: row.probability,
    confidence: row.confidence,
    evidenceSignals: row.evidenceSignals,
    explanation: row.explanation,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

async function loadKeyProviderClaims(
  prismaClient: PrismaClient,
  npis: string[],
): Promise<ClaimRow[]> {
  if (npis.length === 0) {
    return [];
  }

  const rows = await prismaClient.claimRecord.findMany({
    where: {
      subjectNpi: { in: npis },
      claimType: {
        in: [
          'PUBLICATION',
          'CITATION_METRIC',
          'CLINICAL_TRIAL',
          'NIH_GRANT',
          'INDUSTRY_PAYMENT',
          'INSTITUTION_AFFILIATION',
        ],
      },
    },
    select: {
      claimId: true,
      subjectNpi: true,
      claimType: true,
      sourceId: true,
      value: true,
      createdAt: true,
      observedAt: true,
    },
    orderBy: { observedAt: 'desc' },
    take: 8_000,
  });

  return rows.map((row) => ({
    claimId: row.claimId,
    subjectNpi: row.subjectNpi,
    claimType: row.claimType,
    sourceId: row.sourceId,
    value: row.value,
    createdAt: row.createdAt,
    observedAt: row.observedAt,
  }));
}

async function loadRecentAlerts(
  prismaClient: PrismaClient,
  npis: string[],
): Promise<AlertRow[]> {
  if (npis.length === 0) {
    return [];
  }

  const rows = await prismaClient.trustAlertRecord.findMany({
    where: {
      subject: { in: npis },
    },
    select: {
      alertId: true,
      type: true,
      severity: true,
      title: true,
      description: true,
      subject: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 2_000,
  });

  return rows.map((row) => ({
    alertId: row.alertId,
    type: row.type,
    severity: row.severity,
    title: row.title,
    description: row.description,
    subject: row.subject,
    createdAt: row.createdAt,
  }));
}

function extractNpiFromGraphNode(node: GraphNodeRow): string | null {
  return asString(asRecord(node.metadata).npi);
}

async function loadGraphEdges(prismaClient: PrismaClient): Promise<GraphEdgeRow[]> {
  const rows = await prismaClient.graphEdge.findMany({
    where: {
      status: 'ACTIVE',
      edgeType: { in: COLLABORATION_EDGE_TYPES },
    },
    include: {
      sourceNode: {
        select: {
          id: true,
          label: true,
          metadata: true,
        },
      },
      targetNode: {
        select: {
          id: true,
          label: true,
          metadata: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 8_000,
  });

  return rows.map((row) => ({
    id: row.id,
    edgeType: row.edgeType,
    createdAt: row.createdAt,
    sourceNode: row.sourceNode,
    targetNode: row.targetNode,
  }));
}

function dedupeSignalPoints(points: SignalHistoryPoint[]): SignalHistoryPoint[] {
  const seen = new Set<string>();
  return points.filter((point) => {
    const key = `${point.signalType}:${point.entityType}:${point.entityId}:${point.timestamp}:${String(point.value)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export async function syncPredictionSignalHistory(
  predictions: readonly PredictionSignalHistoryInput[],
  prismaClient: PrismaClient = prisma,
): Promise<void> {
  const providerPredictionIds = new Set<string>();

  for (const prediction of predictions) {
    const observedAt = asString(prediction.metadata.lastObservedAt) ?? prediction.updatedAt;
    const signalType = prediction.type === 'PROVIDER_TRAJECTORY'
      ? 'influence_score'
      : prediction.type === 'SPECIALTY_PRESSURE'
        ? 'workforce_pressure'
        : prediction.type === 'INSTITUTION_MOMENTUM'
          ? 'institution_momentum'
          : null;

    if (!signalType) {
      continue;
    }

    if (prediction.type === 'PROVIDER_TRAJECTORY') {
      providerPredictionIds.add(prediction.entityId);
    }

    await upsertLearningEvent({
      prismaClient,
      eventType: INTELLIGENCE_SIGNAL_EVENT,
      subjectType: prediction.entityType,
      subjectId: prediction.entityId,
      occurredAt: observedAt,
      confidence: prediction.confidence,
      signalStrength: prediction.score * 100,
      metadata: {
        signalType,
        predictionId: prediction.id,
        predictionType: prediction.type,
        state: prediction.state,
        entityLabel: prediction.entityLabel,
        value: roundScore(prediction.score * 100),
        drivers: prediction.signals.map((signal) => ({
          label: signal.label,
          value: signal.value,
          source: signal.source ?? 'derived',
          direction: signal.direction,
          explanation: signal.explanation ?? `${signal.label.replace(/_/g, ' ')} contributes to ${signalType}.`,
        })),
      },
      dedupeSeed: {
        signalType,
        predictionId: prediction.id,
        score: roundScore(prediction.score * 100),
        state: prediction.state,
      },
    });
  }

  const providerIds = [...providerPredictionIds];
  const providerClaims = await loadKeyProviderClaims(prismaClient, providerIds);
  const alerts = await loadRecentAlerts(prismaClient, providerIds);
  const activeFindings = await listInvestigatorFindings({
    provider: null,
    findingType: EARLY_WARNING_FINDING_TYPES,
    status: ['new', 'acknowledged', 'investigating', 'escalated'],
    limit: 500,
    offset: 0,
  });

  const findingsByNpi = new Map<string, typeof activeFindings.findings>();
  for (const finding of activeFindings.findings) {
    for (const entityId of finding.entityIds) {
      if (!/^\d{10}$/.test(entityId)) {
        continue;
      }
      const entries = findingsByNpi.get(entityId) ?? [];
      entries.push(finding);
      findingsByNpi.set(entityId, entries);
    }
  }

  const alertsByNpi = new Map<string, AlertRow[]>();
  for (const alert of alerts) {
    if (!alert.subject) {
      continue;
    }
    const entries = alertsByNpi.get(alert.subject) ?? [];
    entries.push(alert);
    alertsByNpi.set(alert.subject, entries);
  }

  for (const providerId of providerIds) {
    const findings = findingsByNpi.get(providerId) ?? [];
    const providerAlerts = alertsByNpi.get(providerId) ?? [];
    if (findings.length === 0 && providerAlerts.length === 0) {
      continue;
    }

    const maxSeverity = Math.max(
      ...findings.map((finding) => severityRank(finding.severity)),
      ...providerAlerts.map((alert) => severityRank(alert.severity)),
      1,
    );
    const warningValue = Math.min(100, 30 + (maxSeverity * 12) + findings.length * 8 + providerAlerts.length * 6);
    const occurredAt = [
      findings[0]?.lastSeenAt,
      providerAlerts[0]?.createdAt.toISOString(),
    ].filter((value): value is string => Boolean(value)).sort().slice(-1)[0] ?? new Date().toISOString();

    await upsertLearningEvent({
      prismaClient,
      eventType: INTELLIGENCE_SIGNAL_EVENT,
      subjectType: 'provider',
      subjectId: providerId,
      occurredAt,
      confidence: clamp01(0.45 + (Math.min(maxSeverity, 5) * 0.08) + Math.min(findings.length, 4) * 0.05),
      signalStrength: warningValue,
      metadata: {
        signalType: 'early_warning',
        value: warningValue,
        drivers: [
          ...findings.slice(0, 4).map((finding) => ({
            label: finding.findingType,
            value: finding.title,
            source: 'INVESTIGATOR_FINDING',
            direction: 'UP',
            explanation: finding.summary,
          })),
          ...providerAlerts.slice(0, 2).map((alert) => ({
            label: alert.type.toLowerCase(),
            value: alert.title,
            source: 'TRUST_ALERT',
            direction: 'UP',
            explanation: alert.description,
          })),
        ],
      },
      dedupeSeed: {
        signalType: 'early_warning',
        warningValue,
        findingIds: findings.slice(0, 6).map((finding) => finding.findingId).sort(),
        alertIds: providerAlerts.slice(0, 4).map((alert) => alert.alertId).sort(),
      },
    });
  }

  for (const claim of providerClaims) {
    const valueRecord = asRecord(claim.value);
    const claimValue = asString(valueRecord.title)
      ?? asString(valueRecord.institution)
      ?? asString(valueRecord.grantId)
      ?? asString(valueRecord.role)
      ?? claim.claimType.toLowerCase();
    await upsertLearningEvent({
      prismaClient,
      eventType: INTELLIGENCE_SIGNAL_EVENT,
      subjectType: 'provider',
      subjectId: claim.subjectNpi,
      occurredAt: claim.observedAt.toISOString(),
      confidence: 0.72,
      signalStrength: claim.claimType === 'NIH_GRANT' || claim.claimType === 'CLINICAL_TRIAL'
        ? 0.82
        : claim.claimType === 'INDUSTRY_PAYMENT'
          ? 0.7
          : 0.64,
      relatedId: claim.claimId,
      metadata: {
        signalType: 'key_provider_event',
        value: claim.claimType.toLowerCase(),
        drivers: [{
          label: claim.claimType.toLowerCase(),
          value: claimValue,
          source: claim.sourceId,
          direction: 'UP',
          explanation: `${claim.claimType.replace(/_/g, ' ')} observed for provider ${claim.subjectNpi}.`,
        }],
      },
      dedupeSeed: {
        signalType: 'key_provider_event',
        claimId: claim.claimId,
      },
    });
  }

  // Coverage is persisted as a signal so downstream consumers can reason about completeness over time.
  for (const providerId of providerIds) {
    const coverage = await getProviderCoverageScore(providerId, prismaClient);
    await upsertLearningEvent({
      prismaClient,
      eventType: INTELLIGENCE_SIGNAL_EVENT,
      subjectType: 'provider',
      subjectId: providerId,
      occurredAt: coverage.updatedAt,
      confidence: coverage.confidence,
      signalStrength: coverage.coverageScore,
      metadata: {
        signalType: 'data_coverage',
        value: coverage.coverageScore,
        drivers: coverage.coveredSources.map((source) => ({
          label: source,
          value: 'covered',
          source,
          direction: 'UP',
          explanation: `${source} currently contributes to the provider intelligence surface.`,
        })),
        missingSources: coverage.missingSources,
        sourceCount: coverage.sourceCount,
      },
      dedupeSeed: {
        signalType: 'data_coverage',
        coverageScore: coverage.coverageScore,
        sourceCount: coverage.sourceCount,
        missingSources: [...coverage.missingSources].sort(),
      },
    });
  }
}

export async function listSignalHistory(
  options: {
    entityType: string;
    entityId: string;
    signalType?: IntelligenceSignalType;
    limit?: number;
  },
  prismaClient: PrismaClient = prisma,
): Promise<SignalHistoryPoint[]> {
  const limit = Math.min(Math.max(options.limit ?? 40, 1), 200);
  const points: SignalHistoryPoint[] = [];

  if (!options.signalType || options.signalType === 'trust_score') {
    const trustRows = await prismaClient.trustScoreHistory.findMany({
      where: {
        subjectId: options.entityId,
        subjectType: {
          in: [...new Set([
            normalizeEntityType(options.entityType),
            'NPI',
            'PROVIDER',
            'CLINICIAN',
          ])],
        },
      },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });

    points.push(...trustRows.map((row) => {
      const direction: NonNullable<IntelligenceDriver['direction']> = row.scoreDelta > 0
        ? 'UP'
        : row.scoreDelta < 0
          ? 'DOWN'
          : 'FLAT';

      return {
        entityType: options.entityType,
        entityId: options.entityId,
        signalType: 'trust_score' as const,
        value: roundScore(row.newScore),
        confidence: clamp01(row.confidence ?? 0.75),
        drivers: [{
          label: row.triggerEvent.toLowerCase(),
          value: roundScore(row.scoreDelta),
          source: row.methodologyVersion ?? 'TRUST_V1',
          direction,
          explanation: `Trust score moved by ${roundScore(row.scoreDelta)} points.`,
        }],
        timestamp: row.recordedAt.toISOString(),
      };
    }));
  }

  const learningRows = await prismaClient.learningEvent.findMany({
    where: {
      eventType: INTELLIGENCE_SIGNAL_EVENT,
      subjectType: normalizeEntityType(options.entityType),
      subjectId: options.entityId,
    },
    select: {
      id: true,
      eventType: true,
      subjectType: true,
      subjectId: true,
      relatedId: true,
      confidence: true,
      signalStrength: true,
      metadata: true,
      occurredAt: true,
    },
    orderBy: { occurredAt: 'desc' },
    take: limit * 3,
  });

  for (const row of learningRows) {
    const point = learningEventToSignalPoint(row);
    if (!point) {
      continue;
    }
    if (options.signalType && point.signalType !== options.signalType) {
      continue;
    }
    points.push(point);
  }

  return dedupeSignalPoints(points)
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, limit);
}

function computeSlope(points: SignalHistoryPoint[]): number {
  const numericPoints = points
    .map((point, index) => ({
      x: index,
      y: typeof point.value === 'number' ? point.value : NaN,
    }))
    .filter((point) => Number.isFinite(point.y));

  if (numericPoints.length < 2) {
    return 0;
  }

  const n = numericPoints.length;
  const sumX = numericPoints.reduce((sum, point) => sum + point.x, 0);
  const sumY = numericPoints.reduce((sum, point) => sum + point.y, 0);
  const sumXY = numericPoints.reduce((sum, point) => sum + (point.x * point.y), 0);
  const sumXX = numericPoints.reduce((sum, point) => sum + (point.x * point.x), 0);
  const denominator = (n * sumXX) - (sumX * sumX);

  if (denominator === 0) {
    return 0;
  }

  return ((n * sumXY) - (sumX * sumY)) / denominator;
}

export async function detectProviderTrajectories(
  providerId: string,
  prismaClient: PrismaClient = prisma,
): Promise<TrajectoryDetection[]> {
  const [influenceHistory, trustHistory, networkChanges] = await Promise.all([
    listSignalHistory({ entityType: 'provider', entityId: providerId, signalType: 'influence_score', limit: 6 }, prismaClient),
    listSignalHistory({ entityType: 'provider', entityId: providerId, signalType: 'trust_score', limit: 6 }, prismaClient),
    listNetworkChanges({ entityType: 'provider', entityId: providerId, limit: 12 }, prismaClient),
  ]);

  const detections: TrajectoryDetection[] = [];

  const influencePoints = [...influenceHistory].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  if (influencePoints.length >= 3 && typeof influencePoints[0]?.value === 'number' && typeof influencePoints.at(-1)?.value === 'number') {
    const delta = roundScore((influencePoints.at(-1)!.value as number) - (influencePoints[0]!.value as number));
    const slope = computeSlope(influencePoints);
    const confidence = clamp01(0.45 + Math.min(Math.abs(delta) / 20, 0.3) + Math.min(Math.abs(slope) / 8, 0.2));
    if (delta >= 6 && slope > 0) {
      detections.push({
        trajectoryType: 'influence_rising',
        confidence,
        explanation: `Influence is rising because the score increased ${delta} points across ${influencePoints.length} windows and the slope remained positive (${roundScore(slope)}).`,
        supportingSignals: influencePoints.slice(-4),
      });
    }
    if (delta <= -6 && slope < 0) {
      detections.push({
        trajectoryType: 'influence_falling',
        confidence,
        explanation: `Influence is falling because the score declined ${Math.abs(delta)} points across ${influencePoints.length} windows and the slope remained negative (${roundScore(slope)}).`,
        supportingSignals: influencePoints.slice(-4),
      });
    }
  }

  const trustPoints = [...trustHistory].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  if (trustPoints.length >= 2 && typeof trustPoints[0]?.value === 'number' && typeof trustPoints.at(-1)?.value === 'number') {
    const delta = roundScore((trustPoints.at(-1)!.value as number) - (trustPoints[0]!.value as number));
    const slope = computeSlope(trustPoints);
    const confidence = clamp01(0.48 + Math.min(Math.abs(delta) / 18, 0.28) + Math.min(Math.abs(slope) / 6, 0.16));
    if (delta <= -5 && slope < 0) {
      detections.push({
        trajectoryType: 'trust_deteriorating',
        confidence,
        explanation: `Trust is deteriorating because the score dropped ${Math.abs(delta)} points across ${trustPoints.length} observations with a negative slope (${roundScore(slope)}).`,
        supportingSignals: trustPoints.slice(-4),
      });
    }
    if (delta >= 5 && slope > 0) {
      detections.push({
        trajectoryType: 'trust_improving',
        confidence,
        explanation: `Trust is improving because the score gained ${delta} points across ${trustPoints.length} observations with a positive slope (${roundScore(slope)}).`,
        supportingSignals: trustPoints.slice(-4),
      });
    }
  }

  const recentChanges = networkChanges.filter((change) => Date.now() - Date.parse(change.observedAt) <= 120 * 86_400_000);
  const expansionSignals = recentChanges.filter((change) =>
    ['new_collaborator', 'trial_network_expansion', 'grant_network_formation', 'new_institution_affiliation'].includes(change.changeType),
  );
  const contractionSignals = recentChanges.filter((change) => change.changeType === 'lost_collaborator');
  if (expansionSignals.length >= 2 && expansionSignals.length > contractionSignals.length) {
    detections.push({
      trajectoryType: 'network_expansion',
      confidence: clamp01(0.5 + Math.min(expansionSignals.length * 0.08, 0.32)),
      explanation: `Network expansion is active because ${expansionSignals.length} recent expansion deltas outpaced ${contractionSignals.length} contraction signals.`,
      supportingSignals: expansionSignals.slice(0, 4).map((change) => ({
        entityType: change.entityType,
        entityId: change.entityId,
        signalType: 'key_provider_event',
        value: change.changeType,
        confidence: change.confidence,
        drivers: change.supportingSignals.map((signal) => ({
          label: signal.label,
          value: signal.value,
          source: signal.source,
        })),
        timestamp: change.observedAt,
      })),
    });
  }
  if (contractionSignals.length >= 2 && contractionSignals.length >= expansionSignals.length) {
    detections.push({
      trajectoryType: 'network_contraction',
      confidence: clamp01(0.46 + Math.min(contractionSignals.length * 0.08, 0.28)),
      explanation: `Network contraction is active because ${contractionSignals.length} collaborator losses were recorded with only ${expansionSignals.length} offsetting expansion signals.`,
      supportingSignals: contractionSignals.slice(0, 4).map((change) => ({
        entityType: change.entityType,
        entityId: change.entityId,
        signalType: 'key_provider_event',
        value: change.changeType,
        confidence: change.confidence,
        drivers: change.supportingSignals.map((signal) => ({
          label: signal.label,
          value: signal.value,
          source: signal.source,
        })),
        timestamp: change.observedAt,
      })),
    });
  }

  return detections;
}

export async function syncNetworkDeltaEvents(
  prismaClient: PrismaClient = prisma,
): Promise<NetworkChangeEvent[]> {
  const [edges, affiliationClaims] = await Promise.all([
    loadGraphEdges(prismaClient),
    prismaClient.claimRecord.findMany({
      where: {
        claimType: 'INSTITUTION_AFFILIATION',
      },
      select: {
        claimId: true,
        subjectNpi: true,
        claimType: true,
        sourceId: true,
        value: true,
        createdAt: true,
        observedAt: true,
      },
      orderBy: { observedAt: 'desc' },
      take: 4_000,
    }),
  ]);

  const recentCutoff = new Date(Date.now() - 120 * 86_400_000);
  const previousCutoff = new Date(Date.now() - 240 * 86_400_000);
  const events: NetworkChangeEvent[] = [];

  const byProvider = new Map<string, {
    recentCollaborators: Map<string, { id: string; label: string; type: string; source: string; observedAt: string }>;
    previousCollaborators: Map<string, { id: string; label: string; type: string; source: string; observedAt: string }>;
    recentGrantCount: number;
    previousGrantCount: number;
    recentTrialCount: number;
    previousTrialCount: number;
    recentGrantObservedAt: string | null;
    recentTrialObservedAt: string | null;
  }>();

  for (const edge of edges) {
    for (const endpoint of [
      { node: edge.sourceNode, opposite: edge.targetNode },
      { node: edge.targetNode, opposite: edge.sourceNode },
    ]) {
      const npi = extractNpiFromGraphNode(endpoint.node);
      if (!npi) {
        continue;
      }

      const current = byProvider.get(npi) ?? {
        recentCollaborators: new Map(),
        previousCollaborators: new Map(),
        recentGrantCount: 0,
        previousGrantCount: 0,
        recentTrialCount: 0,
        previousTrialCount: 0,
        recentGrantObservedAt: null,
        recentTrialObservedAt: null,
      };

      const oppositeNpi = extractNpiFromGraphNode(endpoint.opposite);
      const counterpartId = oppositeNpi ?? endpoint.opposite.id;
      const counterpartLabel = endpoint.opposite.label;
      const counterpartType = oppositeNpi ? 'provider' : 'entity';
      const targetMap = edge.createdAt >= recentCutoff
        ? current.recentCollaborators
        : edge.createdAt >= previousCutoff
          ? current.previousCollaborators
          : null;
      if (targetMap) {
        targetMap.set(counterpartId, {
          id: counterpartId,
          label: counterpartLabel,
          type: counterpartType,
          source: edge.edgeType,
          observedAt: edge.createdAt.toISOString(),
        });
      }

      byProvider.set(npi, current);
    }
  }

  const claimRows = affiliationClaims.map((row) => ({
    claimId: row.claimId,
    subjectNpi: row.subjectNpi,
    claimType: row.claimType,
    sourceId: row.sourceId,
    value: row.value,
    createdAt: row.createdAt,
    observedAt: row.observedAt,
  }));

  const researchClaims = await prismaClient.claimRecord.findMany({
    where: {
      claimType: { in: ['NIH_GRANT', 'CLINICAL_TRIAL'] },
    },
    select: {
      claimId: true,
      subjectNpi: true,
      claimType: true,
      sourceId: true,
      value: true,
      createdAt: true,
      observedAt: true,
    },
    orderBy: { observedAt: 'desc' },
    take: 4_000,
  });

  for (const claim of researchClaims) {
    const current = byProvider.get(claim.subjectNpi) ?? {
      recentCollaborators: new Map(),
      previousCollaborators: new Map(),
      recentGrantCount: 0,
      previousGrantCount: 0,
      recentTrialCount: 0,
      previousTrialCount: 0,
      recentGrantObservedAt: null,
      recentTrialObservedAt: null,
    };
    const isRecent = claim.observedAt >= recentCutoff;
    const isPrevious = claim.observedAt >= previousCutoff && claim.observedAt < recentCutoff;
    if (claim.claimType === 'NIH_GRANT') {
      if (isRecent) {
        current.recentGrantCount += 1;
        current.recentGrantObservedAt = [
          current.recentGrantObservedAt,
          claim.observedAt.toISOString(),
        ].filter((value): value is string => Boolean(value)).sort().slice(-1)[0] ?? claim.observedAt.toISOString();
      }
      if (isPrevious) current.previousGrantCount += 1;
    }
    if (claim.claimType === 'CLINICAL_TRIAL') {
      if (isRecent) {
        current.recentTrialCount += 1;
        current.recentTrialObservedAt = [
          current.recentTrialObservedAt,
          claim.observedAt.toISOString(),
        ].filter((value): value is string => Boolean(value)).sort().slice(-1)[0] ?? claim.observedAt.toISOString();
      }
      if (isPrevious) current.previousTrialCount += 1;
    }
    byProvider.set(claim.subjectNpi, current);
  }

  for (const [providerId, entry] of byProvider) {
    const recentCollaborators = new Set(entry.recentCollaborators.keys());
    const previousCollaborators = new Set(entry.previousCollaborators.keys());

    for (const collaboratorId of recentCollaborators) {
      if (previousCollaborators.has(collaboratorId)) {
        continue;
      }
      const collaborator = entry.recentCollaborators.get(collaboratorId)!;
      const observedAt = collaborator.observedAt;
      const event: NetworkChangeEvent = {
        id: `net_${sha256Hex({ providerId, collaboratorId, type: 'new_collaborator' }).slice(0, 20)}`,
        changeType: 'new_collaborator',
        entityType: 'provider',
        entityId: providerId,
        entityLabel: null,
        counterpartType: collaborator.type,
        counterpartId: collaborator.id,
        counterpartLabel: collaborator.label,
        confidence: 0.76,
        explanation: `A new collaborator entered the provider's mapped network above baseline.`,
        supportingSignals: [{
          label: 'new_edge',
          value: collaborator.label,
          source: collaborator.source,
        }],
        observedAt,
      };
      events.push(event);
      await upsertLearningEvent({
        prismaClient,
        eventType: NETWORK_DELTA_EVENT,
        subjectType: 'provider',
        subjectId: providerId,
        relatedId: collaborator.id,
        occurredAt: observedAt,
        confidence: event.confidence,
        signalStrength: 0.76,
        metadata: {
          changeType: event.changeType,
          entityLabel: event.entityLabel,
          counterpartType: event.counterpartType,
          counterpartId: event.counterpartId,
          counterpartLabel: event.counterpartLabel,
          explanation: event.explanation,
          supportingSignals: event.supportingSignals,
        },
        dedupeSeed: {
          changeType: event.changeType,
          counterpartId: collaborator.id,
        },
      });
    }

    for (const collaboratorId of previousCollaborators) {
      if (recentCollaborators.has(collaboratorId)) {
        continue;
      }
      const collaborator = entry.previousCollaborators.get(collaboratorId)!;
      const observedAt = collaborator.observedAt;
      const event: NetworkChangeEvent = {
        id: `net_${sha256Hex({ providerId, collaboratorId, type: 'lost_collaborator' }).slice(0, 20)}`,
        changeType: 'lost_collaborator',
        entityType: 'provider',
        entityId: providerId,
        entityLabel: null,
        counterpartType: collaborator.type,
        counterpartId: collaborator.id,
        counterpartLabel: collaborator.label,
        confidence: 0.72,
        explanation: `A previously observed collaborator fell below the recent network baseline.`,
        supportingSignals: [{
          label: 'lost_edge',
          value: collaborator.label,
          source: collaborator.source,
        }],
        observedAt,
      };
      events.push(event);
      await upsertLearningEvent({
        prismaClient,
        eventType: NETWORK_DELTA_EVENT,
        subjectType: 'provider',
        subjectId: providerId,
        relatedId: collaborator.id,
        occurredAt: observedAt,
        confidence: event.confidence,
        signalStrength: 0.72,
        metadata: {
          changeType: event.changeType,
          entityLabel: event.entityLabel,
          counterpartType: event.counterpartType,
          counterpartId: event.counterpartId,
          counterpartLabel: event.counterpartLabel,
          explanation: event.explanation,
          supportingSignals: event.supportingSignals,
        },
        dedupeSeed: {
          changeType: event.changeType,
          counterpartId: collaborator.id,
        },
      });
    }

    if (entry.recentTrialCount > entry.previousTrialCount && recentCollaborators.size > previousCollaborators.size) {
      const observedAt = entry.recentTrialObservedAt
        ?? [...entry.recentCollaborators.values()].map((collaborator) => collaborator.observedAt).sort().slice(-1)[0]
        ?? new Date().toISOString();
      const supportingSignals = [
        { label: 'recent_trial_count', value: entry.recentTrialCount, source: 'CLINICAL_TRIALS' },
        { label: 'new_collaborators', value: recentCollaborators.size - previousCollaborators.size, source: 'GRAPH_RUNTIME' },
      ];
      const event: NetworkChangeEvent = {
        id: `net_${sha256Hex({ providerId, type: 'trial_network_expansion' }).slice(0, 20)}`,
        changeType: 'trial_network_expansion',
        entityType: 'provider',
        entityId: providerId,
        entityLabel: null,
        counterpartType: null,
        counterpartId: null,
        counterpartLabel: null,
        confidence: clamp01(0.55 + Math.min(entry.recentTrialCount * 0.08, 0.2)),
        explanation: `Trial activity and collaborator growth crossed the expansion baseline together.`,
        supportingSignals,
        observedAt,
      };
      events.push(event);
      await upsertLearningEvent({
        prismaClient,
        eventType: NETWORK_DELTA_EVENT,
        subjectType: 'provider',
        subjectId: providerId,
        occurredAt: observedAt,
        confidence: event.confidence,
        signalStrength: 0.82,
        metadata: {
          changeType: event.changeType,
          explanation: event.explanation,
          supportingSignals,
        },
        dedupeSeed: {
          changeType: event.changeType,
          recentTrialCount: entry.recentTrialCount,
          collaboratorDelta: recentCollaborators.size - previousCollaborators.size,
        },
      });
    }

    if (entry.recentGrantCount > entry.previousGrantCount && recentCollaborators.size >= previousCollaborators.size + 1) {
      const observedAt = entry.recentGrantObservedAt
        ?? [...entry.recentCollaborators.values()].map((collaborator) => collaborator.observedAt).sort().slice(-1)[0]
        ?? new Date().toISOString();
      const supportingSignals = [
        { label: 'recent_grant_count', value: entry.recentGrantCount, source: 'NIH_REPORTER' },
        { label: 'new_collaborators', value: recentCollaborators.size - previousCollaborators.size, source: 'GRAPH_RUNTIME' },
      ];
      const event: NetworkChangeEvent = {
        id: `net_${sha256Hex({ providerId, type: 'grant_network_formation' }).slice(0, 20)}`,
        changeType: 'grant_network_formation',
        entityType: 'provider',
        entityId: providerId,
        entityLabel: null,
        counterpartType: null,
        counterpartId: null,
        counterpartLabel: null,
        confidence: clamp01(0.58 + Math.min(entry.recentGrantCount * 0.08, 0.22)),
        explanation: `Grant activity and collaborator growth now form a measurable research network.`,
        supportingSignals,
        observedAt,
      };
      events.push(event);
      await upsertLearningEvent({
        prismaClient,
        eventType: NETWORK_DELTA_EVENT,
        subjectType: 'provider',
        subjectId: providerId,
        occurredAt: observedAt,
        confidence: event.confidence,
        signalStrength: 0.84,
        metadata: {
          changeType: event.changeType,
          explanation: event.explanation,
          supportingSignals,
        },
        dedupeSeed: {
          changeType: event.changeType,
          recentGrantCount: entry.recentGrantCount,
          collaboratorDelta: recentCollaborators.size - previousCollaborators.size,
        },
      });
    }
  }

  const affiliationByProvider = new Map<string, { recent: Set<string>; previous: Set<string> }>();
  for (const claim of claimRows) {
    const institution = asString(asRecord(claim.value).institution)
      ?? asString(asRecord(claim.value).organization)
      ?? asString(asRecord(claim.value).hospitalAffiliation);
    if (!institution) {
      continue;
    }
    const state = affiliationByProvider.get(claim.subjectNpi) ?? { recent: new Set<string>(), previous: new Set<string>() };
    if (claim.observedAt >= recentCutoff) {
      state.recent.add(institution);
    } else if (claim.observedAt >= previousCutoff) {
      state.previous.add(institution);
    }
    affiliationByProvider.set(claim.subjectNpi, state);
  }

  for (const [providerId, state] of affiliationByProvider) {
    for (const institution of state.recent) {
      if (state.previous.has(institution)) {
        continue;
      }
      const observedAt = claimRows
        .filter((claim) => claim.subjectNpi === providerId)
        .map((claim) => claim.observedAt.toISOString())
        .sort()
        .slice(-1)[0] ?? new Date().toISOString();
      const event: NetworkChangeEvent = {
        id: `net_${sha256Hex({ providerId, institution, type: 'new_institution_affiliation' }).slice(0, 20)}`,
        changeType: 'new_institution_affiliation',
        entityType: 'provider',
        entityId: providerId,
        entityLabel: null,
        counterpartType: 'institution',
        counterpartId: slugify(institution),
        counterpartLabel: institution,
        confidence: 0.82,
        explanation: `A new institution affiliation appeared above the historical baseline.`,
        supportingSignals: [{
          label: 'institution_affiliation',
          value: institution,
          source: 'NPPES_API',
        }],
        observedAt,
      };
      events.push(event);
      await upsertLearningEvent({
        prismaClient,
        eventType: NETWORK_DELTA_EVENT,
        subjectType: 'provider',
        subjectId: providerId,
        relatedId: slugify(institution),
        occurredAt: observedAt,
        confidence: event.confidence,
        signalStrength: 0.82,
        metadata: {
          changeType: event.changeType,
          counterpartType: event.counterpartType,
          counterpartId: event.counterpartId,
          counterpartLabel: event.counterpartLabel,
          explanation: event.explanation,
          supportingSignals: event.supportingSignals,
        },
        dedupeSeed: {
          changeType: event.changeType,
          institution: slugify(institution),
        },
      });
    }
  }

  return events;
}

export async function listNetworkChanges(
  options: {
    entityType?: string;
    entityId?: string;
    limit?: number;
  } = {},
  prismaClient: PrismaClient = prisma,
): Promise<NetworkChangeEvent[]> {
  const rows = await prismaClient.learningEvent.findMany({
    where: {
      eventType: NETWORK_DELTA_EVENT,
      ...(options.entityType ? { subjectType: normalizeEntityType(options.entityType) } : {}),
      ...(options.entityId ? { subjectId: options.entityId } : {}),
    },
    select: {
      id: true,
      eventType: true,
      subjectType: true,
      subjectId: true,
      relatedId: true,
      confidence: true,
      signalStrength: true,
      metadata: true,
      occurredAt: true,
    },
    orderBy: { occurredAt: 'desc' },
    take: Math.min(Math.max(options.limit ?? 25, 1), 100),
  });

  return rows
    .map((row) => learningEventToNetworkChange(row))
    .filter((row): row is NetworkChangeEvent => Boolean(row));
}

export async function getProviderCoverageScore(
  providerId: string,
  prismaClient: PrismaClient = prisma,
): Promise<DataCoverageScore> {
  const [claims, findings] = await Promise.all([
    prismaClient.claimRecord.findMany({
      where: { subjectNpi: providerId },
      select: {
        sourceId: true,
        claimType: true,
        observedAt: true,
      },
      orderBy: { observedAt: 'desc' },
      take: 5_000,
    }),
    listInvestigatorFindings({
      provider: providerId,
      limit: 100,
      offset: 0,
    }),
  ]);

  const covered = new Set<string>();
  for (const claim of claims) {
    for (const source of COVERAGE_SOURCES) {
      if (source.match(claim.sourceId, claim.claimType)) {
        covered.add(source.label);
      }
    }
  }

  if (findings.findings.length > 0) {
    covered.add('internal findings');
  }

  const missingSources = COVERAGE_SOURCES
    .map((source) => source.label)
    .filter((source) => !covered.has(source));
  const coverageScore = Math.round((covered.size / COVERAGE_SOURCES.length) * 100);
  const latestObservedAt = claims[0]?.observedAt?.toISOString() ?? new Date().toISOString();
  const recencyBonus = claims[0]
    ? Math.max(0, 1 - ((Date.now() - claims[0].observedAt.getTime()) / (180 * 86_400_000)))
    : 0;

  return {
    coverageScore,
    sourceCount: covered.size,
    missingSources,
    confidence: clamp01(0.35 + Math.min((covered.size / COVERAGE_SOURCES.length) * 0.45, 0.45) + recencyBonus * 0.2),
    coveredSources: [...covered].sort(),
    updatedAt: latestObservedAt,
  };
}

export async function syncSignalCorrelations(
  prismaClient: PrismaClient = prisma,
): Promise<SignalCorrelation[]> {
  const [claims, predictions, networkChanges] = await Promise.all([
    prismaClient.claimRecord.findMany({
      where: {
        claimType: { in: ['NIH_GRANT', 'CLINICAL_TRIAL', 'INDUSTRY_PAYMENT', 'INSTITUTION_AFFILIATION'] },
      },
      select: {
        claimId: true,
        subjectNpi: true,
        claimType: true,
        sourceId: true,
        value: true,
        createdAt: true,
        observedAt: true,
      },
      orderBy: { observedAt: 'desc' },
      take: 6_000,
    }),
    loadStoredPredictions(prismaClient),
    listNetworkChanges({ limit: 100 }, prismaClient),
  ]);

  const recentCutoff = new Date(Date.now() - 180 * 86_400_000);
  const byProvider = new Map<string, ClaimRow[]>();
  for (const claim of claims) {
    if (claim.observedAt < recentCutoff) {
      continue;
    }
    const rows = byProvider.get(claim.subjectNpi) ?? [];
    rows.push({
      claimId: claim.claimId,
      subjectNpi: claim.subjectNpi,
      claimType: claim.claimType,
      sourceId: claim.sourceId,
      value: claim.value,
      createdAt: claim.createdAt,
      observedAt: claim.observedAt,
    });
    byProvider.set(claim.subjectNpi, rows);
  }

  const correlations: SignalCorrelation[] = [];
  for (const [providerId, providerClaims] of byProvider) {
    const claimTypes = new Set(providerClaims.map((claim) => claim.claimType));
    const providerPredictions = predictions.filter((prediction) => prediction.entityType === 'provider' && prediction.entityId === providerId);
    const providerNetworkChanges = networkChanges.filter((change) => change.entityType === 'provider' && change.entityId === providerId);

    if (claimTypes.has('NIH_GRANT') && claimTypes.has('CLINICAL_TRIAL') && claimTypes.has('INDUSTRY_PAYMENT')) {
      const observedAt = providerClaims[0]!.observedAt.toISOString();
      const correlation: SignalCorrelation = {
        id: `cor_${sha256Hex({ providerId, type: 'research_program_expansion' }).slice(0, 20)}`,
        correlationType: 'research_program_expansion',
        entities: [{
          entityType: 'provider',
          entityId: providerId,
        }],
        signals: [
          { signalType: 'grant_award', value: 'NIH_GRANT', source: 'NIH_REPORTER', observedAt },
          { signalType: 'trial_registration', value: 'CLINICAL_TRIAL', source: 'CLINICAL_TRIALS', observedAt },
          { signalType: 'industry_payment', value: 'INDUSTRY_PAYMENT', source: 'OPEN_PAYMENTS', observedAt },
        ],
        explanation: 'Grant, trial, and payment signals all appeared in the same recent window, indicating a deterministic research program expansion pattern.',
        confidence: 0.88,
        observedAt,
      };
      correlations.push(correlation);
    }

    const expansionChanges = providerNetworkChanges.filter((change) =>
      ['new_collaborator', 'trial_network_expansion', 'grant_network_formation'].includes(change.changeType),
    );
    if (expansionChanges.length >= 2 && providerPredictions.some((prediction) => prediction.type === 'PROVIDER_TRAJECTORY' && prediction.state === 'rising')) {
      const observedAt = expansionChanges[0]!.observedAt;
      const correlation: SignalCorrelation = {
        id: `cor_${sha256Hex({ providerId, type: 'collaboration_cluster_formation' }).slice(0, 20)}`,
        correlationType: 'collaboration_cluster_formation',
        entities: [{
          entityType: 'provider',
          entityId: providerId,
          entityLabel: providerPredictions[0]?.entityLabel ?? null,
        }],
        signals: [
          ...expansionChanges.slice(0, 3).map((change) => ({
            signalType: change.changeType,
            value: change.counterpartLabel ?? change.changeType,
            source: 'GRAPH_RUNTIME',
            observedAt: change.observedAt,
          })),
          {
            signalType: 'trajectory',
            value: 'rising',
            source: 'PREDICTION_INSIGHT',
            observedAt: providerPredictions[0]?.updatedAt ?? observedAt,
          },
        ],
        explanation: 'Multiple network-expansion deltas now align with a rising trajectory signal, indicating a collaboration cluster is forming.',
        confidence: clamp01(0.65 + Math.min(expansionChanges.length * 0.05, 0.2)),
        observedAt,
      };
      correlations.push(correlation);
    }
  }

  const institutionPredictions = predictions.filter((prediction) =>
    prediction.entityType === 'institution' && prediction.type === 'INSTITUTION_MOMENTUM' && prediction.state === 'expanding',
  );
  const institutionChangeGroups = new Map<string, NetworkChangeEvent[]>();
  for (const change of networkChanges.filter((entry) => entry.counterpartType === 'institution' && entry.counterpartId)) {
    const institutionId = change.counterpartId!;
    const rows = institutionChangeGroups.get(institutionId) ?? [];
    rows.push(change);
    institutionChangeGroups.set(institutionId, rows);
  }

  for (const prediction of institutionPredictions) {
    const supportingChanges = institutionChangeGroups.get(prediction.entityId) ?? [];
    if (supportingChanges.length < 2) {
      continue;
    }
    const correlation: SignalCorrelation = {
      id: `cor_${sha256Hex({ institutionId: prediction.entityId, type: 'institution_research_acceleration' }).slice(0, 20)}`,
      correlationType: 'institution_research_acceleration',
      entities: [{
        entityType: 'institution',
        entityId: prediction.entityId,
        entityLabel: prediction.entityLabel,
      }],
      signals: [
        {
          signalType: 'institution_momentum',
          value: prediction.state,
          source: 'PREDICTION_INSIGHT',
          observedAt: prediction.updatedAt,
        },
        ...supportingChanges.slice(0, 3).map((change) => ({
          signalType: change.changeType,
          value: change.entityId,
          source: 'GRAPH_RUNTIME',
          observedAt: change.observedAt,
        })),
      ],
      explanation: 'Institution momentum and repeated affiliation/network deltas now reinforce the same research acceleration pattern.',
      confidence: clamp01(0.62 + Math.min(supportingChanges.length * 0.06, 0.18)),
      observedAt: prediction.updatedAt,
    };
    correlations.push(correlation);
  }

  for (const correlation of correlations) {
    await upsertLearningEvent({
      prismaClient,
      eventType: SIGNAL_CORRELATION_EVENT,
      subjectType: correlation.entities[0]?.entityType ?? 'entity',
      subjectId: correlation.entities[0]?.entityId ?? 'unknown',
      occurredAt: correlation.observedAt,
      confidence: correlation.confidence,
      signalStrength: correlation.confidence,
      metadata: {
        correlationType: correlation.correlationType,
        entities: correlation.entities,
        signals: correlation.signals,
        explanation: correlation.explanation,
      },
      dedupeSeed: {
        correlationType: correlation.correlationType,
        entities: correlation.entities.map((entity) => `${entity.entityType}:${entity.entityId}`).sort(),
      },
    });
  }

  return correlations;
}

export async function listSignalCorrelations(
  options: {
    entityType?: string;
    entityId?: string;
    limit?: number;
  } = {},
  prismaClient: PrismaClient = prisma,
): Promise<SignalCorrelation[]> {
  const rows = await prismaClient.learningEvent.findMany({
    where: {
      eventType: SIGNAL_CORRELATION_EVENT,
      ...(options.entityType ? { subjectType: normalizeEntityType(options.entityType) } : {}),
      ...(options.entityId ? { subjectId: options.entityId } : {}),
    },
    select: {
      id: true,
      eventType: true,
      subjectType: true,
      subjectId: true,
      relatedId: true,
      confidence: true,
      signalStrength: true,
      metadata: true,
      occurredAt: true,
    },
    orderBy: { occurredAt: 'desc' },
    take: Math.min(Math.max(options.limit ?? 25, 1), 100),
  });

  return rows
    .map((row) => learningEventToCorrelation(row))
    .filter((row): row is SignalCorrelation => Boolean(row));
}

function predictionFeedItem(prediction: PersistablePredictionInsight): IntelligenceFeedItem {
  return {
    id: `feed:prediction:${prediction.id}`,
    itemType: 'prediction',
    entityType: prediction.entityType,
    entityId: prediction.entityId,
    entityLabel: prediction.entityLabel ?? null,
    title: `${prediction.type.replace(/_/g, ' ')} ${prediction.state.replace(/_/g, ' ')}`,
    summary: prediction.summary,
    confidence: prediction.confidence,
    severity: prediction.type === 'TRUST_RISK_ACCELERATION'
      ? prediction.state === 'accelerating'
        ? 'high'
        : 'medium'
      : prediction.type === 'SPECIALTY_PRESSURE'
        ? prediction.state === 'severe'
          ? 'high'
          : 'medium'
        : 'info',
    timestamp: prediction.updatedAt,
    sources: [...new Set(prediction.signals.map((signal) => signal.source).filter(Boolean))],
    metadata: {
      predictionId: prediction.id,
      predictionType: prediction.type,
      state: prediction.state,
      score: prediction.score,
    },
  };
}

export async function listIntelligenceFeed(
  options: {
    entityType?: string;
    entityId?: string;
    limit?: number;
  } = {},
  prismaClient: PrismaClient = prisma,
): Promise<IntelligenceFeedItem[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 150);
  const [predictions, findings, storylines, networkChanges, correlations] = await Promise.all([
    loadStoredPredictions(prismaClient, {
      entityType: options.entityType,
      entityId: options.entityId,
    }),
    listInvestigatorFindings({
      provider: options.entityType === 'provider' ? options.entityId : undefined,
      institution: options.entityType === 'institution' ? options.entityId : undefined,
      limit,
      offset: 0,
    }),
    listStorylines({
      provider: options.entityType === 'provider' ? options.entityId ?? undefined : undefined,
      institution: options.entityType === 'institution' ? options.entityId ?? undefined : undefined,
      limit,
      sync: false,
    }),
    listNetworkChanges({
      entityType: options.entityType,
      entityId: options.entityId,
      limit,
    }, prismaClient),
    listSignalCorrelations({
      entityType: options.entityType,
      entityId: options.entityId,
      limit,
    }, prismaClient),
  ]);

  const feed: IntelligenceFeedItem[] = [];

  for (const finding of findings.findings) {
    const entityId = finding.entityIds[0] ?? 'unknown';
    feed.push({
      id: `feed:finding:${finding.findingId}`,
      itemType: 'finding',
      entityType: finding.scope,
      entityId,
      entityLabel: null,
      title: finding.title,
      summary: finding.summary,
      confidence: finding.confidence,
      severity: normalizeFeedSeverity(finding.severity),
      timestamp: finding.lastSeenAt,
      sources: finding.supportingEvidence
        .map((evidence) => evidence.sourceId)
        .filter((source): source is string => typeof source === 'string' && source.length > 0),
      metadata: {
        findingId: finding.findingId,
        findingType: finding.findingType,
        status: finding.status,
      },
    });
  }

  for (const storyline of storylines.storylines) {
    feed.push({
      id: `feed:storyline:${storyline.storylineId}`,
      itemType: 'storyline',
      entityType: storyline.perspective,
      entityId: storyline.entityIds[0] ?? storyline.storylineId,
      entityLabel: null,
      title: storyline.title,
      summary: storyline.summary,
      confidence: storyline.confidence,
      severity: normalizeFeedSeverity(storyline.severity),
      timestamp: storyline.updatedAt,
      sources: storyline.supportingEvidence
        .map((evidence) => evidence.source)
        .filter((source): source is string => typeof source === 'string' && source.length > 0),
      metadata: {
        storylineId: storyline.storylineId,
        storylineType: storyline.storylineType,
      },
    });
  }

  feed.push(...predictions.map((prediction) => predictionFeedItem(prediction)));

  for (const change of networkChanges) {
    feed.push({
      id: `feed:network:${change.id}`,
      itemType: 'network_change',
      entityType: change.entityType,
      entityId: change.entityId,
      entityLabel: change.entityLabel,
      title: change.changeType.replace(/_/g, ' '),
      summary: change.explanation,
      confidence: change.confidence,
      severity: change.changeType === 'lost_collaborator' ? 'medium' : 'info',
      timestamp: change.observedAt,
      sources: [...new Set(change.supportingSignals.map((signal) => signal.source))],
      metadata: {
        counterpartType: change.counterpartType,
        counterpartId: change.counterpartId,
        counterpartLabel: change.counterpartLabel,
      },
    });
  }

  for (const correlation of correlations) {
    feed.push({
      id: `feed:correlation:${correlation.id}`,
      itemType: 'correlation',
      entityType: correlation.entities[0]?.entityType ?? 'entity',
      entityId: correlation.entities[0]?.entityId ?? 'unknown',
      entityLabel: correlation.entities[0]?.entityLabel ?? null,
      title: correlation.correlationType.replace(/_/g, ' '),
      summary: correlation.explanation,
      confidence: correlation.confidence,
      severity: correlation.confidence >= 0.8 ? 'high' : 'medium',
      timestamp: correlation.observedAt,
      sources: [...new Set(correlation.signals.map((signal) => signal.source))],
      metadata: {
        entities: correlation.entities,
      },
    });
  }

  return feed
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp) || right.confidence - left.confidence)
    .slice(0, limit);
}

function feedMatchesWatch(
  item: IntelligenceFeedItem,
  watch: IntelligenceWatchRecord,
): boolean {
  if (watch.targetType === 'provider') {
    return item.entityType === 'provider' && item.entityId === watch.targetValue;
  }
  if (watch.targetType === 'institution') {
    return (
      (item.entityType === 'institution' && item.entityId === watch.targetValue)
      || asString(asRecord(item.metadata).counterpartId) === watch.targetValue
    );
  }
  if (watch.targetType === 'specialty') {
    return (
      item.entityType === 'specialty' && item.entityId === watch.targetValue
    ) || asString(asRecord(item.metadata).specialty) === watch.targetValue;
  }

  const members = asStringArray(asRecord(item.metadata).clusterMembers);
  return members.includes(watch.targetValue) || item.entityId === watch.targetValue;
}

export async function listIntelligenceWatches(
  prismaClient: PrismaClient = prisma,
): Promise<IntelligenceWatchRecord[]> {
  const rows = await prismaClient.watchlist.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return rows
    .map((row) => watchRowToRecord({
      id: row.id,
      name: row.name,
      ownerOrganizationId: row.ownerOrganizationId,
      targetType: row.targetType,
      targetValue: row.targetValue,
      active: row.active,
      metadata: row.metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))
    .filter((watch) =>
      ['provider', 'institution', 'specialty', 'network_cluster'].includes(watch.targetType),
    );
}

export async function createIntelligenceWatch(
  input: {
    name?: string;
    ownerOrganizationId?: string | null;
    targetType: IntelligenceWatchTargetType;
    targetValue: string;
    subscribedSignals?: string[];
  },
  prismaClient: PrismaClient = prisma,
): Promise<IntelligenceWatchRecord> {
  const normalizedTargetValue = input.targetType === 'provider'
    ? input.targetValue.trim()
    : slugify(input.targetValue);
  const subscribedSignals = input.subscribedSignals?.length
    ? [...new Set(input.subscribedSignals.map((entry) => entry.trim()).filter(Boolean))]
    : watchSubscribedSignals(input.targetType);
  const name = input.name?.trim().length
    ? input.name.trim()
    : `Watch ${input.targetType.replace(/_/g, ' ')} ${normalizedTargetValue}`;
  const targetType = input.targetType === 'provider'
    ? 'PROVIDER'
    : input.targetType === 'institution'
      ? 'INSTITUTION'
      : WATCHLIST_FALLBACK_TARGET_TYPE;
  const dedupeKey = sha256Hex({
    targetType: input.targetType,
    targetValue: normalizedTargetValue,
    ownerOrganizationId: input.ownerOrganizationId ?? null,
  });

  const row = await prismaClient.watchlist.upsert({
    where: { dedupeKey },
    update: {
      name,
      ownerOrganizationId: input.ownerOrganizationId ?? null,
      active: true,
      metadata: toJsonValue({
        watchTargetType: input.targetType,
        subscribedSignals,
      }),
    },
    create: {
      // watchlists.id has no DB default despite the schema's
      // dbgenerated(gen_random_uuid()) (verified in prod 2026-07-05) —
      // supply the id client-side or the insert throws P2011.
      id: randomUUID(),
      dedupeKey,
      name,
      ownerOrganizationId: input.ownerOrganizationId ?? null,
      targetType,
      targetValue: normalizedTargetValue,
      active: true,
      metadata: toJsonValue({
        watchTargetType: input.targetType,
        subscribedSignals,
      }),
    },
  });

  return watchRowToRecord({
    id: row.id,
    name: row.name,
    ownerOrganizationId: row.ownerOrganizationId,
    targetType: row.targetType,
    targetValue: row.targetValue,
    active: row.active,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export async function getIntelligenceWatch(
  watchId: string,
  prismaClient: PrismaClient = prisma,
): Promise<IntelligenceWatchDetail | null> {
  const row = await prismaClient.watchlist.findUnique({
    where: { id: watchId },
  });
  if (!row) {
    return null;
  }

  const watch = watchRowToRecord({
    id: row.id,
    name: row.name,
    ownerOrganizationId: row.ownerOrganizationId,
    targetType: row.targetType,
    targetValue: row.targetValue,
    active: row.active,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  const feed = await listIntelligenceFeed({
    entityType: watch.targetType === 'provider' || watch.targetType === 'institution' ? watch.targetType : undefined,
    entityId: watch.targetType === 'provider' || watch.targetType === 'institution' ? watch.targetValue : undefined,
    limit: 80,
  }, prismaClient);
  const alerts = feed.filter((item) => feedMatchesWatch(item, watch)).slice(0, 30);
  const earlyWarnings = watch.targetType === 'provider'
    ? await listSignalHistory({
      entityType: 'provider',
      entityId: watch.targetValue,
      signalType: 'early_warning',
      limit: 12,
    }, prismaClient)
    : [];

  return {
    ...watch,
    alerts,
    earlyWarnings,
  };
}

export async function deleteIntelligenceWatch(
  watchId: string,
  prismaClient: PrismaClient = prisma,
): Promise<boolean> {
  const existing = await prismaClient.watchlist.findUnique({
    where: { id: watchId },
    select: { id: true },
  });
  if (!existing) {
    return false;
  }

  await prismaClient.watchlist.update({
    where: { id: watchId },
    data: { active: false },
  });
  return true;
}

export async function buildPredictionSurfaceForEntity(
  entityType: 'provider' | 'institution' | 'specialty',
  entityId: string,
  prismaClient: PrismaClient = prisma,
): Promise<{
  predictions: PersistablePredictionInsight[];
  trajectories: TrajectoryDetection[];
  networkChanges: NetworkChangeEvent[];
  correlations: SignalCorrelation[];
  signalHistory: SignalHistoryPoint[];
  coverage: DataCoverageScore | null;
}> {
  const predictions = await loadStoredPredictions(prismaClient, {
    entityType,
    entityId,
  });

  const [networkChanges, correlations, signalHistory] = await Promise.all([
    listNetworkChanges({ entityType, entityId, limit: 20 }, prismaClient),
    listSignalCorrelations({ entityType, entityId, limit: 20 }, prismaClient),
    listSignalHistory({ entityType, entityId, limit: 24 }, prismaClient),
  ]);
  const trajectories = entityType === 'provider'
    ? await detectProviderTrajectories(entityId, prismaClient)
    : [];
  const coverage = entityType === 'provider'
    ? await getProviderCoverageScore(entityId, prismaClient)
    : null;

  return {
    predictions,
    trajectories,
    networkChanges,
    correlations,
    signalHistory,
    coverage,
  };
}
