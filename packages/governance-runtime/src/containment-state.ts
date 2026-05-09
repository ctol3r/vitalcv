/**
 * Containment-state primitives.
 *
 * Doctrine: docs/ops/integrity-containment-dashboard.md §1
 *           docs/ops/constitutional-containment-taxonomy.md
 *
 * Per W2-PR18A non-negotiable rules: Unknown states must NEVER silently
 * coerce to GREEN. CT-UNKNOWN is REQUIRED for missing telemetry.
 */

export const CONTAINMENT_STATES = [
  "CT-GREEN",
  "CT-DEGRADED",
  "CT-FRAGMENTING",
  "CT-ESCALATING",
  "CT-VIOLATION",
  "CT-UNKNOWN", // explicit unknown — fail-closed default
] as const;

export type ContainmentState = (typeof CONTAINMENT_STATES)[number];

const CONTAINMENT_SEVERITY: Readonly<Record<ContainmentState, number>> = Object.freeze({
  "CT-GREEN": 0,
  "CT-UNKNOWN": 50, // fail-closed: unknown is degraded-equivalent
  "CT-DEGRADED": 60,
  "CT-FRAGMENTING": 80,
  "CT-ESCALATING": 90,
  "CT-VIOLATION": 100,
});

export function containmentSeverity(state: ContainmentState): number {
  // eslint-disable-next-line security/detect-object-injection -- state is union
  return CONTAINMENT_SEVERITY[state];
}

export function maxContainmentState(states: readonly ContainmentState[]): ContainmentState {
  if (states.length === 0) return "CT-UNKNOWN";
  let worst: ContainmentState = states[0]!;
  let worstSev = containmentSeverity(worst);
  for (const state of states) {
    const sev = containmentSeverity(state);
    if (sev > worstSev) {
      worst = state;
      worstSev = sev;
    }
  }
  return worst;
}

export function parseContainmentState(value: unknown): ContainmentState {
  if (typeof value !== "string") return "CT-UNKNOWN";
  for (const state of CONTAINMENT_STATES) {
    if (state === value) return state;
  }
  return "CT-UNKNOWN";
}

export function containmentStateDescription(state: ContainmentState): string {
  switch (state) {
    case "CT-GREEN":
      return "No degradation detected; no containment needed";
    case "CT-DEGRADED":
      return "Degradation detected; containment in progress; no escalation";
    case "CT-FRAGMENTING":
      return "Degradation expanding scope; multi-handler / multi-domain spread";
    case "CT-ESCALATING":
      return "Degradation crossed escalation threshold; founder coordination active";
    case "CT-VIOLATION":
      return "Constitutional violation shipped; incident response active";
    case "CT-UNKNOWN":
      return "Containment telemetry absent; treated as DEGRADED per fail-closed posture";
  }
}
