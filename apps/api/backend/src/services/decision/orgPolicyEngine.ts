// ── VitalCV Organization Policy Engine ─────────────────────────────
// Applies organization-specific risk tolerances and rules to the
// Omega Orchestrator's raw outputs.

import { ReadinessPosture } from '../../../../../../packages/trust-contract/src/index';
import { CalibratedDecisionState } from './confidenceEngine';

export interface OrgPolicy {
  orgId: string;
  riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH';
  /** Array of claim types that are strictly required for this org (e.g. ['identity.state_license', 'oig.exclusion']) */
  requiredSignals: string[];
  allowStaleData: boolean;
  /** The maximum historical failure rate (0.0-1.0) before auto-escalating */
  escalationThreshold: number;
  /** Whether the system is allowed to recommend an auto-approve (PROCEED) action */
  autoApproveEnabled: boolean;
}

export interface PolicyApplicationResult {
  policyApplied: boolean;
  finalPosture: ReadinessPosture;
  finalCalibratedState: CalibratedDecisionState;
  finalAction: 'PROCEED' | 'ESCALATE' | 'REQUEST_DATA' | 'NONE';
  policyNotes: string[];
}

const DEFAULT_POLICY: OrgPolicy = {
  orgId: 'default',
  riskTolerance: 'LOW',
  requiredSignals: ['oig.exclusion', 'identity.name'],
  allowStaleData: false,
  escalationThreshold: 0.20, // 20% failure rate triggers escalation
  autoApproveEnabled: false, // Humans must click by default
};

export async function fetchOrgPolicy(orgId: string): Promise<OrgPolicy> {
  // In a real system, we'd fetch this from Prisma OrgSettings.
  // Returning the default strict policy for now.
  return {
    ...DEFAULT_POLICY,
    orgId,
  };
}

/**
 * Applies the organization's specific policy rules to Omega's raw output.
 */
export function applyOrgPolicy(
  policy: OrgPolicy,
  posture: ReadinessPosture,
  calibratedState: CalibratedDecisionState,
  proposedAction: 'PROCEED' | 'ESCALATE' | 'REQUEST_DATA' | 'NONE',
  presentSignals: string[],
  hasStaleData: boolean,
  historicFailureRate: number
): PolicyApplicationResult {
  
  let finalPosture = posture;
  let finalCalibratedState = calibratedState;
  let finalAction = proposedAction;
  const policyNotes: string[] = [];

  // 1. Required Signals Check
  const missingSignals = policy.requiredSignals.filter(s => !presentSignals.includes(s));
  if (missingSignals.length > 0) {
    if (finalPosture === ReadinessPosture.DECISION_GRADE || finalPosture === ReadinessPosture.PARTIAL) {
      finalPosture = ReadinessPosture.PARTIAL;
      finalCalibratedState = 'PENDING';
      finalAction = 'REQUEST_DATA';
      policyNotes.push(`Org Policy: Downgraded to PARTIAL. Missing required signals: ${missingSignals.join(', ')}`);
    }
  }

  // 2. Stale Data Tolerance
  if (hasStaleData && !policy.allowStaleData) {
    if (finalAction === 'PROCEED') {
      finalAction = 'ESCALATE';
      policyNotes.push('Org Policy: Escalated to manual review due to stale data presence (allowStaleData=false).');
    }
  }

  // 3. Escalation Threshold (Historical Outcome Safety)
  if (historicFailureRate > policy.escalationThreshold) {
    if (finalAction === 'PROCEED') {
      finalAction = 'ESCALATE';
      policyNotes.push(`Org Policy: Escalated to manual review. Historic failure rate (${(historicFailureRate * 100).toFixed(1)}%) exceeds org threshold (${(policy.escalationThreshold * 100).toFixed(1)}%).`);
    }
  }

  // 4. Auto-Approve Gate
  if (finalAction === 'PROCEED' && !policy.autoApproveEnabled) {
    // If the org doesn't allow the system to recommend a direct PROCEED, we hold it at ESCALATE (Manual Review).
    finalAction = 'ESCALATE';
    policyNotes.push('Org Policy: Auto-approve disabled. Routing confident decisions to manual review queue.');
  }

  // 5. Risk Tolerance Tweaks
  if (policy.riskTolerance === 'LOW' && finalCalibratedState === 'READY_UNCERTAIN') {
    finalAction = 'ESCALATE';
    policyNotes.push('Org Policy: Low risk tolerance org requires manual review for UNCERTAIN decisions.');
  }

  return {
    policyApplied: true,
    finalPosture,
    finalCalibratedState,
    finalAction,
    policyNotes,
  };
}
