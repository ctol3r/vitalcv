/**
 * The first Readiness Planner — Wave 1076 B1.
 *
 * This is the first visible piece of VitalCV's clinician agent, and it is
 * deliberately the smallest honest one: a bounded, deterministic list of next
 * steps computed from the profile the server just returned. It is not a
 * chatbot, it does not call a model, and it does not have opinions. The same
 * profile always produces the same plan, which is what makes it testable and
 * what makes it safe to show someone about their own career.
 *
 * Every step must answer four questions, because a next-step list that answers
 * fewer is just a to-do list wearing a product name:
 *
 *   what to do            → `action`
 *   why it matters        → `why`
 *   can VitalCV do it     → `vitalcvRole`
 *   who controls it       → `controlledBy`
 *
 * The fourth is the one that keeps the product honest. A clinician should never
 * finish this panel believing VitalCV can grant something only an employer or a
 * licensing board can. Two of the steps below exist precisely to say that out
 * loud.
 *
 * **No readiness score.** Not a percentage, not a tier, not a grade. A single
 * number would flatten "add two states" and "an employer has to decide" into
 * one figure that means nothing and implies progress toward a threshold the
 * product does not control. B1 shows named actions or it shows nothing.
 */

import type { ProfileView } from './profileView';
import { fieldFor } from './profileView';

/** Who actually decides the outcome of a step. */
export type Controller = 'you' | 'vitalcv' | 'employer' | 'institution';

/** What VitalCV itself can contribute to a step. */
export type VitalcvRole =
  /** VitalCV does this part itself. */
  | 'does_it'
  /** VitalCV prepares or runs part of it; something outside finishes it. */
  | 'helps'
  /** VitalCV cannot do this. Only the named controller can. */
  | 'cannot';

export interface PlannerStep {
  id: string;
  /** What to do. */
  action: string;
  /** Why it matters, in terms of an outcome the clinician wants. */
  why: string;
  vitalcvRole: VitalcvRole;
  /** Plain sentence naming VitalCV's part, including where it stops. */
  vitalcvNote: string;
  controlledBy: Controller;
  /** Where the step is done, when it is done inside VitalCV. */
  href?: string;
  cta?: string;
}

export const CONTROLLER_LABEL: Record<Controller, string> = {
  you: 'You control this',
  vitalcv: 'VitalCV does this',
  employer: 'The employer decides this',
  institution: 'Another organization decides this',
};

export const VITALCV_ROLE_LABEL: Record<VitalcvRole, string> = {
  does_it: 'VitalCV can do this',
  helps: 'VitalCV does part of this',
  cannot: 'VitalCV cannot do this',
};

/**
 * How many steps the panel may show.
 *
 * Bounded on purpose. An unbounded list of everything a clinician could
 * theoretically improve is a backlog, and a backlog is the thing this product
 * is supposed to replace. Four is enough for the reason to act, the two
 * cheapest improvements, and the honest limit.
 */
export const MAX_PLANNER_STEPS = 4;

/**
 * A profile that is not yet active has no plan — it has a remaining step, and
 * the activation surface is already showing it. Returning [] rather than
 * inventing advice keeps the planner an "after" surface.
 */
export function planNextSteps(view: ProfileView): PlannerStep[] {
  if (view.activatedAt === null) return [];

  const steps: PlannerStep[] = [];
  const has = (key: string) => {
    const f = fieldFor(view, key);
    if (!f) return false;
    return Array.isArray(f.value) ? f.value.length > 0 : Boolean(f.value);
  };

  /*
   * 1. The reason any of this happened. First, always — a plan that opens with
   *    housekeeping buries the thing the clinician came for.
   */
  steps.push({
    id: 'review_opportunities',
    action: 'Review opportunities matched to your specialty and states',
    why: 'Your profile is saved and reusable, so matching can run against it now. Applying reuses this profile instead of asking for it again.',
    vitalcvRole: 'does_it',
    vitalcvNote: 'VitalCV matches roles to your profile and shows why each one may fit.',
    // The match is computed; the decision to apply is not.
    controlledBy: 'you',
    href: '/explore',
    cta: 'See matched opportunities',
  });

  /*
   * 2–3. The cheapest improvements that change matching, in the order they
   *      change it most. Only ever shown when actually absent.
   */
  if (!has('licensedStates')) {
    steps.push({
      id: 'add_licensed_states',
      action: 'Add the states you are licensed in',
      why: 'Every state you add widens the roles that can match you, and you stop re-entering the list on each application.',
      vitalcvRole: 'cannot',
      vitalcvNote:
        'VitalCV cannot read your state licences from a public source. It records what you enter, clearly labelled as yours.',
      controlledBy: 'you',
      href: `/profile/activate?npi=${view.npi}`,
      cta: 'Add licensed states',
    });
  }

  if (!has('preferredStates') || !has('workArrangement')) {
    steps.push({
      id: 'add_preferences',
      action: 'Say where you want to work and the arrangement you want',
      why: 'No public source knows this. Without it, matching has to guess which of the roles you could take are the ones you would want.',
      vitalcvRole: 'cannot',
      vitalcvNote: 'Only you can answer this. VitalCV uses it to rank roles, and never shares it as a credential.',
      controlledBy: 'you',
      href: `/profile/activate?npi=${view.npi}`,
      cta: 'Set your preferences',
    });
  }

  /*
   * 4. The honest limit. Shown until ownership is actually verified, and worded
   *    so that nobody reads a saved profile as proof of identity: private
   *    holdings stay locked, and this step is why.
   */
  if (!view.permissions.privateCredentialHoldings) {
    steps.push({
      id: 'verify_ownership',
      action: 'Verify that this NPI is yours, when you are ready',
      why: 'Saving a profile does not prove the NPI belongs to you, so credential records held privately for you stay locked until it does. Nothing you have already done is affected.',
      vitalcvRole: 'helps',
      vitalcvNote:
        'VitalCV runs the check and tells you what it needs. It cannot confirm ownership on its own — the confirming source does that.',
      controlledBy: 'institution',
      href: '/clinician/identity/verification',
      cta: 'See what ownership verification needs',
    });
  }

  /*
   * The employer step is always last and always present, and its slot is
   * RESERVED rather than competing for one.
   *
   * It lost that competition in the ordinary case: a freshly activated profile
   * has no licensed states and no preferences, so the two improvement steps
   * plus ownership filled the panel and the cap silently dropped the employer
   * boundary — the single step a clinician is most likely to assume VitalCV
   * controls. A bound that discards the most important item is the wrong bound,
   * so the improvements are capped instead and this is appended after.
   */
  const employerStep: PlannerStep = {
    id: 'employer_review',
    action: 'Send your profile to an employer when you decide to',
    why: 'Nothing is sent until you send it. After that, the employer reviews what you shared and decides its own outcome.',
    vitalcvRole: 'helps',
    vitalcvNote:
      'VitalCV shows you exactly what would be sent, and sends it only when you say so. It does not influence the decision.',
    controlledBy: 'employer',
  };

  return [...steps.slice(0, MAX_PLANNER_STEPS - 1), employerStep];
}
