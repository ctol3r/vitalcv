import type {
  AggregatedInstitutionMomentumSignal,
  AggregatedNetworkShiftSignal,
  AggregatedPredictionSignals,
  AggregatedProviderTrajectorySignal,
  AggregatedSpecialtyPressureSignal,
  AggregatedTrustRiskSignal,
  InstitutionMomentumPredictionInput,
  NetworkShiftPredictionInput,
  PredictionEngineInput,
  PredictionEvidenceSignal,
  ProviderTrajectoryPredictionInput,
  SpecialtyPressurePredictionInput,
  TrustRiskAccelerationPredictionInput,
} from './predictionEngine';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function normalizeSigned(value: number | null | undefined, scale: number): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }

  return clamp01((value + scale) / (scale * 2));
}

function normalizePositive(value: number | null | undefined, scale: number): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }

  return clamp01(value / scale);
}

function signalDirection(value: number | null | undefined): PredictionEvidenceSignal['direction'] {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'FLAT';
  }

  if (value > 0) {
    return 'UP';
  }

  if (value < 0) {
    return 'DOWN';
  }

  return 'FLAT';
}

function coverage(values: Array<number | null | undefined>): number {
  if (values.length === 0) {
    return 0;
  }

  const observed = values.filter((value) => value !== null && value !== undefined && Number.isFinite(value)).length;
  return clamp01(observed / values.length);
}

function positiveSignals(values: Array<number | null | undefined>): number {
  return values.filter((value) => value !== null && value !== undefined && Number.isFinite(value) && value > 0).length;
}

function negativeSignals(values: Array<number | null | undefined>): number {
  return values.filter((value) => value !== null && value !== undefined && Number.isFinite(value) && value < 0).length;
}

function evidenceSignal(
  label: string,
  value: number | string | null | undefined,
  source: string,
  observedAt: string,
): PredictionEvidenceSignal {
  const numericValue = typeof value === 'number' ? value : null;
  return {
    label,
    value: typeof value === 'number' ? Number(value.toFixed(4)) : value ?? 'n/a',
    direction: signalDirection(numericValue),
    source,
    observedAt,
  };
}

function aggregateProviderTrajectorySignal(
  input: ProviderTrajectoryPredictionInput,
): AggregatedProviderTrajectorySignal {
  const values = [
    input.publicationAcceleration,
    input.citationQualityTrend,
    input.trialLeadershipProgression,
    input.grantFundingTrajectory,
    input.industryPaymentDiversification,
    input.networkCentralityChange,
  ];

  const trajectoryIndex = clamp01(
    normalizeSigned(input.publicationAcceleration, 2) * 0.24
    + normalizeSigned(input.citationQualityTrend, 2) * 0.18
    + normalizeSigned(input.trialLeadershipProgression, 3) * 0.18
    + normalizeSigned(input.grantFundingTrajectory, 3) * 0.16
    + normalizeSigned(input.industryPaymentDiversification, 3) * 0.1
    + normalizeSigned(input.networkCentralityChange, 2) * 0.14,
  );

  const volatilityIndex = clamp01(
    Math.abs((input.publicationAcceleration ?? 0) - (input.citationQualityTrend ?? 0)) * 0.14
    + Math.abs((input.trialLeadershipProgression ?? 0) - (input.grantFundingTrajectory ?? 0)) * 0.12
    + Math.abs((input.industryPaymentDiversification ?? 0) - (input.networkCentralityChange ?? 0)) * 0.1,
  );

  return {
    predictionType: 'PROVIDER_TRAJECTORY',
    targetEntity: input.targetEntity,
    signalStrength: trajectoryIndex,
    coverage: coverage(values),
    positiveSignals: positiveSignals(values),
    negativeSignals: negativeSignals(values),
    volatilityIndex,
    evidenceSignals: [
      evidenceSignal('publication_acceleration', input.publicationAcceleration, 'OPENALEX/PUBMED', input.lastObservedAt),
      evidenceSignal('citation_quality_trend', input.citationQualityTrend, 'OPENALEX/PUBMED', input.lastObservedAt),
      evidenceSignal('trial_leadership_progression', input.trialLeadershipProgression, 'CLINICAL_TRIALS', input.lastObservedAt),
      evidenceSignal('grant_funding_trajectory', input.grantFundingTrajectory, 'NIH_REPORTER', input.lastObservedAt),
      evidenceSignal('industry_payment_diversification', input.industryPaymentDiversification, 'OPEN_PAYMENTS', input.lastObservedAt),
      evidenceSignal('network_centrality_change', input.networkCentralityChange, 'GRAPH_RUNTIME', input.lastObservedAt),
    ],
    metrics: {
      publicationAcceleration: input.publicationAcceleration,
      citationQualityTrend: input.citationQualityTrend,
      trialLeadershipProgression: input.trialLeadershipProgression,
      grantFundingTrajectory: input.grantFundingTrajectory,
      industryPaymentDiversification: input.industryPaymentDiversification,
      networkCentralityChange: input.networkCentralityChange,
    },
    lastObservedAt: input.lastObservedAt,
  };
}

