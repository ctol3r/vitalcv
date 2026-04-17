// ── VitalCV Freshness Engine ───────────────────────────────────────
// Evaluates the safety of cached truth based on time elapsed since
// verification, enforcing degradation before data becomes dangerously stale.

export enum FreshnessState {
  /** Safe to use for automated decisions */
  FRESH = 'fresh',
  /** Approaching TTL, should trigger async refresh but still safe */
  AGING = 'aging',
  /** Exceeded TTL, degrades decision confidence (no auto-approve) */
  STALE = 'stale',
  /** Critically old, cannot be used for any decision-grade posture */
  EXPIRED = 'expired',
}

export interface FreshnessContext {
  verifiedAt: string;
  ttlMs: number;
}

export interface FreshnessEvaluation {
  state: FreshnessState;
  ageMs: number;
  timeRemainingMs: number;
}

/**
 * Calculates the exact freshness state of a cached claim/source.
 */
export function evaluateFreshness(context: FreshnessContext): FreshnessEvaluation {
  const ageMs = Date.now() - new Date(context.verifiedAt).getTime();
  const timeRemainingMs = context.ttlMs - ageMs;

  let state = FreshnessState.FRESH;

  if (ageMs >= context.ttlMs * 1.5) {
    // 50% past the TTL
    state = FreshnessState.EXPIRED;
  } else if (ageMs >= context.ttlMs) {
    // Past the TTL
    state = FreshnessState.STALE;
  } else if (ageMs >= context.ttlMs * 0.8) {
    // 80% into the TTL (approaching stale)
    state = FreshnessState.AGING;
  }

  return { state, ageMs, timeRemainingMs };
}
