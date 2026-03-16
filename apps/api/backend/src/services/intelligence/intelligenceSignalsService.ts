import type { PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import {
  articulationPoints,
  betweennessCentrality,
  pageRank,
  toNetworkProjection,
} from '../../../../../../core/graph';
import { buildProviderIntelligenceSnapshot } from './providerIntelligenceService';
import {
  computeExpertiseScarcity,
  type ScarcitySignal,
} from './workforceIntelligenceService';
import {
  computeTrustScoreV1,
  type TrustScoreV1,
} from '../trust/trustScoreV1';

const NPI_RE = /^\d{10}$/;

type Snapshot = Awaited<ReturnType<typeof buildProviderIntelligenceSnapshot>>;
type SnapshotPrediction = Snapshot['predictions'][number];
type SnapshotFinding = Snapshot['findings'][number];
type SnapshotStoryline = Snapshot['storylines'][number];
type SnapshotAction = Snapshot['actions'][number];

type SignalDirection = 'UP' | 'DOWN' | 'FLAT';
type PressureState = 'low' | 'moderate' | 'high' | 'severe' | 'insufficient_signal';
type MomentumState = 'expanding' | 'stable' | 'contracting' | 'mixed' | 'insufficient_signal';

export interface IntelligenceDriver {
  label: string;
  value: number | string;
  direction: SignalDirection;
  source: string;
  explanation: string;
}

export interface LinkedEvidence {
  kind: 'finding' | 'storyline' | 'prediction' | 'signal';
  id: string;
  label: string;
  source: string | null;
}

export interface ProviderTrustScore {
  providerId: string;
  providerNpi: string;
  providerLabel: string;
  score: number | null;
  tier: string;
  confidence: number;
  drivers: IntelligenceDriver[];
  sourceSignals: string[];
  timestamp: string;
  last_updated: string;
  explanation: string;
  insufficientSignal: boolean;
}

export interface NetworkInfluenceScore {
  providerId: string;
  providerNpi: string;
  providerLabel: string;
  score: number | null;
  percentile: number | null;
  tier: string;
  confidence: number;
  drivers: IntelligenceDriver[];
  sourceSignals: string[];
  centrality_delta: number | null;
  timestamp: string;
  last_updated: string;
  explanation: string;
  insufficientSignal: boolean;
}

export interface WorkforcePressureIndex {
  id: string;
  state: PressureState;
  score: number | null;
  confidence: number;
  drivers: IntelligenceDriver[];
  sourceSignals: string[];
  timestamp: string;
  last_updated: string;
  explanation: string;
  specialty: string | null;
  geography: string | null;
  hotspots: Array<{
    geography: string;
    state: PressureState;
    score: number;
    confidence: number;
  }>;
  specialties?: Array<{
    specialty: string;
    state: PressureState;
    score: number;
    confidence: number;
  }>;
  insufficientSignal: boolean;
}

export interface InstitutionalMomentumIndex {
  institutionId: string;
  institutionLabel: string;
  state: MomentumState;
  score: number | null;
  confidence: number;
  drivers: IntelligenceDriver[];
  sourceSignals: string[];
  trend_summary: string;
  timestamp: string;
  last_updated: string;
  explanation: string;
  insufficientSignal: boolean;
}

export interface EarlyWarningAlert {
  id: string;
  headline: string;
  entity: {
    entityType: 'provider' | 'specialty' | 'institution';
    entityId: string;
    entityLabel: string;
  };
  type: 'trust' | 'influence' | 'workforce_pressure' | 'institution_momentum' | 'sanction' | 'network_shift';
  state: string;
  score: number | null;
  confidence: number;
  drivers: IntelligenceDriver[];
  sourceSignals: string[];
  timestamp: string;
  explanation: string;
  linkedEvidence: LinkedEvidence[];
  recommendedAction: string;
}

export interface IntelligenceFeedItem {
  id: string;
  headline: string;
  entity: {
    entityType: string;
    entityId: string;
    entityLabel: string;
  };
  type: 'finding' | 'storyline' | 'prediction' | 'insight' | 'early_warning';
  explanation: string;
  confidence: number;
  linkedEvidence: LinkedEvidence[];
  recommendedAction: string | null;
  created_at: string;
  state: string | null;
  score: number | null;
}

export interface IntelligenceFeedResponse {
  generatedAt: string;
  total: number;
  counts: Record<'finding' | 'storyline' | 'prediction' | 'insight' | 'early_warning', number>;
  items: IntelligenceFeedItem[];
}

export interface ProviderIntelligenceSummary {
  npi: string;
  providerId: string;
  providerLabel: string;
  specialty: string | null;
  geography: string | null;
  trust: ProviderTrustScore;
  influence: NetworkInfluenceScore;
  workforcePressure: WorkforcePressureIndex;
  institutionMomentum: InstitutionalMomentumIndex | null;
  earlyWarnings: EarlyWarningAlert[];
  findings: SnapshotFinding[];
  storylines: SnapshotStoryline[];
  predictions: SnapshotPrediction[];
  actions: SnapshotAction[];
  feed: IntelligenceFeedResponse;
  summary: string;
  generatedAt: string;
}

interface ProviderSignalContext {
  snapshot: Snapshot;
  providerId: string;
  providerNpi: string;
  providerLabel: string;
  specialty: string | null;
  state: string | null;
  institutions: Array<{
    entityId: string;
    label: string;
  }>;
  providerFindings: SnapshotFinding[];
  providerStorylines: SnapshotStoryline[];
  providerPredictions: SnapshotPrediction[];
  providerActions: SnapshotAction[];
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
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
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

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))];
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function withinDays(value: string, now: string, days: number): boolean {
  return Date.parse(now) - Date.parse(value) <= days * 86_400_000;
}

function providerEntityId(npi: string): string {
  return `provider:${npi}`;
}

function directionForSigned(value: number | null, tolerance = 0.0001): SignalDirection {
  if (value === null || Math.abs(value) <= tolerance) {
    return 'FLAT';
  }

  return value > 0 ? 'UP' : 'DOWN';
}

function severityWeight(value: string): number {
  switch (value.toLowerCase()) {
    case 'critical':
      return 8;
    case 'high':
      return 5;
    case 'medium':
      return 2;
    default:
      return 1;
  }
}

function relationshipSourceSignal(relationshipType: string): string {
  switch (relationshipType) {
    case 'shared_industry_relationship':
      return 'OPEN_PAYMENTS';
    case 'co_practice_group':
      return 'PRACTICE_GROUP';
    default:
      return 'COLLABORATION_GRAPH';
  }
}

function trustTier(score: number): string {
  if (score >= 90) return 'Exceptional trust';
  if (score >= 75) return 'Strong trust';
  if (score >= 50) return 'Moderate trust';
  if (score >= 25) return 'Elevated monitoring';
  return 'High risk';
}

function influenceTier(percentile: number): string {
  if (percentile >= 0.99) return 'Network Hub';
  if (percentile >= 0.9) return 'High Influence';
  if (percentile >= 0.5) return 'Typical Network Position';
  return 'Peripheral';
}

function normalizePressureState(value: string | null | undefined): PressureState {
  switch ((value ?? '').toLowerCase()) {
    case 'low':
    case 'moderate':
    case 'high':
    case 'severe':
      return value!.toLowerCase() as PressureState;
    default:
      return 'insufficient_signal';
  }
}

function pressureStateFromScarcityLabel(value: string | null | undefined): PressureState {
  switch ((value ?? '').toUpperCase()) {
    case 'CRITICAL':
      return 'severe';
    case 'HIGH':
      return 'high';
    case 'MODERATE':
      return 'moderate';
    default:
      return 'low';
  }
}

