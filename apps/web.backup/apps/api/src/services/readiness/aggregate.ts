import { differenceInDays } from 'date-fns';
import {
  PrismaClient,
  type Prisma,
  type ReadinessDimensionType,
  type ReadinessDimension,
  type ClinicianReadinessScore,
} from '@prisma/client';
import {
  computeCompactScore,
  computeIdentityScore,
  computePsdScore,
  computeSanctionsScore,
  type DimensionScoreResult,
} from './dimensions';
import { ReadinessEngine, buildDefaultSignals } from './engine';
import {
  evaluateReadinessAlerts,
  type ReadinessAlert,
} from '../alerts/readiness';
import type { DimensionSnapshot } from './types';

const prisma = new PrismaClient();
const readinessEngine = new ReadinessEngine();

export interface AggregateOptions {
  prisma?: PrismaClient;
  refreshSignals?: boolean;
  recruiterSubscribers?: string[];
  locale?: string;
}

export interface CompositeReadinessResult {
  readinessScore: number;
  dimensions: DimensionSnapshot[];
  penalties: {
    recency: number;
    titleVII: number;
  };
  titleVII: {
    compliant: boolean;
    findings: string[];
  };
  alerts: ReadinessAlert[];
}

const DIMENSION_WEIGHTS: Record<ReadinessDimensionType, number> = {
  PSD: 0.22,
  BOARD: 0.18,
  SANCTIONS: 0.2,
  COMPACT: 0.15,
  IDENTITY: 0.1,
  NPDB: 0.15,
};

export async function aggregateReadinessV3(
  clinicianId: string,
  options: AggregateOptions = {},
): Promise<CompositeReadinessResult> {
  const client = options.prisma ?? prisma;

  const existingScore = await client.clinicianReadinessScore.findUnique({
    where: { clinicianId },
  });

  if (!existingScore && options.refreshSignals) {
    const signals = buildDefaultSignals(clinicianId);
    await readinessEngine.evaluateAndStore(signals);
  }

  const [
    psd,
    board,
    sanctions,
    compact,
    identity,
    npdb,
  ] = await Promise.all([
    computePsdScore(clinicianId, client),
    computeBoardScore(clinicianId, client),
    computeSanctionsScore(clinicianId, client),
    computeCompactScore(clinicianId, client),
    computeIdentityScore(clinicianId, client),
    computeNpdbScore(clinicianId, client),
  ]);

  const dimensions = await persistDimensions(client, clinicianId, [
    psd,
    board,
    sanctions,
    compact,
    identity,
    npdb,
  ]);

  const recencyPenalty = deriveRecencyPenalty(dimensions);
  const titleVIIReview = evaluateTitleVIICompliance(dimensions);
  const normalizedWeights = normalizeWeights(DIMENSION_WEIGHTS);

  const weightedScore = dimensions.reduce((total, dimension) => {
    const weight = normalizedWeights[dimension.dimension] ?? 0;
    return total + dimension.score * weight;
  }, 0);

  const readinessScore = clamp01(weightedScore - recencyPenalty - titleVIIReview.penalty);

  await client.clinicianReadinessScore.upsert({
    where: { clinicianId },
    update: {
      score: readinessScore,
      factors: buildFactorSnapshot(dimensions, recencyPenalty, titleVIIReview),
    },
    create: {
      clinicianId,
      score: readinessScore,
      factors: buildFactorSnapshot(dimensions, recencyPenalty, titleVIIReview),
    },
  });

  const alerts = evaluateReadinessAlerts({
    clinicianId,
    previousScore: existingScore?.score,
    currentScore: readinessScore,
    dimensions,
    subscribers: options.recruiterSubscribers ?? [],
    locale: options.locale,
  });

  return {
    readinessScore,
    dimensions,
    penalties: {
      recency: recencyPenalty,
      titleVII: titleVIIReview.penalty,
    },
    titleVII: {
      compliant: titleVIIReview.findings.length === 0,
      findings: titleVIIReview.findings,
    },
    alerts,
  };
}

