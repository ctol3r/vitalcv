export interface SourceReliabilityEvidence {
  sourceId: string;
  contradictionCount: number;
  totalObservations: number;
  freshRecordCount: number;
  agingRecordCount: number;
  staleRecordCount: number;
  successfulRuns: number;
  partialRuns: number;
  failedRuns: number;
  accurateOutcomes: number;
  inaccurateOutcomes: number;
}

export interface SourceReliabilityComputation {
  sourceId: string;
  contradictionFrequency: number;
  freshnessConsistency: number;
  coverageReliability: number;
  verificationAccuracy: number;
  sourceReliabilityScore: number;
  evidenceCount: number;
  explanation: string;
  components: {
    contradictionScore: number;
    freshnessScore: number;
    coverageScore: number;
    accuracyScore: number;
  };
}

function ratio(numerator: number, denominator: number, fallback = 0.5): number {
  if (denominator <= 0) {
    return fallback;
  }

  return numerator / denominator;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Math.round(value * 10_000) / 10_000));
}

function weightedAverage(values: Array<{ weight: number; value: number }>): number {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) {
    return 0;
  }

  return values.reduce((sum, item) => sum + (item.weight * item.value), 0) / totalWeight;
}

export function computeSourceReliability(
  evidence: SourceReliabilityEvidence,
): SourceReliabilityComputation {
  const freshnessSamples = evidence.freshRecordCount + evidence.agingRecordCount + evidence.staleRecordCount;
  const totalRuns = evidence.successfulRuns + evidence.partialRuns + evidence.failedRuns;
  const totalAccuracySignals = evidence.accurateOutcomes + evidence.inaccurateOutcomes;
  const contradictionFrequency = clamp01(
    ratio(evidence.contradictionCount, Math.max(evidence.totalObservations, 1), 0),
  );
  const freshnessConsistency = clamp01(
    ratio(
      evidence.freshRecordCount + (evidence.agingRecordCount * 0.5),
      freshnessSamples,
      0.5,
    ),
  );
  const coverageReliability = clamp01(
    ratio(
      evidence.successfulRuns + (evidence.partialRuns * 0.5),
      totalRuns,
      0.5,
    ),
  );
  const verificationAccuracy = clamp01(
    ratio(evidence.accurateOutcomes, totalAccuracySignals, 0.5),
  );
  const contradictionScore = clamp01(1 - contradictionFrequency);
  const sourceReliabilityScore = clamp01(weightedAverage([
    { weight: 0.25, value: contradictionScore },
    { weight: 0.25, value: freshnessConsistency },
    { weight: 0.2, value: coverageReliability },
    { weight: 0.3, value: verificationAccuracy },
  ]));
  const evidenceCount = evidence.totalObservations + totalRuns + totalAccuracySignals;

  return {
    sourceId: evidence.sourceId,
    contradictionFrequency,
    freshnessConsistency,
    coverageReliability,
    verificationAccuracy,
    sourceReliabilityScore,
    evidenceCount,
    explanation: [
      `contradiction=${contradictionScore.toFixed(2)}`,
      `freshness=${freshnessConsistency.toFixed(2)}`,
      `coverage=${coverageReliability.toFixed(2)}`,
      `accuracy=${verificationAccuracy.toFixed(2)}`,
    ].join(', '),
    components: {
      contradictionScore,
      freshnessScore: freshnessConsistency,
      coverageScore: coverageReliability,
      accuracyScore: verificationAccuracy,
    },
  };
}