function aggregateSpecialtyPressureSignal(
  input: SpecialtyPressurePredictionInput,
): AggregatedSpecialtyPressureSignal {
  const pressureIndex = clamp01(
    normalizePositive(input.shortageProjection, 4) * 0.32
    + normalizePositive(input.demandSupplyRatio, 4) * 0.28
    + normalizePositive(input.wageGrowth, 1.2) * 0.18
    + normalizePositive(input.matchTension, 1) * 0.12
    + (1 - normalizePositive(input.trainingPipelineCoverage, 1.5)) * 0.1,
  );

  return {
    predictionType: 'SPECIALTY_PRESSURE',
    targetEntity: input.targetEntity,
    signalStrength: pressureIndex,
    coverage: coverage([
      input.shortageProjection,
      input.demandSupplyRatio,
      input.wageGrowth,
      input.trainingPipelineCoverage,
      input.matchTension,
    ]),
    evidenceSignals: [
      evidenceSignal('shortage_projection', input.shortageProjection, 'VITALCV_DEMAND_MODEL', input.lastObservedAt),
      evidenceSignal('demand_supply_ratio', input.demandSupplyRatio, 'OPPORTUNITIES/PERSON_PROFILES', input.lastObservedAt),
      evidenceSignal('wage_growth', input.wageGrowth, 'OPPORTUNITY_PAY', input.lastObservedAt),
      evidenceSignal('training_pipeline_coverage', input.trainingPipelineCoverage, 'ACGME', input.lastObservedAt),
      evidenceSignal('match_tension', input.matchTension, 'VITALCV_MATCH_PROXY', input.lastObservedAt),
    ],
    metrics: {
      shortageProjection: input.shortageProjection,
      demandSupplyRatio: input.demandSupplyRatio,
      wageGrowth: input.wageGrowth,
      trainingPipelineCoverage: input.trainingPipelineCoverage,
      matchTension: input.matchTension,
    },
    lastObservedAt: input.lastObservedAt,
  };
}

function aggregateInstitutionMomentumSignal(
  input: InstitutionMomentumPredictionInput,
): AggregatedInstitutionMomentumSignal {
  const values = [
    input.publicationOutputTrend,
    input.grantFundingTrend,
    input.trialSiteGrowth,
    input.providerHeadcountChange,
    input.trainingPipelineExpansion,
  ];

  const momentumIndex = clamp01(
    normalizeSigned(input.publicationOutputTrend, 3) * 0.28
    + normalizeSigned(input.grantFundingTrend, 3) * 0.22
    + normalizeSigned(input.trialSiteGrowth, 3) * 0.2
    + normalizeSigned(input.providerHeadcountChange, 3) * 0.18
    + normalizeSigned(input.trainingPipelineExpansion, 3) * 0.12,
  );

  return {
    predictionType: 'INSTITUTION_MOMENTUM',
    targetEntity: input.targetEntity,
    signalStrength: momentumIndex,
    coverage: coverage(values),
    positiveSignals: positiveSignals(values),
    negativeSignals: negativeSignals(values),
    evidenceSignals: [
      evidenceSignal('publication_output_trend', input.publicationOutputTrend, 'OPENALEX/PUBMED', input.lastObservedAt),
      evidenceSignal('grant_funding_trend', input.grantFundingTrend, 'NIH_REPORTER', input.lastObservedAt),
      evidenceSignal('trial_site_growth', input.trialSiteGrowth, 'CLINICAL_TRIALS', input.lastObservedAt),
      evidenceSignal('provider_headcount_change', input.providerHeadcountChange, 'CLAIM_RECORDS', input.lastObservedAt),
      evidenceSignal('training_pipeline_expansion', input.trainingPipelineExpansion, 'ACGME', input.lastObservedAt),
    ],
    metrics: {
      publicationOutputTrend: input.publicationOutputTrend,
      grantFundingTrend: input.grantFundingTrend,
      trialSiteGrowth: input.trialSiteGrowth,
      providerHeadcountChange: input.providerHeadcountChange,
      trainingPipelineExpansion: input.trainingPipelineExpansion,
    },
    lastObservedAt: input.lastObservedAt,
  };
}

