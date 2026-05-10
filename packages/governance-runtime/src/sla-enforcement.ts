/**
 * Institutional trust SLA enforcement (W2-PR109A).
 *
 * Pure threshold engine over a window of governance epochs. Defines
 * canonical SLAs for replay continuity, ambiguity visibility, and
 * confidence floor; detects breaches; classifies escalation severity.
 */

import type { GovernanceLedger } from "./longitudinal-memory.js";

export interface SlaThresholds {
  /** Maximum allowed fraction of epochs in a window with replayCollapsed > 0. */
  readonly maxReplayCollapsedFraction: number;
  /** Maximum allowed consecutive ambiguity-bearing epochs without escalation. */
  readonly maxConsecutiveAmbiguousEpochs: number;
  /** Minimum allowed aggregate confidence score (0..100; UNKNOWN=0..VERIFIED=100). */
  readonly minConfidenceScore: number;
  /** Maximum allowed contradiction count per window. */
  readonly maxContradictionsPerWindow: number;
}

export const DEFAULT_SLA_THRESHOLDS: SlaThresholds = Object.freeze({
  maxReplayCollapsedFraction: 0.1,
  maxConsecutiveAmbiguousEpochs: 6,
  minConfidenceScore: 50,
  maxContradictionsPerWindow: 2,
});

const CONFIDENCE_NUMERIC: Readonly<Record<string, number>> = Object.freeze({
  VERIFIED: 100,
  "PARTIALLY-VERIFIED": 70,
  ASSUMED: 50,
  UNVERIFIED: 20,
  UNKNOWN: 0,
});

export const SLA_BREACH_SEVERITY = ["INFO", "WARN", "BREACH", "ESCALATION"] as const;
export type SlaBreachSeverity = (typeof SLA_BREACH_SEVERITY)[number];

export type SlaBreach =
  | { readonly tag: "replay-collapse-rate-exceeded"; readonly fraction: number; readonly threshold: number; readonly severity: SlaBreachSeverity }
  | { readonly tag: "ambiguity-escalation-overdue"; readonly consecutiveEpochs: number; readonly threshold: number; readonly severity: SlaBreachSeverity }
  | { readonly tag: "confidence-floor-breached"; readonly observed: number; readonly threshold: number; readonly severity: SlaBreachSeverity }
  | { readonly tag: "contradiction-budget-exceeded"; readonly observed: number; readonly threshold: number; readonly severity: SlaBreachSeverity };

export interface SlaEnforcementReport {
  readonly executedAt: string;
  readonly windowEpochs: number;
  readonly thresholds: SlaThresholds;
  readonly breaches: readonly SlaBreach[];
  readonly escalationRequired: boolean;
  readonly hasCiGatingCondition: boolean;
}

function severityFor(observed: number, threshold: number): SlaBreachSeverity {
  const ratio = threshold === 0 ? Infinity : observed / threshold;
  if (ratio < 1) return "INFO";
  if (ratio < 1.25) return "WARN";
  if (ratio < 2) return "BREACH";
  return "ESCALATION";
}

export function enforceSlas(
  ledger: GovernanceLedger,
  nowIso: string,
  thresholds: SlaThresholds = DEFAULT_SLA_THRESHOLDS,
): SlaEnforcementReport {
  const window = ledger.epochs;
  const breaches: SlaBreach[] = [];

  // Replay collapse rate
  const collapsed = window.filter((e) => e.replayCollapsedCount > 0).length;
  const collapseFrac = window.length === 0 ? 0 : collapsed / window.length;
  if (collapseFrac > thresholds.maxReplayCollapsedFraction) {
    breaches.push({
      tag: "replay-collapse-rate-exceeded",
      fraction: collapseFrac,
      threshold: thresholds.maxReplayCollapsedFraction,
      severity: severityFor(collapseFrac, thresholds.maxReplayCollapsedFraction),
    });
  }

  // Consecutive ambiguity
  let maxConsecutive = 0;
  let cur = 0;
  for (const e of window) {
    if (e.replayAmbiguousCount > 0) {
      cur += 1;
      if (cur > maxConsecutive) maxConsecutive = cur;
    } else {
      cur = 0;
    }
  }
  if (maxConsecutive > thresholds.maxConsecutiveAmbiguousEpochs) {
    breaches.push({
      tag: "ambiguity-escalation-overdue",
      consecutiveEpochs: maxConsecutive,
      threshold: thresholds.maxConsecutiveAmbiguousEpochs,
      severity: severityFor(maxConsecutive, thresholds.maxConsecutiveAmbiguousEpochs),
    });
  }

  // Confidence floor (worst observed)
  let minConf = 100;
  for (const e of window) {
    const score = CONFIDENCE_NUMERIC[e.aggregateVerificationConfidence] ?? 0;
    if (score < minConf) minConf = score;
  }
  if (window.length > 0 && minConf < thresholds.minConfidenceScore) {
    breaches.push({
      tag: "confidence-floor-breached",
      observed: minConf,
      threshold: thresholds.minConfidenceScore,
      severity: severityFor(thresholds.minConfidenceScore - minConf, thresholds.minConfidenceScore),
    });
  }

  // Contradiction budget
  const totalContradictions = window.reduce((a, e) => a + e.contradictionCount, 0);
  if (totalContradictions > thresholds.maxContradictionsPerWindow) {
    breaches.push({
      tag: "contradiction-budget-exceeded",
      observed: totalContradictions,
      threshold: thresholds.maxContradictionsPerWindow,
      severity: severityFor(totalContradictions, thresholds.maxContradictionsPerWindow),
    });
  }

  const escalationRequired = breaches.some((b) => b.severity === "ESCALATION");

  return Object.freeze({
    executedAt: nowIso,
    windowEpochs: window.length,
    thresholds,
    breaches: Object.freeze(breaches),
    escalationRequired,
    hasCiGatingCondition: breaches.some((b) => b.severity === "BREACH" || b.severity === "ESCALATION"),
  });
}
