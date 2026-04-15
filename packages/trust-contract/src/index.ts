/**
 * VitalCV Trust Contract — Canonical State Semantics
 *
 * This package is the single source of truth for all state enums,
 * transition rules, and contradiction detectors. Every service in
 * the monorepo MUST import from here. Local duplicates are forbidden.
 */

// ── Source Status ──────────────────────────────────────────────────
// The status of a single primary-source check (OIG, NPPES, state board, etc.)

export enum SourceStatus {
  /** Check has not been attempted yet. */
  PENDING = 'pending',

  /** Check succeeded — data is fresh within TTL. */
  CHECKED = 'checked',

  /** Check succeeded previously but has exceeded its TTL. */
  STALE = 'stale',

  /** Check failed after retry exhaustion. Error class must be attached. */
  UNAVAILABLE = 'unavailable',

  /** Source requires authentication or credentials not yet configured. NOT a blocker. */
  ACCESS_REQUIRED = 'access_required',

  /** Source returned data that needs manual human review. NOT a blocker. */
  REVIEW_REQUIRED = 'review_required',

  /** Source returned explicit adverse evidence (exclusion, revocation, sanction). */
  BLOCKED_SIGNAL = 'blocked_signal',
}

// ── Readiness Posture ─────────────────────────────────────────────
// The aggregate posture derived from the union of all source lanes.

export enum ReadinessPosture {
  /** At least one source is actively being checked. */
  CHECKING = 'checking',

  /** Some sources checked, but minimum coverage threshold not met. */
  PARTIAL = 'partial',

  /** Minimum coverage met with no adverse signals. Ready for employer review. */
  DECISION_GRADE = 'decision_grade',

  /** At least one source returned BLOCKED_SIGNAL. */
  BLOCKED = 'blocked',

  /** All checked lanes have gone STALE. Evidence exists but is expired. */
  DEGRADED = 'degraded',
}

// ── Proof Availability ────────────────────────────────────────────
// Whether a cryptographic proof receipt can be generated for this entity.

export enum ProofAvailability {
  /** No proof receipt exists. */
  NONE = 'none',

  /** Proof exists but covers only a subset of required sources. */
  SNAPSHOT = 'snapshot',

  /** Proof covers all minimum sources but some are STALE. */
  PARTIAL = 'partial',

  /** Proof covers all minimum sources, all within TTL. */
  DECISION_GRADE = 'decision_grade',
}

// ── Transition Rules ──────────────────────────────────────────────
// LEGAL state transitions. Any transition not listed here is FORBIDDEN.

export const SOURCE_TRANSITIONS: Record<SourceStatus, SourceStatus[]> = {
  [SourceStatus.PENDING]: [
    SourceStatus.CHECKED,     // successful fetch
    SourceStatus.UNAVAILABLE, // retry exhaustion
    SourceStatus.ACCESS_REQUIRED, // auth needed
    SourceStatus.REVIEW_REQUIRED, // manual review needed
    SourceStatus.BLOCKED_SIGNAL, // explicit adverse evidence
  ],
  [SourceStatus.CHECKED]: [
    SourceStatus.STALE,       // TTL expired
  ],
  [SourceStatus.STALE]: [
    SourceStatus.CHECKED,     // re-fetch succeeded
    SourceStatus.UNAVAILABLE, // re-fetch failed after retries
  ],
  [SourceStatus.UNAVAILABLE]: [
    SourceStatus.CHECKED,     // manual retry succeeded
    SourceStatus.PENDING,     // queued for retry
  ],
  [SourceStatus.ACCESS_REQUIRED]: [
    SourceStatus.PENDING,     // credentials configured, re-queued
    SourceStatus.CHECKED,     // direct success after credential fix
  ],
  [SourceStatus.REVIEW_REQUIRED]: [
    SourceStatus.CHECKED,     // human approved the data
    SourceStatus.BLOCKED_SIGNAL, // human flagged as adverse
  ],
  [SourceStatus.BLOCKED_SIGNAL]: [
    SourceStatus.CHECKED,     // appeal succeeded, adverse evidence removed
  ],
};