function normalizeMomentumState(value: string | null | undefined): MomentumState {
  switch ((value ?? '').toLowerCase()) {
    case 'expanding':
    case 'stable':
    case 'contracting':
    case 'mixed':
      return value!.toLowerCase() as MomentumState;
    default:
      return 'insufficient_signal';
  }
}

function defaultExplanation(reason: string): string {
  return `Insufficient signal because ${reason}.`;
}

function driver(
  label: string,
  value: number | string,
  direction: SignalDirection,
  source: string,
  explanation: string,
): IntelligenceDriver {
  return {
    label,
    value,
    direction,
    source,
    explanation,
  };
}

function predictionDriverValue(
  prediction: SnapshotPrediction | undefined,
  label: string,
): number | null {
  if (!prediction) {
    return null;
  }

  for (const item of prediction.drivers) {
    if (item.label === label) {
      return asNumber(item.value);
    }
  }

  return null;
}

function buildDegreeCentrality(projection: ReturnType<typeof toNetworkProjection>): Map<string, { count: number; score: number }> {
  const counts = new Map<string, number>();
  for (const node of projection.nodes) {
    counts.set(node.id, 0);
  }

  for (const edge of projection.edges) {
    counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
    counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
  }

  const maxCount = Math.max(0, ...counts.values());
  return new Map([...counts.entries()].map(([nodeId, count]) => [
    nodeId,
    {
      count,
      score: maxCount === 0 ? 0 : count / maxCount,
    },
  ]));
}

function sortByScoreDescending<T extends { score: number | null }>(items: T[]): T[] {
  return [...items].sort((left, right) => (
    (right.score ?? -1) - (left.score ?? -1)
  ));
}

function withPercentiles<T extends { score: number | null }>(
  items: T[],
): Array<T & { rank: number; percentile: number | null }> {
  const sorted = sortByScoreDescending(items)
    .map((item, index) => ({ item, index }))
    .filter((entry) => entry.item.score !== null);

  const total = sorted.length;
  const rankings = new Map<T, { rank: number; percentile: number | null }>();

  for (const entry of sorted) {
    const rank = entry.index + 1;
    const percentile = total <= 1 ? 1 : clamp01((total - rank) / (total - 1));
    rankings.set(entry.item, { rank, percentile });
  }

  return items.map((item) => ({
    ...item,
    rank: rankings.get(item)?.rank ?? items.length,
    percentile: rankings.get(item)?.percentile ?? null,
  }));
}

function linkedEvidence(kind: LinkedEvidence['kind'], id: string, label: string, source: string | null): LinkedEvidence {
  return {
    kind,
    id,
    label,
    source,
  };
}

async function loadProviderSignalContext(
  npi: string,
  options: {
    sync?: boolean;
    prismaClient?: PrismaClient;
  } = {},
): Promise<ProviderSignalContext> {
  const snapshot = await buildProviderIntelligenceSnapshot({
    sync: options.sync,
    prismaClient: options.prismaClient ?? prisma,
  });

  const providerId = providerEntityId(npi);
  const providerEntity = snapshot.graph.identity.entities.find((entity) => entity.entityId === providerId);
  const specialtyRelation = snapshot.graph.identity.relations.find((relation) => (
    relation.sourceEntityId === providerId && relation.relationType === 'provider_to_specialty'
  ));
  const specialtyEntity = specialtyRelation
    ? snapshot.graph.identity.entities.find((entity) => entity.entityId === specialtyRelation.targetEntityId)
    : null;
  const specialty = asString(providerEntity?.metadata.specialty) ?? specialtyEntity?.label ?? null;
  const state = asString(providerEntity?.metadata.state)?.toUpperCase() ?? null;
  const providerLabel = providerEntity?.label ?? `Provider ${npi}`;

  const institutions = dedupeStrings(
    snapshot.graph.identity.relations
      .filter((relation) => relation.sourceEntityId === providerId && relation.relationType === 'provider_to_institution')
      .map((relation) => relation.targetEntityId),
  ).map((entityId) => ({
    entityId,
    label: snapshot.graph.identity.entities.find((entity) => entity.entityId === entityId)?.label ?? entityId,
  }));

  return {
    snapshot,
    providerId,
    providerNpi: npi,
    providerLabel,
    specialty,
    state,
    institutions,
    providerFindings: snapshot.findings.filter((finding) => (
      finding.entityId === providerId || finding.relatedEntityIds.includes(providerId)
    )),
    providerStorylines: snapshot.storylines.filter((storyline) => storyline.entityIds.includes(providerId)),
    providerPredictions: snapshot.predictions.filter((prediction) => (
      prediction.entity.entityType === 'provider' && prediction.entity.entityId === npi
    )),
    providerActions: snapshot.actions.filter((action) => action.entityId === providerId),
  };
}

function trustSourceSignals(trust: TrustScoreV1, findings: SnapshotFinding[], prediction: SnapshotPrediction | undefined): string[] {
  return dedupeStrings([
    ...Object.values(trust.dimensions).flatMap((dimension) => dimension.sources),
    ...findings.flatMap((finding) => finding.sources),
    ...prediction?.drivers.map((item) => item.source) ?? [],
  ]);
}

function buildProviderTrustScoreFromContext(
  context: ProviderSignalContext,
  trust: TrustScoreV1,
): ProviderTrustScore {
  const now = context.snapshot.generatedAt;
  const uniqueSources = dedupeStrings(
    Object.values(trust.dimensions).flatMap((dimension) => dimension.sources),
  ).length;
  const adverseIndicators = context.providerFindings.filter((finding) => (
    finding.findingType === 'sanction'
    || (finding.findingType === 'credential_change' && /revok|disciplin|suspend/i.test(JSON.stringify(finding.metadata)))
  )).length + trust.contradictions.filter((entry) => (
    entry.dimension === 'licensure' || entry.dimension === 'exclusion'
  )).length;
  const severityPenalty = Math.min(
    22,
    context.providerFindings.reduce((sum, finding) => sum + severityWeight(finding.severity), 0),
  );
  const trustRiskPrediction = context.providerPredictions.find((prediction) => prediction.type === 'TRUST_RISK_ACCELERATION');
  const trustRiskPenalty = Math.round((trustRiskPrediction?.score ?? 0) * 12);
  const evidenceDensityBoost = Math.min(6, uniqueSources * 1.25);
  const freshnessStatus = trust.dimensions.freshness.status;
  const freshnessAdjustment = freshnessStatus === 'FRESH'
    ? 3
    : freshnessStatus === 'AGING'
      ? 0
      : freshnessStatus === 'STALE'
        ? -6
        : -3;

  const insufficientSignal = trust.confidence < 0.3 && uniqueSources < 2;
  const score = insufficientSignal
    ? null
    : clampScore(trust.score + evidenceDensityBoost + freshnessAdjustment - severityPenalty - trustRiskPenalty);
  const tier = score === null ? 'Insufficient signal' : trustTier(score);
  const confidence = insufficientSignal
    ? clamp01(trust.confidence)
    : clamp01((trust.confidence * 0.82) + (Math.min(uniqueSources, 6) / 6 * 0.18));
  const sourceSignals = trustSourceSignals(trust, context.providerFindings, trustRiskPrediction);
  const drivers: IntelligenceDriver[] = [
    driver(
      'exclusion_status',
      trust.dimensions.exclusion.status,
      trust.dimensions.exclusion.status === 'CLEAR' ? 'UP' : 'DOWN',
      trust.dimensions.exclusion.sources[0] ?? 'TRUST_SCORE_V1',
      trust.dimensions.exclusion.explanation,
    ),
    driver(
      'licensure_integrity',
      trust.dimensions.licensure.pct,
      trust.dimensions.licensure.status === 'ACTIVE' || trust.dimensions.licensure.status === 'VERIFIED' ? 'UP' : 'DOWN',
      trust.dimensions.licensure.sources[0] ?? 'TRUST_SCORE_V1',
      trust.dimensions.licensure.explanation,
    ),
    driver(
      'board_certification',
      trust.dimensions.boardCert.status,
      trust.dimensions.boardCert.status === 'CERTIFIED' ? 'UP' : trust.dimensions.boardCert.status === 'NOT_CHECKED' ? 'FLAT' : 'DOWN',
      trust.dimensions.boardCert.sources[0] ?? 'TRUST_SCORE_V1',
      trust.dimensions.boardCert.explanation,
    ),
    driver(
      'verification_recency',
      trust.dimensions.freshness.pct,
      freshnessStatus === 'FRESH' ? 'UP' : freshnessStatus === 'AGING' ? 'FLAT' : 'DOWN',
      'FRESHNESS_MODEL',
      trust.dimensions.freshness.explanation,
    ),
    driver(
      'evidence_density',
      uniqueSources,
      uniqueSources >= 4 ? 'UP' : uniqueSources >= 2 ? 'FLAT' : 'DOWN',
      'SOURCE_COVERAGE',
      `${uniqueSources} corroborating source signal(s) are contributing to the current trust evaluation.`,
    ),
    driver(
      'historical_findings',
      adverseIndicators,
      adverseIndicators > 0 ? 'DOWN' : 'FLAT',
      trustRiskPrediction?.drivers[0]?.source ?? 'INVESTIGATOR_FINDINGS',
      adverseIndicators > 0
        ? `${adverseIndicators} adverse-action or trust-risk indicator(s) are active in the provider intelligence graph.`
        : 'No active adverse-action indicators were detected in the current intelligence window.',
    ),
  ];

  return {
    providerId: context.providerId,
    providerNpi: context.providerNpi,
    providerLabel: context.providerLabel,
    score,
    tier,
    confidence,
    drivers,
    sourceSignals,
    timestamp: trust.computedAt,
    last_updated: trust.computedAt,
    explanation: score === null
      ? defaultExplanation('trust coverage is too sparse to produce a reliable provider trust score')
      : `${context.providerLabel} is currently rated ${tier.toLowerCase()} because Trust Score V1 is ${trust.score}, freshness is ${trust.dimensions.freshness.status.toLowerCase()}, and ${uniqueSources} corroborating source signal(s) are available.`,
    insufficientSignal,
  };
}

