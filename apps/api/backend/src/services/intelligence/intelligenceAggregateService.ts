import prisma from '../../graphql/prisma_client';
import {
  institutionInsightToSignal,
  predictionToSignal,
  providerInsightToInfluenceSignal,
  providerInsightToTrajectorySignal,
  specialtyInsightToSignal,
  trustScoreToSignal,
} from './intelligenceAdapters';
import { listEarlyWarningSignals } from './earlyWarningService';
import { listIntelligenceFeed } from './intelligenceFeedService';
import {
  listInstitutionInsights,
  listProviderInsights,
  listSpecialtyInsights,
} from './providerIntelligenceService';
import { computeTrustScoreV1 } from '../trust/trustScoreV1';
import {
  listPredictionInsights,
  type StoredPredictionInsight,
} from '../predictions/predictionEngineService';
import { listActionRecommendations } from '../actions/actionEngineService';
import {
  buildExplainableIntelligence,
  dedupeStrings,
  normalizeDriver,
  normalizeSourceSignal,
  stableIntelligenceId,
  type ExplainableIntelligenceOutput,
  type IntelligenceEntityRef,
  type IntelligenceFeedItem,
} from './intelligenceDomain';

type TrustHistoryRow = {
  subjectId: string;
  newScore: number;
  confidence: number | null;
  band: string | null;
  metadata: Record<string, unknown>;
  recordedAt: Date;
};

export interface ProviderIntelligenceAggregate {
  generatedAt: string;
  entity: IntelligenceEntityRef;
  trustScore: ExplainableIntelligenceOutput | null;
  influenceScore: ExplainableIntelligenceOutput | null;
  trajectorySignals: ExplainableIntelligenceOutput[];
  recentWarnings: ExplainableIntelligenceOutput[];
  recentFeed: IntelligenceFeedItem[];
  recentFindings: IntelligenceFeedItem[];
  recentStorylines: IntelligenceFeedItem[];
  recommendedWatchItems: string[];
}

export interface InstitutionIntelligenceAggregate {
  generatedAt: string;
  entity: IntelligenceEntityRef;
  momentumSignals: ExplainableIntelligenceOutput[];
  recentWarnings: ExplainableIntelligenceOutput[];
  recentFeed: IntelligenceFeedItem[];
  recommendedWatchItems: string[];
}

export interface SpecialtyIntelligenceAggregate {
  generatedAt: string;
  entity: IntelligenceEntityRef;
  pressureSignals: ExplainableIntelligenceOutput[];
  recentWarnings: ExplainableIntelligenceOutput[];
  recentFeed: IntelligenceFeedItem[];
  recommendedWatchItems: string[];
}

export interface NetworkIntelligenceAggregate {
  generatedAt: string;
  entity: IntelligenceEntityRef;
  networkSignals: ExplainableIntelligenceOutput[];
  recentWarnings: ExplainableIntelligenceOutput[];
  recentFeed: IntelligenceFeedItem[];
  recommendedWatchItems: string[];
}

function toEntity(entityType: string, entityId: string, entityLabel?: string | null): IntelligenceEntityRef {
  return {
    entityType,
    entityId,
    entityLabel: entityLabel ?? entityId,
  };
}

function signalEntityLabel(signal: ExplainableIntelligenceOutput | null, fallbackId: string): string {
  return signal?.entityLabel ?? fallbackId;
}

