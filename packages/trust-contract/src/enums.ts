/**
 * Trust Contract — Canonical Enums
 * wave-120: Truth Engine Enforcement
 *
 * RULE: every state in this file reflects SYSTEM state, not user judgment.
 * "unknown" is never negative. "unavailable" is never a blocker.
 */

// ─── Source Status ────────────────────────────────────────────────
// The state of a single primary-source lane check.

export enum SourceStatus {
  /** Check has not been attempted in this run. NOT a blocker. */
  NOT_CHECKED = 'not_checked',
  /** Check is in progress. NOT a blocker. */
  IN_PROGRESS = 'in_progress',
  /** Check completed — data is fresh within TTL. */
  VERIFIED = 'verified',
  /** Data was verified but has exceeded its freshness window. NOT a blocker. */
  STALE = 'stale',
  /** Source temporarily unavailable (timeout / network). NOT a blocker. */
  UNAVAILABLE = 'unavailable',
  /** Source requires institutional access not yet configured. NOT a blocker. */
  ACCESS_REQUIRED = 'access_required',
  /** Source returned data requiring human review. NOT a blocker. */
  REVIEW_REQUIRED = 'review_required',
  /** Source returned explicit adverse evidence. THE ONLY TRUE BLOCKER. */
  ADVERSE = 'adverse',
}

// ─── Lane Outcome ─────────────────────────────────────────────────
// What a lane's status means for the clinician's readiness.
// Distinct from SourceStatus — status is SYSTEM state, outcome is MEANING.

export enum LaneOutcome {
  /** Lane contributes positive evidence. */
  POSITIVE = 'positive',
  /** Lane has no evidence yet — system state issue, not clinician issue. */
  PENDING = 'pending',
  /** Lane has explicit adverse evidence — clinician action required. */
  ADVERSE = 'adverse',
}

// ─── Readiness Posture ────────────────────────────────────────────
// Aggregate posture from the union of all lanes.

export enum ReadinessPosture {
  /** No lanes have been checked yet in this run. */
  UNCHECKED = 'unchecked',
  /** Checks are in progress. */
  CHECKING = 'checking',
  /** At least one lane checked, but minimum coverage not met. */
  PARTIAL = 'partial',
  /** All required lanes verified, no adverse signals. Decision-ready. */
  DECISION_GRADE = 'decision_grade',
  /** At least one lane returned ADVERSE evidence. */
  BLOCKED = 'blocked',
  /** Previously decision-grade but freshness expired. */
  DEGRADED = 'degraded',
}

// ─── Proof Availability ───────────────────────────────────────────
// What proof artifacts can be exported.

export enum ProofAvailability {
  /** No verified lanes. No proof available yet. */
  NONE = 'none',
  /** At least one verified lane. Partial proof only. */
  PARTIAL = 'partial',
  /** All decision-grade requirements met. Full proof available. */
  DECISION_GRADE = 'decision_grade',
}

// ─── Decision Grade State ─────────────────────────────────────────
// The calibrated output of a decision-grade evaluation.

export enum DecisionGradeState {
  /** Decision grade not yet reached. */
  NOT_REACHED = 'not_reached',
  /** All required lanes clear. No adverse signals. */
  CLEAR = 'clear',
  /** One or more lanes have review-required flags but no adverse evidence. */
  CONDITIONAL = 'conditional',
  /** Explicit adverse evidence detected. */
  BLOCKED = 'blocked',
}

// ─── Freshness Class ──────────────────────────────────────────────
// How fresh a lane's data is relative to its TTL.

export enum FreshnessClass {
  /** Checked within TTL window. */
  CURRENT = 'current',
  /** Within 2× TTL — still usable but approaching expiry. */
  AGING = 'aging',
  /** Beyond TTL. Evidence exists but requires refresh. NOT a blocker by itself. */
  STALE = 'stale',
  /** Never checked or check failed completely. */
  UNKNOWN = 'unknown',
}

// ─── User-Facing Label Map ────────────────────────────────────────
// These labels reflect SYSTEM state, not user judgment.
// Forbidden labels: "Blocked", "Failed", "Unavailable", "Needs Attention"

export const SOURCE_STATUS_LABELS: Record<SourceStatus, string> = {
  [SourceStatus.NOT_CHECKED]:    'Source not yet checked in this run',
  [SourceStatus.IN_PROGRESS]:    'Waiting for source response',
  [SourceStatus.VERIFIED]:       'Verified',
  [SourceStatus.STALE]:          'Previously verified — refresh recommended',
  [SourceStatus.UNAVAILABLE]:    'Source temporarily unreachable',
  [SourceStatus.ACCESS_REQUIRED]:'Institutional access required',
  [SourceStatus.REVIEW_REQUIRED]:'Under manual review',
  [SourceStatus.ADVERSE]:        'Adverse finding — action required',
};

export const READINESS_POSTURE_LABELS: Record<ReadinessPosture, string> = {
  [ReadinessPosture.UNCHECKED]:      'Not yet checked',
  [ReadinessPosture.CHECKING]:       'Verification in progress',
  [ReadinessPosture.PARTIAL]:        'Partial coverage',
  [ReadinessPosture.DECISION_GRADE]: 'Decision-ready',
  [ReadinessPosture.BLOCKED]:        'Adverse finding present',
  [ReadinessPosture.DEGRADED]:       'Refresh required',
};
