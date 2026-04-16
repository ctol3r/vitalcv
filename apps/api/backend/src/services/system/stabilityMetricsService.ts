import type { PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';

const DEFAULT_LOW_SAMPLE_THRESHOLD = 3;
const NPI_SUBJECT_TYPES = ['NPI', 'PROVIDER', 'CLINICIAN'] as const;

export type StabilityClassification =
  | 'unknown'
  | 'stable'
  | 'moderately_stable'
  | 'volatile';

export interface StabilityMetrics {
  npi: string;
  generatedAt: string;
  totalValidations: number;
  anomalies: number;
  anomalyRecords: number;
  driftEvents: number;
  cleanRuns: number;
  consistencyScore: number | null;
  driftRate: number | null;
  classification: StabilityClassification;
  sampleStatus: 'low' | 'sufficient';
  lowSampleThreshold: number;
}

type StabilityPrismaClient = Pick<
  PrismaClient,
  'ingestRun' | 'anomalyHistory' | 'driftEvent'
>;

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

function deriveClassification(input: {
  totalValidations: number;
  anomalies: number;
  driftRate: number | null;
  consistencyScore: number | null;
  lowSampleThreshold: number;
}): StabilityClassification {
  if (input.totalValidations < input.lowSampleThreshold) {
    return 'unknown';
  }

  const anomalyRate =
    input.totalValidations > 0
      ? input.anomalies / input.totalValidations
      : 0;
  const driftBurden = Math.min(input.driftRate ?? 0, 1);
  const consistency = input.consistencyScore ?? 0;

  if (driftBurden >= 0.5 || anomalyRate >= 0.5 || consistency < 0.6) {
    return 'volatile';
  }

  if (driftBurden > 0 || anomalyRate > 0 || consistency < 0.9) {
    return 'moderately_stable';
  }

  return 'stable';
}

export async function computeStabilityMetrics(
  npi: string,
  prismaClient: StabilityPrismaClient = prisma,
  options?: {
    lowSampleThreshold?: number;
    now?: Date;
  },
): Promise<StabilityMetrics> {
  const trimmedNpi = npi.trim();
  const lowSampleThreshold =
    options?.lowSampleThreshold ?? DEFAULT_LOW_SAMPLE_THRESHOLD;
  const generatedAt = (options?.now ?? new Date()).toISOString();

  const [totalValidations, anomalyAggregate, driftEvents] = await Promise.all([
    prismaClient.ingestRun.count({
      where: {
        npi: trimmedNpi,
        status: {
          in: ['DONE', 'ERROR'],
        },
      },
    }),
    prismaClient.anomalyHistory.aggregate({
      where: {
        subjectId: trimmedNpi,
        subjectType: {
          in: [...NPI_SUBJECT_TYPES],
        },
      },
      _count: {
        _all: true,
      },
      _sum: {
        occurrenceCount: true,
      },
    }),
    prismaClient.driftEvent.count({
      where: {
        subjectNpi: trimmedNpi,
      },
    }),
  ]);

  const anomalies = anomalyAggregate._sum.occurrenceCount ?? 0;
  const anomalyRecords = anomalyAggregate._count._all ?? 0;
  const impactedRuns = Math.min(totalValidations, anomalies + driftEvents);
  const cleanRuns =
    totalValidations > 0
      ? Math.max(totalValidations - impactedRuns, 0)
      : 0;

  const consistencyScore =
    totalValidations > 0
      ? roundMetric(cleanRuns / totalValidations)
      : null;
  const driftRate =
    totalValidations > 0
      ? roundMetric(driftEvents / totalValidations)
      : null;

  return {
    npi: trimmedNpi,
    generatedAt,
    totalValidations,
    anomalies,
    anomalyRecords,
    driftEvents,
    cleanRuns,
    consistencyScore,
    driftRate,
    classification: deriveClassification({
      totalValidations,
      anomalies,
      driftRate,
      consistencyScore,
      lowSampleThreshold,
    }),
    sampleStatus:
      totalValidations < lowSampleThreshold ? 'low' : 'sufficient',
    lowSampleThreshold,
  };
}