function aggregateNetworkShiftSignal(
  input: NetworkShiftPredictionInput,
): AggregatedNetworkShiftSignal {
  const shiftIndex = clamp01(
    normalizePositive(input.newEdges, 8) * 0.26
    + normalizePositive(input.lostEdges, 8) * 0.16
    + normalizeSigned(input.centralityChange, 6) * 0.2
    + normalizePositive(input.clusterMerges, 3) * 0.12
    + normalizePositive(input.clusterSplits, 3) * 0.14
    + normalizePositive(input.bridgeNodeChange, 4) * 0.12,
  );

  return {
    predictionType: 'NETWORK_SHIFT',
    targetEntity: input.targetEntity,
    signalStrength: shiftIndex,
    coverage: coverage([
      input.newEdges,
      input.lostEdges,
      input.centralityChange,
      input.clusterMerges,
      input.clusterSplits,
      input.bridgeNodeChange,
    ]),
    evidenceSignals: [
      evidenceSignal('new_edges', input.newEdges, 'GRAPH_RUNTIME', input.lastObservedAt),
      evidenceSignal('lost_edges', input.lostEdges, 'GRAPH_RUNTIME', input.lastObservedAt),
      evidenceSignal('centrality_change', input.centralityChange, 'GRAPH_RUNTIME', input.lastObservedAt),
      evidenceSignal('cluster_merges', input.clusterMerges, 'GRAPH_RUNTIME', input.lastObservedAt),
      evidenceSignal('cluster_splits', input.clusterSplits, 'GRAPH_RUNTIME', input.lastObservedAt),
      evidenceSignal('bridge_node_change', input.bridgeNodeChange, 'GRAPH_RUNTIME', input.lastObservedAt),
    ],
    metrics: {
      newEdges: input.newEdges,
      lostEdges: input.lostEdges,
      centralityChange: input.centralityChange,
      clusterMerges: input.clusterMerges,
      clusterSplits: input.clusterSplits,
      bridgeNodeChange: input.bridgeNodeChange,
    },
    lastObservedAt: input.lastObservedAt,
  };
}

function aggregateTrustRiskSignal(
  input: TrustRiskAccelerationPredictionInput,
): AggregatedTrustRiskSignal {
  const riskIndex = clamp01(
    normalizePositive(input.trustScoreVelocity, 12) * 0.34
    + normalizePositive(input.recentDeclines, 5) * 0.18
    + normalizePositive(input.divergenceCount, 5) * 0.18
    + normalizePositive(input.staleSourceCount, 5) * 0.14
    + normalizePositive(input.alertCount, 4) * 0.16,
  );

  return {
    predictionType: 'TRUST_RISK_ACCELERATION',
    targetEntity: input.targetEntity,
    signalStrength: riskIndex,
    coverage: coverage([
      input.trustScoreVelocity,
      input.recentDeclines,
      input.divergenceCount,
      input.staleSourceCount,
      input.alertCount,
    ]),
    evidenceSignals: [
      evidenceSignal('trust_score_velocity', input.trustScoreVelocity, 'TRUST_SCORE_HISTORY', input.lastObservedAt),
      evidenceSignal('recent_declines', input.recentDeclines, 'TRUST_SCORE_HISTORY', input.lastObservedAt),
      evidenceSignal('divergence_count', input.divergenceCount, 'INVESTIGATOR_FINDINGS', input.lastObservedAt),
      evidenceSignal('stale_source_count', input.staleSourceCount, 'INVESTIGATOR_FINDINGS', input.lastObservedAt),
      evidenceSignal('alert_count', input.alertCount, 'TRUST_ALERTS', input.lastObservedAt),
    ],
    metrics: {
      trustScoreVelocity: input.trustScoreVelocity,
      recentDeclines: input.recentDeclines,
      divergenceCount: input.divergenceCount,
      staleSourceCount: input.staleSourceCount,
      alertCount: input.alertCount,
    },
    lastObservedAt: input.lastObservedAt,
  };
}

export function aggregatePredictionSignals(
  input: PredictionEngineInput,
  _now: string,
): AggregatedPredictionSignals {
  return {
    providerTrajectorySignals: (input.providerTrajectorySignals ?? []).map(aggregateProviderTrajectorySignal),
    specialtyPressureSignals: (input.specialtyPressureSignals ?? []).map(aggregateSpecialtyPressureSignal),
    institutionMomentumSignals: (input.institutionMomentumSignals ?? []).map(aggregateInstitutionMomentumSignal),
    networkShiftSignals: (input.networkShiftSignals ?? []).map(aggregateNetworkShiftSignal),
    trustRiskSignals: (input.trustRiskSignals ?? []).map(aggregateTrustRiskSignal),
  };
}
