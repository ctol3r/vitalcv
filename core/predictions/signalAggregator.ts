import type {
  AggregatedEmergingInvestigatorSignal,
  AggregatedInstitutionResearchSignal,
  AggregatedNetworkExpansionSignal,
  AggregatedPredictionSignals,
  AggregatedTrustDeclineSignal,
  AggregatedWorkforceShortageSignal,
  EmergingInvestigatorPredictionInput,
  InstitutionResearchGrowthPredictionInput,
  NetworkClusterExpansionPredictionInput,
  PredictionEngineInput,
  PredictionEvidenceSignal,
  TrustDeclinePredictionInput,
  WorkforceShortagePredictionInput,
} from './predictionEngine';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function aggregateTrustSignal(input: TrustDeclinePredictionInput): AggregatedTrustDeclineSignal {
  const previousScore = input.previousScore ?? input.recentScore;
  const declineMagnitude = Math.max(0, previousScore - input.recentScore, Math.abs(Math.min(input.scoreDelta, 0)));
  const signalStrength = clamp01(
    (declineMagnitude / 15) * 0.55
    + Math.min(input.staleSourceCount, 4) * 0.08
    + Math.min(input.divergenceCount, 4) * 0.12
    + Math.min(input.recentDeclines, 5) * 0.05,
  );

  const evidenceSignals: PredictionEvidenceSignal[] = [
    { label: 'trust_score_delta', value: Number(input.scoreDelta.toFixed(1)), direction: input.scoreDelta < 0 ? 'DOWN' : 'FLAT', source: 'TRUST_SCORE_HISTORY' },
    { label: 'recent_declines', value: input.recentDeclines, direction: input.recentDeclines > 0 ? 'UP' : 'FLAT', source: 'TRUST_SCORE_HISTORY' },
    { label: 'stale_sources', value: input.staleSourceCount, direction: input.staleSourceCount > 0 ? 'UP' : 'FLAT', source: 'INVESTIGATOR_FINDINGS' },
    { label: 'divergence_signals', value: input.divergenceCount, direction: input.divergenceCount > 0 ? 'UP' : 'FLAT', source: 'INVESTIGATOR_FINDINGS' },
  ];

  return {
    predictionType: 'TRUST_SCORE_DECLINE',
    targetEntity: input.targetEntity,
    signalStrength,
    evidenceSignals,
    metrics: {
      declineMagnitude: Number(declineMagnitude.toFixed(1)),
      staleSourceCount: input.staleSourceCount,
      divergenceCount: input.divergenceCount,
      recentDeclines: input.recentDeclines,
    },
    lastObservedAt: input.lastObservedAt,
  };
}

function aggregateEmergingInvestigatorSignal(
  input: EmergingInvestigatorPredictionInput,
): AggregatedEmergingInvestigatorSignal {
  const publicationGrowth = Math.max(0, input.recentPublications - input.previousPublications);
  const signalStrength = clamp01(
    (publicationGrowth / 6) * 0.35
    + Math.min(input.recentTrials, 4) * 0.1
    + Math.min(input.recentGrantCount, 4) * 0.11
    + Math.min(input.citationCount / 250, 1) * 0.24
    + Math.min(input.graphDegree / 12, 1) * 0.2,
  );

  const evidenceSignals: PredictionEvidenceSignal[] = [
    { label: 'publication_growth', value: publicationGrowth, direction: publicationGrowth > 0 ? 'UP' : 'FLAT', source: 'CLAIM_RECORDS' },
    { label: 'recent_trials', value: input.recentTrials, direction: input.recentTrials > 0 ? 'UP' : 'FLAT', source: 'CLAIM_RECORDS' },
    { label: 'recent_grants', value: input.recentGrantCount, direction: input.recentGrantCount > 0 ? 'UP' : 'FLAT', source: 'CLAIM_RECORDS' },
    { label: 'citation_count', value: input.citationCount, direction: input.citationCount > 0 ? 'UP' : 'FLAT', source: 'CLAIM_RECORDS' },
    { label: 'graph_degree', value: input.graphDegree, direction: input.graphDegree > 0 ? 'UP' : 'FLAT', source: 'GRAPH_RUNTIME' },
  ];

  return {
    predictionType: 'EMERGING_INVESTIGATOR',
    targetEntity: input.targetEntity,
    signalStrength,
    evidenceSignals,
    metrics: {
      publicationGrowth,
      recentTrials: input.recentTrials,
      recentGrantCount: input.recentGrantCount,
      citationCount: input.citationCount,
      graphDegree: input.graphDegree,
    },
    lastObservedAt: input.lastObservedAt,
  };
}