// ── Contradiction Detectors ──────────────────────────────────────
// These functions throw if the system state violates core invariants.

export interface SourceLane {
  name: string;
  status: SourceStatus;
  checkedAt?: string | null;
  errorClass?: string | null;
}

export interface TrustStateSnapshot {
  lanes: SourceLane[];
  posture: ReadinessPosture;
  proofAvailability: ProofAvailability;
  readinessScore: number | null;
  blockerCount: number;
}

export class TrustContradictionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrustContradictionError';
  }
}

export function detectContradictions(state: TrustStateSnapshot): string[] {
  const errors: string[] = [];
  const laneNames = state.lanes.map(l => l.name);
  const laneMap = Object.fromEntries(state.lanes.map(l => [l.name, l]));

  // 1. BLOCKED posture requires at least one BLOCKED_SIGNAL lane
  if (state.posture === ReadinessPosture.BLOCKED) {
    const hasBlockedSignal = state.lanes.some(l => l.status === SourceStatus.BLOCKED_SIGNAL);
    if (!hasBlockedSignal) {
      errors.push(
        `BLOCKED posture declared but no lane has BLOCKED_SIGNAL. ` +
        `Current lanes: ${laneNames.join(', ')}`
      );
    }
  }

  // 2. BLOCKED_SIGNAL lane must result in BLOCKED posture
  const hasBlockedSignal = state.lanes.some(l => l.status === SourceStatus.BLOCKED_SIGNAL);
  if (hasBlockedSignal && state.posture !== ReadinessPosture.BLOCKED) {
    errors.push(
      `Lane has BLOCKED_SIGNAL but posture is ${state.posture}, expected BLOCKED. ` +
      `Offending lanes: ${state.lanes.filter(l => l.status === SourceStatus.BLOCKED_SIGNAL).map(l => l.name).join(', ')}`
    );
  }

  // 3. Score shown with 0 CHECKED lanes
  const checkedLanes = state.lanes.filter(l => l.status === SourceStatus.CHECKED);
  if (state.readinessScore !== null && state.readinessScore > 0 && checkedLanes.length === 0) {
    errors.push(
      `Readiness score is ${state.readinessScore} but zero lanes are CHECKED. ` +
      `Score must be 0 or null without evidence.`
    );
  }

  // 4. Proof enabled with 0 receipts (proof must be NONE)
  if (state.proofAvailability !== ProofAvailability.NONE && checkedLanes.length === 0) {
    errors.push(
      `Proof availability is ${state.proofAvailability} but zero lanes are CHECKED. ` +
      `Proof must be NONE without evidence.`
    );
  }

  // 5. UNAVAILABLE must include error class
  const unavailableLanes = state.lanes.filter(l => l.status === SourceStatus.UNAVAILABLE);
  for (const lane of unavailableLanes) {
    if (!lane.errorClass) {
      errors.push(
        `Lane "${lane.name}" is UNAVAILABLE but has no errorClass. ` +
        `UNAVAILABLE requires an error classification (e.g. "TIMEOUT", "HTTP_5xx", "AUTH_FAILURE").`
      );
    }
  }

  // 6. Blocker count must match real BLOCKED_SIGNAL count
  const realBlockerCount = state.lanes.filter(l => l.status === SourceStatus.BLOCKED_SIGNAL).length;
  if (state.blockerCount !== realBlockerCount) {
    errors.push(
      `Declared blockerCount is ${state.blockerCount} but only ${realBlockerCount} lane(s) have BLOCKED_SIGNAL. ` +
      `blockerCount must equal actual adverse evidence count.`
    );
  }

  // 7. CHECKING posture requires at least one PENDING lane
  if (state.posture === ReadinessPosture.CHECKING) {
    const hasPending = state.lanes.some(l => l.status === SourceStatus.PENDING);
    if (!hasPending) {
      errors.push(
        `CHECKING posture declared but no lane is PENDING. ` +
        `CHECKING requires at least one in-progress source check.`
      );
    }
  }

  // 8. DEGRADED posture requires all CHECKED lanes to be STALE (no fresh data)
  if (state.posture === ReadinessPosture.DEGRADED) {
    const hasFreshChecked = state.lanes.some(l => l.status === SourceStatus.CHECKED);
    if (hasFreshChecked) {
      errors.push(
        `DEGRADED posture declared but fresh CHECKED lanes exist. ` +
        `DEGRADED requires all previously-checked data to have expired.`
      );
    }
  }

  return errors;
}

