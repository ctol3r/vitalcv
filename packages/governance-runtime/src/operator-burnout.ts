/**
 * Institutional operator burnout protection (W2-PR119A).
 *
 * Pure scoring layer over operator activity telemetry. Detects
 * cognitive overload signals (sustained high queue depth, frequent
 * context switches, prolonged ambiguity exposure) before trust
 * degradation occurs.
 */

import type { ReviewItem } from "./verifier-workspace.js";

export const BURNOUT_TIERS = ["RESTED", "PRESSURED", "STRESSED", "BURNT-OUT"] as const;
export type BurnoutTier = (typeof BURNOUT_TIERS)[number];

export interface OperatorActivity {
  readonly operatorId: string;
  readonly assignedItems: readonly ReviewItem[];
  /** Total items processed in the trailing 24h. */
  readonly throughput24h: number;
  /** Total context switches in the trailing 24h (item kind transitions). */
  readonly contextSwitches24h: number;
  /** Total minutes spent on AMBIGUITY_HOLD items in the trailing 24h. */
  readonly ambiguityMinutes24h: number;
}

export interface OperatorHealthScore {
  readonly operatorId: string;
  readonly tier: BurnoutTier;
  readonly score: number; // 0..100; lower = healthier
  readonly contributors: {
    readonly queueDepth: number;
    readonly contextSwitchPenalty: number;
    readonly ambiguityExposure: number;
    readonly throughputStrain: number;
  };
  readonly escalationRequired: boolean;
}

export function deriveOperatorHealth(
  activity: OperatorActivity,
): OperatorHealthScore {
  const queueDepth = activity.assignedItems.filter((i) => i.state !== "RESOLVED").length;
  const queueDepthPenalty = Math.min(30, queueDepth * 2);

  const contextSwitchPenalty = Math.min(30, activity.contextSwitches24h * 0.4);

  const ambiguityExposure = Math.min(25, activity.ambiguityMinutes24h * 0.05);

  // Throughput strain: > 50 items/24h begins to penalize
  const throughputStrain = Math.min(25, Math.max(0, (activity.throughput24h - 50) * 0.5));

  const score = queueDepthPenalty + contextSwitchPenalty + ambiguityExposure + throughputStrain;

  let tier: BurnoutTier;
  if (score >= 75) tier = "BURNT-OUT";
  else if (score >= 50) tier = "STRESSED";
  else if (score >= 25) tier = "PRESSURED";
  else tier = "RESTED";

  return Object.freeze({
    operatorId: activity.operatorId,
    tier,
    score,
    contributors: Object.freeze({
      queueDepth: queueDepthPenalty,
      contextSwitchPenalty,
      ambiguityExposure,
      throughputStrain,
    }),
    escalationRequired: tier === "BURNT-OUT" || tier === "STRESSED",
  });
}

export interface BurnoutProtectionReport {
  readonly executedAt: string;
  readonly operatorsEvaluated: number;
  readonly perOperator: readonly OperatorHealthScore[];
  readonly burntOutCount: number;
  readonly stressedCount: number;
  readonly hasCiGatingCondition: boolean;
}

export function buildBurnoutProtectionReport(
  activities: readonly OperatorActivity[],
  nowIso: string,
  options: { readonly maxBurntOutFraction?: number } = {},
): BurnoutProtectionReport {
  const maxBurntOut = options.maxBurntOutFraction ?? 0.0;
  const perOperator = activities.map(deriveOperatorHealth);
  const burntOut = perOperator.filter((p) => p.tier === "BURNT-OUT").length;
  const stressed = perOperator.filter((p) => p.tier === "STRESSED").length;
  const burntOutFrac = perOperator.length === 0 ? 0 : burntOut / perOperator.length;
  return Object.freeze({
    executedAt: nowIso,
    operatorsEvaluated: perOperator.length,
    perOperator: Object.freeze(perOperator),
    burntOutCount: burntOut,
    stressedCount: stressed,
    hasCiGatingCondition: burntOutFrac > maxBurntOut,
  });
}
