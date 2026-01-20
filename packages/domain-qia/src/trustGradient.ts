/**
 * Trust gradient: confidence + freshness + dispute history + corroboration density.
 */

import type { TrustGradient, TrustGradientInput } from './types';
import { TrustGradientError } from './types';

function assertNormalized(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new TrustGradientError(`${label} must be between 0 and 1`);
  }
  return value;
}

function assertNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new TrustGradientError(`${label} must be a non-negative number`);
  }
  return value;
}

function assertNonNegativeInteger(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new TrustGradientError(`${label} must be a non-negative integer`);
  }
  return value;
}

function computeFreshnessScore(ageSeconds: number, maxAgeSeconds: number): number {
  if (maxAgeSeconds === 0) {
    return ageSeconds === 0 ? 1 : 0;
  }
  const ratio = ageSeconds / maxAgeSeconds;
  const capped = ratio > 1 ? 1 : ratio;
  return 1 - capped;
}

function computeBand(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score < 0.4) {
    return 'LOW';
  }
  if (score < 0.7) {
    return 'MEDIUM';
  }
  return 'HIGH';
}

export function computeTrustGradient(input: TrustGradientInput): TrustGradient {
  if (!input) {
    throw new TrustGradientError('input is required');
  }

  const confidence = assertNormalized(input.confidence, 'confidence');
  const corroboration = assertNormalized(input.corroboration_density, 'corroboration_density');
  const freshnessAge = assertNonNegative(input.freshness_age_seconds, 'freshness_age_seconds');
  const freshnessMax = assertNonNegative(input.freshness_max_age_seconds, 'freshness_max_age_seconds');
  const disputeCount = assertNonNegativeInteger(input.dispute_count, 'dispute_count');

  const freshness = computeFreshnessScore(freshnessAge, freshnessMax);
  const disputeHistory = 1 / (1 + disputeCount);

  const score = (confidence + freshness + disputeHistory + corroboration) / 4;
  const band = computeBand(score);

  return {
    score,
    band,
    components: {
      confidence,
      freshness,
      dispute_history: disputeHistory,
      corroboration_density: corroboration,
    },
  };
}