function buildInfluenceSignalsFromSnapshot(snapshot: Snapshot): NetworkInfluenceScore[] {
  const projection = toNetworkProjection(snapshot.graph.network);
  const pageRankScores = new Map(pageRank(projection).map((entry) => [entry.nodeId, entry]));
  const betweennessScores = new Map(betweennessCentrality(projection).map((entry) => [entry.nodeId, entry]));
  const degreeScores = buildDegreeCentrality(projection);
  const articulation = new Set(articulationPoints(projection));
  const networkShiftByProvider = new Map<string, SnapshotPrediction>(
    snapshot.predictions
      .filter((prediction) => prediction.type === 'NETWORK_SHIFT' && prediction.entity.entityType === 'provider')
      .map((prediction) => [providerEntityId(prediction.entity.entityId), prediction]),
  );

  const unsorted = snapshot.graph.network.entities
    .filter((entity) => entity.entityType === 'provider')
    .filter((entity) => NPI_RE.test(entity.entityId.replace(/^provider:/, '')))
    .map((entity) => {
      const nodeId = entity.entityId;
      const providerNpi = nodeId.replace(/^provider:/, '');
      const edges = snapshot.graph.network.edges.filter((edge) => (
        edge.sourceEntityId === nodeId || edge.targetEntityId === nodeId
      ));
      const relationshipSignals = new Set(edges.map((edge) => relationshipSourceSignal(edge.relationshipType)));
      const networkShift = networkShiftByProvider.get(nodeId);
      const centralityDelta = predictionDriverValue(networkShift, 'centrality_change');
      const pageRankScore = pageRankScores.get(nodeId)?.score ?? 0;
      const betweennessScore = betweennessScores.get(nodeId)?.score ?? 0;
      const degreeScore = degreeScores.get(nodeId)?.score ?? 0;
      const score = clampScore(
        ((pageRankScore * 0.45)
          + (betweennessScore * 0.3)
          + (degreeScore * 0.2)
          + (articulation.has(nodeId) ? 0.05 : 0)) * 100,
      );
      const confidence = clamp01(
        0.35
        + (Math.min(edges.length, 12) / 12 * 0.25)
        + (Math.min(relationshipSignals.size, 4) / 4 * 0.2)
        + (pageRankScore > 0 ? 0.1 : 0)
        + (betweennessScore > 0 ? 0.1 : 0),
      );

      return {
        providerId: nodeId,
        providerNpi,
        providerLabel: entity.label,
        score,
        confidence,
        drivers: [
          driver(
            'page_rank',
            Number(pageRankScore.toFixed(4)),
            pageRankScore >= 0.5 ? 'UP' : 'FLAT',
            'GRAPH_RUNTIME',
            'PageRank measures influence across the live collaboration graph.',
          ),
          driver(
            'betweenness_centrality',
            Number(betweennessScore.toFixed(4)),
            betweennessScore >= 0.5 ? 'UP' : 'FLAT',
            'GRAPH_RUNTIME',
            'Betweenness centrality measures how often the provider bridges otherwise separate groups.',
          ),
          driver(
            'degree_centrality',
            Number(degreeScore.toFixed(4)),
            degreeScore >= 0.5 ? 'UP' : 'FLAT',
            'GRAPH_RUNTIME',
            `${degreeScores.get(nodeId)?.count ?? 0} active relationship(s) are contributing to the current degree centrality.`,
          ),
          driver(
            'articulation_point',
            articulation.has(nodeId) ? 'yes' : 'no',
            articulation.has(nodeId) ? 'UP' : 'FLAT',
            'GRAPH_RUNTIME',
            articulation.has(nodeId)
              ? 'The provider currently bridges multiple communities in the network graph.'
              : 'The provider is not currently an articulation point in the network graph.',
          ),
        ],
        sourceSignals: dedupeStrings(['GRAPH_RUNTIME', ...relationshipSignals]),
        centrality_delta: centralityDelta,
        percentile: null,
        tier: 'Peripheral',
        timestamp: snapshot.generatedAt,
        last_updated: snapshot.generatedAt,
        explanation: '',
        insufficientSignal: edges.length === 0,
      };
    });

  return withPercentiles(unsorted)
    .map((entry) => ({
      ...entry,
      tier: entry.score === null ? 'Insufficient signal' : influenceTier(entry.percentile ?? 0),
      explanation: entry.insufficientSignal
        ? defaultExplanation('the provider has no active network edges in the current graph')
        : `${entry.providerLabel} is ${influenceTier(entry.percentile ?? 0).toLowerCase()} because PageRank is ${entry.drivers[0]?.value}, betweenness is ${entry.drivers[1]?.value}, and degree centrality is ${entry.drivers[2]?.value}.`,
    }))
    .sort((left, right) => (
      (right.score ?? -1) - (left.score ?? -1)
        || (right.percentile ?? -1) - (left.percentile ?? -1)
        || left.providerLabel.localeCompare(right.providerLabel)
    ));
}

