/**
 * State transition graphs + validators.
 *
 * Doctrine: docs/ops/integrity-stress-escalation-paths.md
 *           docs/ops/constitutional-recovery-semantics.md
 *
 * Per W2-PR20A non-negotiable rules:
 *   1. State validity ≠ transition validity.
 *   2. Healthy restoration requires continuity evidence.
 *   4. Degradation history may not disappear silently.
 *   7. Unknown transitions must fail closed.
 *
 * The graphs encode WHICH state-to-state transitions are operationally valid.
 * They do NOT auto-execute transitions. They validate proposed transitions,
 * surface evidence requirements, and reject impossible jumps.
 */

import type { ContainmentState } from "./containment-state.js";
import type { IntegrityState } from "./integrity-state.js";
import type { ReplayState } from "./replay-state.js";

/**
 * Allowed transition: tuple of (from, to). The full graph is the set of
 * allowed tuples. Every transition not in the set is FORBIDDEN.
 */
export interface AllowedTransition<S extends string> {
  readonly from: S;
  readonly to: S;
  /**
   * Continuity evidence required for the transition to be operationally
   * valid. NULL means no specific evidence (e.g., natural degradation
   * does not require evidence; it's the absence of recovery that requires).
   */
  readonly evidenceRequired: string | null;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* INTEGRITY STATE TRANSITIONS                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Allowed integrity-state transitions.
 *
 * Degradation paths are unrestricted (any → worse-or-equal allowed without
 * evidence). Recovery paths require continuity evidence per
 * docs/ops/constitutional-recovery-semantics.md §2 + §7.
 *
 * CI-UNKNOWN can transition to any other state IF telemetry resumes (the
 * evidence is the resumption itself).
 */
export const INTEGRITY_TRANSITIONS: readonly AllowedTransition<IntegrityState>[] = Object.freeze([
  // Degradation paths (any → worse) — no evidence required
  { from: "CI-GREEN", to: "CI-UNKNOWN", evidenceRequired: null },
  { from: "CI-GREEN", to: "CI-DEGRADED", evidenceRequired: null },
  { from: "CI-GREEN", to: "CI-DRIFT", evidenceRequired: null },
  { from: "CI-GREEN", to: "CI-FRAGMENTED", evidenceRequired: null },
  { from: "CI-GREEN", to: "CI-VIOLATION", evidenceRequired: null },
  { from: "CI-DEGRADED", to: "CI-DRIFT", evidenceRequired: null },
  { from: "CI-DEGRADED", to: "CI-FRAGMENTED", evidenceRequired: null },
  { from: "CI-DEGRADED", to: "CI-VIOLATION", evidenceRequired: null },
  { from: "CI-DRIFT", to: "CI-FRAGMENTED", evidenceRequired: null },
  { from: "CI-DRIFT", to: "CI-VIOLATION", evidenceRequired: null },
  { from: "CI-FRAGMENTED", to: "CI-VIOLATION", evidenceRequired: null },

  // Recovery paths (worse → better) — require continuity evidence
  {
    from: "CI-DEGRADED",
    to: "CI-GREEN",
    evidenceRequired: "remediation-verified per recovery-confidence tier (canonical-query verification)",
  },
  {
    from: "CI-DRIFT",
    to: "CI-DEGRADED",
    evidenceRequired: "drift-source remediated; lexicon enforcement re-tightened",
  },
  {
    from: "CI-DRIFT",
    to: "CI-GREEN",
    evidenceRequired: "drift-source remediated AND verified clean across 7-PR rolling window",
  },
  {
    from: "CI-FRAGMENTED",
    to: "CI-DEGRADED",
    evidenceRequired: "cross-source variance closed; Q-CANON verification",
  },
  {
    from: "CI-FRAGMENTED",
    to: "CI-GREEN",
    evidenceRequired: "cross-source variance closed AND sustained over 7-day window",
  },
  {
    from: "CI-VIOLATION",
    to: "CI-FRAGMENTED",
    evidenceRequired: "violation contained; root cause identified; remediation in progress",
  },
  {
    from: "CI-VIOLATION",
    to: "CI-DEGRADED",
    evidenceRequired: "violation remediated; founder-approved closure; Codex re-audit clean",
  },
  // CI-UNKNOWN transitions: telemetry resumption is the evidence
  { from: "CI-UNKNOWN", to: "CI-GREEN", evidenceRequired: "telemetry restored AND nominal" },
  { from: "CI-UNKNOWN", to: "CI-DEGRADED", evidenceRequired: "telemetry restored; degradation observed" },
  { from: "CI-UNKNOWN", to: "CI-DRIFT", evidenceRequired: "telemetry restored; drift observed" },
  { from: "CI-UNKNOWN", to: "CI-FRAGMENTED", evidenceRequired: "telemetry restored; fragmentation observed" },
  { from: "CI-UNKNOWN", to: "CI-VIOLATION", evidenceRequired: "telemetry restored; violation observed" },
  // Any → CI-UNKNOWN: telemetry-loss is its own signal
  { from: "CI-DEGRADED", to: "CI-UNKNOWN", evidenceRequired: null },
  { from: "CI-DRIFT", to: "CI-UNKNOWN", evidenceRequired: null },
  { from: "CI-FRAGMENTED", to: "CI-UNKNOWN", evidenceRequired: null },
  { from: "CI-VIOLATION", to: "CI-UNKNOWN", evidenceRequired: null },
]);

/* ─────────────────────────────────────────────────────────────────────────── */
/* CONTAINMENT STATE TRANSITIONS                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

export const CONTAINMENT_TRANSITIONS: readonly AllowedTransition<ContainmentState>[] = Object.freeze([
  // Degradation paths
  { from: "CT-GREEN", to: "CT-UNKNOWN", evidenceRequired: null },
  { from: "CT-GREEN", to: "CT-DEGRADED", evidenceRequired: null },
  { from: "CT-DEGRADED", to: "CT-FRAGMENTING", evidenceRequired: null },
  { from: "CT-FRAGMENTING", to: "CT-ESCALATING", evidenceRequired: null },
  { from: "CT-ESCALATING", to: "CT-VIOLATION", evidenceRequired: null },

  // Recovery paths — all require evidence
  {
    from: "CT-DEGRADED",
    to: "CT-GREEN",
    evidenceRequired: "containment playbook applied; verification per recovery-confidence tier",
  },
  {
    from: "CT-FRAGMENTING",
    to: "CT-DEGRADED",
    evidenceRequired: "fragmentation scope reduced to single-handler; investigation ongoing",
  },
  {
    from: "CT-FRAGMENTING",
    to: "CT-GREEN",
    evidenceRequired: "fragmentation fully contained AND root cause remediated",
  },
  {
    from: "CT-ESCALATING",
    to: "CT-FRAGMENTING",
    evidenceRequired: "escalation contained; founder coordination active",
  },
  {
    from: "CT-ESCALATING",
    to: "CT-DEGRADED",
    evidenceRequired: "escalation contained AND scope reduced",
  },
  {
    from: "CT-VIOLATION",
    to: "CT-ESCALATING",
    evidenceRequired: "violation incident-response active; remediation in progress",
  },
  // CT-UNKNOWN handling
  { from: "CT-UNKNOWN", to: "CT-GREEN", evidenceRequired: "containment telemetry restored AND nominal" },
  { from: "CT-UNKNOWN", to: "CT-DEGRADED", evidenceRequired: "telemetry restored; degradation observed" },
  { from: "CT-UNKNOWN", to: "CT-FRAGMENTING", evidenceRequired: "telemetry restored; fragmentation observed" },
  { from: "CT-UNKNOWN", to: "CT-ESCALATING", evidenceRequired: "telemetry restored; escalation observed" },
  { from: "CT-UNKNOWN", to: "CT-VIOLATION", evidenceRequired: "telemetry restored; violation observed" },
  { from: "CT-DEGRADED", to: "CT-UNKNOWN", evidenceRequired: null },
  { from: "CT-FRAGMENTING", to: "CT-UNKNOWN", evidenceRequired: null },
  { from: "CT-ESCALATING", to: "CT-UNKNOWN", evidenceRequired: null },
  { from: "CT-VIOLATION", to: "CT-UNKNOWN", evidenceRequired: null },
]);

/* ─────────────────────────────────────────────────────────────────────────── */
/* REPLAY STATE TRANSITIONS                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Replay state transitions are PER-EVENT, not per-aggregate.
 *
 * A replay attempt produces ONE state per event; "transitions" between
 * replay states for the SAME logical operation are forensic-detective
 * (querying multiple audit rows for the same correlationId).
 *
 * The valid transitions enumerate forensic disambiguation patterns per
 * docs/ops/replay-taxonomy-map.md §6.
 *
 * Unlike integrity/containment, R-AMBIGUOUS DOES require evidence to
 * resolve to a specific state — see W2-PR20A non-negotiable rule #3.
 */
export const REPLAY_TRANSITIONS: readonly AllowedTransition<ReplayState>[] = Object.freeze([
  // Ambiguity → resolved state requires forensic evidence
  {
    from: "R-AMBIGUOUS",
    to: "R-OBSERVED",
    evidenceRequired: "IDEMPOTENT_REPLAY audit row found for the (actor, correlationId) pair",
  },
  {
    from: "R-AMBIGUOUS",
    to: "R-DENIED",
    evidenceRequired: "<base>.duplicate_request OR <base>.already_accepted denied audit row found",
  },
  {
    from: "R-AMBIGUOUS",
    to: "R-COLLAPSED",
    evidenceRequired: "CONCURRENCY_GUARD_TRIGGERED audit row found",
  },
  {
    from: "R-AMBIGUOUS",
    to: "R-ACCEPTED",
    evidenceRequired: "payloadHash clustering reveals replay-as-new (capture-replay forensic detection)",
  },

  // Resolved → ambiguous: NEW evidence may un-resolve a prior classification
  { from: "R-OBSERVED", to: "R-AMBIGUOUS", evidenceRequired: "additional row contradicts prior classification" },
  { from: "R-DENIED", to: "R-AMBIGUOUS", evidenceRequired: "additional row contradicts prior classification" },
  { from: "R-COLLAPSED", to: "R-AMBIGUOUS", evidenceRequired: "additional row contradicts prior classification" },
  { from: "R-ACCEPTED", to: "R-AMBIGUOUS", evidenceRequired: "additional row contradicts prior classification" },

  // Forensic re-classification: between resolved states (not direct, but possible
  // if an investigation reveals the prior classification was wrong)
  // These require explicit re-investigation evidence.
  { from: "R-OBSERVED", to: "R-DENIED", evidenceRequired: "re-investigation: row was actually denied, not observed" },
  { from: "R-DENIED", to: "R-OBSERVED", evidenceRequired: "re-investigation: row was actually processed, not denied" },
  { from: "R-OBSERVED", to: "R-ACCEPTED", evidenceRequired: "re-investigation reveals capture-replay (not idempotent)" },
  { from: "R-ACCEPTED", to: "R-OBSERVED", evidenceRequired: "re-investigation reveals idempotent processing (not capture-replay)" },
]);

/* ─────────────────────────────────────────────────────────────────────────── */
/* TRANSITION VALIDATION                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

export type TransitionValidationResult<S extends string> =
  | { readonly tag: "allowed"; readonly evidenceRequired: string | null }
  | { readonly tag: "forbidden"; readonly from: S; readonly to: S; readonly reason: string }
  | { readonly tag: "no-op"; readonly state: S };

export function validateTransition<S extends string>(
  graph: readonly AllowedTransition<S>[],
  from: S,
  to: S,
): TransitionValidationResult<S> {
  if (from === to) {
    return { tag: "no-op", state: from };
  }
  for (const t of graph) {
    if (t.from === from && t.to === to) {
      return { tag: "allowed", evidenceRequired: t.evidenceRequired };
    }
  }
  return {
    tag: "forbidden",
    from,
    to,
    reason: `Transition ${from} → ${to} is not in the canonical transition graph; impossible state jump`,
  };
}

export function validateIntegrityTransition(
  from: IntegrityState,
  to: IntegrityState,
): TransitionValidationResult<IntegrityState> {
  return validateTransition(INTEGRITY_TRANSITIONS, from, to);
}

export function validateContainmentTransition(
  from: ContainmentState,
  to: ContainmentState,
): TransitionValidationResult<ContainmentState> {
  return validateTransition(CONTAINMENT_TRANSITIONS, from, to);
}

export function validateReplayTransition(
  from: ReplayState,
  to: ReplayState,
): TransitionValidationResult<ReplayState> {
  return validateTransition(REPLAY_TRANSITIONS, from, to);
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* TRANSITION AUDIT EVENT SHAPE                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Per W2-PR20A target 4 + W2-PR21A causal-integrity extension.
 * Required: previous state, next state, timestamp, actor/source, transition
 * reason, evidence references (causal lineage), continuity confidence,
 * causality reason.
 */
export const CONTINUITY_CONFIDENCE_LEVELS = ["STRONG", "PARTIAL", "LIMITED", "NONE"] as const;
export type ContinuityConfidence = (typeof CONTINUITY_CONFIDENCE_LEVELS)[number];

/**
 * W2-PR21A target 3: causal confidence semantics.
 * Distinct from ContinuityConfidence (continuity over time);
 * CausalConfidence measures the QUALITY OF EVIDENCE backing the transition.
 */
export const CAUSAL_CONFIDENCE_LEVELS = [
  "CONFIRMED",
  "PROBABLE",
  "PARTIAL",
  "AMBIGUOUS",
  "UNVERIFIED",
] as const;
export type CausalConfidence = (typeof CAUSAL_CONFIDENCE_LEVELS)[number];

/**
 * W2-PR21A target 1: evidence-linked transition references.
 */
export interface CausalLineageRefs {
  readonly evidenceRef: string | null;
  readonly continuityRef: string | null;
  readonly replayRef: string | null;
  readonly telemetryRef: string | null;
  readonly confidenceSource: string;
  readonly causalityReason: string;
}

export interface TransitionAuditEvent<S extends string> {
  readonly axis: "integrity" | "containment" | "replay";
  readonly previousState: S;
  readonly nextState: S;
  readonly timestamp: string; // ISO-8601 UTC
  readonly actor: string;
  readonly transitionReason: string;
  readonly evidenceReference: string | null; // legacy; superseded by lineage.evidenceRef
  readonly continuityConfidence: ContinuityConfidence;
  /** W2-PR21A causal lineage. New transitions MUST include for recovery. */
  readonly lineage?: CausalLineageRefs;
  /** W2-PR21A causal confidence; preserves ambiguity per non-negotiable rule #5. */
  readonly causalConfidence?: CausalConfidence;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* W2-PR21A — CAUSAL VALIDATION                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

export type CausalValidationError =
  | { readonly tag: "missing-evidence-ref"; readonly required: string }
  | { readonly tag: "missing-continuity-ref"; readonly required: string }
  | { readonly tag: "missing-replay-ref"; readonly required: string }
  | { readonly tag: "missing-confidence-source" }
  | { readonly tag: "missing-causality-reason" }
  | { readonly tag: "confidence-without-evidence"; readonly confidence: CausalConfidence };

/**
 * Validates that a transition audit event carries the required causal lineage.
 *
 * Per W2-PR21A non-negotiable rules:
 *   2. Recovery requires evidence lineage.
 *   3. Replay stabilization requires replay continuity evidence.
 *   4. Confidence must remain evidence-derived.
 *
 * Pure validation; no throw.
 */
export function validateCausalLineage<S extends string>(
  event: TransitionAuditEvent<S>,
  context: {
    readonly isRecovery: boolean;
    readonly isReplayStabilization: boolean;
    readonly evidenceRequiredByGraph: string | null;
  },
): readonly CausalValidationError[] {
  const errors: CausalValidationError[] = [];
  const lineage = event.lineage;

  if (context.isRecovery || context.evidenceRequiredByGraph !== null) {
    if (lineage == null || lineage.evidenceRef == null || lineage.evidenceRef === "") {
      errors.push({
        tag: "missing-evidence-ref",
        required: context.evidenceRequiredByGraph ?? "recovery transition",
      });
    }
  }

  if (context.isReplayStabilization) {
    if (lineage == null || lineage.replayRef == null || lineage.replayRef === "") {
      errors.push({
        tag: "missing-replay-ref",
        required: "R-AMBIGUOUS resolution requires replay stabilization evidence",
      });
    }
  }

  if (lineage != null) {
    if (lineage.confidenceSource === "") errors.push({ tag: "missing-confidence-source" });
    if (lineage.causalityReason === "") errors.push({ tag: "missing-causality-reason" });

    const confidence = event.causalConfidence;
    if (
      (confidence === "CONFIRMED" || confidence === "PROBABLE") &&
      (lineage.evidenceRef == null || lineage.evidenceRef === "")
    ) {
      errors.push({ tag: "confidence-without-evidence", confidence });
    }
  }

  return errors;
}

export function isRecoveryTransition(fromSeverity: number, toSeverity: number): boolean {
  return toSeverity < fromSeverity;
}
