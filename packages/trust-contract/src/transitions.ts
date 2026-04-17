/**
 * Trust Contract — Valid State Transitions
 * wave-120: Truth Engine Enforcement
 *
 * Defines which SourceStatus → SourceStatus transitions are legal.
 * Illegal transitions are a system error — not a user state.
 */

import { SourceStatus, ReadinessPosture } from './enums';

// ─── Source Status Transitions ────────────────────────────────────

type StatusTransitionMap = Partial<Record<SourceStatus, SourceStatus[]>>;

export const VALID_SOURCE_STATUS_TRANSITIONS: StatusTransitionMap = {
  [SourceStatus.NOT_CHECKED]: [
    SourceStatus.IN_PROGRESS,
    SourceStatus.UNAVAILABLE,
    SourceStatus.ACCESS_REQUIRED,
  ],
  [SourceStatus.IN_PROGRESS]: [
    SourceStatus.VERIFIED,
    SourceStatus.UNAVAILABLE,
    SourceStatus.REVIEW_REQUIRED,
    SourceStatus.ADVERSE,
    SourceStatus.ACCESS_REQUIRED,
  ],
  [SourceStatus.VERIFIED]: [
    SourceStatus.STALE,      // on TTL expiry
    SourceStatus.ADVERSE,    // new adverse finding on re-check
    SourceStatus.IN_PROGRESS, // re-check initiated
  ],
  [SourceStatus.STALE]: [
    SourceStatus.IN_PROGRESS, // re-check
    SourceStatus.ADVERSE,     // adversity found during re-check
  ],
  [SourceStatus.UNAVAILABLE]: [
    SourceStatus.IN_PROGRESS, // retry
  ],
  [SourceStatus.ACCESS_REQUIRED]: [
    SourceStatus.IN_PROGRESS, // credentials configured, retry
  ],
  [SourceStatus.REVIEW_REQUIRED]: [
    SourceStatus.VERIFIED,    // review passed
    SourceStatus.ADVERSE,     // review found adverse
  ],
  [SourceStatus.ADVERSE]: [
    SourceStatus.IN_PROGRESS, // appeal / correction flow initiated
  ],
};

export function isValidStatusTransition(from: SourceStatus, to: SourceStatus): boolean {
  const allowed = VALID_SOURCE_STATUS_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

// ─── Readiness Posture Transitions ────────────────────────────────

type PostureTransitionMap = Partial<Record<ReadinessPosture, ReadinessPosture[]>>;

export const VALID_POSTURE_TRANSITIONS: PostureTransitionMap = {
  [ReadinessPosture.UNCHECKED]: [
    ReadinessPosture.CHECKING,
    ReadinessPosture.PARTIAL,
  ],
  [ReadinessPosture.CHECKING]: [
    ReadinessPosture.PARTIAL,
    ReadinessPosture.DECISION_GRADE,
    ReadinessPosture.BLOCKED,
  ],
  [ReadinessPosture.PARTIAL]: [
    ReadinessPosture.CHECKING,
    ReadinessPosture.DECISION_GRADE,
    ReadinessPosture.BLOCKED,
    ReadinessPosture.DEGRADED,
  ],
  [ReadinessPosture.DECISION_GRADE]: [
    ReadinessPosture.DEGRADED,    // on TTL expiry
    ReadinessPosture.BLOCKED,     // adverse finding on re-check
    ReadinessPosture.CHECKING,    // re-check initiated
  ],
  [ReadinessPosture.DEGRADED]: [
    ReadinessPosture.CHECKING,    // re-check initiated
    ReadinessPosture.BLOCKED,     // adverse on re-check
  ],
  [ReadinessPosture.BLOCKED]: [
    ReadinessPosture.CHECKING,    // appeal / correction in progress
  ],
};

export function isValidPostureTransition(from: ReadinessPosture, to: ReadinessPosture): boolean {
  const allowed = VALID_POSTURE_TRANSITIONS[from] ?? [];
  return (from === to) || allowed.includes(to); // no-op transitions are always valid
}
