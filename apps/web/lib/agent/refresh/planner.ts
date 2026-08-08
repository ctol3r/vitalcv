/**
 * A2.4 — scheduled source-refresh planning.
 *
 * Decides which lanes a scheduled tick WOULD refresh, in priority order,
 * subject to five gates. It does not refresh anything: A2.4 is still shadow,
 * and background Level-2 execution is A2.5. The output is a plan plus the
 * budget it would have spent, which is exactly what the "no budget breach in
 * shadow" gate needs to be checkable before anything fires.
 *
 * The gates, in order, each producing a NAMED skip reason rather than
 * silence — an operator looking at a tick that refreshed nothing has to be
 * able to tell "everything was fresh" from "the source is down" from "we ran
 * out of budget":
 *
 *   1. relevance — is this lane worth reading for this clinician at all?
 *   2. cadence — has enough time passed for another read to tell us anything?
 *   3. source health — is the source answering?
 *   4. failure pause — has this lane already failed repeatedly?
 *   5. budget — is there quota left this window?
 *
 * Ordering matters. Budget is checked LAST so a lane that would have been
 * skipped for a free reason never consumes quota, and so the budget report
 * reflects work we actually wanted to do.
 */
import { REPEATED_FAILURE_THRESHOLD } from '../policy/derive';
import type { SourceObservationState, StartAgentContext } from '../types';
import { cadenceForLane, cadenceSatisfied, type LaneCadence } from './cadence';
import { createRefreshBudget, type RefreshBudget } from './budget';

export const REFRESH_SKIP_REASONS = [
  'not_relevant',
  'cadence_not_elapsed',
  'no_known_cadence',
  'source_unavailable',
  'paused_repeated_failure',
  'budget_exhausted',
  'rate_limited',
] as const;
export type RefreshSkipReason = (typeof REFRESH_SKIP_REASONS)[number];

export interface PlannedRefresh {
  laneId: string;
  sourceId: string;
  /** Why this lane is worth reading now. */
  because: 'required_for_active_role' | 'evidence_aging' | 'never_observed';
  requiredForDecisionGrade: boolean;
}

export interface SkippedRefresh {
  laneId: string;
  reason: RefreshSkipReason;
  detail: string;
}

export interface RefreshPlan {
  planned: PlannedRefresh[];
  skipped: SkippedRefresh[];
  /** What a live tick would have spent, per source. */
  budgetSpend: Record<string, { used: number; remaining: number; nearLimit: boolean }>;
}

export interface RefreshPlanInput {
  context: StartAgentContext;
  now: string;
  /** Lane health, as the source-health snapshots report it. Absent = unknown. */
  laneHealth?: Record<string, 'LIVE' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN' | 'RATE_LIMITED'>;
  /** Injected so a tick can share one budget across all its subjects. */
  budget?: RefreshBudget;
}

/**
 * Statuses worth re-reading. `current` is excluded — re-reading something
 * already current is the definition of load without information. `not_found`
 * is excluded too: the source was asked and answered, and that answer is a
 * finding, not a gap to keep poking at.
 */
const REFRESHABLE: ReadonlySet<SourceObservationState['status']> = new Set([
  'stale',
  'invalid',
  'not_checked',
  'pending',
]);

/** Lanes an active role actually requires, by lane id. */
function requiredLaneIds(context: StartAgentContext): Set<string> {
  const required = new Set<string>();
  if (!context.role) return required;
  const active =
    context.role.applicationState === 'in_progress' ||
    context.role.applicationState === 'submitted';
  if (!active) return required;
  for (const requirement of context.role.requirements) {
    if (requirement.kind === 'source_lane' && requirement.laneId && requirement.satisfied !== true) {
      required.add(requirement.laneId);
    }
  }
  return required;
}

/** Lanes paused by A1's repeated-failure rule. One retry policy, not two. */
function pausedLaneIds(context: StartAgentContext): Set<string> {
  const paused = new Set<string>();
  for (const entry of context.actionHistory) {
    if (entry.outcome !== 'failed') continue;
    if ((entry.failureCount ?? 1) < REPEATED_FAILURE_THRESHOLD) continue;
    if (entry.type === 'refresh_source_observation') paused.add(entry.actionId);
  }
  return paused;
}

export function planScheduledRefreshes(input: RefreshPlanInput): RefreshPlan {
  const { context, now } = input;
  const budget = input.budget ?? createRefreshBudget();
  const required = requiredLaneIds(context);
  const paused = pausedLaneIds(context);

  const planned: PlannedRefresh[] = [];
  const skipped: SkippedRefresh[] = [];

  // Deterministic order, and required-for-an-active-role lanes get first
  // claim on a scarce budget: work that blocks a start outranks keeping a
  // stale-but-unneeded lane tidy.
  const candidates = [...context.observations].sort((a, b) => {
    const aRequired = required.has(a.laneId) ? 0 : 1;
    const bRequired = required.has(b.laneId) ? 0 : 1;
    if (aRequired !== bRequired) return aRequired - bRequired;
    return a.laneId < b.laneId ? -1 : a.laneId > b.laneId ? 1 : 0;
  });

  for (const lane of candidates) {
    const skip = (reason: RefreshSkipReason, detail: string) =>
      skipped.push({ laneId: lane.laneId, reason, detail });

    // 1. Relevance.
    const isRequired = required.has(lane.laneId);
    if (!isRequired && !REFRESHABLE.has(lane.status)) {
      skip('not_relevant', `status ${lane.status} needs no re-read and no active role requires it`);
      continue;
    }

    // 2. Cadence — from SOURCE_REGISTRY, the one table A2 commits to.
    const cadence: LaneCadence | null = cadenceForLane(lane.laneId);
    if (!cadence) {
      // No default is invented. Asserting how often an unknown authority
      // changes is the same class of error as inventing an expiry date.
      skip('no_known_cadence', `no registry cadence is declared for ${lane.laneId}`);
      continue;
    }
    if (!cadenceSatisfied({ cadence, observedAt: lane.observedAt, now })) {
      skip('cadence_not_elapsed', `${cadence.sourceId} publishes no faster than its declared cadence`);
      continue;
    }

    // 3. Source health — defer rather than retry into a wall.
    const health = input.laneHealth?.[lane.laneId] ?? input.laneHealth?.[cadence.sourceId];
    if (health === 'UNAVAILABLE' || health === 'RATE_LIMITED') {
      skip('source_unavailable', `${cadence.sourceId} is reporting ${health}`);
      continue;
    }

    // 4. Failure pause — A1's threshold, not a second retry policy.
    if (paused.has(`refresh:${lane.laneId}`) || paused.has(lane.laneId)) {
      skip('paused_repeated_failure', 'this lane is paused after repeated failures');
      continue;
    }

    // 5. Budget, last, so nothing skipped for a free reason spends quota.
    const decision = budget.reserve(cadence.sourceId, now);
    if (!decision.allowed) {
      skip(
        decision.reason,
        decision.retryAfterMs
          ? `${cadence.sourceId} asked us to wait ${decision.retryAfterMs}ms`
          : `${cadence.sourceId} budget is spent for this window`,
      );
      continue;
    }

    planned.push({
      laneId: lane.laneId,
      sourceId: cadence.sourceId,
      because: isRequired
        ? 'required_for_active_role'
        : lane.observedAt
          ? 'evidence_aging'
          : 'never_observed',
      requiredForDecisionGrade: cadence.requiredForDecisionGrade,
    });
  }

  return { planned, skipped, budgetSpend: budget.spend() };
}
