/**
 * Minimum Friction — objective profile (MF-WAVE-01).
 *
 * The lexicographic objective from
 * docs/minimum-friction/MINIMUM_FRICTION_OPTIMIZATION_MODEL.md §3, applied to
 * candidate plans over an owner-filtered action space (§4).
 *
 * FOUNDER RULING (recorded on PR #1427, decision 2): `MINIMUM_ACTION_COUNT`
 * is an owner-filtered objective PROFILE, not a second optimizer. This module
 * therefore contains NO search, NO state-space exploration, and NO planning
 * engine — one exported profile filters and ranks candidate actions/plans for
 * the record owner. The deterministic BFS over action-state transitions is
 * owned by the (as-yet-unwritten) PTC optimizer; when it is written, this
 * profile parameterizes its objective. One optimizer, multiple objective
 * profiles.
 *
 * Validity is a GATE, not a term (OPTIMIZATION §1): a plan that violates a
 * hard constraint is invalid — not merely worse — and the profile refuses to
 * compare it at all. No lower-priority advantage can ever buy back a
 * violation.
 *
 * The three impact grades (deterministic / potential / AI-predicted) are kept
 * separate and never summed (OPTIMIZATION §5). In Demo-0 the deterministic
 * impact is FIXTURED — the compiled dependency index that would compute it is
 * NEW-PTC.
 *
 * PURE. No fetch, no DB, no clock, no randomness.
 */

import { compareFrictionVectors, type FrictionVector } from './frictionVector';

// ---------------------------------------------------------------------------
// Action model — structural mirror, not a new model
// ---------------------------------------------------------------------------

/**
 * Owner/permission discriminators mirroring the StartAgent `AgentAction`
 * (apps/web/lib/agent/types.ts), which already carries every field the
 * objective needs. This is a structural projection for the pure layer, NOT a
 * new action model — no new action type is required for MF v0.
 */
export type PlannableActionOwner = 'clinician' | 'vitalcv';
export type PlannableActionPermission =
  | 'observe'
  | 'prepare'
  | 'execute_with_consent';

export interface PlannableAction {
  readonly actionId: string;
  readonly owner: PlannableActionOwner;
  readonly permission: PlannableActionPermission;
  /**
   * DETERMINISTIC impact: requirements this action provably moves to
   * SATISFIED. Exact when computed from the compiled dependency index;
   * FIXTURED in Demo-0.
   */
  readonly deterministicallySatisfiesRequirementIds: readonly string[];
  /** Candidate conflicts this action resolves (held separately from impact). */
  readonly resolvesConflictCandidateIds: readonly string[];
  /** POTENTIAL impact: contingent on a source result not yet known. Never summed in. */
  readonly potentialRequirementIds: readonly string[];
  /** AI-PREDICTED impact: inference-suggested only; never counted as fact. */
  readonly aiPredictedRequirementIds: readonly string[];
}

/** The headline leverage number: deterministic impact only. */
export function deterministicLeverage(action: PlannableAction): number {
  return action.deterministicallySatisfiesRequirementIds.length;
}

/**
 * The action-space filter for minimum-clinician-action planning: actions the
 * record owner must personally perform. `owner === 'vitalcv'` work is safe
 * automatic work that costs the clinician nothing; `observe` requires nothing
 * of anyone.
 */
export function isClinicianAction(action: PlannableAction): boolean {
  return action.owner === 'clinician' && action.permission !== 'observe';
}

// ---------------------------------------------------------------------------
// Plans + validity gate
// ---------------------------------------------------------------------------

/**
 * The four benchmark zero-invariants (OPTIMIZATION §1 maps the eleven hard
 * constraints onto these). Any nonzero counter makes a plan INVALID.
 */
export interface ZeroInvariantCounters {
  readonly falseTruthPromotion: number;
  readonly unauthorizedDisclosure: number;
  readonly crossRecipientConsentReuse: number;
  readonly unknownToSatisfied: number;
}

export const ZERO_INVARIANTS: ZeroInvariantCounters = {
  falseTruthPromotion: 0,
  unauthorizedDisclosure: 0,
  crossRecipientConsentReuse: 0,
  unknownToSatisfied: 0,
};

