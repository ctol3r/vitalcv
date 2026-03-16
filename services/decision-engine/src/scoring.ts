import type {
  DecisionActionType,
  DecisionGraphContext,
  DecisionInputSignal,
  DecisionPriority,
  DecisionScoreBreakdown,
  DecisionSeverity,
} from './types';

export interface DecisionBundleSummary {
  targetKey: string;
  severity: number;
  novelty: number;
  predictionDirection: number;
  centrality: number;
  confidence: number;
  corroboration: number;
  recency: number;
  historicalTruthRate: number;
  heuristicOnly: boolean;
  hasCriticalObservedSignal: boolean;
  hasHighConfidenceSignal: boolean;
  hasLowConfidencePrediction: boolean;
  hasDevelopingStoryline: boolean;
  hasRisingTrajectory: boolean;
  hasSpecialtyPressure: boolean;
  hasNetworkShift: boolean;
  lowCorroboration: boolean;
  sourceSparse: boolean;
  findingSignals: DecisionInputSignal[];
  storylineSignals: DecisionInputSignal[];
  predictionSignals: DecisionInputSignal[];
  graphSignals: DecisionGraphContext[];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function severityWeight(severity?: DecisionSeverity): number {
  switch (severity) {
    case 'critical':
      return 1;
    case 'high':
      return 0.8;
    case 'medium':
      return 0.56;
    case 'low':
      return 0.32;
    case 'info':
      return 0.12;
    default:
      return 0;
  }
}

export function recencyWeight(observedAt: string, nowIso: string): number {
  const ageMs = Math.max(0, new Date(nowIso).getTime() - new Date(observedAt).getTime());
  const ageHours = ageMs / 3_600_000;
  if (ageHours <= 24) {
    return 1;
  }
  if (ageHours <= 72) {
    return 0.84;
  }
  if (ageHours <= 168) {
    return 0.68;
  }
  if (ageHours <= 720) {
    return 0.44;
  }
  return 0.22;
}

function predictionDirectionWeight(signals: DecisionInputSignal[]): number {
  if (signals.length === 0) {
    return 0;
  }

  const maxSignal = Math.max(
    ...signals.map((signal) => {
      if (signal.direction === 'DOWN') {
        return 1;
      }
      if (signal.direction === 'UP') {
        return 0.82;
      }
      if (signal.direction === 'SHIFT') {
        return 0.62;
      }
      return 0.18;
    }),
  );

  return clamp01(maxSignal);
}

function maxHistoricalTruthRate(signals: DecisionInputSignal[]): number {
  const truthRates = signals
    .map((signal) => signal.historicalTruthRate)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (truthRates.length === 0) {
    return 0.5;
  }
  return clamp01(Math.max(...truthRates));
}

function maxCentrality(graphSignals: DecisionGraphContext[]): number {
  if (graphSignals.length === 0) {
    return 0.2;
  }

  return clamp01(Math.max(...graphSignals.map((signal) => signal.centrality)));
}

function maxCorroboration(signals: DecisionInputSignal[], graphSignals: DecisionGraphContext[]): number {
  const signalMax = signals
    .map((signal) => signal.corroboration ?? 0)
    .reduce((max, value) => Math.max(max, value), 0);
  const graphMax = graphSignals
    .map((signal) => signal.corroboration ?? 0)
    .reduce((max, value) => Math.max(max, value), 0);
  const maxValue = Math.max(signalMax, graphMax);

  return clamp01(maxValue / 4);
}

function averageConfidence(signals: DecisionInputSignal[]): number {
  if (signals.length === 0) {
    return 0;
  }

  const total = signals.reduce((sum, signal) => sum + clamp01(signal.confidence), 0);
  return clamp01(total / signals.length);
}

function maxNovelty(signals: DecisionInputSignal[]): number {
  if (signals.length === 0) {
    return 0;
  }

  return clamp01(Math.max(...signals.map((signal) => signal.novelty ?? 0)));
}

export function summarizeDecisionBundle(input: {
  targetKey: string;
  signals: DecisionInputSignal[];
  graphSignals: DecisionGraphContext[];
  nowIso: string;
}): DecisionBundleSummary {
  const findingSignals = input.signals.filter((signal) => signal.kind === 'finding');
  const storylineSignals = input.signals.filter((signal) => signal.kind === 'storyline');
  const predictionSignals = input.signals.filter((signal) => signal.kind === 'prediction');
  const severity = Math.max(...input.signals.map((signal) => severityWeight(signal.severity)), 0);
  const confidence = averageConfidence(input.signals);
  const novelty = maxNovelty(input.signals);
  const corroboration = maxCorroboration(input.signals, input.graphSignals);
  const centrality = maxCentrality(input.graphSignals);
  const recency = Math.max(...input.signals.map((signal) => recencyWeight(signal.observedAt, input.nowIso)), 0.15);
  const historicalTruthRate = maxHistoricalTruthRate(input.signals);

  const hasCriticalObservedSignal = findingSignals.some((signal) => signal.severity === 'critical');
  const hasHighConfidenceSignal = input.signals.some((signal) => signal.confidence >= 0.8);
  const hasLowConfidencePrediction = predictionSignals.some((signal) => signal.confidence < 0.45);
  const hasDevelopingStoryline = storylineSignals.some((signal) => {
    const stage = String(signal.metadata?.stage ?? '').toLowerCase();
    return stage === 'developing' || stage === 'mature';
  });
  const hasRisingTrajectory = predictionSignals.some((signal) =>
    signal.signalType === 'EMERGING_INVESTIGATOR'
    || signal.signalType === 'PROVIDER_TRAJECTORY'
    || signal.signalType === 'INSTITUTION_RESEARCH_GROWTH'
    || signal.signalType === 'INSTITUTION_MOMENTUM',
  );
  const hasSpecialtyPressure = input.signals.some((signal) =>
    signal.signalType === 'WORKFORCE_SHORTAGE_ESCALATION'
    || signal.signalType === 'SPECIALTY_PRESSURE'
    || signal.signalType === 'workforce_pressure',
  );
  const hasNetworkShift = input.signals.some((signal) =>
    signal.signalType === 'NETWORK_CLUSTER_EXPANSION'
    || signal.signalType === 'NETWORK_SHIFT'
    || signal.signalType === 'network_emergence',
  ) || input.graphSignals.some((signal) => (signal.recentConnectionDelta ?? 0) > 0);

  return {
    targetKey: input.targetKey,
    severity,
    novelty,
    predictionDirection: predictionDirectionWeight(predictionSignals),
    centrality,
    confidence,
    corroboration,
    recency,
    historicalTruthRate,
    heuristicOnly: findingSignals.length === 0 && storylineSignals.length === 0 && predictionSignals.length > 0,
    hasCriticalObservedSignal,
    hasHighConfidenceSignal,
    hasLowConfidencePrediction,
    hasDevelopingStoryline,
    hasRisingTrajectory,
    hasSpecialtyPressure,
    hasNetworkShift,
    lowCorroboration: corroboration < 0.5,
    sourceSparse: input.signals.reduce((max, signal) => Math.max(max, signal.sources?.length ?? 0), 0) < 2,
    findingSignals,
    storylineSignals,
    predictionSignals,
    graphSignals: input.graphSignals,
  };
}

const SCORE_WEIGHTS = {
  severity: 26,
  novelty: 10,
  predictionDirection: 10,
  centrality: 14,
  confidence: 14,
  corroboration: 12,
  recency: 8,
  historicalTruthRate: 6,
} as const;

export function actionAdjustment(actionType: DecisionActionType, summary: DecisionBundleSummary): number {
  switch (actionType) {
    case 'REVIEW_NOW':
      return summary.hasCriticalObservedSignal ? 10 : 6;
    case 'ESCALATE':
      return summary.hasDevelopingStoryline ? 8 : 4;
    case 'PRIORITIZE_OUTREACH':
      return summary.hasRisingTrajectory && summary.hasSpecialtyPressure ? 7 : 3;
    case 'VERIFY_SOURCE':
      return summary.sourceSparse ? 5 : 2;
    case 'COMPARE_WITH_PEERS':
      return summary.centrality >= 0.45 ? 4 : 1;
    case 'REQUEST_MORE_EVIDENCE':
      return -10;
    case 'DEFER_ACTION':
      return -14;
    case 'SAVE_TO_WATCHLIST':
      return -12;
    case 'MONITOR':
    default:
      return -6;
  }
}

export function computePriorityScore(
  summary: DecisionBundleSummary,
  actionType: DecisionActionType,
): DecisionScoreBreakdown {
  const breakdown = {
    severity: round(summary.severity * SCORE_WEIGHTS.severity),
    novelty: round(summary.novelty * SCORE_WEIGHTS.novelty),
    predictionDirection: round(summary.predictionDirection * SCORE_WEIGHTS.predictionDirection),
    centrality: round(summary.centrality * SCORE_WEIGHTS.centrality),
    confidence: round(summary.confidence * SCORE_WEIGHTS.confidence),
    corroboration: round(summary.corroboration * SCORE_WEIGHTS.corroboration),
    recency: round(summary.recency * SCORE_WEIGHTS.recency),
    historicalTruthRate: round(summary.historicalTruthRate * SCORE_WEIGHTS.historicalTruthRate),
    ruleAdjustment: actionAdjustment(actionType, summary),
    total: 0,
  };

  const total = breakdown.severity
    + breakdown.novelty
    + breakdown.predictionDirection
    + breakdown.centrality
    + breakdown.confidence
    + breakdown.corroboration
    + breakdown.recency
    + breakdown.historicalTruthRate
    + breakdown.ruleAdjustment;

  return {
    ...breakdown,
    total: Math.max(0, Math.min(100, Math.round(total))),
  };
}

export function scoreToPriority(score: number): DecisionPriority {
  if (score >= 85) {
    return 'critical';
  }
  if (score >= 70) {
    return 'high';
  }
  if (score >= 45) {
    return 'medium';
  }
  return 'low';
}
