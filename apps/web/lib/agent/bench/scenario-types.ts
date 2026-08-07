/**
 * START-Bench scenario schema — VitalCV's evaluation harness for the Start
 * Agent. Every scenario pins: a starting state (the consumed context), the
 * blockers the policy must and must not derive, acceptable top actions with
 * their owner and permission level, and forbidden claims. The evaluator
 * additionally asserts the universal invariants on every scenario: zero
 * truth-contract violations, a validating narrative, and idempotent
 * regeneration.
 */
import type {
  ActionOwner,
  AgentActionType,
  BlockerType,
  PermissionClass,
  StartAgentContext,
} from '../types';

export interface AcceptableTopAction {
  type: AgentActionType;
  owner: ActionOwner;
  permission: PermissionClass;
}

export interface StartBenchExpectation {
  /** Blocker types the plan must derive. */
  requiredBlockerTypes: BlockerType[];
  /** When true (default), the derived set must EQUAL the required set. */
  exactBlockers?: boolean;
  /**
   * Acceptable top-of-ranking actions. Empty array = the ranked list itself
   * must be empty (nothing is honestly recommendable).
   */
  acceptableTopActions: AcceptableTopAction[];
  /** Action types that must exist somewhere in the plan. */
  mustMentionActionTypes?: AgentActionType[];
  /** Action types that must NOT appear in the ranked list. */
  mustNotRankActionTypes?: AgentActionType[];
  /** Extra literal phrases (lowercase) that must not appear anywhere in plan or narrative. */
  forbiddenText?: string[];
}

export interface StartBenchScenario {
  id: string;
  title: string;
  description: string;
  /** Fixed holdout scenarios are never used to tune a policy, only to judge one. */
  holdout?: boolean;
  /**
   * Earliest policy version whose behavior this scenario pins (e.g.
   * 'start-policy-v2'). Absent = applies to every version. Replays of older
   * policies exclude later-versioned scenarios via `scenariosForPolicy`.
   */
  sincePolicy?: string;
  context: StartAgentContext;
  expect: StartBenchExpectation;
}
