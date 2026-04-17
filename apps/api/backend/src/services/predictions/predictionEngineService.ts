// @ts-nocheck
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { Prisma, type PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { createGraphNodeId } from '../graph-engine/ids';
import {
  createPredictionEngine,
  type InstitutionMomentumPredictionInput,
  type NetworkShiftPredictionInput,
  type PredictionEvidenceSignal,
  type PredictionInsight,
  type PredictionState,
  type PredictionTargetEntity,
  type PredictionType,
  type ProviderTrajectoryPredictionInput,
  type SpecialtyPressurePredictionInput,
  type TrustRiskAccelerationPredictionInput,
} from '../../../../../../core/predictions/predictionEngine';
import type { PredictionContract, PredictionSummaryContract } from './contracts';
import {
  syncNetworkDeltaEvents,
  syncPredictionSignalHistory,
  syncSignalCorrelations,
} from '../intelligenceLayer/intelligenceLayerService';

const predictionTracer = trace.getTracer('vitalcv.predictions');

const ACTIVE_FINDING_STATUSES = ['new', 'acknowledged', 'investigating', 'escalated'] as const;
const COLLABORATION_EDGE_TYPES = ['co_author', 'co_pi', 'co_investigator', 'published_with', 'related_to'];
const RESEARCH_SOURCES = ['OPENALEX', 'PUBMED', 'CLINICAL_TRIALS', 'NIH_REPORTER'];
const PAYMENT_SOURCES = ['OPEN_PAYMENTS'];
const NPI_RE = /^\d{10}$/;

type ResearchClaimRow = {
  subjectNpi: string;
  claimType: string;
  sourceId: string;
  createdAt: Date;
  value: Prisma.JsonValue;
};

type PaymentClaimRow = {
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

type PredictionInsightRow = {
  id: string;
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
};

type ResearchMetrics = {
  recentPublications: number;
  previousPublications: number;
  recentTrials: number;
  previousTrials: number;
  recentGrantCount: number;
  previousGrantCount: number;
  recentCitationAverage: number;
  previousCitationAverage: number;
  lastObservedAt: string;
};

type PaymentMetrics = {
  recentUniquePayers: number;
  previousUniquePayers: number;
  lastObservedAt: string;
};

type CollaborationMetrics = {
  targetEntity: PredictionTargetEntity;
  recentPeers: Set<string>;
  previousPeers: Set<string>;
  recentAnchors: Set<string>;
  previousAnchors: Set<string>;
  recentConnections: number;
  previousConnections: number;
  lastObservedAt: string;
};

export interface PredictionQuery {
  type?: string | string[] | null;
  entityType?: string | string[] | null;
  entityId?: string | null;
  state?: string | string[] | null;
  confidence?: number | null;
  updatedAt?: string | null;
  limit?: number;
  offset?: number;
  sync?: boolean;
}

type ResidencyProgramSpecialtyBucket = {
  specialty: string;
  _count: { _all: number };
};

type ResidencyProgramInstitutionBucket = {
  hospital_affiliation: string;
  _count: { _all: number };
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());
}

function normalizeList(value: string[] | string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  const raw = Array.isArray(value) ? value : [value];
  return raw
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function isMissingTableError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021';
}

async function loadResidencyProgramsBySpecialty(
  prismaClient: PrismaClient,
): Promise<ResidencyProgramSpecialtyBucket[]> {
  try {
    const rows = await prismaClient.residencyProgram.groupBy({
      by: ['specialty'],
      _count: { _all: true },
    });
    return rows as ResidencyProgramSpecialtyBucket[];
  } catch (error) {
    if (isMissingTableError(error)) {
      return [];
    }
    throw error;
  }
}

async function loadResidencyProgramsByInstitution(
  prismaClient: PrismaClient,
): Promise<ResidencyProgramInstitutionBucket[]> {
  try {
    const rows = await prismaClient.residencyProgram.groupBy({
      by: ['hospital_affiliation'],
      _count: { _all: true },
    });
    return rows as ResidencyProgramInstitutionBucket[];
  } catch (error) {
    if (isMissingTableError(error)) {
      return [];
    }
    throw error;
  }
}

function daysAgo(nowIso: string, days: number): Date {
  return new Date(new Date(nowIso).getTime() - (days * 86_400_000));
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function safeGrowth(current: number, previous: number): number {
  if (current <= 0 && previous <= 0) {
    return 0;
  }

  if (previous <= 0) {
    return Math.min(current, 3);
  }

  return Number((((current / previous) - 1) * 1).toFixed(4));
}

function clinicianNodeIdForNpi(npi: string): string {
  return createGraphNodeId({
    type: 'clinician',
    sourceKind: 'npi',
    sourceId: npi,
  });
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
    entityId: slugify(name),
    entityLabel: name,
  };
}

function specialtyTarget(name: string): PredictionTargetEntity {
  return {
    entityType: 'specialty',
    entityId: slugify(name),
    entityLabel: name,
  };
}

function predictionState(value: unknown): PredictionState {
  const state = asString(value);
  switch (state) {
    case 'rising':
    case 'stable':
    case 'declining':
    case 'volatile':
    case 'low':
    case 'moderate':
    case 'high':
    case 'severe':
    case 'expanding':
    case 'contracting':
    case 'mixed':
    case 'emerging cluster':
    case 'emerging_cluster':
    case 'expanding collaboration':
    case 'collaboration_expansion':
    case 'network fragmentation':
    case 'network_fragmentation':
    case 'bridge provider shift':
    case 'bridge_provider_shift':
    case 'accelerating':
    case 'watch':
    case 'stabilizing':
      return state;
    default:
      return 'insufficient_signal';
  }
}

function normalizedPredictionState(state: string): string {
  switch (state) {
    case 'emerging cluster':
      return 'emerging_cluster';
    case 'expanding collaboration':
      return 'collaboration_expansion';
    case 'network fragmentation':
      return 'network_fragmentation';
    case 'bridge provider shift':
      return 'bridge_provider_shift';
    default:
      return state;
  }
}

function explainDriver(label: string, direction: 'UP' | 'DOWN' | 'FLAT'): string {
  const readable = label.replace(/_/g, ' ');
  if (direction === 'UP') {
    return `${readable} increased in the latest observation window.`;
  }
  if (direction === 'DOWN') {
    return `${readable} declined in the latest observation window.`;
  }
  return `${readable} remained stable in the latest observation window.`;
}

function extractCitationCount(value: Prisma.JsonValue): number {
  const record = asRecord(value);
  return asNumber(record.citationCount)
    ?? asNumber(record.citations)
    ?? 0;
}

function extractInstitution(value: Prisma.JsonValue): string | null {
  const record = asRecord(value);
  return asString(record.institution)
    ?? asString(record.organization)
    ?? asString(record.affiliation)
    ?? asString(record.employer)
    ?? asString(record.hospitalAffiliation);
}

function extractTopPayers(value: Prisma.JsonValue): string[] {
  const record = asRecord(value);
  return [
    ...asStringArray(record.topPayers),
    ...asStringArray(record.payers),
    asString(record.dominantPayer) ?? '',
    asString(record.applicable_manufacturer_or_applicable_gpo_making_payment_name) ?? '',
  ].filter((entry) => entry.length > 0);
}

function parsePayRangeAverage(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const numbers = [...value.matchAll(/\d+(?:,\d{3})*(?:\.\d+)?/g)]
    .map((match) => Number(match[0].replace(/,/g, '')))
    .filter((entry) => Number.isFinite(entry));

  if (numbers.length === 0) {
    return null;
  }

  if (numbers.length === 1) {
    return numbers[0] ?? null;
  }

  return average(numbers.slice(0, 2));
}

function parsePredictionEvidenceSignals(value: Prisma.JsonValue): PredictionEvidenceSignal[] {
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
      observedAt: asString(record.observedAt) ?? undefined,
    };
  });
}

function predictionEntityKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

function rowToPrediction(row: PredictionInsightRow): StoredPredictionInsight {
  const metadata = asRecord(row.metadata);
  const state = predictionState(metadata.state);
  const summary = asString(metadata.summary) ?? row.explanation;
  const signals = parsePredictionEvidenceSignals(row.evidenceSignals);
  const normalizedState = normalizedPredictionState(state);
  const drivers = signals.map((signal) => ({
    label: signal.label,
    value: signal.value,
    direction: signal.direction,
    source: signal.source ?? 'derived',
    explanation: explainDriver(signal.label, signal.direction),
    observedAt: signal.observedAt,
  }));

  return {
    id: row.predictionId,
    type: row.predictionType as PredictionType,
    entityType: row.targetEntityType,
    entityId: row.targetEntityId,
    entityLabel: row.targetEntityLabel,
    entity: {
      entityType: row.targetEntityType,
      entityId: row.targetEntityId,
      entityLabel: row.targetEntityLabel,
    },
    state,
    score: row.probability,
    scoreLabel: normalizedState,
    confidence: row.confidence,
    explanation: row.explanation,
    signals,
    drivers,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastUpdated: row.updatedAt.toISOString(),
    last_updated: row.updatedAt.toISOString(),
    forecast: metadata.forecast !== false,
    insufficientSignal: state === 'insufficient_signal' || metadata.insufficientSignal === true,
    summary,
    predictionId: row.predictionId,
    predictionType: row.predictionType as PredictionType,
    probability: row.probability,
    targetEntity: {
      entityType: row.targetEntityType,
      entityId: row.targetEntityId,
      entityLabel: row.targetEntityLabel,
    },
    timeHorizon: row.timeHorizon,
    evidenceSignals: signals,
    metadata,
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
    const name = [profile.firstName, profile.lastName]
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .trim();
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
    labels.set(npi, asString(metadata.fullName) ?? node.label);
  }

  return labels;
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
    take: 8_000,
  });

  return rows.map((row) => ({
    subjectNpi: row.subjectNpi,
    claimType: row.claimType,
    sourceId: row.sourceId,
    createdAt: row.createdAt,
    value: row.value,
  }));
}