export interface CandidatePlan {
  readonly planId: string;
  /** Plan order is execution order; the tiebreak reads actionIds in this order. */
  readonly actions: readonly PlannableAction[];
  /** Total friction of the plan. FIXTURED in Demo-0 (no optimizer exists). */
  readonly friction: FrictionVector;
  readonly invariantViolations: ZeroInvariantCounters;
}

/** A plan is valid iff every zero-invariant counter is exactly 0. */
export function isValidPlan(plan: CandidatePlan): boolean {
  const v = plan.invariantViolations;
  return (
    v.falseTruthPromotion === 0 &&
    v.unauthorizedDisclosure === 0 &&
    v.crossRecipientConsentReuse === 0 &&
    v.unknownToSatisfied === 0
  );
}

/** Clinician-required steps in a plan, per the owner filter. */
export function countClinicianActions(plan: CandidatePlan): number {
  return plan.actions.filter(isClinicianAction).length;
}

// ---------------------------------------------------------------------------
// The profile
// ---------------------------------------------------------------------------

/**
 * Compares two VALID plans: lexicographic over the friction vector
 * (frictionVector.ts order), then the stable action-id sequence, then planId.
 * Throws when handed an invalid plan — validity is a gate, and an API that
 * quietly ordered invalid plans would let one be selected.
 */
export function comparePlans(a: CandidatePlan, b: CandidatePlan): number {
  for (const plan of [a, b]) {
    if (!isValidPlan(plan)) {
      throw new Error(
        `Plan ${plan.planId} violates a zero-invariant and cannot be compared; ` +
          'validity is a gate, not a term.',
      );
    }
  }
  const byFriction = compareFrictionVectors(a.friction, b.friction);
  if (byFriction !== 0) return byFriction;

  const aIds = a.actions.map((action) => action.actionId);
  const bIds = b.actions.map((action) => action.actionId);
  const length = Math.min(aIds.length, bIds.length);
  for (let i = 0; i < length; i += 1) {
    const cmp = aIds[i]!.localeCompare(bIds[i]!);
    if (cmp !== 0) return cmp;
  }
  if (aIds.length !== bIds.length) return aIds.length - bIds.length;
  return a.planId.localeCompare(b.planId);
}

/**
 * Valid plans, best (least friction) first. Invalid plans are excluded before
 * any comparison — they can never place, however dominant their vector.
 * Deterministic: independent of input order.
 */
export function rankPlans(
  plans: readonly CandidatePlan[],
): readonly CandidatePlan[] {
  return plans.filter(isValidPlan).sort(comparePlans);
}

/**
 * The selected plan, or null when no valid plan exists. Null is a finding
 * ("no safe plan"), never an invitation to relax the gate.
 */
export function selectPlan(
  plans: readonly CandidatePlan[],
): CandidatePlan | null {
  const ranked = rankPlans(plans);
  return ranked.length > 0 ? ranked[0]! : null;
}

/**
 * THE objective profile — the single exported planning surface of Minimum
 * Friction. There is exactly one, so there is nothing to fork: a second
 * "engine" would have to appear here first, and this module refuses to grow
 * one.
 */
export interface ObjectiveProfile {
  /** The PTC objective this profile parameterizes. */
  readonly objective: 'MINIMUM_ACTION_COUNT';
  /** The record-owner action-space filter. */
  readonly ownerFilter: (action: PlannableAction) => boolean;
  readonly isValidPlan: (plan: CandidatePlan) => boolean;
  readonly comparePlans: (a: CandidatePlan, b: CandidatePlan) => number;
  readonly rankPlans: (
    plans: readonly CandidatePlan[],
  ) => readonly CandidatePlan[];
  readonly selectPlan: (plans: readonly CandidatePlan[]) => CandidatePlan | null;
}

export const MINIMUM_CLINICIAN_ACTIONS_PROFILE: ObjectiveProfile = {
  objective: 'MINIMUM_ACTION_COUNT',
  ownerFilter: isClinicianAction,
  isValidPlan,
  comparePlans,
  rankPlans,
  selectPlan,
};
