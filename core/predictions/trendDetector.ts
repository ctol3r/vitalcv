import type {
  AggregatedPredictionSignals,
  PredictionCandidate,
} from './predictionEngine';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

export function detectPredictionCandidates(
  signals: AggregatedPredictionSignals,
  now: string,
): PredictionCandidate[] {
  const candidates: PredictionCandidate[] = [];

  for (const signal of signals.trustSignals) {
    if (
      signal.signalStrength < 0.45
      || (
        signal.metrics.declineMagnitude < 4
        && signal.metrics.staleSourceCount === 0
        && signal.metrics.divergenceCount === 0
      )
    ) {
      continue;
    }

    candidates.push({
      predictionType: 'TRUST_SCORE_DECLINE',
      targetEntity: signal.targetEntity,
      signalStrength: signal.signalStrength,
      baseProbability: clamp01(0.45 + (signal.signalStrength * 0.45)),
      baseConfidence: clamp01(0.5 + (signal.signalStrength * 0.35)),
      timeHorizon: signal.metrics.declineMagnitude >= 10 ? '14d' : '30d',
      evidenceSignals: signal.evidenceSignals,
      explanationFragments: [
        `trust score already fell ${signal.metrics.declineMagnitude.toFixed(1)} points`,
        signal.metrics.staleSourceCount > 0 ? `${signal.metrics.staleSourceCount} stale source signal(s) remain unresolved` : '',
        signal.metrics.divergenceCount > 0 ? `${signal.metrics.divergenceCount} divergence signal(s) are still active` : '',
      ].filter((value) => value.length > 0),
      metadata: {
        declineMagnitude: signal.metrics.declineMagnitude,
        recentDeclines: signal.metrics.recentDeclines,
      },
      createdAt: now,
    });
  }

  for (const signal of signals.emergingInvestigatorSignals) {
    if (
      signal.signalStrength < 0.5
      || (
        signal.metrics.publicationGrowth < 2
        && signal.metrics.recentTrials === 0
        && signal.metrics.recentGrantCount === 0
      )
    ) {
      continue;
    }

    candidates.push({
      predictionType: 'EMERGING_INVESTIGATOR',
      targetEntity: signal.targetEntity,
      signalStrength: signal.signalStrength,
      baseProbability: clamp01(0.42 + (signal.signalStrength * 0.44)),
      baseConfidence: clamp01(0.48 + (signal.signalStrength * 0.34)),
      timeHorizon: '90d',
      evidenceSignals: signal.evidenceSignals,
      explanationFragments: [
        `${signal.metrics.publicationGrowth} new research-publication signal(s) appeared versus the prior window`,
        signal.metrics.recentTrials > 0 ? `${signal.metrics.recentTrials} active trial-role signal(s) are present` : '',
        signal.metrics.citationCount >= 100 ? `citation volume is already elevated` : '',
      ].filter((value) => value.length > 0),
      metadata: {
        publicationGrowth: signal.metrics.publicationGrowth,
        citationCount: signal.metrics.citationCount,
        graphDegree: signal.metrics.graphDegree,
      },
      createdAt: now,
    });
  }

  for (const signal of signals.institutionSignals) {
    if (
      signal.signalStrength < 0.45
      || signal.metrics.recentResearchCount < 3
      || signal.metrics.researchGrowth < 2
    ) {
      continue;
    }

    candidates.push({
      predictionType: 'INSTITUTION_RESEARCH_GROWTH',
      targetEntity: signal.targetEntity,
      signalStrength: signal.signalStrength,
      baseProbability: clamp01(0.4 + (signal.signalStrength * 0.45)),
      baseConfidence: clamp01(0.46 + (signal.signalStrength * 0.34)),
      timeHorizon: '180d',
      evidenceSignals: signal.evidenceSignals,
      explanationFragments: [
        `${signal.metrics.researchGrowth} additional institution-linked research signal(s) landed this period`,
        `${signal.metrics.contributingProviders} contributing provider(s) are participating`,
        signal.metrics.leadInvestigatorCount > 0 ? `${signal.metrics.leadInvestigatorCount} likely lead investigator(s) are attached` : '',
      ].filter((value) => value.length > 0),
      metadata: {
        recentResearchCount: signal.metrics.recentResearchCount,
        researchGrowth: signal.metrics.researchGrowth,
      },
      createdAt: now,
    });
  }

  for (const signal of signals.networkSignals) {
    if (
      signal.signalStrength < 0.4
      || signal.metrics.recentConnections < 3
      || signal.metrics.expansionDelta < 2
    ) {
      continue;
    }

    candidates.push({
      predictionType: 'NETWORK_CLUSTER_EXPANSION',
      targetEntity: signal.targetEntity,
      signalStrength: signal.signalStrength,
      baseProbability: clamp01(0.38 + (signal.signalStrength * 0.47)),
      baseConfidence: clamp01(0.45 + (signal.signalStrength * 0.33)),
      timeHorizon: '60d',
      evidenceSignals: signal.evidenceSignals,
      explanationFragments: [
        `${signal.metrics.expansionDelta} new connection(s) were added versus the prior window`,
        `${signal.metrics.peerGrowth} new peer node(s) entered the neighborhood`,
        `${signal.metrics.anchorCount} shared collaboration anchor(s) are active`,
      ],
      metadata: {
        recentConnections: signal.metrics.recentConnections,
        averageConfidence: signal.metrics.averageConfidence,
      },
      createdAt: now,
    });
  }

  for (const signal of signals.workforceSignals) {
    if (
      signal.signalStrength < 0.5
      || signal.metrics.demand <= signal.metrics.supply
      || signal.metrics.pressureScore < 40
    ) {
      continue;
    }

    candidates.push({
      predictionType: 'WORKFORCE_SHORTAGE_ESCALATION',
      targetEntity: signal.targetEntity,
      signalStrength: signal.signalStrength,
      baseProbability: clamp01(0.45 + (signal.signalStrength * 0.42)),
      baseConfidence: clamp01(0.5 + (signal.signalStrength * 0.3)),
      timeHorizon: '90d',
      evidenceSignals: signal.evidenceSignals,
      explanationFragments: [
        `${signal.metrics.state} ${signal.metrics.specialty} demand exceeds mapped supply`,
        `shortage ratio is ${signal.metrics.shortageRatio.toFixed(2)}`,
        signal.metrics.demandGrowth > 0 ? `demand increased by ${signal.metrics.demandGrowth}` : '',
      ].filter((value) => value.length > 0),
      metadata: {
        demand: signal.metrics.demand,
        supply: signal.metrics.supply,
        pressureScore: signal.metrics.pressureScore,
      },
      createdAt: now,
    });
  }

  return candidates;
}