function buildSpecialtyPressureSignals(
  snapshot: Snapshot,
  scarcitySignals: ScarcitySignal[],
): WorkforcePressureIndex[] {
  const hotSpotsBySpecialty = new Map<string, ScarcitySignal[]>();
  for (const signal of scarcitySignals) {
    const key = slugify(signal.specialty);
    const list = hotSpotsBySpecialty.get(key) ?? [];
    list.push(signal);
    hotSpotsBySpecialty.set(key, list);
  }

  return snapshot.predictions
    .filter((prediction) => prediction.type === 'SPECIALTY_PRESSURE' && prediction.entity.entityType === 'specialty')
    .map((prediction) => {
      const specialty = prediction.entity.entityLabel ?? prediction.entity.entityId;
      const specialtyId = slugify(specialty);
      const hotSpots = [...(hotSpotsBySpecialty.get(specialtyId) ?? [])]
        .sort((left, right) => right.scarcityScore - left.scarcityScore)
        .slice(0, 8);
      const score = clampScore(prediction.score * 100);
      const state = normalizePressureState(prediction.scoreLabel);
      const confidence = clamp01(
        (prediction.confidence * 0.82) + (Math.min(hotSpots.length, 5) / 5 * 0.18),
      );
      const sourceSignals = dedupeStrings([
        ...prediction.drivers.map((item) => item.source),
        hotSpots.length > 0 ? 'AVAILABILITY_POOL' : null,
        hotSpots.length > 0 ? 'DECISION_CAPSULE' : null,
      ]);
      const severeHotspots = hotSpots.filter((item) => item.scarcityLabel === 'CRITICAL').length;
      const drivers = [
        ...prediction.drivers.slice(0, 4),
        driver(
          'geography_hotspots',
          hotSpots.length,
          hotSpots.length >= 3 ? 'UP' : hotSpots.length > 0 ? 'FLAT' : 'DOWN',
          'WORKFORCE_SCARCITY',
          hotSpots.length > 0
            ? `${hotSpots.length} geography hotspot(s) currently reinforce this specialty pressure signal.`
            : 'No geography hotspots are currently reinforcing this specialty signal.',
        ),
        driver(
          'critical_hotspots',
          severeHotspots,
          severeHotspots > 0 ? 'UP' : 'FLAT',
          'WORKFORCE_SCARCITY',
          severeHotspots > 0
            ? `${severeHotspots} geography hotspot(s) are already in a critical scarcity state for this specialty.`
            : 'No critical geography hotspots are currently active for this specialty.',
        ),
      ];

      return {
        id: specialtyId,
        state,
        score: prediction.scoreLabel === 'insufficient_signal' ? null : score,
        confidence,
        drivers,
        sourceSignals,
        timestamp: prediction.last_updated,
        last_updated: prediction.last_updated,
        explanation: prediction.scoreLabel === 'insufficient_signal'
          ? defaultExplanation(`not enough corroborated workforce signals exist for ${specialty}`)
          : hotSpots.length > 0
            ? `${prediction.explanation} The strongest geography pressure is currently in ${hotSpots[0]!.state}.`
            : prediction.explanation,
        specialty,
        geography: hotSpots[0]?.state ?? null,
        hotspots: hotSpots.map((item) => ({
          geography: item.state,
          state: pressureStateFromScarcityLabel(item.scarcityLabel),
          score: item.scarcityScore,
          confidence: clamp01(0.45 + (item.availableClinicians > 0 ? 0.15 : 0) + (item.immediateCount > 0 ? 0.1 : 0)),
        })),
        insufficientSignal: prediction.scoreLabel === 'insufficient_signal',
      };
    })
    .sort((left, right) => (right.score ?? -1) - (left.score ?? -1));
}

function geographyStateFromScarcity(score: number, entries: ScarcitySignal[]): PressureState {
  if (entries.some((entry) => entry.scarcityLabel === 'CRITICAL') || score >= 80) {
    return 'severe';
  }
  if (entries.some((entry) => entry.scarcityLabel === 'HIGH') || score >= 60) {
    return 'high';
  }
  if (score >= 40) {
    return 'moderate';
  }
  return 'low';
}

function buildGeographyPressureSignals(
  scarcitySignals: ScarcitySignal[],
  now: string,
): WorkforcePressureIndex[] {
  const grouped = new Map<string, ScarcitySignal[]>();
  for (const signal of scarcitySignals) {
    const list = grouped.get(signal.state) ?? [];
    list.push(signal);
    grouped.set(signal.state, list);
  }

  return [...grouped.entries()].map(([stateCode, entries]) => {
    const maxScore = Math.max(...entries.map((entry) => entry.scarcityScore));
    const avgScore = entries.reduce((sum, entry) => sum + entry.scarcityScore, 0) / entries.length;
    const score = clampScore((maxScore * 0.65) + (avgScore * 0.35));
    const state = geographyStateFromScarcity(score, entries);
    const highDemandSpecialties = entries.filter((entry) => entry.demandSignal === 'HIGH').length;
    const verifiedSupply = entries.reduce((sum, entry) => sum + entry.l3Count + entry.l2Count, 0);
    const confidence = clamp01(
      0.42
      + (Math.min(entries.length, 8) / 8 * 0.22)
      + (Math.min(highDemandSpecialties, 3) / 3 * 0.12)
      + (verifiedSupply > 0 ? 0.12 : 0),
    );

    return {
      id: stateCode,
      state,
      score,
      confidence,
      drivers: [
        driver(
          'scarcity_peak',
          maxScore,
          maxScore >= 60 ? 'UP' : 'FLAT',
          'WORKFORCE_SCARCITY',
          `The highest specialty scarcity score in ${stateCode} is ${maxScore}.`,
        ),
        driver(
          'high_demand_specialties',
          highDemandSpecialties,
          highDemandSpecialties > 0 ? 'UP' : 'FLAT',
          'DECISION_CAPSULE',
          `${highDemandSpecialties} specialty bucket(s) show high near-term demand in ${stateCode}.`,
        ),
        driver(
          'verified_supply',
          verifiedSupply,
          verifiedSupply <= 5 ? 'DOWN' : 'FLAT',
          'AVAILABILITY_POOL',
          `${verifiedSupply} verified clinician availability record(s) are currently indexed for ${stateCode}.`,
        ),
      ],
      sourceSignals: ['WORKFORCE_SCARCITY', 'AVAILABILITY_POOL', 'DECISION_CAPSULE'],
      timestamp: now,
      last_updated: now,
      explanation: `${stateCode} is ${state} because the strongest specialty scarcity score is ${maxScore} and ${entries.length} specialty segment(s) are active in the current workforce view.`,
      specialty: null,
      geography: stateCode,
      hotspots: [],
      specialties: entries
        .sort((left, right) => right.scarcityScore - left.scarcityScore)
        .slice(0, 10)
        .map((entry) => ({
          specialty: entry.specialty,
          state: pressureStateFromScarcityLabel(entry.scarcityLabel),
          score: entry.scarcityScore,
          confidence: clamp01(0.45 + (entry.availableClinicians > 0 ? 0.15 : 0) + (entry.immediateCount > 0 ? 0.1 : 0)),
        })),
      insufficientSignal: false,
    };
  }).sort((left, right) => (right.score ?? -1) - (left.score ?? -1));
}

function buildInstitutionMomentumSignals(snapshot: Snapshot): InstitutionalMomentumIndex[] {
  return snapshot.predictions
    .filter((prediction) => prediction.type === 'INSTITUTION_MOMENTUM' && prediction.entity.entityType === 'institution')
    .map((prediction) => {
      const state = normalizeMomentumState(prediction.scoreLabel);
      const score = prediction.scoreLabel === 'insufficient_signal' ? null : clampScore(prediction.score * 100);
      const trendSummary = prediction.drivers.slice(0, 3)
        .map((item) => `${item.label.replace(/_/g, ' ')} ${String(item.value)}`)
        .join(', ');

      return {
        institutionId: prediction.entity.entityId,
        institutionLabel: prediction.entity.entityLabel ?? prediction.entity.entityId,
        state,
        score,
        confidence: clamp01(prediction.confidence),
        drivers: prediction.drivers.slice(0, 5),
        sourceSignals: dedupeStrings(prediction.drivers.map((item) => item.source)),
        trend_summary: trendSummary || 'No trend summary available.',
        timestamp: prediction.last_updated,
        last_updated: prediction.last_updated,
        explanation: prediction.scoreLabel === 'insufficient_signal'
          ? defaultExplanation(`institution momentum signals are too sparse for ${prediction.entity.entityLabel ?? prediction.entity.entityId}`)
          : prediction.explanation,
        insufficientSignal: prediction.scoreLabel === 'insufficient_signal',
      };
    })
    .sort((left, right) => (right.score ?? -1) - (left.score ?? -1));
}

