/**
 * A2.2 — `PlanDelta`: what changed about what this clinician should do.
 *
 * This is the PLAN-level layer. It is complementary to, and must not
 * duplicate, the existing fact-level detectors (`watchtowerEngine`'s 14 delta
 * types, `drift-engine`). Those answer *what changed in the world*; this
 * answers *what changed about what this clinician should do*. A license
 * status flipping is a fact delta; "your top next action changed from
 * refreshing a lane to waiting on the hospital" is a plan delta. A fact delta
 * is a trigger for a run; a plan delta is what a run produces.
 *
 * Materiality is the load-bearing field. Most ticks produce deltas that must
 * be recorded and must never reach a human — `observation_refreshed_no_change`
 * is separated out precisely because it is the most common thing that will
 * ever happen here.
 */
import type { ActionOwner } from '../types';
import type { DecisionProjection, ProjectedAction, ProjectedBlocker } from './projection';

export const PLAN_DELTA_KINDS = [
  'blocker_opened',
  'blocker_cleared',
  'action_became_executable',
  'action_became_blocked',
  'top_action_changed',
  'external_state_changed',
  'observation_refreshed_no_change',
] as const;
export type PlanDeltaKind = (typeof PLAN_DELTA_KINDS)[number];

export interface PlanDelta {
  kind: PlanDeltaKind;
  /**
   * Whether this is worth a human's attention. Recording is unconditional;
   * materiality is what a notification layer would filter on.
   */
  material: boolean;
  /** Who controls the thing that changed, when that is meaningful. */
  owner?: ActionOwner;
  /** The blocker id, action id, or lane id this delta is about. */
  ref: string;
  /** One honest sentence. Never a claim beyond what the projection supports. */
  detail: string;
}

export type DiffOutcome =
  | { comparable: true; deltas: PlanDelta[]; materialCount: number }
  | {
      comparable: false;
      reason: 'completeness_mismatch' | 'no_prior_run' | 'projection_version_mismatch';
      deltas: [];
      materialCount: 0;
    };

const NOT_COMPARABLE = (reason: Exclude<DiffOutcome['comparable'], true> extends never
  ? never
  : 'completeness_mismatch' | 'no_prior_run' | 'projection_version_mismatch'): DiffOutcome => ({
  comparable: false,
  reason,
  deltas: [],
  materialCount: 0,
});

function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/**
 * A top-action change is material only when the new top differs in TYPE or
 * OWNER. Re-ranking between two actions of the same kind and the same owner
 * is churn, not news — telling someone "your next step changed" when it is
 * the same sort of step owned by the same party is the fastest way to teach
 * them to ignore us.
 */
function topActionMateriality(
  prior: DecisionProjection['topAction'],
  next: DecisionProjection['topAction'],
): boolean {
  if (!prior || !next) return true;
  return prior.type !== next.type || prior.owner !== next.owner;
}

function describeBlocker(blocker: ProjectedBlocker): string {
  return `${blocker.type.replace(/_/g, ' ')} (controlled by ${blocker.controlledBy.replace(/_/g, ' ')})`;
}

function describeAction(action: ProjectedAction): string {
  return `${action.type.replace(/_/g, ' ')} (${action.owner.replace(/_/g, ' ')})`;
}

/**
 * Diff two decision projections.
 *
 * Refuses outright when the plans were built by actors who could see
 * different things: diffing a reduced plan against a full one reports the gap
 * between two viewpoints as though it were a change in the world. A refusal
 * here is a suppressed delta, never a fabricated one.
 */
