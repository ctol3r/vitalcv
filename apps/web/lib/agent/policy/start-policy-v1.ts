/**
 * Start Agent policy V0 implementation, versioned `start-policy-v1`.
 *
 * A deterministic decision policy — no LLM decides the priority list. The
 * pipeline (per the A0 contract):
 *
 *   1. consume current state (the assembled StartAgentContext);
 *   2. derive typed blockers;
 *   3. derive candidate actions;
 *   4. hold back actions whose dependencies are unsatisfied (they stay in
 *      the plan with status `blocked_on_dependency`, out of the ranked list);
 *   5. assign ownership;
 *   6. assign permission requirements;
 *   7. rank by the explicit tier rules in ./rank.ts;
 *   8. return a structured StartPlan.
 *
 * The final gate re-validates the plan against the truth contract and THROWS
 * on any violation — this policy cannot return a plan that collapses a truth
 * boundary. Versioning exists so `start-policy-v2` can be replayed against
 * START-Bench and history side-by-side with this one.
 */
import { contextFingerprint, planId } from '../ids';
import { START_TOOLSET_VERSION } from '../tools/registry';
import { assertPlanHonorsTruthContract } from '../truth-boundary';
import type { StartAgentContext, StartPlan } from '../types';
import { deriveBlockersAndActions, type DeriveOptions } from './derive';
import { rankActions } from './rank';

export const START_POLICY_VERSION = 'start-policy-v1';

export interface GenerateStartPlanOptions {
  /**
   * Injected clock (ISO string). Plans are otherwise fully deterministic —
   * with the same `now`, identical contexts produce byte-identical plans.
   */
  now?: string;
  /** Stamped into the plan when a model narrates it; never set by the policy. */
  modelVersion?: string;
}

export interface StartPolicyConfig {
  policyVersion: string;
  deriveOptions: DeriveOptions;
}

export function generateStartPlan(
  context: StartAgentContext,
  options: GenerateStartPlanOptions = {},
): StartPlan {
  return runStartPolicy(context, options, {
    policyVersion: START_POLICY_VERSION,
    deriveOptions: {},
  });
}

/**
 * The shared, versioned pipeline. Each policy version is a frozen
 * (policyVersion, deriveOptions) pair over this machinery so versions replay
 * side-by-side against START-Bench.
 */
export function runStartPolicy(
  context: StartAgentContext,
  options: GenerateStartPlanOptions,
  config: StartPolicyConfig,
): StartPlan {
  // 1–3: consume state, derive blockers and candidate actions.
  const { blockers, actions, blockingApplication } = deriveBlockersAndActions(
    context,
    config.deriveOptions,
  );

  // 4: actions with pending dependencies stay visible but unranked. The one
  // exception: a consent-gated action's dependency on its own consent request
  // is what `awaiting_consent` already encodes — "approve and I'll do it" is
  // presentable, so only OTHER unsatisfied dependencies block it.
  const byId = new Map(actions.map((a) => [a.id, a]));
  for (const action of actions) {
    const hasUnsatisfiedDependency = action.dependencies.some((dep) => {
      const depAction = byId.get(dep);
      if (!depAction || depAction.status === 'completed') return false;
      if (action.permission === 'execute_with_consent' && depAction.type === 'request_consent') {
        return false;
      }
      return true;
    });
    if (hasUnsatisfiedDependency && action.status !== 'completed' && action.status !== 'suppressed') {
      action.status = 'blocked_on_dependency';
    }
  }

  // 5–7: ownership and permissions were assigned at derivation (they are
  // properties of the action, not presentation); rank what remains.
  const { rankedActionIds } = rankActions({ actions, blockingApplication });

  const fingerprint = contextFingerprint(context);
  const plan: StartPlan = {
    planId: planId(context.subject.profileRef, config.policyVersion, fingerprint),
    subject: context.subject,
    contextClass: context.contextClass,
    contextFingerprint: fingerprint,
    blockers,
    actions,
    rankedActionIds,
    generatedAt: options.now ?? new Date().toISOString(),
    policyVersion: config.policyVersion,
    toolsetVersion: START_TOOLSET_VERSION,
    ...(options.modelVersion ? { modelVersion: options.modelVersion } : {}),
  };

  // 8: fail closed — a truth-contract violation is a bug, not a plan.
  assertPlanHonorsTruthContract(plan, context);

  return plan;
}