function buildProviderWarnings(input: {
  context: ProviderSignalContext;
  trust: ProviderTrustScore;
  influence: NetworkInfluenceScore;
  workforcePressure: WorkforcePressureIndex;
  institutionMomentum: InstitutionalMomentumIndex | null;
}): EarlyWarningAlert[] {
  const providerTrajectory = input.context.providerPredictions.find((prediction) => prediction.type === 'PROVIDER_TRAJECTORY');
  const networkShift = input.context.providerPredictions.find((prediction) => prediction.type === 'NETWORK_SHIFT');
  const trustRisk = input.context.providerPredictions.find((prediction) => prediction.type === 'TRUST_RISK_ACCELERATION');
  const latestSanction = input.context.providerFindings.find((finding) => finding.findingType === 'sanction');
  const warnings: EarlyWarningAlert[] = [];

  if (latestSanction) {
    warnings.push({
      id: `warning:${latestSanction.id}`,
      headline: `${input.context.providerLabel} has a new sanction or exclusion signal`,
      entity: {
        entityType: 'provider',
        entityId: input.context.providerNpi,
        entityLabel: input.context.providerLabel,
      },
      type: 'sanction',
      state: 'active',
      score: null,
      confidence: clamp01(latestSanction.confidence),
      drivers: [
        driver(
          'sanction_signal',
          latestSanction.severity,
          'DOWN',
          latestSanction.sources[0] ?? 'OIG_LEIE',
          latestSanction.explanation,
        ),
      ],
      sourceSignals: latestSanction.sources,
      timestamp: latestSanction.createdAt,
      explanation: latestSanction.explanation,
      linkedEvidence: [linkedEvidence('finding', latestSanction.id, latestSanction.headline, latestSanction.sources[0] ?? null)],
      recommendedAction: 'Escalate compliance review and validate exclusion status before relying on this provider.',
    });
  }

  if (input.trust.score !== null && input.trust.score < 50) {
    warnings.push({
      id: `warning:trust:${input.context.providerNpi}`,
      headline: `${input.context.providerLabel} trust score crossed a monitoring threshold`,
      entity: {
        entityType: 'provider',
        entityId: input.context.providerNpi,
        entityLabel: input.context.providerLabel,
      },
      type: 'trust',
      state: input.trust.tier,
      score: input.trust.score,
      confidence: input.trust.confidence,
      drivers: input.trust.drivers.slice(0, 4),
      sourceSignals: input.trust.sourceSignals,
      timestamp: input.trust.last_updated,
      explanation: input.trust.explanation,
      linkedEvidence: [
        ...input.context.providerFindings.slice(0, 2).map((finding) => linkedEvidence('finding', finding.id, finding.headline, finding.sources[0] ?? null)),
        ...(trustRisk ? [linkedEvidence('prediction', trustRisk.predictionId, trustRisk.explanation, trustRisk.drivers[0]?.source ?? null)] : []),
      ],
      recommendedAction: 'Review recent trust drivers, refresh stale evidence, and inspect active findings before using this provider for high-trust workflows.',
    });
  }

  if (
    providerTrajectory
    && providerTrajectory.score >= 0.72
    && ((input.influence.percentile ?? 0) >= 0.9 || (input.influence.centrality_delta ?? 0) >= 1.5)
  ) {
    warnings.push({
      id: `warning:influence:${input.context.providerNpi}`,
      headline: `${input.context.providerLabel} influence trajectory is rising quickly`,
      entity: {
        entityType: 'provider',
        entityId: input.context.providerNpi,
        entityLabel: input.context.providerLabel,
      },
      type: 'influence',
      state: input.influence.tier,
      score: input.influence.score,
      confidence: clamp01((providerTrajectory.confidence + input.influence.confidence) / 2),
      drivers: [
        ...providerTrajectory.drivers.slice(0, 2),
        ...input.influence.drivers.slice(0, 2),
      ],
      sourceSignals: dedupeStrings([
        ...providerTrajectory.drivers.map((item) => item.source),
        ...input.influence.sourceSignals,
      ]),
      timestamp: providerTrajectory.last_updated,
      explanation: `${providerTrajectory.explanation} Current influence percentile is ${Math.round((input.influence.percentile ?? 0) * 100)}%.`,
      linkedEvidence: [
        linkedEvidence('prediction', providerTrajectory.predictionId, providerTrajectory.explanation, providerTrajectory.drivers[0]?.source ?? null),
        linkedEvidence('signal', input.context.providerNpi, input.influence.explanation, 'GRAPH_RUNTIME'),
      ],
      recommendedAction: 'Monitor collaboration expansion and publication growth to determine whether this provider is becoming a strategic network hub.',
    });
  }

  if (networkShift && networkShift.score >= 0.7) {
    warnings.push({
      id: `warning:network:${input.context.providerNpi}`,
      headline: `${input.context.providerLabel} network changed materially`,
      entity: {
        entityType: 'provider',
        entityId: input.context.providerNpi,
        entityLabel: input.context.providerLabel,
      },
      type: 'network_shift',
      state: networkShift.scoreLabel,
      score: clampScore(networkShift.score * 100),
      confidence: networkShift.confidence,
      drivers: networkShift.drivers.slice(0, 4),
      sourceSignals: dedupeStrings(networkShift.drivers.map((item) => item.source)),
      timestamp: networkShift.last_updated,
      explanation: networkShift.explanation,
      linkedEvidence: [linkedEvidence('prediction', networkShift.predictionId, networkShift.explanation, networkShift.drivers[0]?.source ?? null)],
      recommendedAction: 'Inspect the provider graph to identify new collaborators, lost bridges, or relationship concentration changes.',
    });
  }

  if (input.workforcePressure.state === 'severe' || input.workforcePressure.state === 'high') {
    warnings.push({
      id: `warning:pressure:${input.context.providerNpi}`,
      headline: `${input.context.providerLabel} is operating in a ${input.workforcePressure.state} pressure market`,
      entity: {
        entityType: 'provider',
        entityId: input.context.providerNpi,
        entityLabel: input.context.providerLabel,
      },
      type: 'workforce_pressure',
      state: input.workforcePressure.state,
      score: input.workforcePressure.score,
      confidence: input.workforcePressure.confidence,
      drivers: input.workforcePressure.drivers.slice(0, 4),
      sourceSignals: input.workforcePressure.sourceSignals,
      timestamp: input.workforcePressure.last_updated,
      explanation: input.workforcePressure.explanation,
      linkedEvidence: [
        linkedEvidence('signal', input.workforcePressure.id, input.workforcePressure.explanation, input.workforcePressure.sourceSignals[0] ?? null),
      ],
      recommendedAction: 'Track recruiting pressure, compensation movement, and credential readiness around this provider market.',
    });
  }

  if (input.institutionMomentum && input.institutionMomentum.state === 'expanding' && (input.institutionMomentum.score ?? 0) >= 70) {
    warnings.push({
      id: `warning:institution:${input.context.providerNpi}`,
      headline: `${input.institutionMomentum.institutionLabel} research momentum is accelerating`,
      entity: {
        entityType: 'institution',
        entityId: input.institutionMomentum.institutionId,
        entityLabel: input.institutionMomentum.institutionLabel,
      },
      type: 'institution_momentum',
      state: input.institutionMomentum.state,
      score: input.institutionMomentum.score,
      confidence: input.institutionMomentum.confidence,
      drivers: input.institutionMomentum.drivers.slice(0, 4),
      sourceSignals: input.institutionMomentum.sourceSignals,
      timestamp: input.institutionMomentum.last_updated,
      explanation: input.institutionMomentum.explanation,
      linkedEvidence: [linkedEvidence('signal', input.institutionMomentum.institutionId, input.institutionMomentum.trend_summary, input.institutionMomentum.sourceSignals[0] ?? null)],
      recommendedAction: `Monitor whether ${input.context.providerLabel} benefits from ${input.institutionMomentum.institutionLabel}'s expanding research footprint.`,
    });
  }

  return warnings
    .sort((left, right) => (
      right.confidence - left.confidence || Date.parse(right.timestamp) - Date.parse(left.timestamp)
    ))
    .slice(0, 8);
}

