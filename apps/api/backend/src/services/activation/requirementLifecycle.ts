/**
 * ACT-1.3 — the application-linked activation requirement lifecycle.
 *
 * Pure: the state machine, the "resolved" set, and the qualified-start
 * predicate. No I/O. This is the single source of truth for how a requirement
 * may move and when an application is start-ready — the persistence service and
 * both persona views read these functions so they never disagree.
 *
 * Doctrine (Godmode product laws): unknown is not adverse. `blocked` means a
 * genuine blocker exists; `not_started`/`requested`/`under_review` are open
 * work, not failures. Only its own specified evidence/action — or an audited
 * waiver — can resolve a requirement; resolving one never resolves another.
 */

export type ActivationRequirementStatus =
  | 'not_started'
  | 'requested'
  | 'submitted'
  | 'under_review'
  | 'met'
  | 'waived'
  | 'not_applicable'
  | 'blocked'
  | 'expired';

export type ActivationRequirementNecessity = 'required' | 'preferred';
export type ActivationRequirementCategory = 'evidence' | 'policy' | 'onboarding' | 'contract' | 'manual_review';
export type ActivationRequirementOwner = 'clinician' | 'employer' | 'both' | 'system';

/** A requirement counts as satisfied for start when it is in one of these states. */
const RESOLVED: ReadonlySet<ActivationRequirementStatus> = new Set(['met', 'waived', 'not_applicable']);

export function isRequirementResolved(status: ActivationRequirementStatus): boolean {
  return RESOLVED.has(status);
}

/** Allowed transitions. A move not listed here is rejected by the service. */
const TRANSITIONS: Readonly<Record<ActivationRequirementStatus, readonly ActivationRequirementStatus[]>> = {
  not_started: ['requested', 'submitted', 'waived', 'not_applicable', 'blocked'],
  requested: ['submitted', 'waived', 'not_applicable', 'blocked', 'expired'],
  submitted: ['under_review', 'met', 'requested', 'blocked'],
  under_review: ['met', 'requested', 'waived', 'blocked'],
  blocked: ['requested', 'submitted', 'waived', 'not_applicable'],
  expired: ['requested', 'submitted'],
  // Resolved states are stable, except `met` can lapse to `expired` when the
  // underlying evidence's freshness horizon passes.
  met: ['expired'],
  waived: [],
  not_applicable: [],
};

export function canTransition(from: ActivationRequirementStatus, to: ActivationRequirementStatus): boolean {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}

export interface RequirementView {
  readonly id: string;
  readonly necessity: ActivationRequirementNecessity;
  readonly status: ActivationRequirementStatus;
}

export interface ActivationReadiness {
  /** True only when every REQUIRED requirement is resolved. Preferred ones never block. */
  readonly startReady: boolean;
  /** The required requirements still open — the exact blockers, in input order. */
  readonly blocking: readonly RequirementView[];
  /** A required requirement in an explicit `blocked` state (a real blocker, distinct from open work). */
  readonly hasHardBlocker: boolean;
}

/**
 * The qualified-start predicate. An application is start-ready only when every
 * REQUIRED requirement is resolved (met/waived/not_applicable). Preferred
 * requirements never block. This is a necessary condition, not sufficient — an
 * authorized employer still records the explicit start-ready decision (ACT-1.4).
 */
export function deriveActivationReadiness(requirements: readonly RequirementView[]): ActivationReadiness {
  const required = requirements.filter((r) => r.necessity === 'required');
  const blocking = required.filter((r) => !isRequirementResolved(r.status));
  return {
    startReady: blocking.length === 0,
    blocking,
    hasHardBlocker: blocking.some((r) => r.status === 'blocked'),
  };
}
