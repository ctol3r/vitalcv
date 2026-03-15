import type { ActionPriority, ActionCandidate, RankedActionCandidate } from './actionEngine';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function mapPriority(priorityScore: number): ActionPriority {
  if (priorityScore >= 0.82) {
    return 'CRITICAL';
  }
  if (priorityScore >= 0.64) {
    return 'HIGH';
  }
  if (priorityScore >= 0.42) {
    return 'MEDIUM';
  }
  return 'LOW';
}

export function rankActionCandidates(
  candidates: ActionCandidate[],
  _now: string,
): RankedActionCandidate[] {
  return candidates
    .map((candidate) => {
      const priorityScore = clamp01(
        candidate.riskWeight * 0.34
        + candidate.urgencyWeight * 0.28
        + candidate.baseConfidence * 0.18
        + candidate.entityImportance * 0.12
        + candidate.opportunityWeight * 0.05
        + candidate.recencyWeight * 0.03,
      );
      const confidence = clamp01(
        (candidate.baseConfidence * 0.7)
        + (candidate.riskWeight * 0.12)
        + (candidate.urgencyWeight * 0.1)
        + (candidate.recencyWeight * 0.08),
      );

      return {
        ...candidate,
        priority: mapPriority(priorityScore),
        priorityScore,
        confidence,
      };
    })
    .sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }

      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }

      return left.recommendedAction.localeCompare(right.recommendedAction);
    });
}
