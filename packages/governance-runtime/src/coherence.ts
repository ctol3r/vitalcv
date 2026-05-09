/**
 * Cross-axis coherence (W2-PR22A) — systemic integrity reconciliation.
 *
 * Doctrine: this module + W2-PR22A non-negotiable rules:
 *   1. Local validity ≠ systemic coherence.
 *   2. Replay ambiguity propagates systemically.
 *   3. Missing evidence degrades confidence globally.
 *   4. Highest-risk axis dominates systemic truth.
 *   5. Contradictions must remain operator-visible.
 *   6. Unknown cross-axis combinations must fail closed.
 *   7. Systemic integrity must remain ambiguity-honest.
 *
 * The platform reasons SYSTEMICALLY:
 *   - CI-GREEN cannot coexist with R-AMBIGUOUS (rule #2).
 *   - CONFIRMED causal-confidence cannot coexist with missing evidenceRef.
 *   - T0 trust-class cannot coexist with STRONG continuity-confidence
 *     (T0 is fire-and-forget; continuity is structurally weak).
 *   - CT-GREEN cannot coexist with CI-FRAGMENTED (containment cannot be
 *     greener than integrity).
 */

import type { CausalConfidence, ContinuityConfidence } from "./transitions.js";
import { containmentSeverity, type ContainmentState } from "./containment-state.js";
import { integritySeverity, type IntegrityState } from "./integrity-state.js";
import type { ReplayState } from "./replay-state.js";
import type { TrustClass } from "./trust-class.js";

/**
 * Aggregate systemic state. Distinct from per-axis states; reconciles them.
 */
export const SYSTEMIC_STATES = [
  "SYSTEMIC-RECOVERING",
  "SYSTEMIC-DEGRADED",
  "SYSTEMIC-FRAGMENTED",
  "SYSTEMIC-AMBIGUOUS",
  "SYSTEMIC-UNVERIFIED",
] as const;
export type SystemicState = (typeof SYSTEMIC_STATES)[number];

export type CoherenceContradiction =
  | {
      readonly tag: "integrity-vs-replay";
      readonly integrity: IntegrityState;
      readonly replay: ReplayState;
      readonly reason: string;
    }
  | {
      readonly tag: "containment-vs-integrity";
      readonly containment: ContainmentState;
      readonly integrity: IntegrityState;
      readonly reason: string;
    }
  | {
      readonly tag: "trust-class-vs-continuity";
      readonly trustClass: TrustClass;
      readonly continuity: ContinuityConfidence;
      readonly reason: string;
    }
  | {
      readonly tag: "confidence-vs-evidence";
      readonly confidence: CausalConfidence;
      readonly hasEvidenceRef: boolean;
      readonly reason: string;
    };

export interface CrossAxisStateSnapshot {
  readonly integrity: IntegrityState;
  readonly containment: ContainmentState;
  readonly replay: ReplayState;
  readonly trustClass: TrustClass | null; // null = UNCLASSIFIED (fail-closed)
  readonly continuityConfidence: ContinuityConfidence | null;
  readonly causalConfidence: CausalConfidence | null;
  readonly hasEvidenceRef: boolean;
}

/**
 * Detect cross-axis contradictions per W2-PR22A target 1 + 2.
 * Returns array of contradictions (empty array = coherent).
 */
export function detectCoherenceContradictions(
  snapshot: CrossAxisStateSnapshot,
): readonly CoherenceContradiction[] {
  const errors: CoherenceContradiction[] = [];

  // Rule: CI-GREEN cannot coexist with R-AMBIGUOUS (replay ambiguity propagates systemically)
  if (snapshot.integrity === "CI-GREEN" && snapshot.replay === "R-AMBIGUOUS") {
    errors.push({
      tag: "integrity-vs-replay",
      integrity: snapshot.integrity,
      replay: snapshot.replay,
      reason:
        "CI-GREEN incompatible with R-AMBIGUOUS — replay ambiguity propagates to integrity per W2-PR22A rule #2",
    });
  }

  // Rule: CT-GREEN cannot coexist with CI-FRAGMENTED or CI-VIOLATION (containment cannot be greener than integrity)
  if (
    snapshot.containment === "CT-GREEN" &&
    (snapshot.integrity === "CI-FRAGMENTED" || snapshot.integrity === "CI-VIOLATION")
  ) {
    errors.push({
      tag: "containment-vs-integrity",
      containment: snapshot.containment,
      integrity: snapshot.integrity,
      reason:
        `CT-GREEN incompatible with ${snapshot.integrity} — containment cannot be greener than integrity per W2-PR22A rule #4`,
    });
  }

  // Rule: T0 trust-class cannot coexist with STRONG continuity-confidence
  if (snapshot.trustClass === "T0" && snapshot.continuityConfidence === "STRONG") {
    errors.push({
      tag: "trust-class-vs-continuity",
      trustClass: snapshot.trustClass,
      continuity: snapshot.continuityConfidence,
      reason:
        "T0 fire-and-forget incompatible with STRONG continuity confidence — T0 is structurally PARTIAL at best",
    });
  }

  // Rule: CONFIRMED / PROBABLE causal-confidence requires evidenceRef
  if (
    (snapshot.causalConfidence === "CONFIRMED" ||
      snapshot.causalConfidence === "PROBABLE") &&
    !snapshot.hasEvidenceRef
  ) {
    errors.push({
      tag: "confidence-vs-evidence",
      confidence: snapshot.causalConfidence,
      hasEvidenceRef: snapshot.hasEvidenceRef,
      reason:
        `${snapshot.causalConfidence} causal confidence requires evidenceRef per W2-PR22A rule #3`,
    });
  }

  return errors;
}

