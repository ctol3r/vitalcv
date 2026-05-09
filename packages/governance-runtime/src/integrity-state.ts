/**
 * Integrity-state primitives.
 *
 * Doctrine: docs/ops/runtime-integrity-dashboard.md §2
 *           docs/ops/runtime-governance-telemetry.md
 *
 * Per W2-PR18A non-negotiable rule #1: Unknown ≠ healthy.
 * CI-UNKNOWN is REQUIRED for any state where runtime grounding is absent.
 */

export const INTEGRITY_STATES = [
  "CI-GREEN",
  "CI-DEGRADED",
  "CI-DRIFT",
  "CI-FRAGMENTED",
  "CI-VIOLATION",
  "CI-UNKNOWN", // explicit unknown — NEVER coerced to GREEN
] as const;

export type IntegrityState = (typeof INTEGRITY_STATES)[number];

/**
 * Severity ordering. Higher = worse.
 * Used for composite max() per docs/ops/integrity-containment-dashboard.md §3.
 */
const INTEGRITY_SEVERITY: Readonly<Record<IntegrityState, number>> = Object.freeze({
  "CI-GREEN": 0,
  "CI-UNKNOWN": 50, // unknown is treated as MORE severe than GREEN — fail-closed posture
  "CI-DEGRADED": 60,
  "CI-DRIFT": 70,
  "CI-FRAGMENTED": 80,
  "CI-VIOLATION": 100,
});

export function integritySeverity(state: IntegrityState): number {
  // eslint-disable-next-line security/detect-object-injection -- state is IntegrityState union
  return INTEGRITY_SEVERITY[state];
}

/**
 * Composite max: returns the WORST state across an array.
 * Empty array returns CI-UNKNOWN (no telemetry → degraded per W2-PR18A rule #2).
 */
export function maxIntegrityState(states: readonly IntegrityState[]): IntegrityState {
  if (states.length === 0) return "CI-UNKNOWN";
  let worst: IntegrityState = states[0]!;
  let worstSeverity = integritySeverity(worst);
  for (const state of states) {
    const sev = integritySeverity(state);
    if (sev > worstSeverity) {
      worst = state;
      worstSeverity = sev;
    }
  }
  return worst;
}

/**
 * Parse a runtime string into IntegrityState.
 * Returns CI-UNKNOWN (NOT null, NOT CI-GREEN) for unknown input.
 * This is the fail-closed default per W2-PR18A rule #4.
 */
export function parseIntegrityState(value: unknown): IntegrityState {
  if (typeof value !== "string") return "CI-UNKNOWN";
  for (const state of INTEGRITY_STATES) {
    if (state === value) return state;
  }
  return "CI-UNKNOWN";
}

/**
 * Lexicon-aligned wording per state.
 * Operators see this in dashboards / runbooks / CLI output.
 */
export function integrityStateDescription(state: IntegrityState): string {
  switch (state) {
    case "CI-GREEN":
      return "Within all thresholds; integrity nominal";
    case "CI-DEGRADED":
      return "Within tolerance but trending down; investigation recommended";
    case "CI-DRIFT":
      return "Detected drift in vocabulary / classification / wording; investigation required";
    case "CI-FRAGMENTED":
      return "Cross-source inconsistency observed (e.g., EX-1 SIEM count != EX-3 Postgres count)";
    case "CI-VIOLATION":
      return "Constitutional violation detected; immediate action required";
    case "CI-UNKNOWN":
      return "Telemetry absent or unparseable; treated as DEGRADED per fail-closed posture (NOT silently healthy)";
  }
}