function buildFeedCounts(items: IntelligenceFeedItem[]): IntelligenceFeedResponse['counts'] {
  return items.reduce<IntelligenceFeedResponse['counts']>((acc, item) => {
    acc[item.type] += 1;
    return acc;
  }, {
    finding: 0,
    storyline: 0,
    prediction: 0,
    insight: 0,
    early_warning: 0,
  });
}

function buildProviderFeed(input: {
  summary: ProviderIntelligenceSummary;
  limit: number;
}): IntelligenceFeedResponse {
  const items: IntelligenceFeedItem[] = [
    {
      id: `insight:trust:${input.summary.npi}`,
      headline: `${input.summary.providerLabel} trust score`,
      entity: {
        entityType: 'provider',
        entityId: input.summary.npi,
        entityLabel: input.summary.providerLabel,
      },
      type: 'insight' as const,
      explanation: input.summary.trust.explanation,
      confidence: input.summary.trust.confidence,
      linkedEvidence: [],
      recommendedAction: null,
      created_at: input.summary.trust.last_updated,
      state: input.summary.trust.tier,
      score: input.summary.trust.score,
    },
    {
      id: `insight:influence:${input.summary.npi}`,
      headline: `${input.summary.providerLabel} network influence`,
      entity: {
        entityType: 'provider',
        entityId: input.summary.npi,
        entityLabel: input.summary.providerLabel,
      },
      type: 'insight' as const,
      explanation: input.summary.influence.explanation,
      confidence: input.summary.influence.confidence,
      linkedEvidence: [],
      recommendedAction: null,
      created_at: input.summary.influence.last_updated,
      state: input.summary.influence.tier,
      score: input.summary.influence.score,
    },
    ...input.summary.earlyWarnings.map((warning) => ({
      id: warning.id,
      headline: warning.headline,
      entity: warning.entity,
      type: 'early_warning' as const,
      explanation: warning.explanation,
      confidence: warning.confidence,
      linkedEvidence: warning.linkedEvidence,
      recommendedAction: warning.recommendedAction,
      created_at: warning.timestamp,
      state: warning.state,
      score: warning.score,
    })),
    ...input.summary.findings.slice(0, 6).map((finding) => ({
      id: `finding:${finding.id}`,
      headline: finding.headline,
      entity: {
        entityType: 'provider',
        entityId: input.summary.npi,
        entityLabel: input.summary.providerLabel,
      },
      type: 'finding' as const,
      explanation: finding.explanation,
      confidence: clamp01(finding.confidence),
      linkedEvidence: [linkedEvidence('finding', finding.id, finding.headline, finding.sources[0] ?? null)],
      recommendedAction: finding.severity === 'critical'
        ? 'Escalate immediately and verify the upstream evidence.'
        : 'Review the finding alongside related storyline context.',
      created_at: finding.createdAt,
      state: finding.severity,
      score: null,
    })),
    ...input.summary.storylines.slice(0, 4).map((storyline) => ({
      id: `storyline:${storyline.id}`,
      headline: storyline.headline,
      entity: {
        entityType: 'provider',
        entityId: input.summary.npi,
        entityLabel: input.summary.providerLabel,
      },
      type: 'storyline' as const,
      explanation: storyline.summary,
      confidence: 0.72,
      linkedEvidence: storyline.findings.slice(0, 3).map((findingId) => linkedEvidence('finding', findingId, storyline.headline, null)),
      recommendedAction: 'Review the storyline and compare its supporting findings before actioning.',
      created_at: storyline.lastEvent,
      state: storyline.maxSeverity,
      score: null,
    })),
    ...input.summary.predictions.slice(0, 6).map((prediction) => ({
      id: `prediction:${prediction.predictionId}`,
      headline: `${prediction.entity.entityLabel ?? prediction.entity.entityId} ${prediction.type.replace(/_/g, ' ').toLowerCase()}`,
      entity: {
        entityType: prediction.entity.entityType,
        entityId: prediction.entity.entityId,
        entityLabel: prediction.entity.entityLabel ?? prediction.entity.entityId,
      },
      type: 'prediction' as const,
      explanation: prediction.explanation,
      confidence: prediction.confidence,
      linkedEvidence: [linkedEvidence('prediction', prediction.predictionId, prediction.explanation, prediction.drivers[0]?.source ?? null)],
      recommendedAction: 'Validate the forecast against recent findings and graph evidence before acting on it.',
      created_at: prediction.last_updated,
      state: prediction.scoreLabel,
      score: clampScore(prediction.score * 100),
    })),
  ]
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .slice(0, input.limit);

  return {
    generatedAt: input.summary.generatedAt,
    total: items.length,
    counts: buildFeedCounts(items),
    items,
  };
}

export async function getProviderTrustScore(
  npi: string,
  options: {
    sync?: boolean;
    prismaClient?: PrismaClient;
  } = {},
): Promise<ProviderTrustScore> {
  const context = await loadProviderSignalContext(npi, options);
  const trust = await computeTrustScoreV1(npi);
  return buildProviderTrustScoreFromContext(context, trust);
}

export async function listProviderInfluenceScores(
  options: {
    sync?: boolean;
    limit?: number;
    prismaClient?: PrismaClient;
  } = {},
): Promise<{
    generatedAt: string;
    scores: NetworkInfluenceScore[];
  }> {
  const snapshot = await buildProviderIntelligenceSnapshot({
    sync: options.sync,
    prismaClient: options.prismaClient ?? prisma,
  });
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 500);
  return {
    generatedAt: snapshot.generatedAt,
    scores: buildInfluenceSignalsFromSnapshot(snapshot).slice(0, limit),
  };
}

export async function getProviderInfluenceScore(
  npi: string,
  options: {
    sync?: boolean;
    prismaClient?: PrismaClient;
  } = {},
): Promise<NetworkInfluenceScore> {
  const result = await listProviderInfluenceScores({
    ...options,
    limit: 1_000,
  });
  return result.scores.find((entry) => entry.providerNpi === npi) ?? {
    providerId: providerEntityId(npi),
    providerNpi: npi,
    providerLabel: `Provider ${npi}`,
    score: null,
    percentile: null,
    tier: 'Insufficient signal',
    confidence: 0,
    drivers: [],
    sourceSignals: ['GRAPH_RUNTIME'],
    centrality_delta: null,
    timestamp: result.generatedAt,
    last_updated: result.generatedAt,
    explanation: defaultExplanation('the provider has no connected collaboration graph'),
    insufficientSignal: true,
  };
}

export async function listSpecialtyPressureIndexes(
  options: {
    sync?: boolean;
    limit?: number;
    prismaClient?: PrismaClient;
  } = {},
): Promise<{
    generatedAt: string;
    specialties: WorkforcePressureIndex[];
  }> {
  const snapshot = await buildProviderIntelligenceSnapshot({
    sync: options.sync,
    prismaClient: options.prismaClient ?? prisma,
  });
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
  const scarcity = await computeExpertiseScarcity(500);
  return {
    generatedAt: snapshot.generatedAt,
    specialties: buildSpecialtyPressureSignals(snapshot, scarcity).slice(0, limit),
  };
}

