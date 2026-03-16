import { createHash } from 'node:crypto';
import type {
  PredictionCandidate,
  PredictionInsight,
  PredictionState,
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
    state: candidate.state,
    timeHorizon: candidate.timeHorizon,
  }).slice(0, 24)}`;
}

function typeLabel(predictionType: PredictionType): string {
  switch (predictionType) {
    case 'PROVIDER_TRAJECTORY':
      return 'Provider trajectory';
    case 'SPECIALTY_PRESSURE':
      return 'Specialty demand pressure';
    case 'INSTITUTION_MOMENTUM':
      return 'Institution momentum';
    case 'NETWORK_SHIFT':
      return 'Network shift';
    case 'TRUST_RISK_ACCELERATION':
      return 'Trust risk acceleration';
  }
}

function stateLabel(state: PredictionState): string {
  return state === 'insufficient_signal'
    ? 'insufficient signal'
    : state.charAt(0).toUpperCase() + state.slice(1);
}

function subjectLabel(candidate: PredictionCandidate): string {
  return candidate.targetEntity.entityLabel ?? candidate.targetEntity.entityId;
}

function buildSummary(candidate: PredictionCandidate): string {
  const why = candidate.explanationFragments.slice(0, 2).join(' and ');
  if (candidate.state === 'insufficient_signal') {
    return `${typeLabel(candidate.predictionType)} is Insufficient signal because only ${Math.round(candidate.coverage * 100)}% of expected signals are present.`;
  }

  return `${typeLabel(candidate.predictionType)} is ${stateLabel(candidate.state)} because ${why || 'the current signal mix supports that forecast'}.`;
}

function buildExplanation(candidate: PredictionCandidate): string {
  const summary = buildSummary(candidate);
  const confidenceLabel = `${Math.round(candidate.baseConfidence * 100)}% confidence`;
  const forecastWindow = `Forecast window: ${candidate.timeHorizon}.`;
  const forecastNotice = 'This is a forecast, not an observed outcome.';
  return `${summary} ${confidenceLabel}. ${forecastWindow} ${forecastNotice}`;
}

export function forecastPredictions(
  candidates: PredictionCandidate[],
  _now: string,
): PredictionInsight[] {
  return candidates
    .map((candidate) => {
      const evidenceBonus = Math.min(candidate.evidenceSignals.length * 0.02, 0.08);
      const score = clamp01(candidate.baseScore + evidenceBonus);
      const confidence = clamp01(candidate.baseConfidence + Math.min(candidate.coverage * 0.08, 0.08));
      const summary = buildSummary(candidate);
      const insufficientSignal = candidate.state === 'insufficient_signal' || candidate.coverage < 0.34;

      return {
        predictionId: buildPredictionId(candidate),
        predictionType: candidate.predictionType,
        targetEntity: candidate.targetEntity,
        state: candidate.state,
        score,
        probability: score,
        confidence,
        timeHorizon: candidate.timeHorizon,
        evidenceSignals: candidate.evidenceSignals,
        explanation: buildExplanation(candidate),
        createdAt: candidate.createdAt,
        metadata: {
          ...candidate.metadata,
          state: candidate.state,
          summary,
          forecast: true,
          insufficientSignal,
          lastObservedAt: candidate.lastObservedAt,
          coverage: candidate.coverage,
        },
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }

      return left.predictionId.localeCompare(right.predictionId);
    });
}
