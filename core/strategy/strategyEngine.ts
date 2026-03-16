import { createHash } from 'node:crypto';

export type StrategyInsightType =
  | 'PROVIDER_OPPORTUNITY'
  | 'SPECIALTY_SHIFT'
  | 'INSTITUTION_GROWTH'
  | 'NETWORK_CLUSTER_FORMING'
  | 'TALENT_MIGRATION'
  | 'RESEARCH_ACCELERATION';

export type StrategyInsightCategory =
  | 'trend_insight'
  | 'strategic_opportunity'
  | 'strategic_risk';

export type StrategyImpactLevel = 'strategic' | 'major' | 'moderate' | 'minor';

export interface StrategyScope {
  entityType: 'provider' | 'institution' | 'specialty' | 'network' | 'market';
  entityId: string;
  entityLabel?: string | null;
  geography?: string | null;
  specialty?: string | null;
}

export interface StrategyEntityRef {
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  relationship?: string | null;
}

export interface StrategyDriver {
  label: string;
  value: number | string;
  direction: 'UP' | 'DOWN' | 'FLAT';
  source: string;
  explanation: string;
}

export interface StrategySupportingPrediction {
  predictionId: string;
  predictionType: string;
  probability: number;
  confidence: number;
  explanation: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface StrategyInsight {
  id: string;
  type: StrategyInsightType;
  category: StrategyInsightCategory;
  scope: StrategyScope;
  title: string;
  summary: string;
  impactLevel: StrategyImpactLevel;
  confidence: number;
  explanation: string;
  drivers: StrategyDriver[];
  affectedEntities: StrategyEntityRef[];
  recommendedActions: string[];
  supportingPredictions: StrategySupportingPrediction[];
  supportingStorylineIds: string[];
  supportingActionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StrategyMarketSignal {
  scope: StrategyScope;
  shortagePrediction: StrategySupportingPrediction;
  pressureScore: number;
  demand: number;
  supply: number;
  risingProviders: StrategyEntityRef[];
  recommendedActions: string[];
  supportingActionIds: string[];
}

export interface StrategyProviderSignal {
  provider: StrategyEntityRef;
  specialty?: string | null;
  state?: string | null;
  institutions: StrategyEntityRef[];
  risingPrediction?: StrategySupportingPrediction;
  marketSignals: StrategyMarketSignal[];
  institutionShiftStorylineIds: string[];
  networkStorylineIds: string[];
  supportingActionIds: string[];
  recommendedActions: string[];
  publicationGrowth: number;
  recentTrialCount: number;
  recentGrantCount: number;
  citationCount: number;
  graphDegree: number;
}

export interface StrategyInstitutionSignal {
  institution: StrategyEntityRef;
  growthPrediction?: StrategySupportingPrediction;
  linkedRisingProviders: StrategyEntityRef[];
  linkedNetworkCount: number;
  supportingStorylineIds: string[];
  supportingActionIds: string[];
  recommendedActions: string[];
}

export interface StrategyNetworkSignal {
  network: StrategyScope;
  anchorEntity?: StrategyEntityRef;
  peerEntities: StrategyEntityRef[];
  expansionPrediction?: StrategySupportingPrediction;
  supportingStorylineIds: string[];
  supportingActionIds: string[];
  recommendedActions: string[];
  specialty?: string | null;
  geography?: string | null;
}

export interface StrategyEngineInput {
  providerSignals: StrategyProviderSignal[];
  institutionSignals: StrategyInstitutionSignal[];
  marketSignals: StrategyMarketSignal[];
  networkSignals: StrategyNetworkSignal[];
  now?: string;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
}

function hashSeed(seed: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(seed)).digest('hex');
}

function buildInsightId(
  type: StrategyInsightType,
  scope: StrategyScope,
  supportingPredictions: StrategySupportingPrediction[],
): string {
  return `str_${hashSeed({
    type,
    scope,
    supportingPredictions: supportingPredictions.map((prediction) => prediction.predictionId).sort(),
  }).slice(0, 24)}`;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))];
}