export async function getSpecialtyPressureIndex(
  slug: string,
  options: {
    sync?: boolean;
    prismaClient?: PrismaClient;
  } = {},
): Promise<WorkforcePressureIndex> {
  const result = await listSpecialtyPressureIndexes({
    ...options,
    limit: 500,
  });
  const normalizedSlug = slugify(slug);
  return result.specialties.find((entry) => entry.id === normalizedSlug) ?? {
    id: normalizedSlug,
    state: 'insufficient_signal',
    score: null,
    confidence: 0,
    drivers: [],
    sourceSignals: ['WORKFORCE_SCARCITY'],
    timestamp: result.generatedAt,
    last_updated: result.generatedAt,
    explanation: defaultExplanation(`specialty pressure data is unavailable for ${slug}`),
    specialty: slug,
    geography: null,
    hotspots: [],
    insufficientSignal: true,
  };
}

export async function listGeographyPressureIndexes(
  options: {
    limit?: number;
  } = {},
): Promise<{
    generatedAt: string;
    geographies: WorkforcePressureIndex[];
  }> {
  const generatedAt = new Date().toISOString();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
  const scarcity = await computeExpertiseScarcity(500);
  return {
    generatedAt,
    geographies: buildGeographyPressureSignals(scarcity, generatedAt).slice(0, limit),
  };
}

export async function getGeographyPressureIndex(
  geographyId: string,
): Promise<WorkforcePressureIndex> {
  const result = await listGeographyPressureIndexes({
    limit: 500,
  });
  const key = geographyId.trim().toUpperCase();
  return result.geographies.find((entry) => entry.id === key) ?? {
    id: key,
    state: 'insufficient_signal',
    score: null,
    confidence: 0,
    drivers: [],
    sourceSignals: ['WORKFORCE_SCARCITY'],
    timestamp: result.generatedAt,
    last_updated: result.generatedAt,
    explanation: defaultExplanation(`geography pressure data is unavailable for ${key}`),
    specialty: null,
    geography: key,
    hotspots: [],
    specialties: [],
    insufficientSignal: true,
  };
}

export async function listInstitutionMomentumIndexes(
  options: {
    sync?: boolean;
    limit?: number;
    prismaClient?: PrismaClient;
  } = {},
): Promise<{
    generatedAt: string;
    institutions: InstitutionalMomentumIndex[];
  }> {
  const snapshot = await buildProviderIntelligenceSnapshot({
    sync: options.sync,
    prismaClient: options.prismaClient ?? prisma,
  });
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
  return {
    generatedAt: snapshot.generatedAt,
    institutions: buildInstitutionMomentumSignals(snapshot).slice(0, limit),
  };
}

export async function getInstitutionMomentumIndex(
  institutionId: string,
  options: {
    sync?: boolean;
    prismaClient?: PrismaClient;
  } = {},
): Promise<InstitutionalMomentumIndex> {
  const result = await listInstitutionMomentumIndexes({
    ...options,
    limit: 500,
  });
  const normalized = slugify(institutionId);
  return result.institutions.find((entry) => entry.institutionId === normalized) ?? {
    institutionId: normalized,
    institutionLabel: institutionId,
    state: 'insufficient_signal',
    score: null,
    confidence: 0,
    drivers: [],
    sourceSignals: ['INSTITUTION_MOMENTUM'],
    trend_summary: 'Insufficient signal',
    timestamp: result.generatedAt,
    last_updated: result.generatedAt,
    explanation: defaultExplanation(`institution momentum data is unavailable for ${institutionId}`),
    insufficientSignal: true,
  };
}

function combineProviderPressure(
  specialtySignal: WorkforcePressureIndex,
  geographySignal: WorkforcePressureIndex,
  providerSpecialty: string | null,
  providerState: string | null,
  now: string,
): WorkforcePressureIndex {
  if (specialtySignal.insufficientSignal && geographySignal.insufficientSignal) {
    return {
      id: providerSpecialty ? slugify(providerSpecialty) : providerState ?? 'provider-context',
      state: 'insufficient_signal',
      score: null,
      confidence: 0,
      drivers: [],
      sourceSignals: ['WORKFORCE_SCARCITY'],
      timestamp: now,
      last_updated: now,
      explanation: defaultExplanation('provider specialty or geography pressure signals are unavailable'),
      specialty: providerSpecialty,
      geography: providerState,
      hotspots: [],
      insufficientSignal: true,
    };
  }

  const specialtyScore = specialtySignal.score ?? 0;
  const geographyScore = geographySignal.score ?? 0;
  const score = clampScore((specialtyScore * 0.65) + (geographyScore * 0.35));
  const state = geographyStateFromScarcity(score, []);
  const drivers = [
    ...specialtySignal.drivers.slice(0, 3),
    ...geographySignal.drivers.slice(0, 2),
  ].slice(0, 5);

  return {
    id: providerSpecialty ? slugify(providerSpecialty) : geographySignal.id,
    state,
    score,
    confidence: clamp01(((specialtySignal.confidence + geographySignal.confidence) / 2) || specialtySignal.confidence || geographySignal.confidence),
    drivers,
    sourceSignals: dedupeStrings([
      ...specialtySignal.sourceSignals,
      ...geographySignal.sourceSignals,
    ]),
    timestamp: now,
    last_updated: now,
    explanation: `${providerSpecialty ?? 'Provider specialty'} pressure is ${state} in ${providerState ?? 'the current market'} because specialty pressure is ${specialtySignal.state} and geography pressure is ${geographySignal.state}.`,
    specialty: providerSpecialty,
    geography: providerState,
    hotspots: specialtySignal.hotspots.filter((item) => item.geography === providerState).slice(0, 3),
    insufficientSignal: false,
  };
}

