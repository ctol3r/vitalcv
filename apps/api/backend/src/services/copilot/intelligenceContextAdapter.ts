import type {
  CopilotExplanation,
  CopilotGraphInsight,
  CopilotMatch,
  CopilotQueryResponse,
  CopilotResult,
  PreparedCopilotQuery,
} from '../../../../../../core/copilot/copilotEngine';
import {
  buildInstitutionIntelligenceAggregate,
  buildNetworkIntelligenceAggregate,
  buildProviderIntelligenceAggregate,
  buildSpecialtyIntelligenceAggregate,
  listInstitutionMomentumSignals,
  listPressureSignals,
  listProviderTrajectorySignals,
  listRecentNetworkChangeSignals,
  listTopInfluenceSignals,
  listTopTrustSignals,
} from '../intelligence/intelligenceAggregateService';
import { listEarlyWarningSignals } from '../intelligence/earlyWarningService';
import {
  clamp01,
  type ExplainableIntelligenceOutput,
  type IntelligenceFeedItem,
} from '../intelligence/intelligenceDomain';

type CopilotIntelligenceMode =
  | 'TOP_TRUST'
  | 'TOP_INFLUENCE'
  | 'RISING_PROVIDERS'
  | 'SPECIALTY_PRESSURE'
  | 'INSTITUTION_MOMENTUM'
  | 'NETWORK_CHANGES'
  | 'EARLY_WARNINGS';

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function detectMode(preparedQuery: PreparedCopilotQuery): CopilotIntelligenceMode | null {
  const raw = normalizeText(preparedQuery.parsedQuery.rawQuery);

  if (/\b(trust|trusted|highest trust|top trust|best trusted)\b/.test(raw)) {
    return 'TOP_TRUST';
  }
  if (/\b(highest influence|most influential|influence|hub providers?|influential providers?)\b/.test(raw)) {
    return 'TOP_INFLUENCE';
  }
  if (/\b(rising providers?|rising fastest|trajectory|top rising)\b/.test(raw)) {
    return 'RISING_PROVIDERS';
  }
  if (/\b(severe pressure|pressure specialties|highest pressure|workforce pressure|shortage specialties)\b/.test(raw)) {
    return 'SPECIALTY_PRESSURE';
  }
  if (/\b(expanding institutions?|institution momentum|which institutions are expanding|gained momentum)\b/.test(raw)) {
    return 'INSTITUTION_MOMENTUM';
  }
  if (/\b(network changes?|recent network changes?|collaboration changes?|network shift)\b/.test(raw)) {
    return 'NETWORK_CHANGES';
  }
  if (/\b(early warnings?|warning signals?|recent warnings?)\b/.test(raw)) {
    return 'EARLY_WARNINGS';
  }

  return null;
}

function resultType(signal: ExplainableIntelligenceOutput): CopilotResult['type'] {
  if (signal.entityType === 'provider') {
    return 'CLINICIAN';
  }
  if (signal.entityType === 'institution') {
    return 'ORGANIZATION';
  }
  return 'DOCUMENT';
}

function freshnessScore(lastUpdated: string): number {
  const ageDays = Math.max(0, (Date.now() - Date.parse(lastUpdated)) / 86_400_000);
  if (ageDays <= 7) {
    return 1;
  }
  if (ageDays <= 30) {
    return 0.8;
  }
  if (ageDays <= 90) {
    return 0.55;
  }
  return 0.25;
}

function coverageScore(signal: ExplainableIntelligenceOutput): number {
  return clamp01(signal.sourceSignals.length / 5);
}