function trustHistoryToSignal(row: TrustHistoryRow): ExplainableIntelligenceOutput {
  const metadata = row.metadata ?? {};
  const dimensionScores = metadata.dimensionScores && typeof metadata.dimensionScores === 'object' && !Array.isArray(metadata.dimensionScores)
    ? metadata.dimensionScores as Record<string, { score?: unknown; max?: unknown; status?: unknown }>
    : {};
  const trustLimits = Array.isArray(metadata.trustLimits)
    ? metadata.trustLimits.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const gaps = Array.isArray(metadata.gaps)
    ? metadata.gaps.filter((entry): entry is string => typeof entry === 'string')
    : [];

  return buildExplainableIntelligence({
    id: stableIntelligenceId('trust_score', row.subjectId, row.recordedAt.toISOString()),
    type: 'trust_score',
    entity: {
      entityType: 'provider',
      entityId: row.subjectId,
      entityLabel: `Provider ${row.subjectId}`,
    },
    state: (row.band ?? 'unknown').toLowerCase(),
    score: row.newScore,
    confidence: row.confidence ?? 0.6,
    explanation: {
      summary: `Trust score is ${row.newScore}/100${row.band ? ` (${row.band})` : ''}.`,
      details: [...gaps, ...trustLimits].slice(0, 5),
      insufficientSignal: Object.keys(dimensionScores).length === 0,
    },
    drivers: Object.entries(dimensionScores).map(([dimension, value]) => normalizeDriver({
      key: dimension,
      value: typeof value.score === 'number' ? value.score : null,
      direction: 'FLAT',
      importance: typeof value.max === 'number' && value.max > 0 && typeof value.score === 'number'
        ? value.score / value.max
        : 0.4,
      source: 'TRUST_SCORE_HISTORY',
      observedAt: row.recordedAt,
      explanation: typeof value.status === 'string'
        ? `${dimension} status is ${value.status}.`
        : `${dimension} contributes to trust score.`,
    })),
    sourceSignals: Object.entries(dimensionScores).map(([dimension, value]) => normalizeSourceSignal({
      id: stableIntelligenceId('trust_dimension', row.subjectId, dimension),
      type: 'trust_dimension',
      label: dimension,
      value: typeof value.score === 'number' ? value.score : null,
      source: 'TRUST_SCORE_HISTORY',
      confidence: row.confidence ?? null,
      observedAt: row.recordedAt,
      metadata: {
        max: value.max,
        status: value.status,
      },
    })),
    lastUpdated: row.recordedAt,
    metadata: {
      band: row.band,
    },
  });
}

async function loadLatestTrustSignals(limit = 25): Promise<ExplainableIntelligenceOutput[]> {
  const rows = await prisma.trustScoreHistory.findMany({
    where: {
      subjectType: { in: ['NPI', 'PROVIDER', 'CLINICIAN'] },
    },
    select: {
      subjectId: true,
      newScore: true,
      confidence: true,
      band: true,
      metadata: true,
      recordedAt: true,
    },
    orderBy: [
      { subjectId: 'asc' },
      { recordedAt: 'desc' },
    ],
    take: Math.max(limit * 8, 200),
  });

  const latestBySubject = new Map<string, TrustHistoryRow>();
  for (const row of rows) {
    if (!latestBySubject.has(row.subjectId)) {
      latestBySubject.set(row.subjectId, {
        subjectId: row.subjectId,
        newScore: row.newScore,
        confidence: row.confidence,
        band: row.band,
        metadata: (row.metadata ?? {}) as Record<string, unknown>,
        recordedAt: row.recordedAt,
      });
    }
  }

  return [...latestBySubject.values()]
    .map((row) => trustHistoryToSignal(row))
    .sort((left, right) => right.score - left.score || right.confidence.score - left.confidence.score)
    .slice(0, limit);
}

function predictionSignalsForEntity(
  predictions: StoredPredictionInsight[],
): ExplainableIntelligenceOutput[] {
  return predictions.map((prediction) => predictionToSignal(prediction));
}

function feedByType(feed: IntelligenceFeedItem[], type: string): IntelligenceFeedItem[] {
  return feed.filter((item) => item.type === type);
}

async function recommendedWatchItems(
  entityId: string,
  feed: IntelligenceFeedItem[],
): Promise<string[]> {
  const actions = await listActionRecommendations({
    entity: entityId,
    limit: 6,
    offset: 0,
  });

  return dedupeStrings([
    ...actions.actions.map((action) => action.recommendedAction),
    ...feed
      .filter((item) => item.type === 'early_warning')
      .slice(0, 3)
      .map((item) => item.summary),
  ]).slice(0, 6);
}

export async function listTopTrustSignals(limit = 10): Promise<ExplainableIntelligenceOutput[]> {
  return loadLatestTrustSignals(limit);
}

