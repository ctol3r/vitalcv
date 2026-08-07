/**
 * start-policy-v2 — A1's deployed policy.
 *
 * Delta over v1 (and nothing else): a GRANTED share consent surfaces the
 * prepared work as an executable action instead of deriving nothing, making
 * the grant → execute loop reachable. Everything upstream and downstream —
 * blocker derivation, ranking tiers, the truth-contract gate — is the shared
 * versioned pipeline, so replaying v1 vs v2 against START-Bench isolates
 * exactly this behavior change.
 *
 * v1 stays frozen in ./start-policy-v1.ts for replay comparison.
 */
import type { StartAgentContext, StartPlan } from '../types';
import {
  runStartPolicy,
  type GenerateStartPlanOptions,
} from './start-policy-v1';

export const START_POLICY_VERSION_V2 = 'start-policy-v2';

export function generateStartPlanV2(
  context: StartAgentContext,
  options: GenerateStartPlanOptions = {},
): StartPlan {
  return runStartPolicy(context, options, {
    policyVersion: START_POLICY_VERSION_V2,
    deriveOptions: { surfaceGrantedConsentWork: true },
  });
}
