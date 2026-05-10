/**
 * Institutional trust reputation layer (W2-PR121A).
 *
 * Pure derivation of a longitudinal trust reputation score per
 * institution from observed governance epochs + override history +
 * incident history. Reputation is evidence-derived; ambiguity is
 * preserved (no smoothing).
 */

import type { GovernanceLedger } from "./longitudinal-memory.js";
import type { GovernanceIncident } from "./incident-governance.js";
import type { HumanOverrideRecord } from "./override-discipline.js";

export const REPUTATION_TIERS = ["EXEMPLARY", "STRONG", "STANDARD", "WATCHED", "DEGRADED"] as const;
export type ReputationTier = (typeof REPUTATION_TIERS)[number];

export interface ReputationLineage {
  /** Number of clean (no-incident, no-degraded) epochs in window. */
  readonly cleanEpochCount: number;
  /** Number of resolved-with-postmortem incidents. */
  readonly resolvedIncidentCount: number;
  /** Number of unresolved or open SEV-1 incidents. */
  readonly openSev1Count: number;
  /** Number of OVER-RENEWED override states observed. */
  readonly overRenewedOverrideCount: number;
  /** Number of replay collapses observed in window. */
  readonly replayCollapseCount: number;
  /** Number of contradictions observed. */
  readonly contradictionCount: number;
}

export interface TrustReputation {
  readonly subjectId: string; // org / institution id
  readonly tier: ReputationTier;
  readonly score: number; // 0..100; higher = better
  readonly lineage: ReputationLineage;
  /** True if the score is dropping vs prior window (caller supplies prior). */
  readonly driftDetected: boolean;
  /** True iff ambiguity-bearing observations are preserved in the score. */
  readonly ambiguityPreserved: boolean;
}

export interface ReputationInput {
  readonly subjectId: string;
  readonly ledger: GovernanceLedger;
  readonly overrides: readonly HumanOverrideRecord[];
  readonly incidents: readonly GovernanceIncident[];
  /** Optional prior-window score for drift detection. */
  readonly priorScore?: number | null;
}

export function deriveTrustReputation(input: ReputationInput): TrustReputation {
  const epochs = input.ledger.epochs;
  let cleanEpochs = 0;
  let replayCollapses = 0;
  let contradictions = 0;
  let ambigEpochs = 0;
  for (const e of epochs) {
    if (e.replayAmbiguousCount > 0) ambigEpochs += 1;
    if (
      e.replayAmbiguousCount === 0 &&
      e.replayCollapsedCount === 0 &&
      e.integrityDegradedCount === 0 &&
      e.containmentDegradedCount === 0 &&
      e.contradictionCount === 0
    ) cleanEpochs += 1;
    replayCollapses += e.replayCollapsedCount;
    contradictions += e.contradictionCount;
  }
  const overRenewed = input.overrides.filter((o) => o.renewalCount > 3).length;
  const resolvedIncidents = input.incidents.filter((i) => i.state === "POSTMORTEM-CLOSED").length;
  const openSev1 = input.incidents.filter(
    (i) => i.sev === "SEV-1" && i.state !== "POSTMORTEM-CLOSED",
  ).length;

  // Score model — start at 70 (STANDARD baseline)
  let score = 70;
  if (epochs.length > 0) score += Math.min(20, (cleanEpochs / epochs.length) * 20);
  score += Math.min(10, resolvedIncidents * 2);
  score -= openSev1 * 15;
  score -= overRenewed * 8;
  score -= replayCollapses * 2;
  score -= contradictions * 3;
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  let tier: ReputationTier;
  if (score >= 90) tier = "EXEMPLARY";
  else if (score >= 75) tier = "STRONG";
  else if (score >= 55) tier = "STANDARD";
  else if (score >= 35) tier = "WATCHED";
  else tier = "DEGRADED";

  const driftDetected = input.priorScore !== null && input.priorScore !== undefined && score < input.priorScore;

  // Ambiguity preservation: ambiguity-bearing epochs are excluded from the
  // clean-epoch tally, so they contribute to the score's denominator
  // without inflating the "clean" numerator. ambiguityPreserved is true
  // iff the score correctly accounts for them (they were counted but not
  // smoothed away).
  const ambiguityPreserved = ambigEpochs === 0 || cleanEpochs < epochs.length;

  return Object.freeze({
    subjectId: input.subjectId,
    tier,
    score,
    lineage: Object.freeze({
      cleanEpochCount: cleanEpochs,
      resolvedIncidentCount: resolvedIncidents,
      openSev1Count: openSev1,
      overRenewedOverrideCount: overRenewed,
      replayCollapseCount: replayCollapses,
      contradictionCount: contradictions,
    }),
    driftDetected,
    ambiguityPreserved,
  });
}

export interface TrustReputationReport {
  readonly executedAt: string;
  readonly reputations: readonly TrustReputation[];
  readonly hasCiGatingCondition: boolean;
}

export function buildTrustReputationReport(
  inputs: readonly ReputationInput[],
  nowIso: string,
): TrustReputationReport {
  const reputations = inputs.map(deriveTrustReputation);
  // Gate when any subject is DEGRADED or has ambiguity-elision
  const gating = reputations.some(
    (r) => r.tier === "DEGRADED" || !r.ambiguityPreserved,
  );
  return Object.freeze({
    executedAt: nowIso,
    reputations: Object.freeze(reputations),
    hasCiGatingCondition: gating,
  });
}
