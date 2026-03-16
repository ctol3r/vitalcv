import type {
  AggregatedPredictionSignals,
  PredictionCandidate,
  PredictionState,
} from './predictionEngine';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function providerTrajectoryState(signal: AggregatedPredictionSignals['providerTrajectorySignals'][number]): PredictionState {
  if (signal.coverage < 0.34) {
    return 'insufficient_signal';
  }

  if (signal.volatilityIndex >= 0.42 && signal.positiveSignals > 0 && signal.negativeSignals > 0) {
    return 'volatile';
  }

  if (signal.signalStrength >= 0.6 && signal.positiveSignals >= Math.max(2, signal.negativeSignals)) {
    return 'rising';
  }

  if (signal.signalStrength <= 0.4 && signal.negativeSignals > signal.positiveSignals) {
    return 'declining';
  }

  return 'stable';
}

function specialtyPressureState(signal: AggregatedPredictionSignals['specialtyPressureSignals'][number]): PredictionState {
  if (signal.coverage < 0.25) {
    return 'insufficient_signal';
  }

  if ((signal.metrics.demandSupplyRatio ?? 0) >= 2.5 || signal.signalStrength >= 0.8) {
    return 'severe';
  }

  if ((signal.metrics.demandSupplyRatio ?? 0) >= 1.5 || signal.signalStrength >= 0.63) {
    return 'high';
  }

  if ((signal.metrics.demandSupplyRatio ?? 0) >= 1 || signal.signalStrength >= 0.42) {
    return 'moderate';
  }

  return 'low';
}

function institutionMomentumState(signal: AggregatedPredictionSignals['institutionMomentumSignals'][number]): PredictionState {
  if (signal.coverage < 0.25) {
    return 'insufficient_signal';
  }

  if (signal.positiveSignals > 0 && signal.negativeSignals > 0) {
    return 'mixed';
  }

  if (signal.signalStrength >= 0.6 && signal.positiveSignals >= 3) {
    return 'expanding';
  }

  if (signal.signalStrength <= 0.4 && signal.negativeSignals >= 3) {
    return 'contracting';
  }

  return 'stable';
}

function networkShiftState(signal: AggregatedPredictionSignals['networkShiftSignals'][number]): PredictionState {
  if (signal.coverage < 0.25) {
    return 'insufficient_signal';
  }

  if ((signal.metrics.clusterSplits ?? 0) > 0 || (signal.metrics.lostEdges ?? 0) > ((signal.metrics.newEdges ?? 0) + 1)) {
    return 'network fragmentation';
  }

  if ((signal.metrics.bridgeNodeChange ?? 0) >= 2 && (signal.metrics.centralityChange ?? 0) !== 0) {
    return 'bridge provider shift';
  }

  if ((signal.metrics.clusterMerges ?? 0) > 0 || ((signal.metrics.newEdges ?? 0) >= 3 && (signal.metrics.centralityChange ?? 0) > 0)) {
    return 'emerging cluster';
  }

  return 'expanding collaboration';
}

function trustRiskState(signal: AggregatedPredictionSignals['trustRiskSignals'][number]): PredictionState {
  if (signal.coverage < 0.25) {
    return 'insufficient_signal';
  }

  if (signal.signalStrength >= 0.72 || (signal.metrics.trustScoreVelocity ?? 0) >= 8) {
    return 'accelerating';
  }

  if (signal.signalStrength >= 0.45 || (signal.metrics.recentDeclines ?? 0) >= 2) {
    return 'watch';
  }

  return 'stabilizing';
}

