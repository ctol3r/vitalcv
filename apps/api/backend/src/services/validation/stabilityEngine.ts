// ── VitalCV Trust Stability Engine ─────────────────────────────────
// Tracks and exposes truth stability over time for a given NPI.
// Evaluates consistency scores, drift frequency, and anomaly counts.

export interface TrustStabilityProfile {
  npi: string;
  timeWindowDays: number;
  /** Percentage (0.0 to 1.0) of validation runs where no anomalies or drift occurred */
  consistencyScore: number;
  /** Total number of drift events detected in the time window */
  driftFrequency: number;
  /** Total number of anomalies (e.g. dropped confidence, upstream API failures) */
  anomalyCount: number;
  /** Overall categorical stability label */
  stabilityLabel: 'HIGHLY_STABLE' | 'MODERATE_DRIFT' | 'VOLATILE';
  evaluatedAt: string;
}

export interface StabilityInputContext {
  validationRunsCount: number;
  driftEventsCount: number;
  anomalyEventsCount: number;
}

/**
 * Computes the Trust Stability profile for an NPI over a given time window.
 */
export function computeTrustStability(
  npi: string,
  timeWindowDays: number,
  context: StabilityInputContext
): TrustStabilityProfile {
  
  // If we have no validation history, default to perfect consistency but flag as volatile if we have raw drift events
  let consistencyScore = 1.0;
  if (context.validationRunsCount > 0) {
    // A run is "inconsistent" if it generated an anomaly or a drift event
    // Simplification: treating each event as roughly 1 failed validation run
    const inconsistentRuns = Math.min(
      context.validationRunsCount, 
      context.driftEventsCount + context.anomalyEventsCount
    );
    consistencyScore = (context.validationRunsCount - inconsistentRuns) / context.validationRunsCount;
  }

  let stabilityLabel: 'HIGHLY_STABLE' | 'MODERATE_DRIFT' | 'VOLATILE' = 'HIGHLY_STABLE';
  if (consistencyScore < 0.8 || context.driftEventsCount >= 3) {
    stabilityLabel = 'VOLATILE';
  } else if (consistencyScore < 0.98 || context.driftEventsCount > 0) {
    stabilityLabel = 'MODERATE_DRIFT';
  }

  return {
    npi,
    timeWindowDays,
    consistencyScore,
    driftFrequency: context.driftEventsCount,
    anomalyCount: context.anomalyEventsCount,
    stabilityLabel,
    evaluatedAt: new Date().toISOString(),
  };
}