async function computeBoardScore(
  clinicianId: string,
  client: PrismaClient,
): Promise<DimensionScoreResult> {
  const checks = await client.complianceCheck.findMany({
    where: {
      clinicianId,
      type: { in: ['license', 'board_monitoring'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const mismatches = checks.filter((check) => {
    const payload = check.result as Prisma.JsonObject | null;
    return Boolean((payload as { mismatchDetected?: boolean })?.mismatchDetected);
  }).length;

  const recency = checks[0]?.createdAt ?? null;
  const score = roundScore(Math.max(0.2, 1 - mismatches * 0.2));

  return {
    dimension: 'BOARD',
    score,
    metadata: {
      totalChecks: checks.length,
      mismatchCount: mismatches,
      lastCheckAt: recency?.toISOString() ?? null,
    },
  };
}

async function computeNpdbScore(
  clinicianId: string,
  client: PrismaClient,
): Promise<DimensionScoreResult> {
  const readiness = await client.clinicianReadinessScore.findUnique({
    where: { clinicianId },
  });

  const factors = readiness?.factors as Prisma.JsonObject | null;
  const npdbMeta = (factors as { npdbHistory?: { adverseActions?: number; lastReportAt?: string } })
    ?.npdbHistory;

  const adverse = npdbMeta?.adverseActions ?? 0;
  const score = roundScore(Math.max(0, 1 - adverse * 0.25));

  return {
    dimension: 'NPDB',
    score,
    metadata: {
      adverseActions: adverse,
      lastReportAt: npdbMeta?.lastReportAt ?? null,
      derivedFrom: readiness ? 'readiness_factors' : 'none',
    },
  };
}

async function persistDimensions(
  client: PrismaClient,
  clinicianId: string,
  dimensions: DimensionScoreResult[],
): Promise<DimensionSnapshot[]> {
  const results: DimensionSnapshot[] = [];

  for (const dimension of dimensions) {
    const record: ReadinessDimension = await client.readinessDimension.upsert({
      where: {
        clinicianId_dimension: {
          clinicianId,
          dimension: dimension.dimension,
        },
      },
      update: {
        score: dimension.score,
        metadata: dimension.metadata as Prisma.JsonValue,
        updatedAt: new Date(),
      },
      create: {
        clinicianId,
        dimension: dimension.dimension,
        score: dimension.score,
        metadata: dimension.metadata as Prisma.JsonValue,
      },
    });

    results.push({
      ...dimension,
      updatedAt: record.updatedAt.toISOString(),
    });
  }

  return results;
}

function deriveRecencyPenalty(dimensions: DimensionSnapshot[]): number {
  const oldest = dimensions.reduce<Date | null>((current, dimension) => {
    const updated = new Date(dimension.updatedAt);
    if (!current) return updated;
    return updated < current ? updated : current;
  }, null);

  if (!oldest) {
    return 0;
  }

  const days = differenceInDays(new Date(), oldest);
  return clamp01(Math.min(days / 365, 0.15));
}

function evaluateTitleVIICompliance(dimensions: DimensionSnapshot[]) {
  const findings: string[] = [];

  for (const dimension of dimensions) {
    const metadata = dimension.metadata;
    if (metadata && typeof metadata === 'object') {
      const text = JSON.stringify(metadata).toLowerCase();
      if (text.includes('race') || text.includes('religion') || text.includes('gender')) {
        findings.push(
          `${dimension.dimension} metadata references a protected attribute. Remove or mask it.`,
        );
      }
    }
  }

  const penalty = clamp01(findings.length * 0.02);
  return { findings, penalty };
}

function buildFactorSnapshot(
  dimensions: DimensionSnapshot[],
  recencyPenalty: number,
  titleVIIReview: { findings: string[]; penalty: number },
): Record<string, unknown> {
  return {
    readinessComponents: dimensions.reduce<Record<string, number>>((map, dimension) => {
      map[dimension.dimension] = dimension.score;
      return map;
    }, {}),
    recencyPenalty,
    titleVIIFindings: titleVIIReview.findings,
  };
}

function normalizeWeights(weights: Record<ReadinessDimensionType, number>) {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total === 0) return weights;
  return Object.entries(weights).reduce<Record<ReadinessDimensionType, number>>(
    (map, [dimension, weight]) => {
      map[dimension as ReadinessDimensionType] = weight / total;
      return map;
    },
    {} as Record<ReadinessDimensionType, number>,
  );
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function roundScore(value: number): number {
  return Number(clamp01(value).toFixed(4));
}


