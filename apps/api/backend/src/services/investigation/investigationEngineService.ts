import { Prisma, type PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { sha256Hex } from '../../utils/deterministic';
import { withToolSpan } from '../../tools/tracing';
import { executeCopilotQuery } from '../copilot/copilotQueryService';
import { generateTrustGraph } from '../graph/graphEngine';
import { createGraphNodeId } from '../graph-engine/ids';
import { getGraphNode, traceProviderNetwork } from '../graph-engine/queryService';
import {
  getSourceReliabilityScore,
  listAnomalyHistory,
  listGraphInsights,
  listTrustScoreHistory,
  rebuildGraphInsights,
} from '../intelligence/intelligenceEngineService';
import { querySearch } from '../search/searchIndex';
import type { SearchRequestContext } from '../search/requestContext';
import { computeTrustScoreV1, type TrustScoreV1 } from '../trust/trustScoreV1';
import {
  createInvestigationEngine,
  type AnomalyReport,
  type InvestigationAnomaly,
  type InvestigationCopilotDigest,
  type InvestigationDependencies,
  type InvestigationGraphSummary,
  type InvestigationIntelligenceSummary,
  type InvestigationProviderProfile,
  type InvestigationSearchEvidence,
  type NetworkMap,
  type ProviderSummary,
  type TrustBreakdown,
} from '../../../../../../core/investigation/investigationEngine';
import type { ProviderComparisonInput, ProviderComparisonResult } from '../../../../../../core/comparison/providerComparison';
import type { AnomalyMemorySnapshot } from '../../../../../../core/intelligence/anomalyMemory';
import type { TrustEvolutionRecord } from '../../../../../../core/intelligence/trustEvolution';

type ClaimRow = {
  claimType: string;
  value: Prisma.JsonValue;
};

function asRecord(value: Prisma.JsonValue | Record<string, unknown> | undefined | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function publicationIdentifier(value: Prisma.JsonValue): string | null {
  const record = asRecord(value);
  return asString(record.pubmedId)
    ?? asString(record.openAlexId)
    ?? asString(record.title)?.toLowerCase()
    ?? null;
}

function extractGrantIds(value: Prisma.JsonValue): string[] {
  const record = asRecord(value);
  return uniqueStrings([
    ...asStringArray(record.grants),
    ...asStringArray(record.grantIds),
    ...asStringArray(record.awardIds),
    ...asStringArray(record.projectNumbers),
    asString(record.grantId) ?? '',
    asString(record.awardId) ?? '',
    asString(record.projectNumber) ?? '',
    asString(record.nihProjectId) ?? '',
  ]);
}

function parseAggregatePublicationCount(claims: ClaimRow[]): number {
  let aggregate = 0;

  for (const claim of claims) {
    if (claim.claimType !== 'PUBLICATION') {
      continue;
    }

    const title = asString(asRecord(claim.value).title);
    const match = title?.match(/^(\d+)\s+/);
    if (match) {
      aggregate = Math.max(aggregate, parseInt(match[1]!, 10));
    }
  }

  return aggregate;
}

function isActiveTrial(status: string): boolean {
  const normalized = normalizeText(status).toUpperCase();
  return ['RECRUITING', 'ACTIVE', 'ENROLLING_BY_INVITATION', 'NOT_YET_RECRUITING'].includes(normalized);
}

function publicSearchContext(query: string): SearchRequestContext {
  return {
    aclLevel: 'PUBLIC',
    isAuthenticated: false,
    membershipRoles: ['PUBLIC'],
    queryHash: sha256Hex(query.trim().toLowerCase()),
  };
}

async function loadHistoryWithFallback(
  npi: string,
  loader: (subjectType: string, subjectId: string, prismaClient: PrismaClient) => Promise<TrustEvolutionRecord[]>,
  prismaClient: PrismaClient,
): Promise<TrustEvolutionRecord[]> {
  for (const subjectType of ['CLINICIAN', 'PROVIDER', 'NPI']) {
    const rows = await loader(subjectType, npi, prismaClient);
    if (rows.length > 0) {
      return rows;
    }
  }

  return [];
}

async function loadAnomalyHistoryWithFallback(
  npi: string,
  prismaClient: PrismaClient,
): Promise<AnomalyMemorySnapshot[]> {
  for (const subjectType of ['CLINICIAN', 'PROVIDER', 'NPI']) {
    const rows = await listAnomalyHistory(subjectType, npi, prismaClient);
    if (rows.length > 0) {
      return rows;
    }
  }

  return [];
}

function mapTrustBreakdown(
  trustScore: TrustScoreV1,
  timeline: TrustEvolutionRecord[],
): TrustBreakdown {
  return {
    npi: trustScore.npi,
    methodology: trustScore.methodology,
    score: trustScore.score,
    band: trustScore.band,
    bandLabel: trustScore.bandLabel,
    confidence: trustScore.confidence,
    totalPenalty: trustScore.totalPenalty,
    dimensions: Object.entries(trustScore.dimensions).map(([key, dimension]) => ({
      key,
      score: dimension.score,
      max: dimension.max,
      status: dimension.status,
      explanation: dimension.explanation,
      gaps: [...dimension.gaps],
      sources: [...dimension.sources],
    })),
    contradictions: trustScore.contradictions.map((contradiction) => ({
      severity: contradiction.severity === 'CRITICAL'
        ? 'CRITICAL'
        : contradiction.severity === 'MODERATE'
          ? 'MEDIUM'
          : 'LOW',
      dimension: contradiction.dimension,
      description: contradiction.description,
      penalty: contradiction.penalty,
      sources: [...contradiction.sources],
    })),
    gaps: [...trustScore.gaps],
    trustLimits: [...trustScore.trustLimits],
    recommendations: [...trustScore.recommendations],
    timeline: timeline.map((point) => ({
      recordedAt: point.recordedAt,
      score: point.newScore,
      scoreDelta: point.scoreDelta,
      triggerEvent: point.triggerEvent,
      band: point.band ?? null,
      confidence: point.confidence ?? null,
    })),
  };
}

function highestSeverity(anomalies: InvestigationAnomaly[]): AnomalyReport['overallSeverity'] {
  if (anomalies.some((anomaly) => anomaly.severity === 'CRITICAL')) {
    return 'CRITICAL';
  }
  if (anomalies.some((anomaly) => anomaly.severity === 'HIGH')) {
    return 'HIGH';
  }
  if (anomalies.some((anomaly) => anomaly.severity === 'MEDIUM')) {
    return 'MEDIUM';
  }
  if (anomalies.some((anomaly) => anomaly.severity === 'LOW')) {
    return 'LOW';
  }
  return 'NONE';
}

function recommendedActions(anomalies: InvestigationAnomaly[]): string[] {
  const actions: string[] = [];

  if (anomalies.some((anomaly) => anomaly.category === 'DIVERGENCE')) {
    actions.push('Review contradiction evidence and re-run primary source verification.');
  }
  if (anomalies.some((anomaly) => anomaly.category === 'TRUST_VOLATILITY')) {
    actions.push('Inspect trust score history for recent drops and identify the trigger event.');
  }
  if (anomalies.some((anomaly) => anomaly.category === 'GRAPH')) {
    actions.push('Inspect graph relationships for unexpected edges before using them in downstream decisions.');
  }
  if (anomalies.some((anomaly) => anomaly.category === 'SOURCE')) {
    actions.push('Re-verify low-reliability sources before elevating this provider.');
  }

  return uniqueStrings(actions);
}

async function loadComparisonClaims(
  npi: string,
  prismaClient: PrismaClient,
): Promise<ClaimRow[]> {
  const rows = await prismaClient.claimRecord.findMany({
    where: {
      subjectNpi: npi,
      claimType: {
        in: ['SPECIALTY', 'PUBLICATION', 'CLINICAL_TRIAL', 'INDUSTRY_PAYMENT'],
      },
      status: { in: ['ACTIVE', 'UNVERIFIED'] },
    },
    select: {
      claimType: true,
      value: true,
    },
    orderBy: { observedAt: 'desc' },
    take: 2_000,
  });

  return rows.map((row) => ({
    claimType: row.claimType,
    value: row.value,
  }));
}

async function resolveComparisonInput(
  npi: string,
  trustScore: TrustScoreV1,
  prismaClient: PrismaClient,
): Promise<ProviderComparisonInput> {
  const [profile, claims] = await Promise.all([
    prismaClient.personProfile.findFirst({
      where: { npi },
      select: {
        firstName: true,
        lastName: true,
        specialty: true,
      },
    }),
    loadComparisonClaims(npi, prismaClient),
  ]);

  const providerName = normalizeText([profile?.firstName ?? '', profile?.lastName ?? ''].join(' ')).trim()
    || `Provider ${npi}`;
  const specialties = uniqueStrings(
    claims
      .filter((claim) => claim.claimType === 'SPECIALTY')
      .map((claim) => asString(asRecord(claim.value).taxonomyDescription) ?? '')
      .filter(Boolean),
  );
  const publicationIds = uniqueStrings(
    claims
      .filter((claim) => claim.claimType === 'PUBLICATION')
      .map((claim) => publicationIdentifier(claim.value) ?? '')
      .filter(Boolean),
  );
  const totalPublications = Math.max(publicationIds.length, parseAggregatePublicationCount(claims));
  const citationCount = claims
    .filter((claim) => claim.claimType === 'PUBLICATION')
    .reduce((sum, claim) => sum + (asNumber(asRecord(claim.value).citationCount) ?? 0), 0);
  const recentPublications = claims
    .filter((claim) => claim.claimType === 'PUBLICATION')
    .filter((claim) => {
      const publishedDate = asString(asRecord(claim.value).publishedDate);
      if (!publishedDate) {
        return false;
      }

      const parsed = new Date(publishedDate);
      if (Number.isNaN(parsed.getTime())) {
        return false;
      }

      const ageYears = (Date.now() - parsed.getTime()) / (365 * 24 * 60 * 60 * 1000);
      return ageYears <= 3;
    }).length;
  const trials = claims.filter((claim) => claim.claimType === 'CLINICAL_TRIAL');
  const payments = claims.filter((claim) => claim.claimType === 'INDUSTRY_PAYMENT');

  return {
    npi,
    providerName,
    primarySpecialty: profile?.specialty ?? specialties[0] ?? null,
    secondarySpecialties: specialties.filter((specialty) => specialty !== (profile?.specialty ?? specialties[0] ?? null)),
    trustScore: trustScore.score,
    trustBand: trustScore.band,
    publicationMetrics: {
      totalPublications,
      citationCount,
      recentPublications,
    },
    fundingMetrics: {
      totalIndustryPayments: payments.reduce((sum, claim) => sum + (asNumber(asRecord(claim.value).totalAmount) ?? 0), 0),
      paymentRecordCount: payments.reduce((sum, claim) => sum + (asNumber(asRecord(claim.value).recordCount) ?? 0), 0),
      uniquePayers: uniqueStrings(payments.flatMap((claim) => asStringArray(asRecord(claim.value).topPayers))).length,
      sharedGrantCount: uniqueStrings(claims.flatMap((claim) => extractGrantIds(claim.value))).length,
    },
    trialMetrics: {
      totalTrials: uniqueStrings(trials.map((claim) => asString(asRecord(claim.value).nctId) ?? '')).length,
      activeTrials: trials.filter((claim) => isActiveTrial(asString(asRecord(claim.value).status) ?? 'UNKNOWN')).length,
      principalInvestigatorRoles: trials.filter(
        (claim) => (asString(asRecord(claim.value).role) ?? 'OTHER') === 'PRINCIPAL_INVESTIGATOR',
      ).length,
    },
  };
}

function createBackendDependencies(prismaClient: PrismaClient): InvestigationDependencies {
  const trustCache = new Map<string, Promise<TrustScoreV1>>();
  const timelineCache = new Map<string, Promise<TrustEvolutionRecord[]>>();
  const networkCache = new Map<string, Promise<NetworkMap>>();

  function loadTrustScore(npi: string): Promise<TrustScoreV1> {
    const existing = trustCache.get(npi);
    if (existing) {
      return existing;
    }

    const next = computeTrustScoreV1(npi);
    trustCache.set(npi, next);
    return next;
  }

  function loadTimeline(npi: string): Promise<TrustEvolutionRecord[]> {
    const existing = timelineCache.get(npi);
    if (existing) {
      return existing;
    }

    const next = loadHistoryWithFallback(npi, listTrustScoreHistory, prismaClient);
    timelineCache.set(npi, next);
    return next;
  }

  function loadNetwork(npi: string): Promise<NetworkMap> {
    const existing = networkCache.get(npi);
    if (existing) {
      return existing;
    }

    const next = traceProviderNetwork(npi, prismaClient);
    networkCache.set(npi, next);
    return next;
  }

  async function loadTrustBreakdownForNpi(npi: string): Promise<TrustBreakdown> {
    const [trustScore, timeline] = await Promise.all([
      loadTrustScore(npi),
      loadTimeline(npi),
    ]);

    return mapTrustBreakdown(trustScore, timeline);
  }

  return {
    async loadProviderProfile(npi) {
      const graphNodeId = createGraphNodeId({
        type: 'clinician',
        sourceKind: 'npi',
        sourceId: npi,
      });
      const [profile, graphNode, network] = await Promise.all([
        prismaClient.personProfile.findFirst({
          where: { npi },
          select: {
            firstName: true,
            lastName: true,
            specialty: true,
            stateOfPractice: true,
          },
        }),
        getGraphNode(graphNodeId, prismaClient).catch(() => null),
        loadNetwork(npi).catch(() => null),
      ]);
      const providerNode = (network as NetworkMap | null)?.nodes.find((node) => node.npi === npi);

      const providerName = normalizeText([profile?.firstName ?? '', profile?.lastName ?? ''].join(' ')).trim()
        || graphNode?.label
        || `Provider ${npi}`;

      return {
        npi,
        providerName,
        primarySpecialty: profile?.specialty ?? asString(graphNode?.metadata.specialty) ?? null,
        secondarySpecialties: [],
        state: profile?.stateOfPractice ?? asString(graphNode?.metadata.state) ?? null,
        affiliations: Array.isArray(providerNode?.metadata.affiliations)
          ? providerNode.metadata.affiliations.filter((entry): entry is string => typeof entry === 'string')
          : [],
      };
    },

    async loadSearchEvidence(npi, profile) {
      const query = uniqueStrings([
        profile?.providerName ?? '',
        profile?.primarySpecialty ?? '',
        npi,
      ]).join(' ');
      const response = await querySearch({
        q: query || npi,
        aclLevel: 'PUBLIC',
        limit: 5,
      });

      return response.results.map((result): InvestigationSearchEvidence => ({
        id: result.id,
        title: result.title,
        snippet: result.snippet,
        sourceUrl: result.sourceUrl,
        provenance: result.provenance,
        score: result.score,
        freshnessStatus: result.freshnessStatus,
        metadata: result.metadata,
      }));
    },

    async loadTrustBreakdown(npi) {
      return loadTrustBreakdownForNpi(npi);
    },

    async loadNetworkMap(npi) {
      return loadNetwork(npi);
    },

    async loadAnomalyReport(npi) {
      const [trustBreakdown, anomalyHistory] = await Promise.all([
        loadTrustBreakdownForNpi(npi),
        loadAnomalyHistoryWithFallback(npi, prismaClient),
      ]);
      const graphNodeId = createGraphNodeId({
        type: 'clinician',
        sourceKind: 'npi',
        sourceId: npi,
      });

      let graphInsights = await listGraphInsights(graphNodeId, prismaClient);

      if (graphInsights.length === 0) {
        const rebuilt = await rebuildGraphInsights({
          nodeId: graphNodeId,
          graphMode: 'trust',
        }, prismaClient).catch(() => []);
        graphInsights = rebuilt;
      }

      const anomalies: InvestigationAnomaly[] = [
        ...trustBreakdown.contradictions.map((contradiction, index) => ({
          id: `contradiction:${index}:${contradiction.dimension}`,
          category: 'DIVERGENCE' as const,
          severity: contradiction.severity,
          title: `${contradiction.dimension} contradiction`,
          description: contradiction.description,
          evidence: [...contradiction.sources],
          observedAt: new Date().toISOString(),
        })),
        ...anomalyHistory.map((entry) => ({
          id: entry.anomalyKey,
          category: 'DIVERGENCE' as const,
          severity: entry.severity,
          title: `${entry.anomalyType} anomaly`,
          description: entry.metadata['description']
            ? String(entry.metadata['description'])
            : `${entry.anomalyType} detected for ${entry.subjectId}.`,
          evidence: [...entry.sourceIds],
          observedAt: entry.lastDetectedAt,
          metadata: entry.metadata,
        })),
        ...trustBreakdown.timeline
          .filter((point) => point.scoreDelta <= -10)
          .map((point) => ({
            id: `trust-drop:${point.recordedAt}`,
            category: 'TRUST_VOLATILITY' as const,
            severity: point.scoreDelta <= -20 ? 'HIGH' as const : 'MEDIUM' as const,
            title: 'Trust score dropped materially',
            description: `${point.triggerEvent} changed the trust score by ${point.scoreDelta}.`,
            evidence: [point.triggerEvent],
            observedAt: point.recordedAt,
          })),
        ...graphInsights
          .filter((insight) => insight.insightType === 'ANOMALOUS_RELATIONSHIP')
          .map((insight) => ({
            id: `graph:${insight.nodeId}:${insight.timestamp}`,
            category: 'GRAPH' as const,
            severity: insight.confidence >= 0.85 ? 'HIGH' as const : 'MEDIUM' as const,
            title: insight.insightType,
            description: insight.explanation,
            evidence: [...insight.relatedNodeIds],
            observedAt: insight.timestamp,
            metadata: insight.metadata,
          })),
      ];

      return {
        npi,
        generatedAt: new Date().toISOString(),
        overallSeverity: highestSeverity(anomalies),
        anomalyCount: anomalies.length,
        anomalies,
        recommendedActions: recommendedActions(anomalies),
      };
    },

    async loadCopilotDigest(npi, profile) {
      const query = uniqueStrings([
        'investigate provider',
        profile?.providerName ?? '',
        profile?.primarySpecialty ?? '',
        npi,
        'trust anomalies network relationships',
      ]).join(' ');

      return withToolSpan(
        {
          toolName: 'investigation.copilot_digest',
          input: {
            npi,
            queryHash: sha256Hex(query.toLowerCase()),
          },
        },
        async () => {
          const response = await executeCopilotQuery({
            query,
            limit: 5,
            requestContext: publicSearchContext(query),
          });

          if (response.results.length === 0 && response.graphInsights.length === 0) {
            return null;
          }

          return {
            summary:
              response.explanations[0]?.summary
              ?? response.results[0]?.summary
              ?? `Investigation summary for ${profile?.providerName ?? npi}.`,
            reasoning: response.explanations[0]?.because.slice(0, 3) ?? [],
            graphHighlights: response.graphInsights.slice(0, 3).map((insight) => insight.summary),
          } satisfies InvestigationCopilotDigest;
        },
      );
    },

    async loadGraphSummary(npi) {
      const graph = await generateTrustGraph(npi);
      const dominantRelationships = Object.entries(
        graph.edges.reduce<Record<string, number>>((counts, edge) => {
          counts[edge.label] = (counts[edge.label] ?? 0) + 1;
          return counts;
        }, {}),
      )
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 3)
        .map(([label]) => label);

      return {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        dominantRelationships,
        highRiskNodes: graph.nodes
          .filter((node) => node.decisionRisk === 'HIGH' || node.decisionRisk === 'CRITICAL')
          .map((node) => node.label),
      } satisfies InvestigationGraphSummary;
    },

    async loadIntelligenceSummary(npi) {
      const trustScore = await loadTrustScore(npi);
      const graphNodeId = createGraphNodeId({
        type: 'clinician',
        sourceKind: 'npi',
        sourceId: npi,
      });
      const graphInsights = await listGraphInsights(graphNodeId, prismaClient);
      const sourceIds = uniqueStrings(
        Object.values(trustScore.dimensions).flatMap((dimension) => dimension.sources),
      );

      const sourceReliability = await Promise.all(
        sourceIds.slice(0, 5).map(async (sourceId) => {
          const reliability = await getSourceReliabilityScore(sourceId, prismaClient);
          return {
            sourceId,
            score: reliability.sourceReliabilityScore,
            explanation: reliability.explanation,
          };
        }),
      );

      return {
        graphInsights: graphInsights.map((insight) => ({
          type: insight.insightType,
          confidence: insight.confidence,
          explanation: insight.explanation,
        })),
        sourceReliability,
      } satisfies InvestigationIntelligenceSummary;
    },

    async loadComparisonInputs(npiList) {
      const uniqueNpis = uniqueStrings(npiList);
      const trustScores = await Promise.all(uniqueNpis.map((npi) => loadTrustScore(npi)));
      return Promise.all(
        uniqueNpis.map((npi, index) => resolveComparisonInput(npi, trustScores[index]!, prismaClient)),
      );
    },
  };
}

function backendInvestigationEngine(prismaClient: PrismaClient = prisma) {
  return createInvestigationEngine(createBackendDependencies(prismaClient));
}

export async function investigateProvider(
  npi: string,
  prismaClient: PrismaClient = prisma,
): Promise<ProviderSummary> {
  return backendInvestigationEngine(prismaClient).investigateProvider(npi);
}

export async function traceNetwork(
  npi: string,
  prismaClient: PrismaClient = prisma,
): Promise<NetworkMap> {
  return backendInvestigationEngine(prismaClient).traceNetwork(npi);
}

export async function compareProviders(
  npiList: string[],
  prismaClient: PrismaClient = prisma,
): Promise<ProviderComparisonResult> {
  return backendInvestigationEngine(prismaClient).compareProviders(npiList);
}

export async function findAnomalies(
  npi: string,
  prismaClient: PrismaClient = prisma,
): Promise<AnomalyReport> {
  return backendInvestigationEngine(prismaClient).findAnomalies(npi);
}
