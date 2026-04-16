// ── VitalCV Next Best Action Engine MVP (Deterministic) ───────────
// STRICT RULE: No ML, no prediction, no probabilistic scoring.
// Computes exactly ONE next best action based purely on the 
// resolved states of the Recognition, Acceptance, and Activation graphs.

import { ReadinessPosture } from '../../../../packages/trust-contract/src/index';
import { EvaluatedRequirement } from './acceptanceGraph';
import { ActivationUnit } from './activationGraph';

export enum RecommendedAction {
  PROCEED = 'PROCEED',
  REQUEST_DATA = 'REQUEST_DATA',
  REVERIFY = 'REVERIFY',
  ESCALATE = 'ESCALATE',
  HOLD = 'HOLD',
  READY_TO_APPLY = 'READY_TO_APPLY',
  FIX_BLOCKERS = 'FIX_BLOCKERS'
}

export type ActionDomain = 'recognition' | 'acceptance' | 'activation';

export interface NbaRecommendation {
  action: RecommendedAction;
  domain: ActionDomain;
  reasoning: string;
  effortEstimate: 'LOW' | 'MEDIUM' | 'HIGH';
  impactEstimate: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface NbaInputContext {
  recognitionBlockers: string[];
  acceptanceBlockers: EvaluatedRequirement[];
  activationBlockers: ActivationUnit[];
  recognitionMissing: string[];
  acceptanceMissing: EvaluatedRequirement[];
  activationMissing: ActivationUnit[];
  readinessPosture: ReadinessPosture;
  hasAdverseSignals: boolean;
  employerAction: 'PROCEED' | 'ESCALATE' | 'REQUEST_DATA' | 'REVERIFY' | 'HOLD' | 'NONE';
  isStale: boolean;
}

/**
 * Deterministically generates exactly ONE next best action.
 * Priority: Activation Blockers -> Acceptance Blockers -> Recognition Blockers
 */
export function generateNextBestAction(context: NbaInputContext): NbaRecommendation {

  // 1. Critical System Holds
  if (context.hasAdverseSignals) {
    return {
      action: RecommendedAction.ESCALATE,
      domain: 'recognition',
      reasoning: 'Critical adverse signal detected (e.g. OIG Exclusion). Immediate compliance escalation required.',
      effortEstimate: 'HIGH',
      impactEstimate: 'HIGH'
    };
  }

  if (context.isStale) {
    return {
      action: RecommendedAction.REVERIFY,
      domain: 'recognition',
      reasoning: 'Verified data has exceeded its TTL and is now stale. A fresh sync is required before proceeding.',
      effortEstimate: 'LOW',
      impactEstimate: 'HIGH'
    };
  }

  // 2. ACTIVATION BLOCKERS (Highest Priority)
  // If the employer has accepted them, but they can't start
  if (context.employerAction === 'PROCEED' && context.activationBlockers.length > 0) {
    const target = context.activationBlockers[0];
    return {
      action: RecommendedAction.HOLD,
      domain: 'activation',
      reasoning: `Start blocked: ${target.name}. ${target.detail}`,
      effortEstimate: 'HIGH',
      impactEstimate: 'HIGH'
    };
  }

  if (context.employerAction === 'PROCEED' && context.activationMissing.length > 0) {
    const target = context.activationMissing[0];
    return {
      action: RecommendedAction.REQUEST_DATA,
      domain: 'activation',
      reasoning: `Start pending: Missing ${target.name}. ${target.detail}`,
      effortEstimate: 'MEDIUM',
      impactEstimate: 'HIGH'
    };
  }

  // 3. ACCEPTANCE BLOCKERS (Medium Priority)
  // The employer is reviewing them, but org requirements are failing
  if (context.acceptanceBlockers.length > 0) {
    const target = context.acceptanceBlockers[0];
    return {
      action: RecommendedAction.ESCALATE,
      domain: 'acceptance',
      reasoning: `Acceptance blocked: ${target.rule.claimType} failed validation. ${target.detail}`,
      effortEstimate: 'HIGH',
      impactEstimate: 'HIGH'
    };
  }

  if (context.acceptanceMissing.length > 0) {
    const target = context.acceptanceMissing[0];
    return {
      action: RecommendedAction.REQUEST_DATA,
      domain: 'acceptance',
      reasoning: `Acceptance pending: Missing ${target.rule.claimType}. ${target.detail}`,
      effortEstimate: 'MEDIUM',
      impactEstimate: 'HIGH'
    };
  }

  // 4. RECOGNITION BLOCKERS (Lowest Priority / Base layer)
  if (context.readinessPosture === ReadinessPosture.INSUFFICIENT_DATA || context.readinessPosture === ReadinessPosture.PARTIAL) {
    return {
      action: RecommendedAction.REQUEST_DATA,
      domain: 'recognition',
      reasoning: context.recognitionMissing.length > 0 
        ? `Missing base credential: ${context.recognitionMissing[0]}`
        : 'Missing required coverage to reach Decision Grade.',
      effortEstimate: 'MEDIUM',
      impactEstimate: 'MEDIUM'
    };
  }

  if (context.readinessPosture === ReadinessPosture.CHECKING) {
    return {
      action: RecommendedAction.HOLD,
      domain: 'recognition',
      reasoning: 'Automated primary source verifications are currently running.',
      effortEstimate: 'LOW',
      impactEstimate: 'LOW'
    };
  }

  // 5. ALL CLEAR
  return {
    action: RecommendedAction.PROCEED,
    domain: 'acceptance',
    reasoning: 'All critical sources verified. Ready for Org Deployment.',
    effortEstimate: 'LOW',
    impactEstimate: 'HIGH'
  };
}
