import type { PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import type {
  InvestigatorLearningResolution,
  LearningCalibrationBucket,
  LearningCalibrationReport,
  LearningCalibrationSlice,
  LearningFeedbackInput,
  LearningFeedbackResult,
} from './contracts';
import {
  getInvestigatorFinding,
  setInvestigatorFindingStatus,
} from '../investigators/investigatorEngineService';
import { recordLearningSignal } from '../intelligence/intelligenceEngineService';

function clamp01(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

const ACTIONABLE_RESOLUTIONS = new Set<InvestigatorLearningResolution>([
  'true_positive_actionable',
  'true_positive_informational',
]);
const FALSE_POSITIVE_RESOLUTIONS = new Set<InvestigatorLearningResolution>([
  'false_positive_data_error',
  'false_positive_threshold_too_sensitive',
  'false_positive_contextually_irrelevant',
]);

export function confidenceBucketFor(value: number): string {
  if (value < 0.25) return '0.00-0.24';
  if (value < 0.5) return '0.25-0.49';
  if (value < 0.75) return '0.50-0.74';
  if (value < 0.9) return '0.75-0.89';
  return '0.90-1.00';
}

function sliceKey(investigatorId: string, findingType: string): string {
  return `${investigatorId}::${findingType}`;
}

function statusForResolution(resolution: InvestigatorLearningResolution): 'resolved' | 'dismissed' {
  return FALSE_POSITIVE_RESOLUTIONS.has(resolution) ? 'dismissed' : 'resolved';
}

type BucketAccumulator = {
  confidenceBucket: string;
  totalReviewed: number;
  actionableCount: number;
  falsePositiveCount: number;
  inconclusiveCount: number;
  confidenceTotal: number;
};

type SliceAccumulator = {
  investigatorId: string;
  findingType: string;
  buckets: Map<string, BucketAccumulator>;
  totalReviewed: number;
  falsePositiveCount: number;
};

function accumulateSlice(
  slices: Map<string, SliceAccumulator>,
  investigatorId: string,
  findingType: string,
  confidenceBucket: string,
  confidence: number,
  resolution: InvestigatorLearningResolution,
): void {
  const key = sliceKey(investigatorId, findingType);
  const current = slices.get(key) ?? {
    investigatorId,
    findingType,
    buckets: new Map<string, BucketAccumulator>(),
    totalReviewed: 0,
    falsePositiveCount: 0,
  };
  const bucket = current.buckets.get(confidenceBucket) ?? {
    confidenceBucket,
    totalReviewed: 0,
    actionableCount: 0,
    falsePositiveCount: 0,
    inconclusiveCount: 0,
    confidenceTotal: 0,
  };

  bucket.totalReviewed += 1;
  bucket.confidenceTotal += confidence;
  if (ACTIONABLE_RESOLUTIONS.has(resolution)) {
    bucket.actionableCount += 1;
  } else if (FALSE_POSITIVE_RESOLUTIONS.has(resolution)) {
    bucket.falsePositiveCount += 1;
    current.falsePositiveCount += 1;
  } else {
    bucket.inconclusiveCount += 1;
  }

  current.totalReviewed += 1;
  current.buckets.set(confidenceBucket, bucket);
  slices.set(key, current);
}

function finalizeSlice(slice: SliceAccumulator): LearningCalibrationSlice {
  const buckets: LearningCalibrationBucket[] = [...slice.buckets.values()]
    .map((bucket) => {
      const avgConfidence = bucket.totalReviewed > 0 ? bucket.confidenceTotal / bucket.totalReviewed : 0;
      const observedActionableRate = bucket.totalReviewed > 0 ? bucket.actionableCount / bucket.totalReviewed : 0;
      const falsePositiveRate = bucket.totalReviewed > 0 ? bucket.falsePositiveCount / bucket.totalReviewed : 0;
      return {
        confidenceBucket: bucket.confidenceBucket,
        totalReviewed: bucket.totalReviewed,
        actionableCount: bucket.actionableCount,
        falsePositiveCount: bucket.falsePositiveCount,
        inconclusiveCount: bucket.inconclusiveCount,
        falsePositiveRate,
        observedActionableRate,
        calibrationGap: clamp01(avgConfidence - observedActionableRate, 0),
      };
    })
    .sort((left, right) => left.confidenceBucket.localeCompare(right.confidenceBucket));

  return {
    investigatorId: slice.investigatorId,
    findingType: slice.findingType,
    buckets,
    totalReviewed: slice.totalReviewed,
    falsePositiveRate: slice.totalReviewed > 0 ? slice.falsePositiveCount / slice.totalReviewed : 0,
  };
}

export async function recordInvestigatorLearningFeedback(
  input: LearningFeedbackInput,
): Promise<LearningFeedbackResult> {
  const finding = await getInvestigatorFinding(input.findingId);
  if (!finding) {
    throw new Error(`Finding not found: ${input.findingId}`);
  }

  const confidenceBucket = confidenceBucketFor(finding.confidence);
  const recordedAt = new Date().toISOString();
  const status = statusForResolution(input.resolution);
  const note = input.note
    ?? `Analyst marked this finding as ${input.resolution.replace(/_/g, ' ')}.`;

  const updatedFinding = await setInvestigatorFindingStatus(
    input.findingId,
    status,
    {
      actorId: input.actorId ?? null,
      note,
      metadata: {
        learningFeedback: {
          resolution: input.resolution,
          confidenceBucket,
          rootCause: input.rootCause ?? null,
          manualDiscoveryGap: input.manualDiscoveryGap === true,
          recordedAt,
          ...(input.metadata ?? {}),
        },
      },
    },
  );

  await recordLearningSignal({
    eventType: 'USER_CORRECTION',
    loopType: 'USER_CORRECTION',
    subjectType: 'INVESTIGATOR_FINDING',
    subjectId: input.findingId,
    sourceId: finding.investigatorId,
    relatedId: finding.storylineKey,
    status: input.resolution,
    confidence: finding.confidence,
    metadata: {
      investigatorId: finding.investigatorId,
      findingType: finding.findingType,
      confidenceBucket,
      rootCause: input.rootCause ?? null,
      manualDiscoveryGap: input.manualDiscoveryGap === true,
      note,
      ...(input.metadata ?? {}),
    },
    occurredAt: recordedAt,
  });

  return {
    recordedAt,
    finding: updatedFinding,
    resolution: input.resolution,
    confidenceBucket,
  };
}

export async function buildLearningCalibrationReport(
  prismaClient: PrismaClient = prisma,
): Promise<LearningCalibrationReport> {
  const rows = await prismaClient.learningEvent.findMany({
    where: {
      subjectType: 'INVESTIGATOR_FINDING',
    },
    select: {
      sourceId: true,
      status: true,
      confidence: true,
      metadata: true,
    },
    take: 5_000,
    orderBy: { occurredAt: 'desc' },
  });

  const byInvestigator = new Map<string, SliceAccumulator>();
  const byFindingType = new Map<string, SliceAccumulator>();
  const rootCauseCounts: Record<string, number> = {};
  let actionable = 0;
  let falsePositive = 0;
  let inconclusive = 0;
  let manualDiscoveryGapCount = 0;

  for (const row of rows) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const resolution = row.status as InvestigatorLearningResolution;
    const investigatorId = typeof metadata.investigatorId === 'string'
      ? metadata.investigatorId
      : row.sourceId ?? 'unknown';
    const findingType = typeof metadata.findingType === 'string'
      ? metadata.findingType
      : 'unknown';
    const confidence = typeof row.confidence === 'number' ? row.confidence : 0;
    const confidenceBucket = typeof metadata.confidenceBucket === 'string'
      ? metadata.confidenceBucket
      : confidenceBucketFor(confidence);
    const rootCause = typeof metadata.rootCause === 'string' && metadata.rootCause.trim().length > 0
      ? metadata.rootCause.trim()
      : null;

    accumulateSlice(byInvestigator, investigatorId, findingType, confidenceBucket, confidence, resolution);
    accumulateSlice(byFindingType, 'ALL', findingType, confidenceBucket, confidence, resolution);

    if (ACTIONABLE_RESOLUTIONS.has(resolution)) {
      actionable += 1;
    } else if (FALSE_POSITIVE_RESOLUTIONS.has(resolution)) {
      falsePositive += 1;
    } else {
      inconclusive += 1;
    }

    if (rootCause) {
      rootCauseCounts[rootCause] = (rootCauseCounts[rootCause] ?? 0) + 1;
    }
    if (metadata.manualDiscoveryGap === true) {
      manualDiscoveryGapCount += 1;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      reviewed: rows.length,
      actionable,
      falsePositive,
      inconclusive,
      manualDiscoveryGapCount,
    },
    byInvestigator: [...byInvestigator.values()]
      .map((slice) => finalizeSlice(slice))
      .sort((left, right) => right.totalReviewed - left.totalReviewed || left.investigatorId.localeCompare(right.investigatorId)),
    byFindingType: [...byFindingType.values()]
      .map((slice) => finalizeSlice(slice))
      .sort((left, right) => right.totalReviewed - left.totalReviewed || left.findingType.localeCompare(right.findingType)),
    rootCauseCounts,
  };
}
