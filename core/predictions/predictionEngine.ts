import { aggregatePredictionSignals } from './signalAggregator';
import { forecastPredictions } from './forecastModel';
import { detectPredictionCandidates } from './trendDetector';

export type PredictionType =
  | 'TRUST_SCORE_DECLINE'
  | 'EMERGING_INVESTIGATOR'
  | 'INSTITUTION_RESEARCH_GROWTH'
  | 'NETWORK_CLUSTER_EXPANSION'
  | 'WORKFORCE_SHORTAGE_ESCALATION';

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
}

export interface TrustDeclinePredictionInput {
  targetEntity: PredictionTargetEntity;
  recentScore: number;
  previousScore: number | null;
  scoreDelta: number;
  recentDeclines: number;
  staleSourceCount: number;
  divergenceCount: number;
  lastObservedAt: string;
}

export interface EmergingInvestigatorPredictionInput {
  targetEntity: PredictionTargetEntity;
  recentPublications: number;
  previousPublications: number;
  recentTrials: number;
  recentGrantCount: number;
  citationCount: number;
  graphDegree: number;
  lastObservedAt: string;
}

export interface InstitutionResearchGrowthPredictionInput {
  targetEntity: PredictionTargetEntity;
  recentResearchCount: number;
  previousResearchCount: number;
  contributingProviders: number;
  leadInvestigatorCount: number;
  lastObservedAt: string;
}

export interface NetworkClusterExpansionPredictionInput {
  targetEntity: PredictionTargetEntity;
  recentConnections: number;
  previousConnections: number;
  peerGrowth: number;
  anchorCount: number;
  averageConfidence: number;
  lastObservedAt: string;
}

export interface WorkforceShortagePredictionInput {
  targetEntity: PredictionTargetEntity;
  specialty: string;
  state: string;
  demand: number;
  previousDemand: number;
  supply: number;
  pressureScore: number;
  lastObservedAt: string;
}

export interface AggregatedTrustDeclineSignal {
  predictionType: 'TRUST_SCORE_DECLINE';
  targetEntity: PredictionTargetEntity;
  signalStrength: number;
  evidenceSignals: PredictionEvidenceSignal[];
  metrics: {
    declineMagnitude: number;
    staleSourceCount: number;
    divergenceCount: number;
    recentDeclines: number;
  };
  lastObservedAt: string;
}

export interface AggregatedEmergingInvestigatorSignal {
  predictionType: 'EMERGING_INVESTIGATOR';
  targetEntity: PredictionTargetEntity;
  signalStrength: number;
  evidenceSignals: PredictionEvidenceSignal[];
  metrics: {
    publicationGrowth: number;
    recentTrials: number;
    recentGrantCount: number;
    citationCount: number;
    graphDegree: number;
  };
  lastObservedAt: string;
}

export interface AggregatedInstitutionResearchSignal {
  predictionType: 'INSTITUTION_RESEARCH_GROWTH';
  targetEntity: PredictionTargetEntity;
  signalStrength: number;
  evidenceSignals: PredictionEvidenceSignal[];
  metrics: {
    researchGrowth: number;
    contributingProviders: number;
    leadInvestigatorCount: number;
    recentResearchCount: number;
  };
  lastObservedAt: string;
}

export interface AggregatedNetworkExpansionSignal {
  predictionType: 'NETWORK_CLUSTER_EXPANSION';
  targetEntity: PredictionTargetEntity;
  signalStrength: number;
  evidenceSignals: PredictionEvidenceSignal[];
  metrics: {
    expansionDelta: number;
    peerGrowth: number;
    anchorCount: number;
    averageConfidence: number;
    recentConnections: number;
  };
  lastObservedAt: string;
}

export interface AggregatedWorkforceShortageSignal {
  predictionType: 'WORKFORCE_SHORTAGE_ESCALATION';
  targetEntity: PredictionTargetEntity;
  signalStrength: number;
  evidenceSignals: PredictionEvidenceSignal[];
  metrics: {
    demandGrowth: number;
    demand: number;
    supply: number;
    pressureScore: number;
    shortageRatio: number;
    specialty: string;
    state: string;
  };
  lastObservedAt: string;
}

export interface AggregatedPredictionSignals {
  trustSignals: AggregatedTrustDeclineSignal[];
  emergingInvestigatorSignals: AggregatedEmergingInvestigatorSignal[];
  institutionSignals: AggregatedInstitutionResearchSignal[];
  networkSignals: AggregatedNetworkExpansionSignal[];
  workforceSignals: AggregatedWorkforceShortageSignal[];
}

export interface PredictionCandidate {
  predictionType: PredictionType;
  targetEntity: PredictionTargetEntity;
  signalStrength: number;
  baseProbability: number;
  baseConfidence: number;
  timeHorizon: string;
  evidenceSignals: PredictionEvidenceSignal[];
  explanationFragments: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PredictionInsight {
  predictionId: string;
  predictionType: PredictionType;
  targetEntity: PredictionTargetEntity;
  probability: number;
  confidence: number;
  timeHorizon: string;
  evidenceSignals: PredictionEvidenceSignal[];
  explanation: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface PredictionEngineInput {
  trustSignals?: readonly TrustDeclinePredictionInput[];
  emergingInvestigatorSignals?: readonly EmergingInvestigatorPredictionInput[];
  institutionResearchSignals?: readonly InstitutionResearchGrowthPredictionInput[];
  networkExpansionSignals?: readonly NetworkClusterExpansionPredictionInput[];
  workforceShortageSignals?: readonly WorkforceShortagePredictionInput[];
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
