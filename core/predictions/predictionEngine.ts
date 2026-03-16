import { aggregatePredictionSignals } from './signalAggregator';
import { forecastPredictions } from './forecastModel';
import { detectPredictionCandidates } from './trendDetector';

export type PredictionType =
  | 'PROVIDER_TRAJECTORY'
  | 'SPECIALTY_PRESSURE'
  | 'INSTITUTION_MOMENTUM'
  | 'NETWORK_SHIFT'
  | 'TRUST_RISK_ACCELERATION';

export type PredictionState =
  | 'rising'
  | 'stable'
  | 'declining'
  | 'volatile'
  | 'low'
  | 'moderate'
  | 'high'
  | 'severe'
  | 'expanding'
  | 'contracting'
  | 'mixed'
  | 'emerging cluster'
  | 'emerging_cluster'
  | 'expanding collaboration'
  | 'collaboration_expansion'
  | 'network fragmentation'
  | 'network_fragmentation'
  | 'bridge provider shift'
  | 'bridge_provider_shift'
  | 'accelerating'
  | 'watch'
  | 'stabilizing'
  | 'insufficient_signal';

export interface PredictionTargetEntity {
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
}

export interface PredictionEvidenceSignal {
  label: string;
  value: number | string;
  direction: 'UP' | 'DOWN' | 'FLAT';
  source?: string | null;
  observedAt?: string;
}

export interface ProviderTrajectoryPredictionInput {
  targetEntity: PredictionTargetEntity;
  publicationAcceleration: number | null;
  citationQualityTrend: number | null;
  trialLeadershipProgression: number | null;
  grantFundingTrajectory: number | null;
  industryPaymentDiversification: number | null;
  networkCentralityChange: number | null;
  lastObservedAt: string;
}

export interface SpecialtyPressurePredictionInput {
  targetEntity: PredictionTargetEntity;
  shortageProjection: number | null;
  demandSupplyRatio: number | null;
  wageGrowth: number | null;
  trainingPipelineCoverage: number | null;
  matchTension: number | null;
  lastObservedAt: string;
}

export interface InstitutionMomentumPredictionInput {
  targetEntity: PredictionTargetEntity;
  publicationOutputTrend: number | null;
  grantFundingTrend: number | null;
  trialSiteGrowth: number | null;
  providerHeadcountChange: number | null;
  trainingPipelineExpansion: number | null;
  lastObservedAt: string;
}

export interface NetworkShiftPredictionInput {
  targetEntity: PredictionTargetEntity;
  newEdges: number | null;
  lostEdges: number | null;
  centralityChange: number | null;
  clusterMerges: number | null;
  clusterSplits: number | null;
  bridgeNodeChange: number | null;
  lastObservedAt: string;
}

export interface TrustRiskAccelerationPredictionInput {
  targetEntity: PredictionTargetEntity;
  trustScoreVelocity: number | null;
  recentDeclines: number | null;
  divergenceCount: number | null;
  staleSourceCount: number | null;
  alertCount: number | null;
  lastObservedAt: string;
}

export interface AggregatedProviderTrajectorySignal {
  predictionType: 'PROVIDER_TRAJECTORY';
  targetEntity: PredictionTargetEntity;
  signalStrength: number;
  coverage: number;
  positiveSignals: number;
  negativeSignals: number;
  volatilityIndex: number;
  evidenceSignals: PredictionEvidenceSignal[];
  metrics: {
    publicationAcceleration: number | null;
    citationQualityTrend: number | null;
    trialLeadershipProgression: number | null;
    grantFundingTrajectory: number | null;
    industryPaymentDiversification: number | null;
    networkCentralityChange: number | null;
  };
  lastObservedAt: string;
}

