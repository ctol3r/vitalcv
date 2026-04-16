// ── VitalCV Start Activation Graph MVP (Deterministic) ───────────
// STRICT RULE: No ML, no prediction, no probabilistic modeling.
// Translates the raw Acceptance Graph output into a Startability state
// and a deterministic static time-to-start heuristic.

import { AcceptanceState, EvaluatedRequirement } from './acceptanceGraph';

// ── Activation Model ─────────────────────────────────────────────

export interface ActivationUnit {
  id: string;
  name: string;
  status: 'satisfied' | 'missing' | 'blocked';
  detail: string;
}

export interface StartabilityState {
  orgId: string;
  isStartReady: boolean;
  activationUnits: ActivationUnit[];
  estimatedDaysToStart: number;
}

// ── Static Heuristic Constants ───────────────────────────────────
// Banned from ML: We use fixed heuristic penalty days per missing item
const DAYS_PER_MISSING_ITEM = 2;
const DAYS_PER_BLOCKED_ITEM = 90; // Exclusions/Revocations fundamentally halt hiring

/**
 * Deterministically evaluates Startability against the Acceptance State.
 */
export function evaluateActivationGraph(
  acceptance: AcceptanceState
): StartabilityState {
  const activationUnits: ActivationUnit[] = [];
  let estimatedDaysToStart = 0;

  // 1. Map Blocked Requirements
  for (const block of acceptance.blockers) {
    activationUnits.push({
      id: \`blocker_\${block.rule.claimType}\`,
      name: \`\${block.rule.claimType} verification blocked\`,
      status: 'blocked',
      detail: block.detail,
    });
    estimatedDaysToStart += DAYS_PER_BLOCKED_ITEM;
  }

  // 2. Map Missing Requirements
  for (const missing of acceptance.missingActions) {
    activationUnits.push({
      id: \`missing_\${missing.rule.claimType}\`,
      name: \`\${missing.rule.claimType} verification required\`,
      status: 'missing',
      detail: missing.detail,
    });
    estimatedDaysToStart += DAYS_PER_MISSING_ITEM;
  }

  // 3. Map Satisfied Requirements
  for (const satisfied of acceptance.satisfied) {
    activationUnits.push({
      id: \`satisfied_\${satisfied.rule.claimType}\`,
      name: \`\${satisfied.rule.claimType} verified\`,
      status: 'satisfied',
      detail: satisfied.detail,
    });
  }

  return {
    orgId: acceptance.orgId,
    isStartReady: acceptance.isReady,
    activationUnits,
    estimatedDaysToStart: acceptance.isReady ? 0 : estimatedDaysToStart,
  };
}
