import { buildActionId } from './actionHistory';
import type { RankedActionCandidate, RecommendedAction } from './actionEngine';

function cleanSentence(value: string): string {
  return value.trim().replace(/[.]+$/, '');
}

function joinReasons(reasons: string[]): string {
  const cleaned = reasons.map(cleanSentence).filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
  if (cleaned.length === 0) {
    return 'the latest storyline and prediction signals require follow-up';
  }
  if (cleaned.length === 1) {
    return cleaned[0]!;
  }
  if (cleaned.length === 2) {
    return `${cleaned[0]} and ${cleaned[1]}`;
  }
  return `${cleaned[0]}, ${cleaned[1]}, and ${cleaned[2]}`;
}

export function explainActionCandidates(
  candidates: RankedActionCandidate[],
  now: string,
): RecommendedAction[] {
  return candidates.map((candidate) => ({
    actionId: buildActionId({
      actionType: candidate.actionType,
      targetEntity: candidate.targetEntity,
      storylineKey: candidate.storylineKey ?? null,
      predictionIds: candidate.predictionIds,
    }),
    actionType: candidate.actionType,
    targetEntity: candidate.targetEntity,
    recommendedAction: candidate.recommendedAction,
    priority: candidate.priority,
    priorityScore: candidate.priorityScore,
    confidence: candidate.confidence,
    explanation: `${cleanSentence(candidate.recommendedAction)} because ${joinReasons(candidate.reasonFragments)}.`,
    createdAt: now,
    status: 'pending',
    storylineKey: candidate.storylineKey ?? null,
    sourceFindingIds: [...candidate.sourceFindingIds],
    predictionIds: [...candidate.predictionIds],
    evidence: candidate.evidence,
    metadata: candidate.metadata,
  }));
}