export interface AggregatedSpecialtyPressureSignal {
  predictionType: 'SPECIALTY_PRESSURE';
  targetEntity: PredictionTargetEntity;
  signalStrength: number;
  coverage: number;
  evidenceSignals: PredictionEvidenceSignal[];
  metrics: {
    shortageProjection: number | null;
    demandSupplyRatio: number | null;
    wageGrowth: number | null;
    trainingPipelineCoverage: number | null;
    matchTension: number | null;
  };
  lastObservedAt: string;
}

export interface AggregatedInstitutionMomentumSignal {
  predictionType: 'INSTITUTION_MOMENTUM';
  targetEntity: PredictionTargetEntity;
  signalStrength: number;
  coverage: number;
  positiveSignals: number;
  negativeSignals: number;
  evidenceSignals: PredictionEvidenceSignal[];
  metrics: {
    publicationOutputTrend: number | null;
    grantFundingTrend: number | null;
    trialSiteGrowth: number | null;
    providerHeadcountChange: number | null;
    trainingPipelineExpansion: number | null;
  };
  lastObservedAt: string;
}

export interface AggregatedNetworkShiftSignal {
  predictionType: 'NETWORK_SHIFT';
  targetEntity: PredictionTargetEntity;
  signalStrength: number;
  coverage: number;
  evidenceSignals: PredictionEvidenceSignal[];
  metrics: {
    newEdges: number | null;
    lostEdges: number | null;
    centralityChange: number | null;
    clusterMerges: number | null;
    clusterSplits: number | null;
    bridgeNodeChange: number | null;
  };
  lastObservedAt: string;
}

export interface AggregatedTrustRiskSignal {
  predictionType: 'TRUST_RISK_ACCELERATION';
  targetEntity: PredictionTargetEntity;
  signalStrength: number;
  coverage: number;
  evidenceSignals: PredictionEvidenceSignal[];
  metrics: {
    trustScoreVelocity: number | null;
    recentDeclines: number | null;
    divergenceCount: number | null;
    staleSourceCount: number | null;
    alertCount: number | null;
  };
  lastObservedAt: string;
}

export interface AggregatedPredictionSignals {
  providerTrajectorySignals: AggregatedProviderTrajectorySignal[];
  specialtyPressureSignals: AggregatedSpecialtyPressureSignal[];
  institutionMomentumSignals: AggregatedInstitutionMomentumSignal[];
  networkShiftSignals: AggregatedNetworkShiftSignal[];
  trustRiskSignals: AggregatedTrustRiskSignal[];
}

export interface PredictionCandidate {
  predictionType: PredictionType;
  targetEntity: PredictionTargetEntity;
  state: PredictionState;
  signalStrength: number;
  coverage: number;
  baseScore: number;
  baseConfidence: number;
  timeHorizon: string;
  evidenceSignals: PredictionEvidenceSignal[];
  explanationFragments: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  lastObservedAt: string;
}

export interface PredictionInsight {
  predictionId: string;
  predictionType: PredictionType;
  targetEntity: PredictionTargetEntity;
  state: PredictionState;
  score: number;
  probability: number;
  confidence: number;
  timeHorizon: string;
  evidenceSignals: PredictionEvidenceSignal[];
  explanation: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface PredictionEngineInput {
  providerTrajectorySignals?: readonly ProviderTrajectoryPredictionInput[];
  specialtyPressureSignals?: readonly SpecialtyPressurePredictionInput[];
  institutionMomentumSignals?: readonly InstitutionMomentumPredictionInput[];
  networkShiftSignals?: readonly NetworkShiftPredictionInput[];
  trustRiskSignals?: readonly TrustRiskAccelerationPredictionInput[];
  now?: string;
}

export function createPredictionEngine() {
  return {
    generate(input: PredictionEngineInput): PredictionInsight[] {
      const now = input.now ?? new Date().toISOString();
      const aggregated = aggregatePredictionSignals(input, now);
      const candidates = detectPredictionCandidates(aggregated, now);
      return forecastPredictions(candidates, now);
    },
  };
}