export async function listTopInfluenceSignals(limit = 10): Promise<ExplainableIntelligenceOutput[]> {
  const [providerInsights, findings] = await Promise.all([
    listProviderInsights({ sync: false, limit: Math.max(limit, 25) }),
    listIntelligenceFeed({ includeTypes: ['finding'], limit: 200 }),
  ]);

  const findingTypesByProvider = new Map<string, string[]>();
  for (const item of findings.items) {
    const providerRef = item.entityRefs.find((ref) => ref.entityType === 'provider');
    if (!providerRef) {
      continue;
    }
    const bucket = findingTypesByProvider.get(providerRef.entityId) ?? [];
    const findingType = typeof item.metadata.findingType === 'string' ? item.metadata.findingType : null;
    if (findingType) {
      bucket.push(findingType);
    }
    findingTypesByProvider.set(providerRef.entityId, bucket);
  }

  return providerInsights.insights
    .map((insight) => providerInsightToInfluenceSignal(
      insight,
      findingTypesByProvider.get(insight.entity.entityId) ?? [],
    ))
    .sort((left, right) => right.score - left.score || right.confidence.score - left.confidence.score)
    .slice(0, limit);
}

export async function listProviderTrajectorySignals(limit = 10): Promise<ExplainableIntelligenceOutput[]> {
  const providerInsights = await listProviderInsights({ sync: false, limit: Math.max(limit, 25) });
  return providerInsights.insights
    .map((insight) => providerInsightToTrajectorySignal(insight))
    .sort((left, right) => right.score - left.score || right.confidence.score - left.confidence.score)
    .slice(0, limit);
}

export async function listPressureSignals(limit = 10): Promise<ExplainableIntelligenceOutput[]> {
  const specialtyInsights = await listSpecialtyInsights({ sync: false, limit: Math.max(limit, 25) });
  return specialtyInsights.insights
    .map((insight) => specialtyInsightToSignal(insight))
    .sort((left, right) => right.score - left.score || right.confidence.score - left.confidence.score)
    .slice(0, limit);
}

export async function listInstitutionMomentumSignals(limit = 10): Promise<ExplainableIntelligenceOutput[]> {
  const institutionInsights = await listInstitutionInsights({ sync: false, limit: Math.max(limit, 25) });
  return institutionInsights.insights
    .map((insight) => institutionInsightToSignal(insight))
    .sort((left, right) => right.score - left.score || right.confidence.score - left.confidence.score)
    .slice(0, limit);
}

export async function listRecentNetworkChangeSignals(limit = 10): Promise<ExplainableIntelligenceOutput[]> {
  const result = await listPredictionInsights({
    type: 'NETWORK_SHIFT',
    limit: Math.max(limit, 25),
    offset: 0,
    sync: false,
  });

  return predictionSignalsForEntity(result.predictions)
    .sort((left, right) => Date.parse(right.lastUpdated) - Date.parse(left.lastUpdated))
    .slice(0, limit);
}

export async function buildProviderIntelligenceAggregate(
  npi: string,
): Promise<ProviderIntelligenceAggregate> {
  const generatedAt = new Date().toISOString();
  const [trustScore, providerInsights, predictions, warnings, feed] = await Promise.all([
    computeTrustScoreV1(npi).catch(() => null),
    listProviderInsights({ sync: false, limit: 200 }),
    listPredictionInsights({
      entityType: 'provider',
      entityId: npi,
      limit: 25,
      offset: 0,
      sync: false,
    }),
    listEarlyWarningSignals({ entityType: 'provider', entityId: npi, limit: 6 }),
    listIntelligenceFeed({ entityType: 'provider', entityId: npi, limit: 24 }),
  ]);

  const providerInsight = providerInsights.insights.find((insight) => insight.entity.entityId === npi) ?? null;
  const findingTypes = feed.items
    .filter((item) => item.type === 'finding')
    .map((item) => (typeof item.metadata.findingType === 'string' ? item.metadata.findingType : null))
    .filter((item): item is string => Boolean(item));
  const trustSignal = trustScore ? trustScoreToSignal(trustScore) : null;
  const influenceSignal = providerInsight
    ? providerInsightToInfluenceSignal(providerInsight, findingTypes)
    : null;
  const entity = toEntity('provider', npi, signalEntityLabel(influenceSignal ?? trustSignal, npi));
  const watchItems = await recommendedWatchItems(npi, feed.items);

  return {
    generatedAt,
    entity,
    trustScore: trustSignal,
    influenceScore: influenceSignal,
    trajectorySignals: predictionSignalsForEntity(predictions.predictions),
    recentWarnings: warnings,
    recentFeed: feed.items,
    recentFindings: feedByType(feed.items, 'finding').slice(0, 6),
    recentStorylines: feedByType(feed.items, 'storyline').slice(0, 6),
    recommendedWatchItems: watchItems,
  };
}

