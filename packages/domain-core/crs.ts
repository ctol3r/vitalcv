import { CanonicalPrimitiveError } from './errors';

export const START_READY_CRS_THRESHOLD = 80;

export type CrsBand = 'GREEN' | 'YELLOW' | 'RED';

export function getCrsBand(score: number): CrsBand {
  if (score >= START_READY_CRS_THRESHOLD) return 'GREEN';
  if (score >= 50) return 'YELLOW';
  return 'RED';
}

export function assertStartReadyCrs(score: unknown): asserts score is number {
  if (typeof score !== 'number' || Number.isNaN(score) || !Number.isFinite(score)) {
    throw new CanonicalPrimitiveError('CRS score must be a finite number', 'INVALID_FIELD', {
      score,
    });
  }

  if (score < START_READY_CRS_THRESHOLD) {
    throw new CanonicalPrimitiveError('Start is blocked when CRS is below 80', 'CRS_BELOW_THRESHOLD', {
      score,
      threshold: START_READY_CRS_THRESHOLD,
      band: getCrsBand(score),
    });
  }
}