async function loadPaymentClaimRows(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<PaymentClaimRow[]> {
  const rows = await prismaClient.claimRecord.findMany({
    where: {
      OR: [
        { sourceId: { in: PAYMENT_SOURCES } },
        { claimType: { in: ['INDUSTRY_PAYMENT', 'RESEARCH_PAYMENT'] } },
      ],
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
    take: 6_000,
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
    take: 4_000,
  });

  return rows.map((row) => ({
    subjectNpi: row.subjectNpi,
    createdAt: row.createdAt,
    value: row.value,
  }));
}

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
    const recentPublicationRows = recent.filter((row) => ['PUBLICATION', 'CITATION_METRIC'].includes(row.claimType));
    const previousPublicationRows = previous.filter((row) => ['PUBLICATION', 'CITATION_METRIC'].includes(row.claimType));
    const recentTrials = recent.filter((row) => row.claimType === 'CLINICAL_TRIAL').length;
    const previousTrials = previous.filter((row) => row.claimType === 'CLINICAL_TRIAL').length;
    const recentGrantRows = recent.filter((row) => row.sourceId === 'NIH_REPORTER' || row.claimType.includes('GRANT'));
    const previousGrantRows = previous.filter((row) => row.sourceId === 'NIH_REPORTER' || row.claimType.includes('GRANT'));

    metricsByNpi.set(npi, {
      recentPublications: recentPublicationRows.length,
      previousPublications: previousPublicationRows.length,
      recentTrials,
      previousTrials,
      recentGrantCount: recentGrantRows.length,
      previousGrantCount: previousGrantRows.length,
      recentCitationAverage: average(recentPublicationRows.map((row) => extractCitationCount(row.value))),
      previousCitationAverage: average(previousPublicationRows.map((row) => extractCitationCount(row.value))),
      lastObservedAt: rows[0]?.createdAt.toISOString() ?? new Date(nowIso).toISOString(),
    });
  }

  return metricsByNpi;
}

function buildPaymentMetricsByNpi(
  claims: PaymentClaimRow[],
  nowIso: string,
): Map<string, PaymentMetrics> {
  const recentCutoff = daysAgo(nowIso, 180);
  const grouped = new Map<string, PaymentClaimRow[]>();

  for (const claim of claims) {
    const rows = grouped.get(claim.subjectNpi) ?? [];
    rows.push(claim);
    grouped.set(claim.subjectNpi, rows);
  }

  const metrics = new Map<string, PaymentMetrics>();
  for (const [npi, rows] of grouped) {
    const recentPayers = new Set<string>();
    const previousPayers = new Set<string>();
    for (const row of rows) {
      const target = row.createdAt >= recentCutoff ? recentPayers : previousPayers;
      for (const payer of extractTopPayers(row.value)) {
        target.add(payer);
      }
    }

    metrics.set(npi, {
      recentUniquePayers: recentPayers.size,
      previousUniquePayers: previousPayers.size,
      lastObservedAt: rows[0]?.createdAt.toISOString() ?? new Date(nowIso).toISOString(),
    });
  }

  return metrics;
}

function extractProviderIdFromNode(node: { metadata: Prisma.JsonValue }): string | null {
  return asString(asRecord(node.metadata).npi);
}

async function loadCollaborationMetrics(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<Map<string, CollaborationMetrics>> {
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
    take: 4_000,
  });

  const metrics = new Map<string, CollaborationMetrics>();

  for (const edge of edges) {
    const isRecent = edge.createdAt >= recentCutoff;
    for (const endpoint of [
      { node: edge.sourceNode, opposite: edge.targetNode },
      { node: edge.targetNode, opposite: edge.sourceNode },
    ]) {
      const providerId = extractProviderIdFromNode(endpoint.node);
      if (!providerId) {
        continue;
      }

      const key = providerId;
      const current = metrics.get(key) ?? {
        targetEntity: providerTarget(providerId, endpoint.node.label),
        recentPeers: new Set<string>(),
        previousPeers: new Set<string>(),
        recentAnchors: new Set<string>(),
        previousAnchors: new Set<string>(),
        recentConnections: 0,
        previousConnections: 0,
        lastObservedAt: edge.createdAt.toISOString(),
      };

      const oppositeProviderId = extractProviderIdFromNode(endpoint.opposite);
      if (isRecent) {
        current.recentConnections += 1;
      } else {
        current.previousConnections += 1;
      }

      if (oppositeProviderId) {
        if (isRecent) {
          current.recentPeers.add(oppositeProviderId);
        } else {
          current.previousPeers.add(oppositeProviderId);
        }
      } else if (isRecent) {
        current.recentAnchors.add(endpoint.opposite.id);
      } else {
        current.previousAnchors.add(endpoint.opposite.id);
      }

      if (edge.createdAt.toISOString() > current.lastObservedAt) {
        current.lastObservedAt = edge.createdAt.toISOString();
      }

      metrics.set(key, current);
    }
  }

  return metrics;
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

