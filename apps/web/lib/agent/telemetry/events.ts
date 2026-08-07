/**
 * Start Agent outcome-event vocabulary.
 *
 * The names are enforced here, not in the database, so replay/analysis code
 * has one import to trust. Every action event connects
 *   plan version -> action -> owner -> outcome -> elapsed time
 * and (relatedKind, relatedRef) lets future hiring outcomes (application,
 * interview, offer, accepted offer, start) join the same chain before those
 * systems exist.
 */
export const AGENT_EVENT_TYPES = [
  'agent_plan_generated',
  'agent_action_presented',
  'agent_action_accepted',
  'agent_action_dismissed',
  'agent_action_completed',
  'agent_action_failed',
  'agent_action_blocked',
  'agent_human_override',
  'agent_plan_superseded',
] as const;
export type AgentEventType = (typeof AGENT_EVENT_TYPES)[number];

/** Forward foreign-reference kinds for downstream hiring outcomes. */
export const AGENT_RELATED_KINDS = [
  'application',
  'interview',
  'offer',
  'accepted_offer',
  'start',
] as const;
export type AgentRelatedKind = (typeof AGENT_RELATED_KINDS)[number];

export function isAgentEventType(value: string): value is AgentEventType {
  return (AGENT_EVENT_TYPES as readonly string[]).includes(value);
}