function toResult(
  signal: ExplainableIntelligenceOutput,
  feed: IntelligenceFeedItem[],
  rank: number,
): CopilotResult {
  const relevance = clamp01(signal.score / 100);
  const trustScore = signal.type === 'trust_score'
    ? relevance
    : clamp01(signal.confidence.score * 0.8);
  const freshness = freshnessScore(signal.lastUpdated);
  const sourceCoverage = coverageScore(signal);
  const total = clamp01(
    (relevance * 0.42)
      + (trustScore * 0.18)
      + (freshness * 0.18)
      + (sourceCoverage * 0.22),
  );
  const recentFeed = feed[0];

  return {
    id: `${signal.entityType}:${signal.entityId}:${signal.type}`,
    rank,
    type: resultType(signal),
    title: signal.entityLabel ?? signal.entityId,
    subtitle: `${signal.type.replace(/_/g, ' ')} · ${signal.state}`,
    summary: recentFeed
      ? `${signal.explanation.summary} Recent context: ${recentFeed.headline}.`
      : signal.explanation.summary,
    specialty: signal.entityType === 'specialty' ? signal.entityLabel ?? signal.entityId : undefined,
    institution: signal.entityType === 'institution' ? signal.entityLabel ?? signal.entityId : undefined,
    trustScore: signal.type === 'trust_score' ? signal.score : undefined,
    trustBand: signal.type === 'trust_score' ? signal.state.toUpperCase() : undefined,
    scores: {
      relevance,
      trustScore,
      freshness,
      sourceCoverage,
      total,
    },
    sourceCoverage: [...new Set(signal.sourceSignals.map((source) => source.source).filter((value): value is string => Boolean(value)))],
  };
}

function toExplanation(
  signal: ExplainableIntelligenceOutput,
  feed: IntelligenceFeedItem[],
  resultId: string,
): CopilotExplanation {
  const matchedFilters: CopilotMatch[] = [{
    field: 'keyword',
    value: signal.state,
    reason: `state matched ${signal.state}`,
  }];

  return {
    resultId,
    title: signal.entityLabel ?? signal.entityId,
    summary: signal.explanation.summary,
    because: [
      ...signal.drivers.slice(0, 3).map((driver) => driver.explanation),
      ...signal.sourceSignals.slice(0, 2).map((source) => `${source.label} = ${String(source.value)}`),
      ...feed.slice(0, 2).map((item) => `feed: ${item.headline}`),
    ].slice(0, 5),
    matchedFilters,
    verifiedSources: [...new Set(signal.sourceSignals.map((source) => source.source).filter((value): value is string => Boolean(value)))],
    scoring: {
      relevance: clamp01(signal.score / 100),
      trustScore: signal.type === 'trust_score' ? clamp01(signal.score / 100) : clamp01(signal.confidence.score * 0.8),
      freshness: freshnessScore(signal.lastUpdated),
      sourceCoverage: coverageScore(signal),
      total: clamp01(
        (clamp01(signal.score / 100) * 0.42)
          + ((signal.type === 'trust_score' ? clamp01(signal.score / 100) : clamp01(signal.confidence.score * 0.8)) * 0.18)
          + (freshnessScore(signal.lastUpdated) * 0.18)
          + (coverageScore(signal) * 0.22),
      ),
    },
  };
}

function graphInsightType(signal: ExplainableIntelligenceOutput): CopilotGraphInsight['type'] {
  switch (signal.type) {
    case 'influence_score':
      return 'PUBLICATION_NETWORK';
    case 'institution_momentum':
      return 'INSTITUTION_CONNECTION';
    case 'workforce_pressure':
      return 'SOURCE_COVERAGE';
    case 'early_warning':
      return 'SOURCE_COVERAGE';
    case 'network_shift':
      return 'COLLABORATOR';
    default:
      return 'SOURCE_COVERAGE';
  }
}

function toGraphInsight(
  signal: ExplainableIntelligenceOutput,
  feed: IntelligenceFeedItem[],
  resultId: string,
): CopilotGraphInsight {
  return {
    resultId,
    type: graphInsightType(signal),
    summary: feed[0]
      ? `${signal.entityLabel ?? signal.entityId} links to ${feed[0].headline} in the current intelligence feed.`
      : `${signal.entityLabel ?? signal.entityId} is supported by ${signal.sourceSignals.length} normalized source signal(s).`,
    path: [
      signal.entityLabel ?? signal.entityId,
      signal.type.replace(/_/g, ' '),
      ...feed.slice(0, 2).map((item) => item.headline),
    ],
    depth: 1,
  };
}