export function diffProjections(
  prior: DecisionProjection | null,
  next: DecisionProjection,
): DiffOutcome {
  // No prior is NOT "no changes detected". A first run for a subject has
  // nothing to compare against, and saying "nothing changed" would be the
  // same error as an empty monitoring plan reporting all-clear.
  if (!prior) return NOT_COMPARABLE('no_prior_run');
  if (prior.version !== next.version) return NOT_COMPARABLE('projection_version_mismatch');
  if (prior.completeness !== next.completeness) return NOT_COMPARABLE('completeness_mismatch');

  const deltas: PlanDelta[] = [];

  // --- Blockers -----------------------------------------------------------
  const priorBlockers = indexById(prior.blockers);
  const nextBlockers = indexById(next.blockers);

  for (const blocker of next.blockers) {
    if (priorBlockers.has(blocker.id)) continue;
    deltas.push({
      kind: 'blocker_opened',
      material: true,
      owner: blocker.controlledBy,
      ref: blocker.id,
      detail: `A new blocker appeared: ${describeBlocker(blocker)}.`,
    });
  }
  for (const blocker of prior.blockers) {
    if (nextBlockers.has(blocker.id)) continue;
    deltas.push({
      kind: 'blocker_cleared',
      material: true,
      owner: blocker.controlledBy,
      ref: blocker.id,
      detail: `A blocker cleared: ${describeBlocker(blocker)}.`,
    });
  }

  // --- Action executability ----------------------------------------------
  const priorActions = indexById(prior.actions);
  for (const action of next.actions) {
    const before = priorActions.get(action.id);
    if (!before) continue; // a wholly new action is reported via its blocker
    if (before.executable === action.executable) continue;
    deltas.push({
      kind: action.executable ? 'action_became_executable' : 'action_became_blocked',
      material: true,
      owner: action.owner,
      ref: action.id,
      detail: action.executable
        ? `${describeAction(action)} can now run (was ${before.status.replace(/_/g, ' ')}).`
        : `${describeAction(action)} can no longer run (now ${action.status.replace(/_/g, ' ')}).`,
    });
  }

  // --- Top action ---------------------------------------------------------
  const priorTop = prior.topAction?.id ?? null;
  const nextTop = next.topAction?.id ?? null;
  if (priorTop !== nextTop) {
    deltas.push({
      kind: 'top_action_changed',
      material: topActionMateriality(prior.topAction, next.topAction),
      ...(next.topAction ? { owner: next.topAction.owner } : {}),
      ref: nextTop ?? priorTop ?? 'none',
      detail: next.topAction
        ? `The most useful next step is now ${describeAction({
            ...next.topAction,
            permission: 'observe',
            status: 'ready',
            executable: true,
          } as ProjectedAction)}.`
        : 'There is no longer a recommendable next step.',
    });
  }

  // --- External state -----------------------------------------------------
  // Employer review is the case the spec calls out: `shared → opened` is
  // recorded but not material (opening is not reviewing, and nothing the
  // clinician can act on has changed), while reaching `reviewed` is.
  if (prior.external.employerReview !== next.external.employerReview) {
    const to = next.external.employerReview ?? 'absent';
    deltas.push({
      kind: 'external_state_changed',
      material: to === 'reviewed',
      owner: 'employer',
      ref: 'employer_review',
      detail: `Employer review state moved from ${prior.external.employerReview ?? 'absent'} to ${to}.`,
    });
  }
  if (prior.external.applicationState !== next.external.applicationState) {
    deltas.push({
      kind: 'external_state_changed',
      material: true,
      ref: 'application_state',
      detail: `Application state moved from ${prior.external.applicationState ?? 'absent'} to ${next.external.applicationState ?? 'absent'}.`,
    });
  }

  // --- Observations re-read with no change --------------------------------
  // The most common outcome by far, and the reason this kind exists as its
  // own non-material entry rather than as silence.
  const priorObservations = new Map(prior.observations.map((o) => [o.laneId, o]));
  for (const observation of next.observations) {
    const before = priorObservations.get(observation.laneId);
    if (!before) continue;
    if (before.status !== observation.status) continue;
    if (!observation.observedAt || !before.observedAt) continue;
    if (observation.observedAt === before.observedAt) continue;
    deltas.push({
      kind: 'observation_refreshed_no_change',
      material: false,
      owner: 'source',
      ref: observation.laneId,
      detail: `${observation.laneId} was read again and still reports ${observation.status}.`,
    });
  }

  return {
    comparable: true,
    deltas,
    materialCount: deltas.filter((d) => d.material).length,
  };
}
