import { createHash } from 'node:crypto';
import type {
  PredictionCandidate,
  PredictionInsight,
  PredictionType,
} from './predictionEngine';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
}

function hashPredictionSeed(seed: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(seed)).digest('hex');
}

function buildPredictionId(candidate: PredictionCandidate): string {
  return `pred_${hashPredictionSeed({
    predictionType: candidate.predictionType,
    targetEntity: candidate.targetEntity,
    timeHorizon: candidate.timeHorizon,
  }).slice(0, 24)}`;
}

function subjectLabel(candidate: PredictionCandidate): string {
  return candidate.targetEntity.entityLabel ?? candidate.targetEntity.entityId;
}

function verbForPrediction(predictionType: PredictionType): string {
  switch (predictionType) {
    case 'TRUST_SCORE_DECLINE':
      return 'is likely to deteriorate further';
    case 'EMERGING_INVESTIGATOR':
      return 'is likely to emerge as a higher-visibility investigator';
    case 'INSTITUTION_RESEARCH_GROWTH':
      return 'is likely to keep accelerating research output';
    case 'NETWORK_CLUSTER_EXPANSION':
      return 'is likely to keep expanding its collaboration cluster';
    case 'WORKFORCE_SHORTAGE_ESCALATION':
      return 'is likely to face a deeper workforce shortage';
  }
}

function buildExplanation(candidate: PredictionCandidate): string {
  const parts = candidate.explanationFragments.slice(0, 3);
  const suffix = parts.length > 0 ? ` because ${parts.join(', ')}` : '';
  return `${subjectLabel(candidate)} ${verbForPrediction(candidate.predictionType)} within ${candidate.timeHorizon}${suffix}.`;
}

export function forecastPredictions(
  candidates: PredictionCandidate[],
  _now: string,
): PredictionInsight[] {
  return candidates
    .map((candidate) => {
      const evidenceBonus = Math.min(candidate.evidenceSignals.length * 0.025, 0.1);
      const probability = clamp01(candidate.baseProbability + (candidate.signalStrength * 0.1) + evidenceBonus);
      const confidence = clamp01(candidate.baseConfidence + (candidate.signalStrength * 0.08));

      return {
        predictionId: buildPredictionId(candidate),
        predictionType: candidate.predictionType,
        targetEntity: candidate.targetEntity,
        probability,
        confidence,
        timeHorizon: candidate.timeHorizon,
        evidenceSignals: candidate.evidenceSignals,
        explanation: buildExplanation(candidate),
        createdAt: candidate.createdAt,
        metadata: candidate.metadata,
      };
    })
    .sort((left, right) => {
      if (right.probability !== left.probability) {
        return right.probability - left.probability;
      }

      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }

      return left.predictionId.localeCompare(right.predictionId);
    });
}