async function loadSignalsForMode(
  mode: CopilotIntelligenceMode,
  limit: number,
): Promise<Array<{ signal: ExplainableIntelligenceOutput; feed: IntelligenceFeedItem[] }>> {
  switch (mode) {
    case 'TOP_TRUST': {
      const signals = await listTopTrustSignals(limit);
      return Promise.all(signals.map(async (signal) => ({
        signal,
        feed: (await buildProviderIntelligenceAggregate(signal.entityId)).recentFeed.slice(0, 3),
      })));
    }
    case 'TOP_INFLUENCE': {
      const signals = await listTopInfluenceSignals(limit);
      return Promise.all(signals.map(async (signal) => ({
        signal,
        feed: (await buildProviderIntelligenceAggregate(signal.entityId)).recentFeed.slice(0, 3),
      })));
    }
    case 'RISING_PROVIDERS': {
      const signals = await listProviderTrajectorySignals(limit);
      return Promise.all(signals.map(async (signal) => ({
        signal,
        feed: (await buildProviderIntelligenceAggregate(signal.entityId)).recentFeed.slice(0, 3),
      })));
    }
    case 'SPECIALTY_PRESSURE': {
      const signals = await listPressureSignals(limit);
      return Promise.all(signals.map(async (signal) => ({
        signal,
        feed: (await buildSpecialtyIntelligenceAggregate(signal.entityId)).recentFeed.slice(0, 3),
      })));
    }
    case 'INSTITUTION_MOMENTUM': {
      const signals = await listInstitutionMomentumSignals(limit);
      return Promise.all(signals.map(async (signal) => ({
        signal,
        feed: (await buildInstitutionIntelligenceAggregate(signal.entityId)).recentFeed.slice(0, 3),
      })));
    }
    case 'NETWORK_CHANGES': {
      const signals = await listRecentNetworkChangeSignals(limit);
      return Promise.all(signals.map(async (signal) => ({
        signal,
        feed: (await buildNetworkIntelligenceAggregate(signal.entityId)).recentFeed.slice(0, 3),
      })));
    }
    case 'EARLY_WARNINGS': {
      const signals = await listEarlyWarningSignals({ limit });
      return Promise.all(signals.map(async (signal) => {
        const feed = signal.entityType === 'provider'
          ? (await buildProviderIntelligenceAggregate(signal.entityId)).recentFeed.slice(0, 3)
          : signal.entityType === 'institution'
            ? (await buildInstitutionIntelligenceAggregate(signal.entityId)).recentFeed.slice(0, 3)
            : [];
        return { signal, feed };
      }));
    }
  }
}

export async function maybeExecuteIntelligenceContextQuery(
  preparedQuery: PreparedCopilotQuery,
  limit: number,
): Promise<CopilotQueryResponse | null> {
  const mode = detectMode(preparedQuery);
  if (!mode) {
    return null;
  }

  const resultsWithFeed = await loadSignalsForMode(mode, limit);
  if (resultsWithFeed.length === 0) {
    return null;
  }

  const results = resultsWithFeed.map(({ signal, feed }, index) => toResult(signal, feed, index + 1));
  const explanations = resultsWithFeed.map(({ signal, feed }, index) => (
    toExplanation(signal, feed, results[index]!.id)
  ));
  const graphInsights = resultsWithFeed.map(({ signal, feed }, index) => (
    toGraphInsight(signal, feed, results[index]!.id)
  ));

  return {
    parsedQuery: preparedQuery.parsedQuery,
    results,
    explanations,
    graphInsights,
  };
}
