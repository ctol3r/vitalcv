/**
 * Automation / event engine (Wave 1300, C4)
 * ──────────────────────────────────────────────────────────────────────────
 * Configurable triggers → actions over the EXISTING platform event stream
 * (W900). Rules are declarative: a trigger event type, an optional condition,
 * and an action. Evaluation is PURE — it returns action DESCRIPTORS to be
 * carried out by the platform's existing delivery machinery. An automation can
 * never mutate source evidence, confer decision-grade, or change trust; it can
 * only describe notifications/routing in response to events that already
 * happened.
 */
import { PLATFORM_EVENT_TYPES, type PlatformEventType, type PlatformEvent } from '@/lib/platform-cloud/events';

export type AutomationActionType = 'notify' | 'route_to_review' | 'tag';

export interface AutomationAction {
  type: AutomationActionType;
  /** Free-form target (queue, channel, label) — never provider PII. */
  target: string;
}

export interface AutomationRule {
  ruleId: string;
  /** Event type that triggers this rule (must be a known platform event). */
  on: PlatformEventType;
  /**
   * Optional payload predicate, expressed declaratively as an equality on a
   * top-level payload key. Kept intentionally simple (no code execution).
   */
  whenPayloadEquals?: { key: string; value: string | number | boolean };
  action: AutomationAction;
}

export interface TriggeredAction {
  ruleId: string;
  action: AutomationAction;
  /** The subject the event concerned (carried through, never expanded to PII). */
  subjectKey: string;
}

function isKnownType(t: unknown): t is PlatformEventType {
  return typeof t === 'string' && (PLATFORM_EVENT_TYPES as readonly string[]).includes(t);
}

function conditionHolds(rule: AutomationRule, event: PlatformEvent): boolean {
  if (!rule.whenPayloadEquals) return true;
  const payload = event.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  return (payload as Record<string, unknown>)[rule.whenPayloadEquals.key] === rule.whenPayloadEquals.value;
}

/**
 * Evaluate rules against one event, returning the actions to fire. Fails closed:
 * an unknown event type triggers nothing. Pure — no side effects.
 */
export function evaluateAutomations(rules: AutomationRule[], event: PlatformEvent): TriggeredAction[] {
  if (!isKnownType(event.type)) return [];
  return rules
    .filter((rule) => rule.on === event.type && conditionHolds(rule, event))
    .map((rule) => ({ ruleId: rule.ruleId, action: rule.action, subjectKey: event.subjectKey }));
}
