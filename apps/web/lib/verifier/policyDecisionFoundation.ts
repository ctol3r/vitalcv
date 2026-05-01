/**
 * FOUNDATION-SWEEP-7 — verifier policy decision foundation.
 *
 * This module models internal outcome language only. It does not run a live
 * policy engine or committee workflow.
 */

export type PolicyDecisionOutcome =
  | 'acceptable_for_start'
  | 'requires_committee_review'
  | 'pending_additional_info'
  | 'unable_to_assess';

export interface PolicyDecisionCopy {
  action: string;
  detail: string;
}

export interface PolicyDecisionFoundation {
  provisionLive: false;
  automatedPolicyEngine: false;
  committeeWorkflowLive: false;
  outcomes: PolicyDecisionOutcome[];
  disclaimers: string[];
}

export function buildPolicyDecisionFoundation(): PolicyDecisionFoundation {
  return {
    provisionLive: false,
    automatedPolicyEngine: false,
    committeeWorkflowLive: false,
    outcomes: [
      'acceptable_for_start',
      'requires_committee_review',
      'pending_additional_info',
      'unable_to_assess',
    ],
    disclaimers: [
      'Policy decision outcomes are internal assessment labels; no automated policy engine is live.',
      'Committee workflow routing is planned and is not enabled by this foundation.',
    ],
  };
}

export function getPolicyDecisionCopy(
  outcome: PolicyDecisionOutcome,
): PolicyDecisionCopy {
  switch (outcome) {
    case 'acceptable_for_start':
      return {
        action: 'Mark acceptable for start',
        detail: 'Current assessment records support moving this application to the employer start workflow.',
      };
    case 'requires_committee_review':
      return {
        action: 'Escalate to committee',
        detail: 'Policy requires committee review before this assessment can move forward.',
      };
    case 'pending_additional_info':
      return {
        action: 'Request additional info',
        detail: 'Additional information is needed before the internal assessment can continue.',
      };
    case 'unable_to_assess':
      return {
        action: 'Unable to assess',
        detail: 'Available information is insufficient for an internal policy assessment.',
      };
  }
}

export function policyDecisionRequiresEscalation(
  outcome: PolicyDecisionOutcome,
): boolean {
  return outcome === 'requires_committee_review';
}
