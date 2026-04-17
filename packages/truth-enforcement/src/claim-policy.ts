// ── VitalCV Semantic Claim Policy Engine ────────────────────────
// Defines the exact bounds of what an agent/system is legally and
// architecturally permitted to claim in its outputs.

import { SemanticClaimIntent, SemanticCapability } from './agent-validation';

export enum ClaimCategory {
  ALLOWED = 'allowed',       // Universally permitted (e.g. "We check the OIG registry")
  RESTRICTED = 'restricted', // Universally banned (e.g. "We use blockchain")
  CONTEXTUAL = 'contextual', // Requires active system evidence (e.g. "Cryptographically verified")
}

export interface ClaimPolicy {
  allowedClaims: string[];
  restrictedClaims: string[];
  contextualClaims: string[];
}

// Global baseline policy for VitalCV agents
export const VITALCV_BASELINE_POLICY: ClaimPolicy = {
  allowedClaims: ['OIG', 'NPPES', 'PECOS', 'automated verification', 'federated identity'],
  restrictedClaims: ['blockchain', 'smart contracts', '100% guarantee', '100% certainty'],
  contextualClaims: ['cryptographically verified', 'cryptographic receipt', 'immutable audit'],
};

export interface PolicyEvaluation {
  passed: boolean;
  violationReason: string | null;
}

/**
 * Validates extracted semantic intent against the formal Claim Policy and live System Capability.
 */
export function evaluateClaimPolicy(
  intent: SemanticClaimIntent,
  capability: SemanticCapability,
  policy: ClaimPolicy = VITALCV_BASELINE_POLICY
): PolicyEvaluation {

  // 1. Check RESTRICTED boundaries (hard bans)
  if (intent.impliesBlockchain && !intent.isNegated) {
    return { passed: false, violationReason: 'Claim references restricted technology (blockchain) not supported by architecture.' };
  }

  // 2. Check CONTEXTUAL boundaries (requires evidence)
  if (intent.impliesCryptography && !intent.isNegated) {
    if (!capability.hasCryptography) {
      return { passed: false, violationReason: 'Claim contextually requires cryptographic capabilities, which are inactive or unsupported in this run.' };
    }
  }

  if (intent.impliesImmutableAudit && !intent.isNegated) {
    if (!capability.hasImmutableAudit) {
      return { passed: false, violationReason: 'Claim asserts immutable audit, but evidence of an active immutable ledger is missing.' };
    }
  }

  // If no violations hit, it passes policy
  return { passed: true, violationReason: null };
}