export async function buildInstitutionIntelligenceAggregate(
  institutionId: string,
): Promise<InstitutionIntelligenceAggregate> {
  const generatedAt = new Date().toISOString();
  const [signals, warnings, feed] = await Promise.all([
    listPredictionInsights({
      entityType: 'institution',
      entityId: institutionId,
      limit: 25,
      offset: 0,
      sync: false,
    }),
    listEarlyWarningSignals({ entityType: 'institution', entityId: institutionId, limit: 6 }),
    listIntelligenceFeed({ entityType: 'institution', entityId: institutionId, limit: 24 }),
  ]);

  const momentumSignals = predictionSignalsForEntity(signals.predictions);
  const entity = toEntity(
    'institution',
    institutionId,
    momentumSignals[0]?.entityLabel ?? institutionId,
  );
  const watchItems = await recommendedWatchItems(institutionId, feed.items);

  return {
    generatedAt,
    entity,
    momentumSignals,
    recentWarnings: warnings,
    recentFeed: feed.items,
    recommendedWatchItems: watchItems,
  };
}

export async function buildSpecialtyIntelligenceAggregate(
  specialtyId: string,
): Promise<SpecialtyIntelligenceAggregate> {
  const generatedAt = new Date().toISOString();
  const [signals, warnings, feed] = await Promise.all([
    listPredictionInsights({
      entityType: 'specialty',
      entityId: specialtyId,
      limit: 25,
      offset: 0,
      sync: false,
    }),
    listEarlyWarningSignals({ entityType: 'specialty', entityId: specialtyId, limit: 6 }),
    listIntelligenceFeed({ entityType: 'specialty', entityId: specialtyId, limit: 24 }),
  ]);

  const pressureSignals = predictionSignalsForEntity(signals.predictions);
  const entity = toEntity(
    'specialty',
    specialtyId,
    pressureSignals[0]?.entityLabel ?? specialtyId,
  );
  const watchItems = await recommendedWatchItems(specialtyId, feed.items);

  return {
    generatedAt,
    entity,
    pressureSignals,
    recentWarnings: warnings,
    recentFeed: feed.items,
    recommendedWatchItems: watchItems,
  };
}

export async function buildNetworkIntelligenceAggregate(
  entityId: string,
): Promise<NetworkIntelligenceAggregate> {
  const generatedAt = new Date().toISOString();
  const [signals, warnings, feed] = await Promise.all([
    listPredictionInsights({
      type: 'NETWORK_SHIFT',
      entityId,
      limit: 25,
      offset: 0,
      sync: false,
    }),
    listEarlyWarningSignals({ entityType: 'network', entityId, limit: 6 }),
    listIntelligenceFeed({ entityType: 'network', entityId, limit: 24 }),
  ]);

  const networkSignals = predictionSignalsForEntity(signals.predictions);
  const entity = toEntity(
    'network',
    entityId,
    networkSignals[0]?.entityLabel ?? entityId,
  );
  const watchItems = await recommendedWatchItems(entityId, feed.items);

  return {
    generatedAt,
    entity,
    networkSignals,
    recentWarnings: warnings,
    recentFeed: feed.items,
    recommendedWatchItems: watchItems,
  };
}