function dedupeEntities(entities: StrategyEntityRef[]): StrategyEntityRef[] {
  const seen = new Set<string>();
  return entities.filter((entity) => {
    const key = `${entity.entityType}:${entity.entityId}:${entity.relationship ?? ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function dedupePredictions(predictions: StrategySupportingPrediction[]): StrategySupportingPrediction[] {
  const seen = new Set<string>();
  return predictions.filter((prediction) => {
    if (seen.has(prediction.predictionId)) {
      return false;
    }
    seen.add(prediction.predictionId);
    return true;
  });
}

function dedupeDrivers(drivers: StrategyDriver[]): StrategyDriver[] {
  const seen = new Set<string>();
  return drivers.filter((driver) => {
    const key = `${driver.source}:${driver.label}:${String(driver.value)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function earliestDate(values: string[], fallback: string): string {
  const parsed = values
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  return parsed.length > 0 ? new Date(parsed[0]!).toISOString() : fallback;
}

function latestDate(values: string[], fallback: string): string {
  const parsed = values
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left);
  return parsed.length > 0 ? new Date(parsed[0]!).toISOString() : fallback;
}

function impactRank(level: StrategyImpactLevel): number {
  switch (level) {
    case 'strategic':
      return 4;
    case 'major':
      return 3;
    case 'moderate':
      return 2;
    case 'minor':
    default:
      return 1;
  }
}

function scoreToImpactLevel(score: number): StrategyImpactLevel {
  if (score >= 88) {
    return 'strategic';
  }
  if (score >= 72) {
    return 'major';
  }
  if (score >= 56) {
    return 'moderate';
  }
  return 'minor';
}

function categoryForType(type: StrategyInsightType): StrategyInsightCategory {
  switch (type) {
    case 'PROVIDER_OPPORTUNITY':
    case 'INSTITUTION_GROWTH':
      return 'strategic_opportunity';
    case 'SPECIALTY_SHIFT':
    case 'TALENT_MIGRATION':
      return 'strategic_risk';
    case 'NETWORK_CLUSTER_FORMING':
    case 'RESEARCH_ACCELERATION':
    default:
      return 'trend_insight';
  }
}

function mergeActionLabels(values: string[][], fallback: string[]): string[] {
  const merged = uniqueStrings(values.flat());
  return merged.length > 0 ? merged.slice(0, 5) : fallback;
}

function createInsight(input: {
  type: StrategyInsightType;
  scope: StrategyScope;
  title: string;
  summary: string;
  confidence: number;
  impactScore: number;
  explanation: string;
  drivers: StrategyDriver[];
  affectedEntities: StrategyEntityRef[];
  recommendedActions: string[];
  supportingPredictions: StrategySupportingPrediction[];
  supportingStorylineIds: string[];
  supportingActionIds: string[];
  now: string;
}): StrategyInsight {
  const predictions = dedupePredictions(input.supportingPredictions);
  const createdAt = earliestDate(
    predictions.map((prediction) => prediction.createdAt),
    input.now,
  );
  const updatedAt = latestDate(
    predictions.flatMap((prediction) => [prediction.createdAt, prediction.updatedAt]),
    input.now,
  );
  return {
    id: buildInsightId(input.type, input.scope, predictions),
    type: input.type,
    category: categoryForType(input.type),
    scope: input.scope,
    title: input.title,
    summary: input.summary,
    impactLevel: scoreToImpactLevel(input.impactScore),
    confidence: clamp01(input.confidence),
    explanation: input.explanation,
    drivers: dedupeDrivers(input.drivers).slice(0, 6),
    affectedEntities: dedupeEntities(input.affectedEntities).slice(0, 10),
    recommendedActions: uniqueStrings(input.recommendedActions).slice(0, 5),
    supportingPredictions: predictions,
    supportingStorylineIds: uniqueStrings(input.supportingStorylineIds),
    supportingActionIds: uniqueStrings(input.supportingActionIds),
    createdAt,
    updatedAt,
  };
}

function marketLabel(signal: StrategyMarketSignal): string {
  return signal.scope.entityLabel
    ?? (
      [signal.scope.geography, signal.scope.specialty]
        .filter((value): value is string => Boolean(value))
        .join(' ')
      || signal.scope.entityId
    );
}

function providerOpportunityInsight(
  signal: StrategyProviderSignal,
  now: string,
): StrategyInsight | null {
  const shortage = [...signal.marketSignals]
    .sort((left, right) => right.pressureScore - left.pressureScore)[0];

  if (!signal.risingPrediction || !shortage || shortage.pressureScore < 70) {
    return null;
  }

  const specialty = signal.specialty ?? shortage.scope.specialty ?? 'priority specialty';
  const state = signal.state ?? shortage.scope.geography ?? 'priority market';
  const providerLabel = signal.provider.entityLabel ?? signal.provider.entityId;
  const opportunityScore =
    (shortage.pressureScore * 0.58)
    + (signal.risingPrediction.probability * 22)
    + (signal.risingPrediction.confidence * 18)
    + Math.min(signal.graphDegree, 12);
  const confidence = clamp01(
    ((signal.risingPrediction.confidence * 0.52)
    + (shortage.shortagePrediction.confidence * 0.36)
    + (signal.networkStorylineIds.length > 0 ? 0.08 : 0.02)
    + (signal.recentGrantCount > 0 || signal.recentTrialCount > 0 ? 0.04 : 0)) / 1.02,
  );

  return createInsight({
    type: 'PROVIDER_OPPORTUNITY',
    scope: {
      entityType: 'provider',
      entityId: signal.provider.entityId,
      entityLabel: providerLabel,
      geography: state,
      specialty,
    },
    title: `${providerLabel} is emerging in a high-pressure ${specialty} market`,
    summary: `${specialty} demand in ${state} is outpacing mapped supply while ${providerLabel}'s research and network trajectory is rising.`,
    confidence,
    impactScore: opportunityScore,
    explanation: `${providerLabel} triggered a provider opportunity insight because ${marketLabel(shortage)} is operating under severe workforce pressure and the provider already has a rising-trajectory prediction supported by research and graph signals.`,
    drivers: [
      {
        label: 'specialty_pressure',
        value: shortage.pressureScore,
        direction: 'UP',
        source: 'PREDICTION_ENGINE',
        explanation: `${specialty} pressure score reached ${shortage.pressureScore} in ${state}.`,
      },
      {
        label: 'demand_vs_supply',
        value: `${shortage.demand}:${shortage.supply}`,
        direction: shortage.demand > shortage.supply ? 'UP' : 'FLAT',
        source: 'OPPORTUNITIES',
        explanation: `${shortage.demand} active roles are competing against ${shortage.supply} mapped providers.`,
      },
      {
        label: 'publication_growth',
        value: signal.publicationGrowth,
        direction: signal.publicationGrowth > 0 ? 'UP' : 'FLAT',
        source: 'CLAIM_RECORDS',
        explanation: `${providerLabel} added ${signal.publicationGrowth} net publication signals over the prior window.`,
      },
      {
        label: 'research_activity',
        value: signal.recentGrantCount + signal.recentTrialCount,
        direction: signal.recentGrantCount + signal.recentTrialCount > 0 ? 'UP' : 'FLAT',
        source: 'CLAIM_RECORDS',
        explanation: `${signal.recentGrantCount} grant-linked and ${signal.recentTrialCount} trial-linked signals are active.`,
      },
      {
        label: 'graph_degree',
        value: signal.graphDegree,
        direction: signal.graphDegree > 0 ? 'UP' : 'FLAT',
        source: 'GRAPH_RUNTIME',
        explanation: `${providerLabel} already sits in a graph neighborhood with degree ${signal.graphDegree}.`,
      },
    ],
    affectedEntities: [
      {
        ...signal.provider,
        relationship: 'subject',
      },
      {
        entityType: 'specialty',
        entityId: shortage.scope.entityId,
        entityLabel: marketLabel(shortage),
        relationship: 'market',
      },
      ...signal.institutions.map((institution) => ({
        ...institution,
        relationship: 'affiliation',
      })),
    ],
    recommendedActions: mergeActionLabels(
      [signal.recommendedActions, shortage.recommendedActions],
      [
        `Prioritize recruiter outreach to ${providerLabel}.`,
        `Map retention and competitive-intelligence signals for ${specialty} in ${state}.`,
        `Review the provider's collaboration graph before competitors do.`,
      ],
    ),
    supportingPredictions: [
      signal.risingPrediction,
      shortage.shortagePrediction,
    ],
    supportingStorylineIds: [
      ...signal.networkStorylineIds,
      ...signal.institutionShiftStorylineIds,
    ],
    supportingActionIds: [
      ...signal.supportingActionIds,
      ...shortage.supportingActionIds,
    ],
    now,
  });
}

function specialtyShiftInsights(
  marketSignals: StrategyMarketSignal[],
  now: string,
): StrategyInsight[] {
  return marketSignals
    .filter((signal) => signal.pressureScore >= 60 && signal.risingProviders.length >= 2)
    .map((signal) => {
      const specialty = signal.scope.specialty ?? signal.scope.entityLabel ?? signal.scope.entityId;
      const state = signal.scope.geography ?? 'priority market';
      const providerLabels = signal.risingProviders
        .map((provider) => provider.entityLabel ?? provider.entityId)
        .slice(0, 3);
      const impactScore =
        (signal.pressureScore * 0.7)
        + (signal.risingProviders.length * 8)
        + (signal.shortagePrediction.probability * 12);
      return createInsight({
        type: 'SPECIALTY_SHIFT',
        scope: signal.scope,
        title: `${specialty} demand is accelerating in ${state}`,
        summary: `${signal.risingProviders.length} rising providers are appearing in a shortage market, indicating a material specialty shift in ${state}.`,
        confidence: clamp01(
          (signal.shortagePrediction.confidence * 0.7)
          + Math.min(signal.risingProviders.length / 8, 0.2)
          + 0.08,
        ),
        impactScore,
        explanation: `${specialty} generated a specialty-shift insight because workforce pressure is already elevated in ${state} and multiple rising providers are clustering inside the same constrained market.`,
        drivers: [
          {
            label: 'specialty_pressure',
            value: signal.pressureScore,
            direction: 'UP',
            source: 'PREDICTION_ENGINE',
            explanation: `The shortage model assigned ${specialty} a pressure score of ${signal.pressureScore} in ${state}.`,
          },
          {
            label: 'rising_provider_count',
            value: signal.risingProviders.length,
            direction: 'UP',
            source: 'STRATEGY_ENGINE',
            explanation: `${signal.risingProviders.length} rising providers are already present in the same market.`,
          },
          {
            label: 'demand_vs_supply',
            value: `${signal.demand}:${signal.supply}`,
            direction: signal.demand > signal.supply ? 'UP' : 'FLAT',
            source: 'OPPORTUNITIES',
            explanation: `${signal.demand} active roles are competing against ${signal.supply} mapped providers.`,
          },
        ],
        affectedEntities: [
          {
            entityType: 'specialty',
            entityId: signal.scope.entityId,
            entityLabel: marketLabel(signal),
            relationship: 'market',
          },
          ...signal.risingProviders.map((provider) => ({
            ...provider,
            relationship: 'rising_provider',
          })),
        ],
        recommendedActions: mergeActionLabels(
          [signal.recommendedActions],
          [
            `Expand recruiting capacity for ${specialty} in ${state}.`,
            `Benchmark compensation pressure against ${providerLabels.join(', ') || 'rising peers'}.`,
            `Review adjacent institutions before the shortage worsens.`,
          ],
        ),
        supportingPredictions: [signal.shortagePrediction],
        supportingStorylineIds: [],
        supportingActionIds: signal.supportingActionIds,
        now,
      });
    });
}

function institutionGrowthInsight(
  signal: StrategyInstitutionSignal,
  now: string,
): StrategyInsight | null {
  if (!signal.growthPrediction) {
    return null;
  }

  const providerCount = signal.linkedRisingProviders.length;
  if (providerCount === 0 && signal.linkedNetworkCount === 0) {
    return null;
  }

  const growthPrediction = signal.growthPrediction;
  const researchGrowth = typeof growthPrediction.metadata.researchGrowth === 'number'
    ? growthPrediction.metadata.researchGrowth
    : 0;
  const contributingProviders = typeof growthPrediction.metadata.contributingProviders === 'number'
    ? growthPrediction.metadata.contributingProviders
    : providerCount;
  const leadInvestigatorCount = typeof growthPrediction.metadata.leadInvestigatorCount === 'number'
    ? growthPrediction.metadata.leadInvestigatorCount
    : 0;
  const label = signal.institution.entityLabel ?? signal.institution.entityId;
  const impactScore =
    (growthPrediction.probability * 36)
    + (growthPrediction.confidence * 24)
    + Math.min(researchGrowth * 5, 20)
    + Math.min(providerCount * 5, 15)
    + Math.min(signal.linkedNetworkCount * 4, 12);

  return createInsight({
    type: 'INSTITUTION_GROWTH',
    scope: {
      entityType: 'institution',
      entityId: signal.institution.entityId,
      entityLabel: label,
    },
    title: `${label} is expanding research capacity`,
    summary: `${label} is combining institution momentum with ${providerCount} rising provider signal(s) and ${signal.linkedNetworkCount} emerging collaboration cluster(s).`,
    confidence: clamp01(
      (growthPrediction.confidence * 0.72)
      + Math.min(providerCount / 10, 0.14)
      + Math.min(signal.linkedNetworkCount / 10, 0.14),
    ),
    impactScore,
    explanation: `${label} triggered an institution-growth insight because institution research momentum is expanding and the surrounding provider/network layer is also strengthening.`,
    drivers: [
      {
        label: 'research_growth',
        value: researchGrowth,
        direction: researchGrowth > 0 ? 'UP' : 'FLAT',
        source: 'PREDICTION_ENGINE',
        explanation: `Institution research growth increased by ${researchGrowth} signals over the prior window.`,
      },
      {
        label: 'contributing_providers',
        value: contributingProviders,
        direction: contributingProviders > 0 ? 'UP' : 'FLAT',
        source: 'CLAIM_RECORDS',
        explanation: `${contributingProviders} providers are contributing to the institution's research footprint.`,
      },
      {
        label: 'lead_investigators',
        value: leadInvestigatorCount,
        direction: leadInvestigatorCount > 0 ? 'UP' : 'FLAT',
        source: 'CLAIM_RECORDS',
        explanation: `${leadInvestigatorCount} likely lead investigators are visible in the signal set.`,
      },
      {
        label: 'linked_network_clusters',
        value: signal.linkedNetworkCount,
        direction: signal.linkedNetworkCount > 0 ? 'UP' : 'FLAT',
        source: 'GRAPH_RUNTIME',
        explanation: `${signal.linkedNetworkCount} collaboration cluster signals are linked to the institution's providers.`,
      },
    ],
    affectedEntities: [
      {
        ...signal.institution,
        relationship: 'subject',
      },
      ...signal.linkedRisingProviders.map((provider) => ({
        ...provider,
        relationship: 'contributing_provider',
      })),
    ],
    recommendedActions: mergeActionLabels(
      [signal.recommendedActions],
      [
        `Open growth-watch coverage for ${label}.`,
        `Prioritize partnership and recruiting outreach around ${label}.`,
        `Track which specialty clusters are feeding ${label}'s expansion.`,
      ],
    ),
    supportingPredictions: [growthPrediction],
    supportingStorylineIds: signal.supportingStorylineIds,
    supportingActionIds: signal.supportingActionIds,
    now,
  });
}

function networkClusterInsight(
  signal: StrategyNetworkSignal,
  now: string,
): StrategyInsight | null {
  if (!signal.expansionPrediction || signal.peerEntities.length < 2) {
    return null;
  }

  const recentConnections = typeof signal.expansionPrediction.metadata.recentConnections === 'number'
    ? signal.expansionPrediction.metadata.recentConnections
    : signal.peerEntities.length;
  const anchorLabel = signal.anchorEntity?.entityLabel ?? signal.network.entityLabel ?? signal.network.entityId;
  const specialtyPhrase = signal.specialty ? `${signal.specialty} ` : '';
  const impactScore =
    (signal.expansionPrediction.probability * 35)
    + (signal.expansionPrediction.confidence * 24)
    + Math.min(signal.peerEntities.length * 7, 21)
    + Math.min(recentConnections * 2, 16);

  return createInsight({
    type: 'NETWORK_CLUSTER_FORMING',
    scope: signal.network,
    title: `New ${specialtyPhrase}collaboration cluster is forming around ${anchorLabel}`,
    summary: `${anchorLabel} is now at the center of a denser collaboration network spanning ${signal.peerEntities.length} peer entities.`,
    confidence: clamp01(
      (signal.expansionPrediction.confidence * 0.78)
      + Math.min(signal.peerEntities.length / 12, 0.16)
      + (signal.supportingStorylineIds.length > 0 ? 0.06 : 0.02),
    ),
    impactScore,
    explanation: `${anchorLabel} triggered a network-cluster insight because graph expansion signals and storyline evidence both indicate a newly dense collaboration neighborhood.`,
    drivers: [
      {
        label: 'peer_count',
        value: signal.peerEntities.length,
        direction: 'UP',
        source: 'GRAPH_RUNTIME',
        explanation: `${signal.peerEntities.length} peer entities now sit inside the same collaboration cluster.`,
      },
      {
        label: 'recent_connections',
        value: recentConnections,
        direction: recentConnections > 0 ? 'UP' : 'FLAT',
        source: 'GRAPH_RUNTIME',
        explanation: `${recentConnections} recent graph connections are supporting the cluster signal.`,
      },
      {
        label: 'expansion_probability',
        value: Number(signal.expansionPrediction.probability.toFixed(2)),
        direction: 'UP',
        source: 'PREDICTION_ENGINE',
        explanation: `The network expansion prediction is already at probability ${signal.expansionPrediction.probability.toFixed(2)}.`,
      },
    ],
    affectedEntities: [
      ...(signal.anchorEntity ? [{ ...signal.anchorEntity, relationship: 'anchor' as const }] : []),
      ...signal.peerEntities.map((entity) => ({
        ...entity,
        relationship: 'peer',
      })),
    ],
    recommendedActions: mergeActionLabels(
      [signal.recommendedActions],
      [
        `Map the collaborators around ${anchorLabel}.`,
        'Review cluster participants for recruiting, partnership, and diligence relevance.',
        'Track whether the cluster is expanding into new institutions or specialties.',
      ],
    ),
    supportingPredictions: [signal.expansionPrediction],
    supportingStorylineIds: signal.supportingStorylineIds,
    supportingActionIds: signal.supportingActionIds,
    now,
  });
}

function talentMigrationInsight(
  signal: StrategyProviderSignal,
  now: string,
): StrategyInsight | null {
  if (signal.institutionShiftStorylineIds.length === 0 || !signal.risingPrediction) {
    return null;
  }

  const providerLabel = signal.provider.entityLabel ?? signal.provider.entityId;
  const destinations = signal.institutions.slice(0, 2).map((institution) => institution.entityLabel ?? institution.entityId);
  const impactScore =
    (signal.risingPrediction.probability * 32)
    + (signal.risingPrediction.confidence * 24)
    + Math.min(signal.institutionShiftStorylineIds.length * 8, 24)
    + Math.min(signal.marketSignals.length * 6, 18);

  return createInsight({
    type: 'TALENT_MIGRATION',
    scope: {
      entityType: 'provider',
      entityId: signal.provider.entityId,
      entityLabel: providerLabel,
      geography: signal.state ?? null,
      specialty: signal.specialty ?? null,
    },
    title: `${providerLabel} shows signals of near-term talent movement`,
    summary: `${providerLabel} has both affiliation-shift storyline activity and a rising provider trajectory, suggesting that future talent movement is becoming strategically relevant.`,
    confidence: clamp01(
      (signal.risingPrediction.confidence * 0.66)
      + Math.min(signal.institutionShiftStorylineIds.length / 10, 0.22)
      + (signal.institutions.length > 1 ? 0.12 : 0.06),
    ),
    impactScore,
    explanation: `${providerLabel} triggered a talent-migration insight because institution-shift signals are already active while the provider's momentum is still rising, which usually increases recruiting and retention pressure around the provider.`,
    drivers: [
      {
        label: 'affiliation_shift_events',
        value: signal.institutionShiftStorylineIds.length,
        direction: 'UP',
        source: 'STORYLINE_ENGINE',
        explanation: `${signal.institutionShiftStorylineIds.length} institution-shift storyline event(s) are linked to the provider.`,
      },
      {
        label: 'trajectory_confidence',
        value: Number(signal.risingPrediction.confidence.toFixed(2)),
        direction: 'UP',
        source: 'PREDICTION_ENGINE',
        explanation: `The provider's rising-trajectory confidence is ${signal.risingPrediction.confidence.toFixed(2)}.`,
      },
      {
        label: 'affiliated_institutions',
        value: signal.institutions.length,
        direction: signal.institutions.length > 1 ? 'UP' : 'FLAT',
        source: 'CLAIM_RECORDS',
        explanation: `${signal.institutions.length} institution affiliation(s) are present in the provider context.`,
      },
    ],
    affectedEntities: [
      {
        ...signal.provider,
        relationship: 'subject',
      },
      ...signal.institutions.map((institution) => ({
        ...institution,
        relationship: 'possible_destination',
      })),
    ],
    recommendedActions: mergeActionLabels(
      [signal.recommendedActions],
      [
        `Track affiliation changes for ${providerLabel}.`,
        `Assess recruiter and retention pressure around ${destinations.join(', ') || 'linked institutions'}.`,
        `Review downstream network effects before the movement becomes public.`,
      ],
    ),
    supportingPredictions: [signal.risingPrediction],
    supportingStorylineIds: signal.institutionShiftStorylineIds,
    supportingActionIds: signal.supportingActionIds,
    now,
  });
}

function researchAccelerationInsight(
  signal: StrategyProviderSignal,
  now: string,
): StrategyInsight | null {
  if (
    !signal.risingPrediction
    || (
      signal.publicationGrowth < 3
      && signal.recentGrantCount === 0
      && signal.recentTrialCount === 0
      && signal.citationCount < 100
    )
  ) {
    return null;
  }

  const providerLabel = signal.provider.entityLabel ?? signal.provider.entityId;
  const impactScore =
    (signal.risingPrediction.probability * 34)
    + (signal.risingPrediction.confidence * 22)
    + Math.min(signal.publicationGrowth * 6, 24)
    + Math.min(signal.recentGrantCount * 8, 16)
    + Math.min(signal.recentTrialCount * 7, 14)
    + Math.min(signal.citationCount / 12, 14);

  return createInsight({
    type: 'RESEARCH_ACCELERATION',
    scope: {
      entityType: 'provider',
      entityId: signal.provider.entityId,
      entityLabel: providerLabel,
      geography: signal.state ?? null,
      specialty: signal.specialty ?? null,
    },
    title: `${providerLabel} is accelerating research influence`,
    summary: `${providerLabel}'s publication, grant, and trial signals are strong enough to suggest a meaningful increase in future research influence.`,
    confidence: clamp01(
      (signal.risingPrediction.confidence * 0.7)
      + Math.min(signal.publicationGrowth / 20, 0.12)
      + Math.min(signal.recentGrantCount / 10, 0.1)
      + Math.min(signal.recentTrialCount / 10, 0.08),
    ),
    impactScore,
    explanation: `${providerLabel} triggered a research-acceleration insight because the provider's research footprint is growing fast enough to move from a storyline into a strategic influence signal.`,
    drivers: [
      {
        label: 'publication_growth',
        value: signal.publicationGrowth,
        direction: signal.publicationGrowth > 0 ? 'UP' : 'FLAT',
        source: 'CLAIM_RECORDS',
        explanation: `${providerLabel} added ${signal.publicationGrowth} net publication signals in the latest window.`,
      },
      {
        label: 'recent_grants',
        value: signal.recentGrantCount,
        direction: signal.recentGrantCount > 0 ? 'UP' : 'FLAT',
        source: 'CLAIM_RECORDS',
        explanation: `${signal.recentGrantCount} recent grant-linked signals are active.`,
      },
      {
        label: 'recent_trials',
        value: signal.recentTrialCount,
        direction: signal.recentTrialCount > 0 ? 'UP' : 'FLAT',
        source: 'CLAIM_RECORDS',
        explanation: `${signal.recentTrialCount} trial-role signal(s) remain active.`,
      },
      {
        label: 'citation_count',
        value: signal.citationCount,
        direction: signal.citationCount > 0 ? 'UP' : 'FLAT',
        source: 'CLAIM_RECORDS',
        explanation: `Citation count is currently ${signal.citationCount}.`,
      },
    ],
    affectedEntities: [
      {
        ...signal.provider,
        relationship: 'subject',
      },
      ...signal.institutions.map((institution) => ({
        ...institution,
        relationship: 'affiliation',
      })),
    ],
    recommendedActions: mergeActionLabels(
      [signal.recommendedActions],
      [
        `Track ${providerLabel} for rising influence and partnership value.`,
        'Review emerging collaborators and institutional affiliations.',
        'Use the research acceleration signal in recruiting and market planning.',
      ],
    ),
    supportingPredictions: [signal.risingPrediction],
    supportingStorylineIds: signal.networkStorylineIds,
    supportingActionIds: signal.supportingActionIds,
    now,
  });
}

function compareInsights(left: StrategyInsight, right: StrategyInsight): number {
  const impactDelta = impactRank(right.impactLevel) - impactRank(left.impactLevel);
  if (impactDelta !== 0) {
    return impactDelta;
  }

  if (right.confidence !== left.confidence) {
    return right.confidence - left.confidence;
  }

  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

export function createStrategyEngine() {
  return {
    generate(input: StrategyEngineInput): StrategyInsight[] {
      const now = input.now ?? new Date().toISOString();
      const insights: StrategyInsight[] = [];

      for (const signal of input.providerSignals) {
        const providerOpportunity = providerOpportunityInsight(signal, now);
        if (providerOpportunity) {
          insights.push(providerOpportunity);
        }

        const talentMovement = talentMigrationInsight(signal, now);
        if (talentMovement) {
          insights.push(talentMovement);
        }

        const researchAcceleration = researchAccelerationInsight(signal, now);
        if (researchAcceleration) {
          insights.push(researchAcceleration);
        }
      }

      insights.push(...specialtyShiftInsights(input.marketSignals, now));

      for (const signal of input.institutionSignals) {
        const insight = institutionGrowthInsight(signal, now);
        if (insight) {
          insights.push(insight);
        }
      }

      for (const signal of input.networkSignals) {
        const insight = networkClusterInsight(signal, now);
        if (insight) {
          insights.push(insight);
        }
      }

      return insights.sort(compareInsights);
    },
  };
}