export async function getProviderIntelligenceSummary(
  npi: string,
  options: {
    sync?: boolean;
    prismaClient?: PrismaClient;
    limit?: number;
  } = {},
): Promise<ProviderIntelligenceSummary> {
  const context = await loadProviderSignalContext(npi, options);
  const trustState = await computeTrustScoreV1(npi);
  const trust = buildProviderTrustScoreFromContext(context, trustState);
  const influence = buildInfluenceSignalsFromSnapshot(context.snapshot).find((entry) => entry.providerNpi === npi) ?? {
    providerId: context.providerId,
    providerNpi: npi,
    providerLabel: context.providerLabel,
    score: null,
    percentile: null,
    tier: 'Insufficient signal',
    confidence: 0,
    drivers: [],
    sourceSignals: ['GRAPH_RUNTIME'],
    centrality_delta: null,
    timestamp: context.snapshot.generatedAt,
    last_updated: context.snapshot.generatedAt,
    explanation: defaultExplanation('the provider has no connected collaboration graph'),
    insufficientSignal: true,
  };
  const scarcity = await computeExpertiseScarcity(500);
  const specialtySignals = buildSpecialtyPressureSignals(context.snapshot, scarcity);
  const geographySignals = buildGeographyPressureSignals(scarcity, context.snapshot.generatedAt);
  const specialtySignal = context.specialty
    ? specialtySignals.find((entry) => entry.id === slugify(context.specialty ?? ''))
    : undefined;
  const geographySignal = context.state
    ? geographySignals.find((entry) => entry.id === context.state)
    : undefined;
  const workforcePressure = combineProviderPressure(
    specialtySignal ?? {
      id: context.specialty ? slugify(context.specialty) : 'provider-specialty',
      state: 'insufficient_signal',
      score: null,
      confidence: 0,
      drivers: [],
      sourceSignals: ['WORKFORCE_SCARCITY'],
      timestamp: context.snapshot.generatedAt,
      last_updated: context.snapshot.generatedAt,
      explanation: defaultExplanation('specialty pressure is unavailable'),
      specialty: context.specialty,
      geography: context.state,
      hotspots: [],
      insufficientSignal: true,
    },
    geographySignal ?? {
      id: context.state ?? 'provider-geography',
      state: 'insufficient_signal',
      score: null,
      confidence: 0,
      drivers: [],
      sourceSignals: ['WORKFORCE_SCARCITY'],
      timestamp: context.snapshot.generatedAt,
      last_updated: context.snapshot.generatedAt,
      explanation: defaultExplanation('geography pressure is unavailable'),
      specialty: null,
      geography: context.state,
      hotspots: [],
      specialties: [],
      insufficientSignal: true,
    },
    context.specialty,
    context.state,
    context.snapshot.generatedAt,
  );
  const institutions = buildInstitutionMomentumSignals(context.snapshot);
  const institutionMomentum = context.institutions
    .map((institution) => institutions.find((entry) => entry.institutionId === institution.entityId.replace(/^institution:/, '')) ?? null)
    .find((entry): entry is InstitutionalMomentumIndex => entry !== null) ?? null;
  const earlyWarnings = buildProviderWarnings({
    context,
    trust,
    influence,
    workforcePressure,
    institutionMomentum,
  });

  const summary: ProviderIntelligenceSummary = {
    npi,
    providerId: context.providerId,
    providerLabel: context.providerLabel,
    specialty: context.specialty,
    geography: context.state,
    trust,
    influence,
    workforcePressure,
    institutionMomentum,
    earlyWarnings,
    findings: context.providerFindings.slice(0, 12),
    storylines: context.providerStorylines.slice(0, 8),
    predictions: context.providerPredictions.slice(0, 12),
    actions: context.providerActions.slice(0, 8),
    feed: {
      generatedAt: context.snapshot.generatedAt,
      total: 0,
      counts: {
        finding: 0,
        storyline: 0,
        prediction: 0,
        insight: 0,
        early_warning: 0,
      },
      items: [],
    },
    summary: `${context.providerLabel} trust is ${trust.tier.toLowerCase()}, network influence is ${influence.tier.toLowerCase()}, and workforce pressure is ${workforcePressure.state}.`,
    generatedAt: context.snapshot.generatedAt,
  };

  summary.feed = buildProviderFeed({
    summary,
    limit: Math.min(Math.max(options.limit ?? 20, 5), 50),
  });

  return summary;
}

export async function buildIntelligenceFeed(
  options: {
    providerNpi?: string | null;
    sync?: boolean;
    limit?: number;
    prismaClient?: PrismaClient;
  } = {},
): Promise<IntelligenceFeedResponse> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);

  if (options.providerNpi && NPI_RE.test(options.providerNpi)) {
    const summary = await getProviderIntelligenceSummary(options.providerNpi, options);
    return buildProviderFeed({
      summary,
      limit,
    });
  }

  const snapshot = await buildProviderIntelligenceSnapshot({
    sync: options.sync,
    prismaClient: options.prismaClient ?? prisma,
  });
  const scarcity = await computeExpertiseScarcity(500);
  const influenceScores = buildInfluenceSignalsFromSnapshot(snapshot).slice(0, 5);
  const specialtySignals = buildSpecialtyPressureSignals(snapshot, scarcity).slice(0, 5);
  const institutionSignals = buildInstitutionMomentumSignals(snapshot).slice(0, 5);
  const items: IntelligenceFeedItem[] = [
    ...snapshot.findings.slice(0, 8).map((finding) => ({
      id: `finding:${finding.id}`,
      headline: finding.headline,
      entity: {
        entityType: finding.entityId.startsWith('provider:') ? 'provider' : 'entity',
        entityId: finding.entityId.replace(/^provider:/, ''),
        entityLabel: finding.headline,
      },
      type: 'finding' as const,
      explanation: finding.explanation,
      confidence: clamp01(finding.confidence),
      linkedEvidence: [linkedEvidence('finding', finding.id, finding.headline, finding.sources[0] ?? null)],
      recommendedAction: finding.severity === 'critical' ? 'Escalate immediately.' : 'Review supporting evidence.',
      created_at: finding.createdAt,
      state: finding.severity,
      score: null,
    })),
    ...snapshot.storylines.slice(0, 6).map((storyline) => ({
      id: `storyline:${storyline.id}`,
      headline: storyline.headline,
      entity: {
        entityType: 'storyline',
        entityId: storyline.id,
        entityLabel: storyline.headline,
      },
      type: 'storyline' as const,
      explanation: storyline.summary,
      confidence: 0.7,
      linkedEvidence: storyline.findings.slice(0, 3).map((findingId) => linkedEvidence('finding', findingId, storyline.headline, null)),
      recommendedAction: 'Inspect the linked findings before escalating.',
      created_at: storyline.lastEvent,
      state: storyline.maxSeverity,
      score: null,
    })),
    ...snapshot.predictions
      .filter((prediction) => prediction.scoreLabel !== 'insufficient_signal')
      .slice(0, 8)
      .map((prediction) => ({
        id: `prediction:${prediction.predictionId}`,
        headline: `${prediction.entity.entityLabel ?? prediction.entity.entityId} ${prediction.type.replace(/_/g, ' ').toLowerCase()}`,
        entity: {
          entityType: prediction.entity.entityType,
          entityId: prediction.entity.entityId,
          entityLabel: prediction.entity.entityLabel ?? prediction.entity.entityId,
        },
        type: 'prediction' as const,
        explanation: prediction.explanation,
        confidence: prediction.confidence,
        linkedEvidence: [linkedEvidence('prediction', prediction.predictionId, prediction.explanation, prediction.drivers[0]?.source ?? null)],
        recommendedAction: 'Validate this forecast against current evidence before actioning it.',
        created_at: prediction.last_updated,
        state: prediction.scoreLabel,
        score: clampScore(prediction.score * 100),
      })),
    ...influenceScores.map((signal) => ({
      id: `insight:influence:${signal.providerNpi}`,
      headline: `${signal.providerLabel} network influence`,
      entity: {
        entityType: 'provider',
        entityId: signal.providerNpi,
        entityLabel: signal.providerLabel,
      },
      type: 'insight' as const,
      explanation: signal.explanation,
      confidence: signal.confidence,
      linkedEvidence: [],
      recommendedAction: null,
      created_at: signal.last_updated,
      state: signal.tier,
      score: signal.score,
    })),
    ...specialtySignals.map((signal) => ({
      id: `insight:pressure:${signal.id}`,
      headline: `${signal.specialty ?? signal.id} workforce pressure`,
      entity: {
        entityType: 'specialty',
        entityId: signal.id,
        entityLabel: signal.specialty ?? signal.id,
      },
      type: 'insight' as const,
      explanation: signal.explanation,
      confidence: signal.confidence,
      linkedEvidence: [],
      recommendedAction: null,
      created_at: signal.last_updated,
      state: signal.state,
      score: signal.score,
    })),
    ...institutionSignals.map((signal) => ({
      id: `insight:momentum:${signal.institutionId}`,
      headline: `${signal.institutionLabel} institutional momentum`,
      entity: {
        entityType: 'institution',
        entityId: signal.institutionId,
        entityLabel: signal.institutionLabel,
      },
      type: 'insight' as const,
      explanation: signal.explanation,
      confidence: signal.confidence,
      linkedEvidence: [],
      recommendedAction: null,
      created_at: signal.last_updated,
      state: signal.state,
      score: signal.score,
    })),
  ]
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .slice(0, limit);

  return {
    generatedAt: snapshot.generatedAt,
    total: items.length,
    counts: buildFeedCounts(items),
    items,
  };
}
