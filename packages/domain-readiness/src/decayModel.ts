/**
 * Deterministic exponential decay model for CRS freshness.
 */

import { ReadinessInvariantError } from './types';

function assertFiniteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new ReadinessInvariantError(`${label} must be a finite number`);
  }
  return value;
}

export function decayScore(baseScore: number, elapsedMs: number, halfLifeMs: number): number {
  assertFiniteNumber(baseScore, 'baseScore');
  assertFiniteNumber(elapsedMs, 'elapsedMs');
  assertFiniteNumber(halfLifeMs, 'halfLifeMs');

  if (baseScore < 0 || baseScore > 100) {
    throw new ReadinessInvariantError('baseScore must be between 0 and 100');
  }
  if (elapsedMs < 0) {
    throw new ReadinessInvariantError('elapsedMs must be a non-negative number');
  }
  if (halfLifeMs <= 0) {
    throw new ReadinessInvariantError('halfLifeMs must be greater than 0');
  }

  if (baseScore === 0 || elapsedMs === 0) {
    return baseScore;
  }

  const decayFactor = Math.pow(0.5, elapsedMs / halfLifeMs);
  return baseScore * decayFactor;
}