async function loadProviderTrajectorySignals(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<ProviderTrajectoryPredictionInput[]> {
  const [researchClaims, paymentClaims, collaborationMetrics] = await Promise.all([
    loadResearchClaimRows(prismaClient, nowIso),
    loadPaymentClaimRows(prismaClient, nowIso),
    loadCollaborationMetrics(prismaClient, nowIso),
  ]);

  const researchByNpi = buildResearchMetricsByNpi(researchClaims, nowIso);
  const paymentByNpi = buildPaymentMetricsByNpi(paymentClaims, nowIso);
  const npis = [...new Set([
    ...researchByNpi.keys(),
    ...paymentByNpi.keys(),
    ...collaborationMetrics.keys(),
  ])].filter((npi) => NPI_RE.test(npi));
  const labels = await loadProviderLabels(prismaClient, npis);

  return npis.map((npi) => {
    const research = researchByNpi.get(npi);
    const payments = paymentByNpi.get(npi);
    const collaboration = collaborationMetrics.get(npi);
    const lastObservedAt = [
      research?.lastObservedAt,
      payments?.lastObservedAt,
      collaboration?.lastObservedAt,
    ].filter((value): value is string => Boolean(value)).sort().slice(-1)[0] ?? nowIso;

    return {
      targetEntity: providerTarget(npi, labels.get(npi) ?? null),
      publicationAcceleration: research
        ? safeGrowth(research.recentPublications, research.previousPublications)
        : null,
      citationQualityTrend: research
        ? safeGrowth(research.recentCitationAverage, research.previousCitationAverage)
        : null,
      trialLeadershipProgression: research
        ? Number((research.recentTrials - research.previousTrials).toFixed(4))
        : null,
      grantFundingTrajectory: research
        ? safeGrowth(research.recentGrantCount, research.previousGrantCount)
        : null,
      industryPaymentDiversification: payments
        ? Number((payments.recentUniquePayers - payments.previousUniquePayers).toFixed(4))
        : null,
      networkCentralityChange: collaboration
        ? Number(((collaboration.recentPeers.size + collaboration.recentAnchors.size)
          - (collaboration.previousPeers.size + collaboration.previousAnchors.size)).toFixed(4))
        : null,
      lastObservedAt,
    };
  });
}

async function loadSpecialtyPressureSignals(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<SpecialtyPressurePredictionInput[]> {
  const recentCutoff = daysAgo(nowIso, 120);
  const horizonCutoff = daysAgo(nowIso, 365);
  const [opportunities, supplyBuckets, residencyPrograms] = await Promise.all([
    prismaClient.opportunity.findMany({
      where: {
        createdAt: { gte: horizonCutoff },
      },
      select: {
        specialty: true,
        payRange: true,
        createdAt: true,
      },
      take: 5_000,
    }),
    prismaClient.personProfile.groupBy({
      by: ['specialty'],
      where: {
        specialty: { not: null },
      },
      _count: { _all: true },
    }),
    loadResidencyProgramsBySpecialty(prismaClient),
  ]);

  const supplyBySpecialty = new Map<string, number>();
  for (const bucket of supplyBuckets) {
    if (bucket.specialty) {
      supplyBySpecialty.set(bucket.specialty.toLowerCase(), bucket._count._all);
    }
  }

  const pipelineBySpecialty = new Map<string, number>();
  for (const row of residencyPrograms) {
    pipelineBySpecialty.set(row.specialty.toLowerCase(), row._count._all);
  }

  const grouped = new Map<string, {
    specialty: string;
    recentDemand: number;
    previousDemand: number;
    recentPayRanges: number[];
    previousPayRanges: number[];
  }>();

  for (const opportunity of opportunities) {
    const key = opportunity.specialty.toLowerCase();
    const current = grouped.get(key) ?? {
      specialty: opportunity.specialty,
      recentDemand: 0,
      previousDemand: 0,
      recentPayRanges: [],
      previousPayRanges: [],
    };

    const payAverage = parsePayRangeAverage(opportunity.payRange);
    if (opportunity.createdAt >= recentCutoff) {
      current.recentDemand += 1;
      if (payAverage !== null) {
        current.recentPayRanges.push(payAverage);
      }
    } else {
      current.previousDemand += 1;
      if (payAverage !== null) {
        current.previousPayRanges.push(payAverage);
      }
    }

    grouped.set(key, current);
  }

  const signals: SpecialtyPressurePredictionInput[] = [];
  for (const [key, value] of grouped) {
    const supply = supplyBySpecialty.get(key) ?? 0;
    const pipeline = pipelineBySpecialty.get(key) ?? 0;
    const recentPayAverage = average(value.recentPayRanges);
    const previousPayAverage = average(value.previousPayRanges);
    const demandSupplyRatio = supply <= 0 ? value.recentDemand : value.recentDemand / supply;
    const trainingPipelineCoverage = value.recentDemand <= 0 ? pipeline : pipeline / value.recentDemand;
    const demandGrowth = value.recentDemand - value.previousDemand;
    const shortageProjection = Number((demandSupplyRatio + Math.max(demandGrowth, 0) / 3).toFixed(4));
    const matchTension = Number((Math.max(demandGrowth, 0) / Math.max(pipeline, 1)).toFixed(4));
    const wageGrowth = previousPayAverage <= 0 || recentPayAverage <= 0
      ? (recentPayAverage > 0 ? 0.1 : null)
      : Number((((recentPayAverage / previousPayAverage) - 1)).toFixed(4));

    signals.push({
      targetEntity: specialtyTarget(value.specialty),
      shortageProjection,
      demandSupplyRatio: Number(demandSupplyRatio.toFixed(4)),
      wageGrowth,
      trainingPipelineCoverage: Number(trainingPipelineCoverage.toFixed(4)),
      matchTension,
      lastObservedAt: nowIso,
    });
  }

  return signals;
}

async function loadInstitutionMomentumSignals(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<InstitutionMomentumPredictionInput[]> {
  const researchClaims = await loadResearchClaimRows(prismaClient, nowIso);
  const researchByNpi = buildResearchMetricsByNpi(researchClaims, nowIso);
  const npis = [...researchByNpi.keys()];
  const [affiliationRows, residencyPrograms] = await Promise.all([
    loadAffiliationRows(prismaClient, npis, nowIso),
    loadResidencyProgramsByInstitution(prismaClient),
  ]);

  const trainingByInstitution = new Map<string, number>();
  for (const row of residencyPrograms) {
    trainingByInstitution.set(slugify(row.hospital_affiliation), row._count._all);
  }

  const recentCutoff = daysAgo(nowIso, 180);
  const institutionsByNpi = new Map<string, Array<{ institution: string; createdAt: Date }>>();
  for (const row of affiliationRows) {
    const institution = extractInstitution(row.value);
    if (!institution) {
      continue;
    }
    const entries = institutionsByNpi.get(row.subjectNpi) ?? [];
    entries.push({ institution, createdAt: row.createdAt });
    institutionsByNpi.set(row.subjectNpi, entries);
  }

  const aggregated = new Map<string, {
    label: string;
    recentPublications: number;
    previousPublications: number;
    recentGrants: number;
    previousGrants: number;
    recentTrials: number;
    previousTrials: number;
    recentHeadcount: Set<string>;
    previousHeadcount: Set<string>;
    lastObservedAt: string;
  }>();

  for (const [npi, metrics] of researchByNpi) {
    const institutions = institutionsByNpi.get(npi) ?? [];
    for (const affiliation of institutions) {
      const key = slugify(affiliation.institution);
      const current = aggregated.get(key) ?? {
        label: affiliation.institution,
        recentPublications: 0,
        previousPublications: 0,
        recentGrants: 0,
        previousGrants: 0,
        recentTrials: 0,
        previousTrials: 0,
        recentHeadcount: new Set<string>(),
        previousHeadcount: new Set<string>(),
        lastObservedAt: metrics.lastObservedAt,
      };

      current.recentPublications += metrics.recentPublications;
      current.previousPublications += metrics.previousPublications;
      current.recentGrants += metrics.recentGrantCount;
      current.previousGrants += metrics.previousGrantCount;
      current.recentTrials += metrics.recentTrials;
      current.previousTrials += metrics.previousTrials;

      if (affiliation.createdAt >= recentCutoff) {
        current.recentHeadcount.add(npi);
      } else {
        current.previousHeadcount.add(npi);
      }

      if (metrics.lastObservedAt > current.lastObservedAt) {
        current.lastObservedAt = metrics.lastObservedAt;
      }

      aggregated.set(key, current);
    }
  }

  const signals: InstitutionMomentumPredictionInput[] = [];
  for (const [key, value] of aggregated) {
    const trainingPrograms = trainingByInstitution.get(key) ?? 0;
    signals.push({
      targetEntity: institutionTarget(value.label),
      publicationOutputTrend: Number((value.recentPublications - value.previousPublications).toFixed(4)),
      grantFundingTrend: Number((value.recentGrants - value.previousGrants).toFixed(4)),
      trialSiteGrowth: Number((value.recentTrials - value.previousTrials).toFixed(4)),
      providerHeadcountChange: Number((value.recentHeadcount.size - value.previousHeadcount.size).toFixed(4)),
      trainingPipelineExpansion: Number((trainingPrograms - 1).toFixed(4)),
      lastObservedAt: value.lastObservedAt,
    });
  }

  return signals;
}

async function loadNetworkShiftSignals(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<NetworkShiftPredictionInput[]> {
  const collaborationMetrics = await loadCollaborationMetrics(prismaClient, nowIso);

  return [...collaborationMetrics.values()]
    .map((value) => ({
      targetEntity: value.targetEntity,
      newEdges: value.recentPeers.size + value.recentAnchors.size - [...value.previousPeers, ...value.previousAnchors].filter((entry) =>
        value.recentPeers.has(entry) || value.recentAnchors.has(entry),
      ).length,
      lostEdges: value.previousPeers.size + value.previousAnchors.size - [...value.recentPeers, ...value.recentAnchors].filter((entry) =>
        value.previousPeers.has(entry) || value.previousAnchors.has(entry),
      ).length,
      centralityChange: Number(((value.recentPeers.size + value.recentAnchors.size)
        - (value.previousPeers.size + value.previousAnchors.size)).toFixed(4)),
      clusterMerges: value.recentAnchors.size > value.previousAnchors.size && value.recentPeers.size >= value.previousPeers.size
        ? 1
        : 0,
      clusterSplits: value.previousPeers.size > value.recentPeers.size
        ? 1
        : 0,
      bridgeNodeChange: Number((value.recentAnchors.size - value.previousAnchors.size).toFixed(4)),
      lastObservedAt: value.lastObservedAt,
    }))
    .filter((signal) =>
      (signal.newEdges ?? 0) > 0
      || (signal.lostEdges ?? 0) > 0
      || (signal.bridgeNodeChange ?? 0) !== 0,
    );
}

async function loadTrustRiskSignals(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<TrustRiskAccelerationPredictionInput[]> {
  const [historyRows, divergenceRows, alertRows] = await Promise.all([
    prismaClient.trustScoreHistory.findMany({
      where: {
        subjectType: { in: ['NPI', 'PROVIDER', 'CLINICIAN'] },
        recordedAt: { gte: daysAgo(nowIso, 120) },
      },
      orderBy: [{ subjectId: 'asc' }, { recordedAt: 'desc' }],
      take: 2_000,
    }),
    prismaClient.investigatorFinding.findMany({
      where: {
        status: { in: [...ACTIVE_FINDING_STATUSES] },
        findingType: { in: ['divergence', 'trust_decline'] },
        lastSeenAt: { gte: daysAgo(nowIso, 120) },
      },
      select: {
        entityIds: true,
        metadata: true,
      },
      take: 500,
    }),
    prismaClient.trustAlertRecord.findMany({
      where: {
        createdAt: { gte: daysAgo(nowIso, 120) },
        subject: { not: null },
      },
      select: {
        subject: true,
        createdAt: true,
      },
      take: 500,
    }),
  ]);

  const historyBySubject = new Map<string, typeof historyRows>();
  for (const row of historyRows) {
    const list = historyBySubject.get(row.subjectId) ?? [];
    list.push(row);
    historyBySubject.set(row.subjectId, list);
  }

  const divergenceBySubject = new Map<string, { staleSourceCount: number; divergenceCount: number }>();
  for (const row of divergenceRows) {
    const subjectId = findingSubjectId(row);
    if (!subjectId) {
      continue;
    }
    const metadata = asRecord(row.metadata);
    const staleDimensions = Array.isArray(metadata.staleDimensions) ? metadata.staleDimensions.length : 0;
    const current = divergenceBySubject.get(subjectId) ?? { staleSourceCount: 0, divergenceCount: 0 };
    divergenceBySubject.set(subjectId, {
      staleSourceCount: current.staleSourceCount + staleDimensions,
      divergenceCount: current.divergenceCount + 1,
    });
  }

  const alertsBySubject = new Map<string, number>();
  for (const row of alertRows) {
    if (!row.subject) {
      continue;
    }
    alertsBySubject.set(row.subject, (alertsBySubject.get(row.subject) ?? 0) + 1);
  }

  const labels = await loadProviderLabels(prismaClient, [...historyBySubject.keys()]);
  const signals: TrustRiskAccelerationPredictionInput[] = [];

  for (const [subjectId, rows] of historyBySubject) {
    const sorted = [...rows].sort((left, right) => right.recordedAt.getTime() - left.recordedAt.getTime());
    const latest = sorted[0];
    if (!latest) {
      continue;
    }

    const previous = sorted[1] ?? null;
    const declineMagnitude = previous
      ? Math.max(0, previous.newScore - latest.newScore)
      : Math.max(0, Math.abs(Math.min(latest.scoreDelta, 0)));
    const divergence = divergenceBySubject.get(subjectId) ?? { staleSourceCount: 0, divergenceCount: 0 };
    const recentDeclines = sorted.filter((row) => row.scoreDelta < 0 && row.recordedAt >= daysAgo(nowIso, 60)).length;

    signals.push({
      targetEntity: providerTarget(subjectId, labels.get(subjectId) ?? null),
      trustScoreVelocity: Number(declineMagnitude.toFixed(4)),
      recentDeclines,
      divergenceCount: divergence.divergenceCount,
      staleSourceCount: divergence.staleSourceCount,
      alertCount: alertsBySubject.get(subjectId) ?? 0,
      lastObservedAt: latest.recordedAt.toISOString(),
    });
  }

  return signals;
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

  const rows: PredictionInsightRow[] = [];
  for (const prediction of predictions) {
    const row = await prismaClient.predictionInsight.upsert({
      where: { predictionId: prediction.predictionId },
      update: {
        predictionType: prediction.predictionType,
        targetEntityType: prediction.targetEntity.entityType,
        targetEntityId: prediction.targetEntity.entityId,
        targetEntityLabel: prediction.targetEntity.entityLabel ?? null,
        probability: prediction.score,
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
        probability: prediction.score,
        confidence: prediction.confidence,
        timeHorizon: prediction.timeHorizon,
        evidenceSignals: toJsonValue(prediction.evidenceSignals),
        explanation: prediction.explanation,
        metadata: toJsonValue(prediction.metadata),
        createdAt: new Date(prediction.createdAt),
      },
    });

    rows.push({
      id: row.id,
      predictionId: row.predictionId,
      predictionType: row.predictionType,
      targetEntityType: row.targetEntityType,
      targetEntityId: row.targetEntityId,
      targetEntityLabel: row.targetEntityLabel,
      probability: row.probability,
      confidence: row.confidence,
      timeHorizon: row.timeHorizon,
      evidenceSignals: row.evidenceSignals,
      explanation: row.explanation,
      metadata: row.metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  return rows
    .map((row) => rowToPrediction(row))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
}

async function fetchStoredPredictions(prismaClient: PrismaClient): Promise<StoredPredictionInsight[]> {
  const rows = await prismaClient.predictionInsight.findMany({
    orderBy: [
      { probability: 'desc' },
      { confidence: 'desc' },
      { updatedAt: 'desc' },
    ],
  });

  return rows.map((row) => rowToPrediction({
    id: row.id,
    predictionId: row.predictionId,
    predictionType: row.predictionType,
    targetEntityType: row.targetEntityType,
    targetEntityId: row.targetEntityId,
    targetEntityLabel: row.targetEntityLabel,
    probability: row.probability,
    confidence: row.confidence,
    timeHorizon: row.timeHorizon,
    evidenceSignals: row.evidenceSignals,
    explanation: row.explanation,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

function matchesPrediction(prediction: StoredPredictionInsight, query: PredictionQuery): boolean {
  const typeFilter = normalizeList(query.type);
  const entityTypeFilter = normalizeList(query.entityType);
  const stateFilter = normalizeList(query.state);

  if (typeFilter.length > 0 && !typeFilter.includes(prediction.type)) {
    return false;
  }

  if (entityTypeFilter.length > 0 && !entityTypeFilter.includes(prediction.entityType)) {
    return false;
  }

  if (query.entityId && prediction.entityId !== query.entityId) {
    return false;
  }

  if (stateFilter.length > 0 && !stateFilter.includes(prediction.state)) {
    return false;
  }

  if (typeof query.confidence === 'number' && prediction.confidence < query.confidence) {
    return false;
  }

  if (query.updatedAt) {
    const updatedAfter = new Date(query.updatedAt).getTime();
    if (!Number.isFinite(updatedAfter) || new Date(prediction.updatedAt).getTime() < updatedAfter) {
      return false;
    }
  }

  return true;
}

function summarizePredictions(predictions: StoredPredictionInsight[]): PredictionSummaryContract {
  const byType = new Map<string, number>();
  const byState = new Map<string, number>();

  for (const prediction of predictions) {
    byType.set(prediction.type, (byType.get(prediction.type) ?? 0) + 1);
    byState.set(prediction.state, (byState.get(prediction.state) ?? 0) + 1);
  }

  return {
    available: predictions.length > 0,
    total: predictions.length,
    updatedAt: predictions[0]?.updatedAt ?? null,
    topPrediction: predictions[0] ?? null,
    predictions: predictions.slice(0, 5),
    byType: [...byType.entries()].map(([key, count]) => ({ key, count })),
    byState: [...byState.entries()].map(([key, count]) => ({ key, count })),
  };
}

export type StoredPredictionInsight = PredictionContract;

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
        providerTrajectorySignals,
        specialtyPressureSignals,
        institutionMomentumSignals,
        networkShiftSignals,
        trustRiskSignals,
      ] = await Promise.all([
        loadProviderTrajectorySignals(prismaClient, now),
        loadSpecialtyPressureSignals(prismaClient, now),
        loadInstitutionMomentumSignals(prismaClient, now),
        loadNetworkShiftSignals(prismaClient, now),
        loadTrustRiskSignals(prismaClient, now),
      ]);

      const predictions = engine.generate({
        providerTrajectorySignals,
        specialtyPressureSignals,
        institutionMomentumSignals,
        networkShiftSignals,
        trustRiskSignals,
        now,
      });

      const stored = await persistPredictions(predictions, prismaClient);
      await syncPredictionSignalHistory(stored, prismaClient);
      await syncNetworkDeltaEvents(prismaClient);
      await syncSignalCorrelations(prismaClient);
      return stored;
    },
  );
}

export async function listPredictionInsights(
  query: PredictionQuery = {},
  prismaClient: PrismaClient = prisma,
): Promise<{ total: number; predictions: StoredPredictionInsight[]; syncedAt: string | null }> {
  return withPredictionSpan(
    'predictions.list',
    {
      'vitalcv.predictions.sync': query.sync !== false,
      'vitalcv.predictions.filter_count': normalizeList(query.type).length + normalizeList(query.state).length,
    },
    async () => {
      const base = query.sync === false
        ? await fetchStoredPredictions(prismaClient)
        : await refreshPredictionInsights(new Date().toISOString(), prismaClient);

      const filtered = base.filter((prediction) => matchesPrediction(prediction, query));
      const offset = Math.max(query.offset ?? 0, 0);
      const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);

      return {
        total: filtered.length,
        predictions: filtered.slice(offset, offset + limit),
        syncedAt: query.sync === false ? null : new Date().toISOString(),
      };
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

  const mapped = rows.map((row) => rowToPrediction({
    id: row.id,
    predictionId: row.predictionId,
    predictionType: row.predictionType,
    targetEntityType: row.targetEntityType,
    targetEntityId: row.targetEntityId,
    targetEntityLabel: row.targetEntityLabel,
    probability: row.probability,
    confidence: row.confidence,
    timeHorizon: row.timeHorizon,
    evidenceSignals: row.evidenceSignals,
    explanation: row.explanation,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  const order = new Map(predictionIds.map((predictionId, index) => [predictionId, index]));
  return mapped.sort((left, right) => (order.get(left.predictionId) ?? 0) - (order.get(right.predictionId) ?? 0));
}

export async function getPredictionSummaryForEntity(
  entityType: string,
  entityId: string,
  options: { sync?: boolean; prismaClient?: PrismaClient } = {},
): Promise<PredictionSummaryContract> {
  const result = await listPredictionInsights({
    entityType,
    entityId,
    limit: 25,
    offset: 0,
    sync: options.sync,
  }, options.prismaClient ?? prisma);

  return summarizePredictions(result.predictions);
}

export async function getPredictionSummariesForEntityKeys(
  entityKeys: string[],
  options: { sync?: boolean; prismaClient?: PrismaClient } = {},
): Promise<Map<string, PredictionSummaryContract>> {
  const keys = [...new Set(entityKeys.filter((entry) => entry.includes(':')))];
  if (keys.length === 0) {
    return new Map();
  }

  const predictions = options.sync === false
    ? await fetchStoredPredictions(options.prismaClient ?? prisma)
    : await refreshPredictionInsights(new Date().toISOString(), options.prismaClient ?? prisma);

  const grouped = new Map<string, StoredPredictionInsight[]>();
  for (const prediction of predictions) {
    const key = predictionEntityKey(prediction.entityType, prediction.entityId);
    if (!keys.includes(key)) {
      continue;
    }

    const list = grouped.get(key) ?? [];
    list.push(prediction);
    grouped.set(key, list);
  }

  const summaries = new Map<string, PredictionSummaryContract>();
  for (const key of keys) {
    summaries.set(key, summarizePredictions(grouped.get(key) ?? []));
  }

  return summaries;
}