export function enforceContradictions(state: TrustStateSnapshot): void {
  const errors = detectContradictions(state);
  if (errors.length > 0) {
    throw new TrustContradictionError(
      `Trust state contradiction detected:\n${errors.map(e => `  - ${e}`).join('\n')}`
    );
  }
}

// ── Posture Derivation ───────────────────────────────────────────
// Computes ReadinessPosture from a set of source lanes.

export function derivePosture(lanes: SourceLane[]): ReadinessPosture {
  const statuses = new Set(lanes.map(l => l.status));

  // BLOCKED: any lane has explicit adverse evidence
  if (statuses.has(SourceStatus.BLOCKED_SIGNAL)) {
    return ReadinessPosture.BLOCKED;
  }

  // CHECKING: at least one lane is still being fetched
  if (statuses.has(SourceStatus.PENDING) || statuses.has(SourceStatus.ACCESS_REQUIRED)) {
    return ReadinessPosture.CHECKING;
  }

  // DEGRADED: lanes exist but all are stale, none fresh
  if (statuses.has(SourceStatus.STALE) && !statuses.has(SourceStatus.CHECKED)) {
    return ReadinessPosture.DEGRADED;
  }

  // PARTIAL: some checked but minimum coverage not met
  // (Minimum coverage = 2 sources checked: NPPES + OIG)
  const checkedCount = lanes.filter(l => l.status === SourceStatus.CHECKED).length;
  if (checkedCount > 0 && checkedCount < 2) {
    return ReadinessPosture.PARTIAL;
  }

  // REVIEW_REQUIRED bumps to PARTIAL (not BLOCKED)
  if (statuses.has(SourceStatus.REVIEW_REQUIRED) && !statuses.has(SourceStatus.CHECKED)) {
    return ReadinessPosture.PARTIAL;
  }

  // DECISION_GRADE: minimum coverage met, no adverse signals
  if (checkedCount >= 2) {
    return ReadinessPosture.DECISION_GRADE;
  }

  // UNAVAILABLE with no checked lanes
  if (statuses.has(SourceStatus.UNAVAILABLE)) {
    return ReadinessPosture.PARTIAL;
  }

  // Default fallback
  return ReadinessPosture.CHECKING;
}

// ── Score Derivation ─────────────────────────────────────────────
// Score is 0 until minimum evidence threshold is met.

export function deriveScore(lanes: SourceLane[]): number {
  const checkedCount = lanes.filter(l => l.status === SourceStatus.CHECKED).length;

  if (checkedCount === 0) return 0;
  if (checkedCount < 2) return 0; // No score before minimum evidence

  // Score = percentage of CHECKED lanes out of total lanes
  const blockedCount = lanes.filter(l => l.status === SourceStatus.BLOCKED_SIGNAL).length;
  if (blockedCount > 0) return 0; // Any blocker zeros the score

  return Math.round((checkedCount / lanes.length) * 100);
}
export * from './auth-model';
export * from './trust-registry';
export * from './multi-issuer';
export * from './arbitration-engine';
export * from './explainability-engine';
