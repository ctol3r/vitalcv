/**
 * start-policy-v1 — ranking stage.
 *
 * Explicit, versioned tier rules (highest value first):
 *
 *   1. resolves a blocker standing between the clinician and an ACTIVE
 *      application/start — even when the action is human-only, because the
 *      truthful top answer may be "the employer holds the next move";
 *   2. VitalCV can do it now without consent (owner vitalcv, observe/prepare);
 *   3. one quick clinician approval away (consent requests and consent-gated
 *      prepared work);
 *   4. unblocks downstream work (has dependents, or is an opportunity to
 *      pursue — the start path itself);
 *   5. informational (waits, pause notices, honest "nothing here" notes);
 *   6. optional enrichment.
 *
 * Ties break deterministically by (tier, action-type order, id). No clock,
 * no randomness.
 */
import { AGENT_ACTION_TYPES, type AgentAction } from '../types';

export const START_POLICY_RANKING_VERSION = 'start-policy-v1';

const RANKABLE = new Set<AgentAction['status']>(['ready', 'awaiting_consent', 'awaiting_external']);

const INFORMATIONAL_TYPES = new Set<AgentAction['type']>([
  'informational_note',
  'await_source_availability',
  'await_employer_decision',
  'await_institution_decision',
  'review_repeated_failure',
  'review_source_response',
]);

function typeOrder(type: AgentAction['type']): number {
  return AGENT_ACTION_TYPES.indexOf(type);
}

export interface RankInput {
  actions: AgentAction[];
  blockingApplication: Set<string>;
}

export interface RankResult {
  /** Same action objects, with rankTier/priority assigned. */
  actions: AgentAction[];
  rankedActionIds: string[];
}

function tierOf(action: AgentAction, input: RankInput, dependedOn: Set<string>): 1 | 2 | 3 | 4 | 5 | 6 {
  if (action.resolvesBlockerIds.some((id) => input.blockingApplication.has(id))) return 1;
  if (
    action.owner === 'vitalcv' &&
    (action.permission === 'observe' || action.permission === 'prepare') &&
    action.status === 'ready' &&
    !INFORMATIONAL_TYPES.has(action.type)
  ) {
    return 2;
  }
  if (action.permission === 'execute_with_consent' || action.type === 'request_consent') return 3;
  // verify_ownership structurally gates private holdings, sharing, and
  // applying — downstream value even before an explicit dependent exists.
  if (
    dependedOn.has(action.id) ||
    action.type === 'review_opportunity' ||
    action.type === 'verify_ownership'
  ) {
    return 4;
  }
  if (INFORMATIONAL_TYPES.has(action.type)) return 5;
  return 6;
}

export function rankActions(input: RankInput): RankResult {
  const dependedOn = new Set<string>();
  for (const action of input.actions) {
    for (const dep of action.dependencies) dependedOn.add(dep);
  }

  for (const action of input.actions) {
    action.rankTier = tierOf(action, input, dependedOn);
  }

  const byRank = (a: AgentAction, b: AgentAction): number =>
    a.rankTier - b.rankTier ||
    typeOrder(a.type) - typeOrder(b.type) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  const rankable = input.actions.filter((a) => RANKABLE.has(a.status)).sort(byRank);
  const unrankable = input.actions.filter((a) => !RANKABLE.has(a.status)).sort(byRank);

  let priority = 1;
  for (const action of [...rankable, ...unrankable]) {
    action.priority = priority;
    priority += 1;
  }

  return {
    actions: input.actions,
    rankedActionIds: rankable.map((a) => a.id),
  };
}
