/**
 * Trust Contract — Hard Gating Rules
 * wave-120: Truth Engine Enforcement
 *
 * Score, proof, and display gating.
 * RULE: no score before proof. No proof before receipt. No blocked without adverse.
 */

import { SourceStatus, ReadinessPosture, ProofAvailability, FreshnessClass } from './enums';

// ─── Lane snapshot (input to all gating functions) ────────────────

export interface LaneSnapshot {
  laneId: string;
  status: SourceStatus;
  checkedAt: number | null;  // unix ms — null = never checked
  freshnessWindowMs: number;
  hasReceipt: boolean;       // was a verifiable receipt issued?
  hasAdverseEvidence: boolean;
}

// ─── Score Gating ─────────────────────────────────────────────────

export interface ScoreGateResult {
  showScore: boolean;
  score: number | null;      // null = not computed, not shown
  reason: string;
}

const MIN_VERIFIED_LANES_FOR_SCORE = 1;

export function gateScore(
  lanes: LaneSnapshot[],
  rawScore: number | null
): ScoreGateResult {
  const verifiedCount = lanes.filter(l => l.status === SourceStatus.VERIFIED).length;

  if (verifiedCount === 0) {
    return {
      showScore: false,
      score: null,
      reason: 'Score unavailable — waiting for verified sources',
    };
  }

  if (verifiedCount < MIN_VERIFIED_LANES_FOR_SCORE) {
    return {
      showScore: false,
      score: null,
      reason: `Score requires at least ${MIN_VERIFIED_LANES_FOR_SCORE} verified lane(s). Currently: ${verifiedCount}`,
    };
  }

  if (rawScore === null) {
    return {
      showScore: false,
      score: null,
      reason: 'Score not yet computed',
    };
  }

  return {
    showScore: true,
    score: rawScore,
    reason: `Score based on ${verifiedCount} verified lane(s)`,
  };
}

// ─── Proof Gating ──────────────────────────────────────────────────

export interface ProofGateResult {
  availability: ProofAvailability;
  canDownload: boolean;
  label: string;
  ctaLabel: string;
  limitations: string[];
}

const DECISION_GRADE_REQUIRED_LANES = ['nppes_identity', 'oig_exclusions', 'state_license'];

export function gateProof(lanes: LaneSnapshot[]): ProofGateResult {
  const laneMap = new Map(lanes.map(l => [l.laneId, l]));
  const verifiedWithReceipt = lanes.filter(l =>
    l.status === SourceStatus.VERIFIED && l.hasReceipt
  );
  const limitations: string[] = [];

  // Collect non-verified lanes as explicit limitations
  for (const lane of lanes) {
    if (lane.status !== SourceStatus.VERIFIED) {
      limitations.push(`${lane.laneId}: ${SOURCE_STATUS_LIMITATION[lane.status]}`);
    }
  }

  // No receipts at all
  if (verifiedWithReceipt.length === 0) {
    return {
      availability: ProofAvailability.NONE,
      canDownload: false,
      label: 'No proof available',
      ctaLabel: 'Proof available once at least one source is verified',
      limitations,
    };
  }

  // Check decision-grade threshold
  const allDecisionMet = DECISION_GRADE_REQUIRED_LANES.every(required => {
    const lane = laneMap.get(required);
    return lane?.status === SourceStatus.VERIFIED && lane.hasReceipt;
  });

  if (allDecisionMet) {
    return {
      availability: ProofAvailability.DECISION_GRADE,
      canDownload: true,
      label: 'Decision-Grade Proof Pack',
      ctaLabel: 'Download Decision-Grade Proof Pack',
      limitations,
    };
  }

  return {
    availability: ProofAvailability.PARTIAL,
    canDownload: true,
    label: 'Partial Proof Pack',
    ctaLabel: 'Download Partial Proof Pack',
    limitations,
  };
}

// ─── Blocker Gating ────────────────────────────────────────────────

export interface BlockerGateResult {
  isBlocked: boolean;
  blockedLanes: string[];
  pendingLanes: string[];    // system state — not clinician state
  reason: string;
}

export function gateBlockers(lanes: LaneSnapshot[]): BlockerGateResult {
  const blockedLanes = lanes
    .filter(l => l.status === SourceStatus.ADVERSE)
    .map(l => l.laneId);

  const pendingLanes = lanes
    .filter(l => [
      SourceStatus.NOT_CHECKED,
      SourceStatus.IN_PROGRESS,
      SourceStatus.UNAVAILABLE,
      SourceStatus.ACCESS_REQUIRED,
    ].includes(l.status))
    .map(l => l.laneId);

  return {
    isBlocked: blockedLanes.length > 0,
    blockedLanes,
    pendingLanes,
    reason: blockedLanes.length > 0
      ? `Adverse finding on: ${blockedLanes.join(', ')}`
      : 'No adverse findings',
  };
}

// ─── Readiness Posture Derivation ─────────────────────────────────

export function deriveReadinessPosture(lanes: LaneSnapshot[]): ReadinessPosture {
  if (lanes.length === 0) return ReadinessPosture.UNCHECKED;

  const hasAdverse = lanes.some(l => l.status === SourceStatus.ADVERSE);
  if (hasAdverse) return ReadinessPosture.BLOCKED;

  const allUnchecked = lanes.every(l =>
    l.status === SourceStatus.NOT_CHECKED
  );
  if (allUnchecked) return ReadinessPosture.UNCHECKED;

  const anyInProgress = lanes.some(l => l.status === SourceStatus.IN_PROGRESS);
  if (anyInProgress) return ReadinessPosture.CHECKING;

  const verifiedLanes = lanes.filter(l => l.status === SourceStatus.VERIFIED);
  const allRequiredVerified = DECISION_GRADE_REQUIRED_LANES.every(req =>
    verifiedLanes.some(l => l.laneId === req)
  );

  const hasStale = lanes.some(l => l.status === SourceStatus.STALE);
  if (allRequiredVerified && hasStale) return ReadinessPosture.DEGRADED;
  if (allRequiredVerified) return ReadinessPosture.DECISION_GRADE;

  return ReadinessPosture.PARTIAL;
}

// ─── Helpers ──────────────────────────────────────────────────────

const SOURCE_STATUS_LIMITATION: Record<SourceStatus, string> = {
  [SourceStatus.NOT_CHECKED]:    'not yet checked',
  [SourceStatus.IN_PROGRESS]:    'check in progress',
  [SourceStatus.VERIFIED]:       'verified',
  [SourceStatus.STALE]:          'stale — refresh required',
  [SourceStatus.UNAVAILABLE]:    'source temporarily unreachable',
  [SourceStatus.ACCESS_REQUIRED]:'institutional access required',
  [SourceStatus.REVIEW_REQUIRED]:'under manual review',
  [SourceStatus.ADVERSE]:        'adverse finding',
};

// Re-export for convenience
export { SOURCE_STATUS_LABELS, READINESS_POSTURE_LABELS } from './enums';