function aggregateInstitutionSignal(
  input: InstitutionResearchGrowthPredictionInput,
): AggregatedInstitutionResearchSignal {
  const researchGrowth = Math.max(0, input.recentResearchCount - input.previousResearchCount);
  const signalStrength = clamp01(
    (researchGrowth / 10) * 0.45
    + Math.min(input.contributingProviders / 8, 1) * 0.25
    + Math.min(input.leadInvestigatorCount / 4, 1) * 0.15
    + Math.min(input.recentResearchCount / 12, 1) * 0.15,
  );

  const evidenceSignals: PredictionEvidenceSignal[] = [
    { label: 'research_growth', value: researchGrowth, direction: researchGrowth > 0 ? 'UP' : 'FLAT', source: 'CLAIM_RECORDS' },
    { label: 'recent_research_signals', value: input.recentResearchCount, direction: input.recentResearchCount > 0 ? 'UP' : 'FLAT', source: 'CLAIM_RECORDS' },
    { label: 'contributing_providers', value: input.contributingProviders, direction: input.contributingProviders > 0 ? 'UP' : 'FLAT', source: 'CLAIM_RECORDS' },
    { label: 'lead_investigators', value: input.leadInvestigatorCount, direction: input.leadInvestigatorCount > 0 ? 'UP' : 'FLAT', source: 'CLAIM_RECORDS' },
  ];

  return {
    predictionType: 'INSTITUTION_RESEARCH_GROWTH',
    targetEntity: input.targetEntity,
    signalStrength,
    evidenceSignals,
    metrics: {
      researchGrowth,
      contributingProviders: input.contributingProviders,
      leadInvestigatorCount: input.leadInvestigatorCount,
      recentResearchCount: input.recentResearchCount,
    },
    lastObservedAt: input.lastObservedAt,
  };
}

function aggregateNetworkSignal(
  input: NetworkClusterExpansionPredictionInput,
): AggregatedNetworkExpansionSignal {
  const expansionDelta = Math.max(0, input.recentConnections - input.previousConnections);
  const signalStrength = clamp01(
    (expansionDelta / 8) * 0.45
    + Math.min(input.peerGrowth / 6, 1) * 0.2
    + Math.min(input.anchorCount / 6, 1) * 0.15
    + clamp01(input.averageConfidence) * 0.2,
  );

  const evidenceSignals: PredictionEvidenceSignal[] = [
    { label: 'connection_growth', value: expansionDelta, direction: expansionDelta > 0 ? 'UP' : 'FLAT', source: 'GRAPH_RUNTIME' },
    { label: 'recent_connections', value: input.recentConnections, direction: input.recentConnections > 0 ? 'UP' : 'FLAT', source: 'GRAPH_RUNTIME' },
    { label: 'peer_growth', value: input.peerGrowth, direction: input.peerGrowth > 0 ? 'UP' : 'FLAT', source: 'GRAPH_RUNTIME' },
    { label: 'anchor_count', value: input.anchorCount, direction: input.anchorCount > 0 ? 'UP' : 'FLAT', source: 'GRAPH_RUNTIME' },
    { label: 'average_confidence', value: Number(input.averageConfidence.toFixed(2)), direction: 'UP', source: 'GRAPH_RUNTIME' },
  ];

  return {
    predictionType: 'NETWORK_CLUSTER_EXPANSION',
    targetEntity: input.targetEntity,
    signalStrength,
    evidenceSignals,
    metrics: {
      expansionDelta,
      peerGrowth: input.peerGrowth,
      anchorCount: input.anchorCount,
      averageConfidence: Number(input.averageConfidence.toFixed(2)),
      recentConnections: input.recentConnections,
    },
    lastObservedAt: input.lastObservedAt,
  };
}

function aggregateWorkforceSignal(
  input: WorkforceShortagePredictionInput,
): AggregatedWorkforceShortageSignal {
  const demandGrowth = Math.max(0, input.demand - input.previousDemand);
  const shortageRatio = input.supply <= 0 ? input.demand : input.demand / input.supply;
  const signalStrength = clamp01(
    Math.min(input.pressureScore / 100, 1) * 0.45
    + Math.min(demandGrowth / 6, 1) * 0.2
    + Math.min(shortageRatio / 4, 1) * 0.35,
  );

  const evidenceSignals: PredictionEvidenceSignal[] = [
    { label: 'active_demand', value: input.demand, direction: input.demand > 0 ? 'UP' : 'FLAT', source: 'OPPORTUNITIES' },
    { label: 'demand_growth', value: demandGrowth, direction: demandGrowth > 0 ? 'UP' : 'FLAT', source: 'OPPORTUNITIES' },
    { label: 'mapped_supply', value: input.supply, direction: input.supply === 0 ? 'DOWN' : 'FLAT', source: 'PERSON_PROFILES' },
    { label: 'shortage_ratio', value: Number(shortageRatio.toFixed(2)), direction: shortageRatio > 1 ? 'UP' : 'FLAT', source: 'OPPORTUNITIES' },
    { label: 'pressure_score', value: Number(input.pressureScore.toFixed(1)), direction: input.pressureScore > 0 ? 'UP' : 'FLAT', source: 'OPPORTUNITIES' },
  ];

  return {
    predictionType: 'WORKFORCE_SHORTAGE_ESCALATION',
    targetEntity: input.targetEntity,
    signalStrength,
    evidenceSignals,
    metrics: {
      demandGrowth,
      demand: input.demand,
      supply: input.supply,
      pressureScore: Number(input.pressureScore.toFixed(1)),
      shortageRatio: Number(shortageRatio.toFixed(2)),
      specialty: input.specialty,
      state: input.state,
    },
    lastObservedAt: input.lastObservedAt,
  };
}

export function aggregatePredictionSignals(
  input: PredictionEngineInput,
  _now: string,
): AggregatedPredictionSignals {
  return {
    trustSignals: (input.trustSignals ?? []).map(aggregateTrustSignal),
    emergingInvestigatorSignals: (input.emergingInvestigatorSignals ?? []).map(aggregateEmergingInvestigatorSignal),
    institutionSignals: (input.institutionResearchSignals ?? []).map(aggregateInstitutionSignal),
    networkSignals: (input.networkExpansionSignals ?? []).map(aggregateNetworkSignal),
    workforceSignals: (input.workforceShortageSignals ?? []).map(aggregateWorkforceSignal),
  };
}