function providerTrajectoryCandidate(
  signal: AggregatedPredictionSignals['providerTrajectorySignals'][number],
  now: string,
): PredictionCandidate {
  const state = providerTrajectoryState(signal);
  return {
    predictionType: 'PROVIDER_TRAJECTORY',
    targetEntity: signal.targetEntity,
    state,
    signalStrength: signal.signalStrength,
    coverage: signal.coverage,
    baseScore: clamp01(signal.signalStrength + (state === 'rising' ? 0.08 : state === 'volatile' ? 0.04 : 0)),
    baseConfidence: clamp01(0.42 + signal.coverage * 0.38 + (1 - Math.min(signal.volatilityIndex, 1)) * 0.12),
    timeHorizon: '180d',
    evidenceSignals: signal.evidenceSignals,
    explanationFragments: [
      signal.metrics.publicationAcceleration !== null ? `publication acceleration is ${signal.metrics.publicationAcceleration.toFixed(2)}x versus the prior window` : '',
      signal.metrics.trialLeadershipProgression !== null ? `trial leadership moved by ${signal.metrics.trialLeadershipProgression.toFixed(1)}` : '',
      signal.metrics.networkCentralityChange !== null ? `network centrality shifted ${signal.metrics.networkCentralityChange.toFixed(1)}` : '',
      signal.metrics.grantFundingTrajectory !== null ? `grant funding trajectory moved ${signal.metrics.grantFundingTrajectory.toFixed(1)}` : '',
    ].filter((value) => value.length > 0),
    metadata: {
      coverage: signal.coverage,
      volatilityIndex: signal.volatilityIndex,
      positiveSignals: signal.positiveSignals,
      negativeSignals: signal.negativeSignals,
    },
    createdAt: now,
    lastObservedAt: signal.lastObservedAt,
  };
}

function specialtyPressureCandidate(
  signal: AggregatedPredictionSignals['specialtyPressureSignals'][number],
  now: string,
): PredictionCandidate {
  const state = specialtyPressureState(signal);
  return {
    predictionType: 'SPECIALTY_PRESSURE',
    targetEntity: signal.targetEntity,
    state,
    signalStrength: signal.signalStrength,
    coverage: signal.coverage,
    baseScore: clamp01(signal.signalStrength + (state === 'severe' ? 0.06 : state === 'high' ? 0.03 : 0)),
    baseConfidence: clamp01(0.4 + signal.coverage * 0.42),
    timeHorizon: '365d',
    evidenceSignals: signal.evidenceSignals,
    explanationFragments: [
      signal.metrics.demandSupplyRatio !== null ? `demand-to-supply ratio is ${signal.metrics.demandSupplyRatio.toFixed(2)}` : '',
      signal.metrics.shortageProjection !== null ? `shortage projection is ${signal.metrics.shortageProjection.toFixed(2)}` : '',
      signal.metrics.trainingPipelineCoverage !== null ? `training pipeline coverage is ${signal.metrics.trainingPipelineCoverage.toFixed(2)}` : '',
      signal.metrics.wageGrowth !== null ? `offered pay moved ${signal.metrics.wageGrowth.toFixed(2)}` : '',
    ].filter((value) => value.length > 0),
    metadata: {
      coverage: signal.coverage,
    },
    createdAt: now,
    lastObservedAt: signal.lastObservedAt,
  };
}

function institutionMomentumCandidate(
  signal: AggregatedPredictionSignals['institutionMomentumSignals'][number],
  now: string,
): PredictionCandidate {
  const state = institutionMomentumState(signal);
  return {
    predictionType: 'INSTITUTION_MOMENTUM',
    targetEntity: signal.targetEntity,
    state,
    signalStrength: signal.signalStrength,
    coverage: signal.coverage,
    baseScore: clamp01(signal.signalStrength + (state === 'expanding' ? 0.06 : 0)),
    baseConfidence: clamp01(0.42 + signal.coverage * 0.4),
    timeHorizon: '180d',
    evidenceSignals: signal.evidenceSignals,
    explanationFragments: [
      signal.metrics.publicationOutputTrend !== null ? `publication output moved ${signal.metrics.publicationOutputTrend.toFixed(1)}` : '',
      signal.metrics.grantFundingTrend !== null ? `grant funding moved ${signal.metrics.grantFundingTrend.toFixed(1)}` : '',
      signal.metrics.providerHeadcountChange !== null ? `provider headcount moved ${signal.metrics.providerHeadcountChange.toFixed(1)}` : '',
      signal.metrics.trainingPipelineExpansion !== null ? `training pipeline moved ${signal.metrics.trainingPipelineExpansion.toFixed(1)}` : '',
    ].filter((value) => value.length > 0),
    metadata: {
      coverage: signal.coverage,
      positiveSignals: signal.positiveSignals,
      negativeSignals: signal.negativeSignals,
    },
    createdAt: now,
    lastObservedAt: signal.lastObservedAt,
  };
}

