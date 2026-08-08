/**
 * Consent authorization — deriving the scope from canonical state.
 *
 * The browser expresses approval OF AN ACTION. It never authors the
 * authorization namespace: a client-supplied scope string would let the
 * caller invent an authorization the plan never asked for, and would couple
 * the ledger's vocabulary to whatever a stale tab happened to be rendering.
 *
 * So a grant names an `actionId`, and the scope is read off the canonical
 * action in a freshly regenerated plan, behind the same gates the executor
 * applies. Everything here is pure over an already-built plan; the caller
 * owns the rebuild.
 */
import type { AgentAction, StartPlan } from '../types';
import { isStandingEligibleScope, type ConsentKind } from './types';

export const CONSENT_AUTHORIZATION_REFUSALS = [
  'action_not_in_current_plan',
  'action_does_not_require_consent',
  'human_only_action',
  'not_vitalcv_owned',
  'action_missing_scope',
  'standing_scope_not_eligible',
] as const;
export type ConsentAuthorizationRefusal = (typeof CONSENT_AUTHORIZATION_REFUSALS)[number];

export type ConsentAuthorization =
  | { ok: true; scope: string; kind: ConsentKind; action: AgentAction }
  | { ok: false; refusal: ConsentAuthorizationRefusal; detail: string };

/**
 * Resolve the consent scope a clinician is approving, from the action id
 * they approved. Gate order mirrors the executor: existence, then the
 * categorical facts about the action, then its scope.
 */
export function authorizeConsentForAction(
  plan: StartPlan,
  actionId: string,
): ConsentAuthorization {
  const action = plan.actions.find((candidate) => candidate.id === actionId);
  if (!action) {
    return {
      ok: false,
      refusal: 'action_not_in_current_plan',
      detail:
        'That action is not in the current plan for your current state, so there is nothing to approve.',
    };
  }
  // A2.5 — standing consent takes its own path. It is not a Level-3
  // authorization: the work it enables (a source refresh) is Level 2 and the
  // scheduler could already invoke it. What standing consent adds is
  // LEGIBILITY — the clinician chose to have work done unattended and can
  // revoke it — so the gates differ from the disclosure path deliberately.
  if (action.consentKind === 'standing') {
    if (!action.consentScope) {
      return {
        ok: false,
        refusal: 'action_missing_scope',
        detail: 'This action names no consent scope, so no authorization can be derived from it.',
      };
    }
    if (!isStandingEligibleScope(action.consentScope)) {
      return {
        ok: false,
        refusal: 'standing_scope_not_eligible',
        detail:
          'Only non-disclosing work may be approved as standing consent. VitalCV will always ask before showing anything to anyone.',
      };
    }
    return { ok: true, scope: action.consentScope, kind: 'standing', action };
  }

  if (action.permission === 'human_only') {
    return {
      ok: false,
      refusal: 'human_only_action',
      detail: 'This decision belongs to a person; approving it would not let VitalCV act.',
    };
  }
  if (action.permission !== 'execute_with_consent') {
    return {
      ok: false,
      refusal: 'action_does_not_require_consent',
      detail: `This action runs at the ${action.permission} level and needs no approval.`,
    };
  }
  if (action.owner !== 'vitalcv') {
    return {
      ok: false,
      refusal: 'not_vitalcv_owned',
      detail: `This step belongs to the ${action.owner.replace(/_/g, ' ')}; approval would not let VitalCV do it.`,
    };
  }
  if (!action.consentScope) {
    return {
      ok: false,
      refusal: 'action_missing_scope',
      detail: 'This action names no consent scope, so no authorization can be derived from it.',
    };
  }
  return { ok: true, scope: action.consentScope, kind: 'point', action };
}
