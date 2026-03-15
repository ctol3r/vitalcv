import type {
  FindingRankBreakdown,
  FindingScoreSignals,
  InvestigatorFindingDraft,
  InvestigatorFindingRecord,
  InvestigatorSeverity,
} from './investigatorTypes';

type RankingInput = Pick<InvestigatorFindingDraft, 'severity' | 'confidence' | 'scoreSignals'>
  & Partial<Pick<InvestigatorFindingRecord, 'occurrenceCount'>>;

const SEVERITY_SCORES: Record<InvestigatorSeverity, number> = {
  low: 0.25,
  medium: 0.5,
  high: 0.8,
  critical: 1,
};

const RANKING_WEIGHTS: Record<keyof FindingScoreSignals | 'severity', number> = {
  severity: 0.24,
  confidence: 0.18,
  trustImpact: 0.18,
  freshness: 0.12,
  novelty: 0.1,
  entityImportance: 0.1,
  graphCentrality: 0.08,
};

function clamp01(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function computeNovelty(
  requestedNovelty: number | undefined,
  occurrenceCount: number | undefined,
): number {
  if (typeof requestedNovelty === 'number') {
    return clamp01(requestedNovelty, 1);
  }

  const existingOccurrences = Math.max(0, (occurrenceCount ?? 1) - 1);
  return clamp01(1 - (existingOccurrences * 0.15), 0.25);
}

export function buildFindingScoreSignals(input: RankingInput): FindingScoreSignals {
  return {
    confidence: clamp01(input.confidence, 0.5),
    trustImpact: clamp01(input.scoreSignals?.trustImpact, 0.35),
    freshness: clamp01(input.scoreSignals?.freshness, 0.6),
    novelty: computeNovelty(input.scoreSignals?.novelty, input.occurrenceCount),
    entityImportance: clamp01(input.scoreSignals?.entityImportance, 0.5),
    graphCentrality: clamp01(input.scoreSignals?.graphCentrality, 0.45),
  };
}

export function rankFinding(input: RankingInput): {
  priorityScore: number;
  scoreSignals: FindingScoreSignals;
  rankBreakdown: FindingRankBreakdown;
} {
  const scoreSignals = buildFindingScoreSignals(input);
  const severity = SEVERITY_SCORES[input.severity];

  const breakdown: FindingRankBreakdown = {
    severity: Math.round(severity * RANKING_WEIGHTS.severity * 10_000) / 10_000,
    confidence: Math.round(scoreSignals.confidence * RANKING_WEIGHTS.confidence * 10_000) / 10_000,
    trustImpact: Math.round(scoreSignals.trustImpact * RANKING_WEIGHTS.trustImpact * 10_000) / 10_000,
    freshness: Math.round(scoreSignals.freshness * RANKING_WEIGHTS.freshness * 10_000) / 10_000,
    novelty: Math.round(scoreSignals.novelty * RANKING_WEIGHTS.novelty * 10_000) / 10_000,
    entityImportance: Math.round(scoreSignals.entityImportance * RANKING_WEIGHTS.entityImportance * 10_000) / 10_000,
    graphCentrality: Math.round(scoreSignals.graphCentrality * RANKING_WEIGHTS.graphCentrality * 10_000) / 10_000,
    total: 0,
    weights: RANKING_WEIGHTS,
  };

  breakdown.total = Math.round(
    (
      breakdown.severity
      + breakdown.confidence
      + breakdown.trustImpact
      + breakdown.freshness
      + breakdown.novelty
      + breakdown.entityImportance
      + breakdown.graphCentrality
    ) * 10_000,
  ) / 10_000;

  return {
    priorityScore: Math.round(breakdown.total * 100 * 100) / 100,
    scoreSignals,
    rankBreakdown: breakdown,
  };
}