function networkShiftCandidate(
  signal: AggregatedPredictionSignals['networkShiftSignals'][number],
  now: string,
): PredictionCandidate | null {
  const state = networkShiftState(signal);
  if (
    state !== 'network fragmentation'
    && state !== 'bridge provider shift'
    && state !== 'emerging cluster'
    && (signal.signalStrength < 0.42 || (signal.metrics.newEdges ?? 0) === 0)
  ) {
    return null;
  }

  return {
    predictionType: 'NETWORK_SHIFT',
    targetEntity: signal.targetEntity,
    state,
    signalStrength: signal.signalStrength,
    coverage: signal.coverage,
    baseScore: clamp01(signal.signalStrength),
    baseConfidence: clamp01(0.4 + signal.coverage * 0.4),
    timeHorizon: '90d',
    evidenceSignals: signal.evidenceSignals,
    explanationFragments: [
      signal.metrics.newEdges !== null ? `${signal.metrics.newEdges.toFixed(0)} new edge(s) appeared` : '',
      signal.metrics.lostEdges !== null ? `${signal.metrics.lostEdges.toFixed(0)} edge(s) dropped out of the recent window` : '',
      signal.metrics.centralityChange !== null ? `centrality moved ${signal.metrics.centralityChange.toFixed(1)}` : '',
      signal.metrics.clusterSplits !== null && signal.metrics.clusterSplits > 0 ? `${signal.metrics.clusterSplits.toFixed(0)} cluster split(s) were detected` : '',
      signal.metrics.clusterMerges !== null && signal.metrics.clusterMerges > 0 ? `${signal.metrics.clusterMerges.toFixed(0)} cluster merge(s) were detected` : '',
    ].filter((value) => value.length > 0),
    metadata: {
      coverage: signal.coverage,
    },
    createdAt: now,
    lastObservedAt: signal.lastObservedAt,
  };
}

function trustRiskCandidate(
  signal: AggregatedPredictionSignals['trustRiskSignals'][number],
  now: string,
): PredictionCandidate {
  const state = trustRiskState(signal);
  return {
    predictionType: 'TRUST_RISK_ACCELERATION',
    targetEntity: signal.targetEntity,
    state,
    signalStrength: signal.signalStrength,
    coverage: signal.coverage,
    baseScore: clamp01(signal.signalStrength + (state === 'accelerating' ? 0.08 : 0)),
    baseConfidence: clamp01(0.44 + signal.coverage * 0.4),
    timeHorizon: '45d',
    evidenceSignals: signal.evidenceSignals,
    explanationFragments: [
      signal.metrics.trustScoreVelocity !== null ? `trust score velocity is ${signal.metrics.trustScoreVelocity.toFixed(1)} points per interval` : '',
      signal.metrics.recentDeclines !== null ? `${signal.metrics.recentDeclines.toFixed(0)} recent decline(s) remain active` : '',
      signal.metrics.divergenceCount !== null ? `${signal.metrics.divergenceCount.toFixed(0)} divergence signal(s) are unresolved` : '',
      signal.metrics.staleSourceCount !== null ? `${signal.metrics.staleSourceCount.toFixed(0)} stale source signal(s) persist` : '',
    ].filter((value) => value.length > 0),
    metadata: {
      coverage: signal.coverage,
    },
    createdAt: now,
    lastObservedAt: signal.lastObservedAt,
  };
}

export function detectPredictionCandidates(
  signals: AggregatedPredictionSignals,
  now: string,
): PredictionCandidate[] {
  const candidates: PredictionCandidate[] = [];

  for (const signal of signals.providerTrajectorySignals) {
    if (signal.coverage === 0) {
      continue;
    }
    candidates.push(providerTrajectoryCandidate(signal, now));
  }

  for (const signal of signals.specialtyPressureSignals) {
    if (signal.coverage === 0) {
      continue;
    }
    candidates.push(specialtyPressureCandidate(signal, now));
  }

  for (const signal of signals.institutionMomentumSignals) {
    if (signal.coverage === 0) {
      continue;
    }
    candidates.push(institutionMomentumCandidate(signal, now));
  }

  for (const signal of signals.networkShiftSignals) {
    if (signal.coverage === 0) {
      continue;
    }
    const candidate = networkShiftCandidate(signal, now);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  for (const signal of signals.trustRiskSignals) {
    if (signal.coverage === 0) {
      continue;
    }
    candidates.push(trustRiskCandidate(signal, now));
  }

  return candidates;
}