/**
 * Cross-axis severity resolution per W2-PR22A target 3.
 *
 * Returns the systemic state. Highest-risk axis dominates; ambiguity
 * propagates; contradictions surface as SYSTEMIC-AMBIGUOUS.
 */
export function resolveSystemicState(
  snapshot: CrossAxisStateSnapshot,
): { readonly state: SystemicState; readonly contradictions: readonly CoherenceContradiction[] } {
  const contradictions = detectCoherenceContradictions(snapshot);

  // If contradictions exist, surface as ambiguous (rule #5 + #7)
  if (contradictions.length > 0) {
    return { state: "SYSTEMIC-AMBIGUOUS", contradictions };
  }

  // Unknown / unverified inputs degrade systemic state
  if (
    snapshot.integrity === "CI-UNKNOWN" ||
    snapshot.containment === "CT-UNKNOWN" ||
    snapshot.trustClass === null ||
    snapshot.continuityConfidence === null ||
    snapshot.causalConfidence === null ||
    snapshot.causalConfidence === "UNVERIFIED"
  ) {
    return { state: "SYSTEMIC-UNVERIFIED", contradictions };
  }

  // Replay-ambiguity → SYSTEMIC-AMBIGUOUS (per rule #2)
  if (snapshot.replay === "R-AMBIGUOUS") {
    return { state: "SYSTEMIC-AMBIGUOUS", contradictions };
  }

  // Compute combined severity from integrity + containment axes
  const intSev = integritySeverity(snapshot.integrity);
  const ctSev = containmentSeverity(snapshot.containment);
  const maxSev = Math.max(intSev, ctSev);

  // SYSTEMIC-FRAGMENTED if any axis is fragmented or worse
  if (snapshot.integrity === "CI-FRAGMENTED" || snapshot.integrity === "CI-VIOLATION") {
    return { state: "SYSTEMIC-FRAGMENTED", contradictions };
  }
  if (snapshot.containment === "CT-FRAGMENTING" || snapshot.containment === "CT-ESCALATING" || snapshot.containment === "CT-VIOLATION") {
    return { state: "SYSTEMIC-FRAGMENTED", contradictions };
  }

  // Active recovery: integrity DEGRADED but containment GREEN with strong continuity
  if (
    intSev > 0 &&
    snapshot.containment === "CT-GREEN" &&
    snapshot.continuityConfidence === "STRONG"
  ) {
    return { state: "SYSTEMIC-RECOVERING", contradictions };
  }

  // If no contradictions, no fragmentation, no UNKNOWN, and any degradation → DEGRADED
  if (maxSev > 0) {
    return { state: "SYSTEMIC-DEGRADED", contradictions };
  }

  // All-clear: no contradictions, no degradation, no ambiguity, all axes GREEN/STRONG
  // BUT we never return a "SYSTEMIC-GREEN" state — the systemic-state vocabulary
  // is INTENTIONALLY degradation-focused. All-clear is rendered as SYSTEMIC-RECOVERING
  // (the default operational posture is "recovering from prior degradation").
  return { state: "SYSTEMIC-RECOVERING", contradictions };
}

export function systemicStateDescription(state: SystemicState): string {
  switch (state) {
    case "SYSTEMIC-RECOVERING":
      return "All axes nominal OR active recovery from prior degradation; continuity strong";
    case "SYSTEMIC-DEGRADED":
      return "One or more axes degraded; investigation per containment runbook";
    case "SYSTEMIC-FRAGMENTED":
      return "Cross-axis fragmentation detected; SOC + ops investigation";
    case "SYSTEMIC-AMBIGUOUS":
      return "Cross-axis contradictions detected OR replay ambiguity propagated; disambiguation required";
    case "SYSTEMIC-UNVERIFIED":
      return "One or more axes UNKNOWN / UNCLASSIFIED / UNVERIFIED; systemic state cannot be confirmed";
  }
}
