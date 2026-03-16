import { SpanStatusCode, trace } from '@opentelemetry/api';
import { Prisma, type PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { createGraphNodeId } from '../graph-engine/ids';
import {
  createPredictionEngine,
  type EmergingInvestigatorPredictionInput,
  type InstitutionResearchGrowthPredictionInput,
  type NetworkClusterExpansionPredictionInput,
  type PredictionInsight,
  type PredictionTargetEntity,
  type TrustDeclinePredictionInput,
  type WorkforceShortagePredictionInput,
} from '../../../../../../core/predictions/predictionEngine';

const predictionTracer = trace.getTracer('vitalcv.predictions');

const ACTIVE_FINDING_STATUSES = ['new', 'acknowledged', 'investigating', 'escalated'] as const;
const COLLABORATION_EDGE_TYPES = ['co_author', 'co_pi', 'co_investigator', 'published_with', 'related_to'];
const RESEARCH_SOURCES = ['OPENALEX', 'PUBMED', 'CLINICAL_TRIALS', 'NIH_REPORTER'];
const NPI_RE = /^\d{10}$/;

type ResearchClaimRow = {
  subjectNpi: string;
  claimType: string;
  sourceId: string;
  createdAt: Date;
  value: Prisma.JsonValue;
};

type InstitutionAffiliationRow = {
  subjectNpi: string;
  createdAt: Date;
  value: Prisma.JsonValue;
};

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

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function daysAgo(nowIso: string, days: number): Date {
  return new Date(new Date(nowIso).getTime() - (days * 86_400_000));
}

function clinicianNodeIdForNpi(npi: string): string {
  return createGraphNodeId({
    type: 'clinician',
    sourceKind: 'npi',
    sourceId: npi,
  });
}

function extractCitationCount(value: Prisma.JsonValue): number {
  const record = asRecord(value);
  return asNumber(record.citationCount) ?? 0;
}

function extractInstitution(value: Prisma.JsonValue): string | null {
  const record = asRecord(value);
  return asString(record.institution)
    ?? asString(record.organization)
    ?? asString(record.affiliation)
    ?? asString(record.employer);
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function providerTarget(npi: string, label: string | null): PredictionTargetEntity {
  return {
    entityType: 'provider',
    entityId: npi,
    entityLabel: label ?? `Provider ${npi}`,
  };
}

function institutionTarget(name: string): PredictionTargetEntity {
  return {
    entityType: 'institution',
    entityId: `institution:${slugify(name)}`,
    entityLabel: name,
  };
}

function marketTarget(state: string, specialty: string): PredictionTargetEntity {
  return {
    entityType: 'market',
    entityId: `market:${state.toUpperCase()}:${slugify(specialty)}`,
    entityLabel: `${state.toUpperCase()} ${specialty}`,
  };
}

async function withPredictionSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  work: () => Promise<T>,
): Promise<T> {
  return predictionTracer.startActiveSpan(name, async (span) => {
    span.setAttributes(attributes);
    try {
      const result = await work();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'prediction failure',
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

async function loadProviderLabels(
  prismaClient: PrismaClient,
  npis: string[],
): Promise<Map<string, string>> {
  if (npis.length === 0) {
    return new Map();
  }

  const uniqueNpis = [...new Set(npis.filter((npi) => NPI_RE.test(npi)))];
  const [profiles, graphNodes] = await Promise.all([
    prismaClient.personProfile.findMany({
      where: { npi: { in: uniqueNpis } },
      select: {
        npi: true,
        firstName: true,
        lastName: true,
      },
    }),
    prismaClient.graphNode.findMany({
      where: {
        id: {
          in: uniqueNpis.map((npi) => clinicianNodeIdForNpi(npi)),
        },
      },
      select: {
        id: true,
        label: true,
        metadata: true,
      },
    }),
  ]);

  const labels = new Map<string, string>();
  for (const profile of profiles) {
    if (!profile.npi) {
      continue;
    }
    const name = [profile.firstName, profile.lastName].filter((value): value is string => Boolean(value)).join(' ').trim();
    if (name.length > 0) {
      labels.set(profile.npi, name);
    }
  }

  for (const node of graphNodes) {
    const metadata = asRecord(node.metadata);
    const npi = asString(metadata.npi);
    if (!npi || labels.has(npi)) {
      continue;
    }
    const fullName = asString(metadata.fullName);
    labels.set(npi, fullName ?? node.label);
  }

  return labels;
}

function findingSubjectId(row: {
  entityIds: string[];
  metadata: Prisma.JsonValue;
}): string | null {
  const metadata = asRecord(row.metadata);
  const metadataNpi = asString(metadata.npi);
  if (metadataNpi && NPI_RE.test(metadataNpi)) {
    return metadataNpi;
  }

  return row.entityIds.find((entityId) => NPI_RE.test(entityId)) ?? null;
}

async function loadTrustSignals(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<TrustDeclinePredictionInput[]> {
  const [historyRows, divergenceRows] = await Promise.all([
    prismaClient.trustScoreHistory.findMany({
      where: {
        subjectType: { in: ['NPI', 'PROVIDER', 'CLINICIAN'] },
        recordedAt: { gte: daysAgo(nowIso, 90) },
      },
      orderBy: [{ subjectId: 'asc' }, { recordedAt: 'desc' }],
      take: 2_000,
    }),
    prismaClient.investigatorFinding.findMany({
      where: {
        findingType: 'divergence',
        status: { in: [...ACTIVE_FINDING_STATUSES] },
        lastSeenAt: { gte: daysAgo(nowIso, 90) },
      },
      select: {
        entityIds: true,
        metadata: true,
      },
      take: 400,
    }),
  ]);

  const historyBySubject = new Map<string, typeof historyRows>();
  for (const row of historyRows) {
    const rows = historyBySubject.get(row.subjectId) ?? [];
    rows.push(row);
    historyBySubject.set(row.subjectId, rows);
  }

  const divergenceBySubject = new Map<string, { staleSourceCount: number; divergenceCount: number }>();
  for (const row of divergenceRows) {
    const subjectId = findingSubjectId(row);
    if (!subjectId) {
      continue;
    }
    const metadata = asRecord(row.metadata);
    const staleDimensions = Array.isArray(metadata.staleDimensions) ? metadata.staleDimensions.length : 0;
    const existing = divergenceBySubject.get(subjectId) ?? { staleSourceCount: 0, divergenceCount: 0 };
    divergenceBySubject.set(subjectId, {
      staleSourceCount: existing.staleSourceCount + staleDimensions,
      divergenceCount: existing.divergenceCount + 1,
    });
  }

  const labels = await loadProviderLabels(prismaClient, [...historyBySubject.keys()]);
  const signals: TrustDeclinePredictionInput[] = [];

  for (const [subjectId, rows] of historyBySubject) {
    const sorted = [...rows].sort((left, right) => right.recordedAt.getTime() - left.recordedAt.getTime());
    const latest = sorted[0];
    if (!latest) {
      continue;
    }

    const previous = sorted[1] ?? null;
    const recentDeclines = sorted.filter((row) => row.scoreDelta < 0 && row.recordedAt >= daysAgo(nowIso, 45)).length;
    const divergence = divergenceBySubject.get(subjectId) ?? { staleSourceCount: 0, divergenceCount: 0 };

    signals.push({
      targetEntity: providerTarget(subjectId, labels.get(subjectId) ?? null),
      recentScore: latest.newScore,
      previousScore: previous?.newScore ?? latest.previousScore ?? null,
      scoreDelta: latest.scoreDelta,
      recentDeclines,
      staleSourceCount: divergence.staleSourceCount,
      divergenceCount: divergence.divergenceCount,
      lastObservedAt: latest.recordedAt.toISOString(),
    });
  }

  return signals;
}

async function loadResearchClaimRows(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<ResearchClaimRow[]> {
  const rows = await prismaClient.claimRecord.findMany({
    where: {
      sourceId: { in: RESEARCH_SOURCES },
      createdAt: { gte: daysAgo(nowIso, 365) },
    },
    select: {
      subjectNpi: true,
      claimType: true,
      sourceId: true,
      createdAt: true,
      value: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5_000,
  });

  return rows.map((row) => ({
    subjectNpi: row.subjectNpi,
    claimType: row.claimType,
    sourceId: row.sourceId,
    createdAt: row.createdAt,
    value: row.value,
  }));
}

async function loadAffiliationRows(
  prismaClient: PrismaClient,
  npis: string[],
  nowIso: string,
): Promise<InstitutionAffiliationRow[]> {
  if (npis.length === 0) {
    return [];
  }

  const rows = await prismaClient.claimRecord.findMany({
    where: {
      subjectNpi: { in: npis },
      claimType: 'INSTITUTION_AFFILIATION',
      createdAt: { gte: daysAgo(nowIso, 365) },
    },
    select: {
      subjectNpi: true,
      createdAt: true,
      value: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 3_000,
  });

  return rows.map((row) => ({
    subjectNpi: row.subjectNpi,
    createdAt: row.createdAt,
    value: row.value,
  }));
}

type ResearchMetrics = {
  recentPublications: number;
  previousPublications: number;
  recentTrials: number;
  recentGrantCount: number;
  citationCount: number;
  lastObservedAt: string;
};

function buildResearchMetricsByNpi(
  claims: ResearchClaimRow[],
  nowIso: string,
): Map<string, ResearchMetrics> {
  const recentCutoff = daysAgo(nowIso, 180);
  const metricsByNpi = new Map<string, ResearchMetrics>();

  const grouped = new Map<string, ResearchClaimRow[]>();
  for (const claim of claims) {
    const rows = grouped.get(claim.subjectNpi) ?? [];
    rows.push(claim);
    grouped.set(claim.subjectNpi, rows);
  }

  for (const [npi, rows] of grouped) {
    const recent = rows.filter((row) => row.createdAt >= recentCutoff);
    const previous = rows.filter((row) => row.createdAt < recentCutoff);
    const recentPublications = recent.filter((row) => ['PUBLICATION', 'CITATION_METRIC'].includes(row.claimType)).length;
    const previousPublications = previous.filter((row) => ['PUBLICATION', 'CITATION_METRIC'].includes(row.claimType)).length;
    const recentTrials = recent.filter((row) => row.claimType === 'CLINICAL_TRIAL').length;
    const recentGrantCount = recent.filter((row) => row.sourceId === 'NIH_REPORTER' || row.claimType.includes('GRANT')).length;
    const citationCount = Math.max(0, ...recent.map((row) => extractCitationCount(row.value)));
    const lastObservedAt = rows[0]?.createdAt.toISOString() ?? new Date(nowIso).toISOString();

    metricsByNpi.set(npi, {
      recentPublications,
      previousPublications,
      recentTrials,
      recentGrantCount,
      citationCount,
      lastObservedAt,
    });
  }

  return metricsByNpi;
}

async function loadEmergingInvestigatorSignals(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<EmergingInvestigatorPredictionInput[]> {
  const claims = await loadResearchClaimRows(prismaClient, nowIso);
  const npis = [...new Set(claims.map((claim) => claim.subjectNpi).filter((subjectNpi) => NPI_RE.test(subjectNpi)))];
  if (npis.length === 0) {
    return [];
  }

  const [labels, graphNodes] = await Promise.all([
    loadProviderLabels(prismaClient, npis),
    prismaClient.graphNode.findMany({
      where: {
        id: {
          in: npis.map((npi) => clinicianNodeIdForNpi(npi)),
        },
      },
      select: {
        id: true,
        degree: true,
        metadata: true,
      },
    }),
  ]);

  const degreeByNpi = new Map<string, number>();
  for (const node of graphNodes) {
    const npi = asString(asRecord(node.metadata).npi);
    if (npi) {
      degreeByNpi.set(npi, node.degree);
    }
  }

  const metricsByNpi = buildResearchMetricsByNpi(claims, nowIso);
  const signals: EmergingInvestigatorPredictionInput[] = [];

  for (const [npi, metrics] of metricsByNpi) {
    signals.push({
      targetEntity: providerTarget(npi, labels.get(npi) ?? null),
      recentPublications: metrics.recentPublications,
      previousPublications: metrics.previousPublications,
      recentTrials: metrics.recentTrials,
      recentGrantCount: metrics.recentGrantCount,
      citationCount: metrics.citationCount,
      graphDegree: degreeByNpi.get(npi) ?? 0,
      lastObservedAt: metrics.lastObservedAt,
    });
  }

  return signals;
}

async function loadInstitutionResearchSignals(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<InstitutionResearchGrowthPredictionInput[]> {
  const claims = await loadResearchClaimRows(prismaClient, nowIso);
  const metricsByNpi = buildResearchMetricsByNpi(claims, nowIso);
  const npis = [...metricsByNpi.keys()];
  const affiliationRows = await loadAffiliationRows(prismaClient, npis, nowIso);

  const institutionsByNpi = new Map<string, string[]>();
  for (const row of affiliationRows) {
    const institution = extractInstitution(row.value);
    if (!institution) {
      continue;
    }
    const names = institutionsByNpi.get(row.subjectNpi) ?? [];
    if (!names.includes(institution)) {
      names.push(institution);
      institutionsByNpi.set(row.subjectNpi, names);
    }
  }

  const aggregated = new Map<string, {
    recentResearchCount: number;
    previousResearchCount: number;
    contributingProviders: Set<string>;
    leadInvestigatorCount: number;
    lastObservedAt: string;
  }>();

  for (const [npi, metrics] of metricsByNpi) {
    const institutions = institutionsByNpi.get(npi) ?? [];
    if (institutions.length === 0) {
      continue;
    }

    const leadInvestigator = metrics.recentPublications >= 3 || metrics.recentTrials >= 1;
    for (const institution of institutions) {
      const current = aggregated.get(institution) ?? {
        recentResearchCount: 0,
        previousResearchCount: 0,
        contributingProviders: new Set<string>(),
        leadInvestigatorCount: 0,
        lastObservedAt: metrics.lastObservedAt,
      };
      current.recentResearchCount += metrics.recentPublications + metrics.recentTrials + metrics.recentGrantCount;
      current.previousResearchCount += metrics.previousPublications;
      current.contributingProviders.add(npi);
      if (leadInvestigator) {
        current.leadInvestigatorCount += 1;
      }
      if (metrics.lastObservedAt > current.lastObservedAt) {
        current.lastObservedAt = metrics.lastObservedAt;
      }
      aggregated.set(institution, current);
    }
  }

  const signals: InstitutionResearchGrowthPredictionInput[] = [];
  for (const [institution, value] of aggregated) {
    signals.push({
      targetEntity: institutionTarget(institution),
      recentResearchCount: value.recentResearchCount,
      previousResearchCount: value.previousResearchCount,
      contributingProviders: value.contributingProviders.size,
      leadInvestigatorCount: value.leadInvestigatorCount,
      lastObservedAt: value.lastObservedAt,
    });
  }

  return signals;
}

function extractProviderIdFromNode(node: { metadata: Prisma.JsonValue }): string | null {
  return asString(asRecord(node.metadata).npi);
}

function parsePredictionEvidenceSignals(value: Prisma.JsonValue): PredictionInsight['evidenceSignals'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => {
    const record = asRecord(entry);
    const label = asString(record.label) ?? 'signal';
    const direction = asString(record.direction);
    return {
      label,
      value: typeof record.value === 'number' || typeof record.value === 'string' ? record.value : String(record.value ?? ''),
      direction: direction === 'DOWN' || direction === 'FLAT' ? direction : 'UP',
      source: asString(record.source),
    };
  });
}

async function loadNetworkExpansionSignals(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<NetworkClusterExpansionPredictionInput[]> {
  const recentCutoff = daysAgo(nowIso, 90);
  const historicalCutoff = daysAgo(nowIso, 180);
  const edges = await prismaClient.graphEdge.findMany({
    where: {
      edgeType: { in: COLLABORATION_EDGE_TYPES },
      status: 'ACTIVE',
      createdAt: { gte: historicalCutoff },
    },
    include: {
      sourceNode: true,
      targetNode: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 2_000,
  });

  const stats = new Map<string, {
    targetEntity: PredictionTargetEntity;
    recentConnections: number;
    previousConnections: number;
    recentPeers: Set<string>;
    previousPeers: Set<string>;
    recentAnchors: Set<string>;
    confidenceTotal: number;
  }>();

  for (const edge of edges) {
    for (const endpoint of [
      { node: edge.sourceNode, opposite: edge.targetNode },
      { node: edge.targetNode, opposite: edge.sourceNode },
    ]) {
      const providerId = extractProviderIdFromNode(endpoint.node);
      const targetEntity = providerId
        ? providerTarget(providerId, endpoint.node.label)
        : {
          entityType: 'graph_node',
          entityId: endpoint.node.id,
          entityLabel: endpoint.node.label,
        };
      const key = `${targetEntity.entityType}:${targetEntity.entityId}`;
      const current = stats.get(key) ?? {
        targetEntity,
        recentConnections: 0,
        previousConnections: 0,
        recentPeers: new Set<string>(),
        previousPeers: new Set<string>(),
        recentAnchors: new Set<string>(),
        confidenceTotal: 0,
      };

      const oppositeProviderId = extractProviderIdFromNode(endpoint.opposite);
      const isRecent = edge.createdAt >= recentCutoff;
      if (isRecent) {
        current.recentConnections += 1;
        current.confidenceTotal += edge.confidence;
        if (oppositeProviderId) {
          current.recentPeers.add(oppositeProviderId);
        } else {
          current.recentAnchors.add(endpoint.opposite.id);
        }
      } else {
        current.previousConnections += 1;
        if (oppositeProviderId) {
          current.previousPeers.add(oppositeProviderId);
        }
      }

      stats.set(key, current);
    }
  }

  const signals: NetworkClusterExpansionPredictionInput[] = [];
  for (const value of stats.values()) {
    const averageConfidence = value.recentConnections > 0
      ? value.confidenceTotal / value.recentConnections
      : 0.5;
    signals.push({
      targetEntity: value.targetEntity,
      recentConnections: value.recentConnections,
      previousConnections: value.previousConnections,
      peerGrowth: Math.max(0, value.recentPeers.size - value.previousPeers.size),
      anchorCount: value.recentAnchors.size,
      averageConfidence,
      lastObservedAt: nowIso,
    });
  }

  return signals;
}

async function loadWorkforceShortageSignals(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<WorkforceShortagePredictionInput[]> {
  const recentCutoff = daysAgo(nowIso, 30);
  const opportunities = await prismaClient.opportunity.findMany({
    where: { status: 'ACTIVE' },
    select: {
      specialty: true,
      state: true,
      createdAt: true,
    },
    take: 2_000,
  });

  const supplyBuckets = await prismaClient.personProfile.groupBy({
    by: ['specialty', 'stateOfPractice'],
    where: {
      specialty: { not: null },
      stateOfPractice: { not: null },
    },
    _count: { _all: true },
  });

  const supplyByBucket = new Map<string, number>();
  for (const bucket of supplyBuckets) {
    if (!bucket.specialty || !bucket.stateOfPractice) {
      continue;
    }
    supplyByBucket.set(`${bucket.specialty.toLowerCase()}::${bucket.stateOfPractice.toUpperCase()}`, bucket._count._all);
  }

  const demandByBucket = new Map<string, { specialty: string; state: string; demand: number; previousDemand: number }>();
  for (const opportunity of opportunities) {
    const key = `${opportunity.specialty.toLowerCase()}::${opportunity.state.toUpperCase()}`;
    const current = demandByBucket.get(key) ?? {
      specialty: opportunity.specialty,
      state: opportunity.state.toUpperCase(),
      demand: 0,
      previousDemand: 0,
    };
    current.demand += 1;
    if (opportunity.createdAt < recentCutoff) {
      current.previousDemand += 1;
    }
    demandByBucket.set(key, current);
  }

  const signals: WorkforceShortagePredictionInput[] = [];
  for (const [key, bucket] of demandByBucket) {
    const supply = supplyByBucket.get(key) ?? 0;
    const pressureScore = Math.round((bucket.demand * 18) + (Math.max(0, 4 - supply) * 12));
    signals.push({
      targetEntity: marketTarget(bucket.state, bucket.specialty),
      specialty: bucket.specialty,
      state: bucket.state,
      demand: bucket.demand,
      previousDemand: bucket.previousDemand,
      supply,
      pressureScore,
      lastObservedAt: nowIso,
    });
  }

  return signals;
}

function mapPredictionRow(row: {
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
}): StoredPredictionInsight {
  return {
    predictionId: row.predictionId,
    predictionType: row.predictionType as PredictionInsight['predictionType'],
    targetEntity: {
      entityType: row.targetEntityType,
      entityId: row.targetEntityId,
      entityLabel: row.targetEntityLabel,
    },
    probability: row.probability,
    confidence: row.confidence,
    timeHorizon: row.timeHorizon,
    evidenceSignals: parsePredictionEvidenceSignals(row.evidenceSignals),
    explanation: row.explanation,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    metadata: asRecord(row.metadata),
  };
}

async function persistPredictions(
  predictions: PredictionInsight[],
  prismaClient: PrismaClient,
): Promise<StoredPredictionInsight[]> {
  const ids = predictions.map((prediction) => prediction.predictionId);
  if (ids.length === 0) {
    await prismaClient.predictionInsight.deleteMany({});
    return [];
  }

  await prismaClient.predictionInsight.deleteMany({
    where: {
      predictionId: { notIn: ids },
    },
  });

  const results: StoredPredictionInsight[] = [];
  for (const prediction of predictions) {
    const row = await prismaClient.predictionInsight.upsert({
      where: { predictionId: prediction.predictionId },
      update: {
        predictionType: prediction.predictionType,
        targetEntityType: prediction.targetEntity.entityType,
        targetEntityId: prediction.targetEntity.entityId,
        targetEntityLabel: prediction.targetEntity.entityLabel ?? null,
        probability: prediction.probability,
        confidence: prediction.confidence,
        timeHorizon: prediction.timeHorizon,
        evidenceSignals: toJsonValue(prediction.evidenceSignals),
        explanation: prediction.explanation,
        metadata: toJsonValue(prediction.metadata),
      },
      create: {
        predictionId: prediction.predictionId,
        predictionType: prediction.predictionType,
        targetEntityType: prediction.targetEntity.entityType,
        targetEntityId: prediction.targetEntity.entityId,
        targetEntityLabel: prediction.targetEntity.entityLabel ?? null,
        probability: prediction.probability,
        confidence: prediction.confidence,
        timeHorizon: prediction.timeHorizon,
        evidenceSignals: toJsonValue(prediction.evidenceSignals),
        explanation: prediction.explanation,
        metadata: toJsonValue(prediction.metadata),
        createdAt: new Date(prediction.createdAt),
      },
    });

    results.push(mapPredictionRow(row));
  }

  return results.sort((left, right) => right.probability - left.probability || left.predictionId.localeCompare(right.predictionId));
}

export interface StoredPredictionInsight extends Omit<PredictionInsight, 'createdAt'> {
  createdAt: string;
  updatedAt: string;
}

export async function refreshPredictionInsights(
  now = new Date().toISOString(),
  prismaClient: PrismaClient = prisma,
): Promise<StoredPredictionInsight[]> {
  return withPredictionSpan(
    'predictions.refresh',
    { 'vitalcv.predictions.refresh': true },
    async () => {
      const engine = createPredictionEngine();
      const [
        trustSignals,
        emergingInvestigatorSignals,
        institutionResearchSignals,
        networkExpansionSignals,
        workforceShortageSignals,
      ] = await Promise.all([
        loadTrustSignals(prismaClient, now),
        loadEmergingInvestigatorSignals(prismaClient, now),
        loadInstitutionResearchSignals(prismaClient, now),
        loadNetworkExpansionSignals(prismaClient, now),
        loadWorkforceShortageSignals(prismaClient, now),
      ]);

      const predictions = engine.generate({
        trustSignals,
        emergingInvestigatorSignals,
        institutionResearchSignals,
        networkExpansionSignals,
        workforceShortageSignals,
        now,
      });

      return persistPredictions(predictions, prismaClient);
    },
  );
}

export async function listPredictionInsightsByIds(
  predictionIds: string[],
  prismaClient: PrismaClient = prisma,
): Promise<StoredPredictionInsight[]> {
  if (predictionIds.length === 0) {
    return [];
  }

  const rows = await prismaClient.predictionInsight.findMany({
    where: {
      predictionId: { in: predictionIds },
    },
    orderBy: [{ probability: 'desc' }, { confidence: 'desc' }],
  });

  const mapped = rows.map((row) => mapPredictionRow(row));
  const order = new Map(predictionIds.map((predictionId, index) => [predictionId, index]));
  return mapped.sort((left, right) => (order.get(left.predictionId) ?? 0) - (order.get(right.predictionId) ?? 0));
}
