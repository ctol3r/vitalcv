// ── VitalCV Explainability Engine ──────────────────────────────────
// Provides human-readable, deterministic explanations for all
// arbitrated decisions. The system must never fabricate reasoning.

import { IssuerStatus, ClaimVerificationPolicy } from './trust-registry';
import { IssuerType, type NetworkIssuer } from './multi-issuer';
import { arbitrateConflict, type ClaimConflict, type ConflictingClaim, type ArbitratedClaim } from './arbitration-engine';

// ── Explainability Model ─────────────────────────────────────────

export interface ReasoningStep {
  stepIndex: number;
  action: 'FILTERED' | 'EVALUATED' | 'SELECTED' | 'TIE_BREAKER';
  reason: string;
  claimIdsAffected: string[];
}

export interface ExplainabilityRecord {
  /** The clinician NPI */
  subjectNpi: string;
  /** The type of claim being arbitrated */
  claimType: string;
  /** All claims considered during the arbitration cycle */
  evaluatedClaims: ConflictingClaim[];
  /** The final arbitrated result */
  winningClaim: ArbitratedClaim | null;
  /** Claims that lost the arbitration */
  rejectedClaims: ConflictingClaim[];
  /** The deterministic steps taken to reach the decision */
  reasoningSteps: ReasoningStep[];
  /** The final policy constraint applied to the winner */
  policyApplied: string;
  /** When this explanation was generated */
  generatedAt: string;
}

// ── Explainability Engine ────────────────────────────────────────

const ISSUER_PRIORITY: Record<IssuerType, number> = {
  [IssuerType.PRIMARY_AUTHORITY]: 1,
  [IssuerType.SYSTEM]: 2,
  [IssuerType.HOSPITAL]: 3,
  [IssuerType.CREDENTIALING_ORG]: 3,
  [IssuerType.STAFFING_AGENCY]: 4,
};

/**
 * Wraps the Trust Arbitration Engine to produce a full ExplainabilityRecord
 * alongside the final decision.
 */
export function explainArbitration(
  conflict: ClaimConflict,
  registry: NetworkIssuer[]
): ExplainabilityRecord {
  
  const reasoningSteps: ReasoningStep[] = [];
  const rejectedClaims: ConflictingClaim[] = [];
  let stepCounter = 1;

  if (conflict.conflictingClaims.length === 0) {
    return {
      subjectNpi: conflict.subjectNpi,
      claimType: conflict.claimType,
      evaluatedClaims: [],
      winningClaim: null,
      rejectedClaims: [],
      reasoningSteps: [{
        stepIndex: stepCounter,
        action: 'EVALUATED',
        reason: 'No claims provided for arbitration',
        claimIdsAffected: []
      }],
      policyApplied: 'N/A',
      generatedAt: new Date().toISOString(),
    };
  }

  // 1. Signature Filter
  const invalidSigs = conflict.conflictingClaims.filter(c => !c.signatureValid);
  const validSigs = conflict.conflictingClaims.filter(c => c.signatureValid);

  if (invalidSigs.length > 0) {
    invalidSigs.forEach(c => rejectedClaims.push(c));
    reasoningSteps.push({
      stepIndex: stepCounter++,
      action: 'FILTERED',
      reason: 'Signature invalid',
      claimIdsAffected: invalidSigs.map(c => c.claimId),
    });
  }

  if (validSigs.length === 0) {
    return buildFailureExplanation(conflict, rejectedClaims, reasoningSteps, 'All claims failed signature validation');
  }

  // 2. Policy & TTL Filter
  const validPolicy: ConflictingClaim[] = [];
  const expiredOrRevoked: ConflictingClaim[] = [];

  for (const claim of validSigs) {
    const issuer = registry.find(r => r.issuerId === claim.issuerId);
    if (!issuer) {
      expiredOrRevoked.push(claim);
      continue;
    }

    const ageMs = Date.now() - new Date(claim.issuedAt).getTime();
    if (ageMs > issuer.policies.maxTtlMs) {
      expiredOrRevoked.push(claim);
      continue;
    }

    if (issuer.status !== IssuerStatus.ACTIVE && issuer.policies.revocationPolicy === ClaimVerificationPolicy.TRUST_AT_VERIFICATION) {
      expiredOrRevoked.push(claim);
      continue;
    }

    validPolicy.push(claim);
  }

  if (expiredOrRevoked.length > 0) {
    expiredOrRevoked.forEach(c => rejectedClaims.push(c));
    reasoningSteps.push({
      stepIndex: stepCounter++,
      action: 'FILTERED',
      reason: 'Issuer revoked, unknown, or claim TTL expired',
      claimIdsAffected: expiredOrRevoked.map(c => c.claimId),
    });
  }

  if (validPolicy.length === 0) {
    return buildFailureExplanation(conflict, rejectedClaims, reasoningSteps, 'All claims expired or revoked');
  }

  // 3. Single Candidate Fast-Path
  if (validPolicy.length === 1) {
    const winner = validPolicy[0];
    reasoningSteps.push({
      stepIndex: stepCounter++,
      action: 'SELECTED',
      reason: 'Only one valid claim remaining after filtering',
      claimIdsAffected: [winner.claimId],
    });

    return buildSuccessExplanation(conflict, winner, rejectedClaims, reasoningSteps, 'Only valid claim', registry);
  }

  // 4. Authority Priority Sorting
  validPolicy.sort((a, b) => ISSUER_PRIORITY[a.issuerType] - ISSUER_PRIORITY[b.issuerType]);
  
  const highestPriority = ISSUER_PRIORITY[validPolicy[0].issuerType];
  const topTier = validPolicy.filter(c => ISSUER_PRIORITY[c.issuerType] === highestPriority);
  const lowerTier = validPolicy.filter(c => ISSUER_PRIORITY[c.issuerType] > highestPriority);

  if (lowerTier.length > 0) {
    lowerTier.forEach(c => rejectedClaims.push(c));
    reasoningSteps.push({
      stepIndex: stepCounter++,
      action: 'FILTERED',
      reason: `Higher authority source (${topTier[0].issuerType}) overruled lower priority claims`,
      claimIdsAffected: lowerTier.map(c => c.claimId),
    });
  }

  // 5. Authority Winner
  if (topTier.length === 1) {
    const winner = topTier[0];
    reasoningSteps.push({
      stepIndex: stepCounter++,
      action: 'SELECTED',
      reason: 'Highest priority issuer',
      claimIdsAffected: [winner.claimId],
    });
    return buildSuccessExplanation(conflict, winner, rejectedClaims, reasoningSteps, `Won via superior issuer authority (${winner.issuerType})`, registry);
  }

  // 6. Recency Tie-Breaker
  topTier.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  const winner = topTier[0];
  const tiedLosers = topTier.slice(1);
  
  tiedLosers.forEach(c => rejectedClaims.push(c));
  reasoningSteps.push({
    stepIndex: stepCounter++,
    action: 'TIE_BREAKER',
    reason: 'More recent claim won the tie-breaker',
    claimIdsAffected: [winner.claimId, ...tiedLosers.map(c => c.claimId)],
  });

  return buildSuccessExplanation(conflict, winner, rejectedClaims, reasoningSteps, `Won tie-breaker via recency (${winner.issuedAt})`, registry);
}

function buildFailureExplanation(conflict: ClaimConflict, rejectedClaims: ConflictingClaim[], reasoningSteps: ReasoningStep[], policyApplied: string): ExplainabilityRecord {
  return {
    subjectNpi: conflict.subjectNpi,
    claimType: conflict.claimType,
    evaluatedClaims: conflict.conflictingClaims,
    winningClaim: null,
    rejectedClaims,
    reasoningSteps,
    policyApplied,
    generatedAt: new Date().toISOString(),
  };
}

function buildSuccessExplanation(conflict: ClaimConflict, winner: ConflictingClaim, rejectedClaims: ConflictingClaim[], reasoningSteps: ReasoningStep[], reason: string, registry: NetworkIssuer[]): ExplainabilityRecord {
  let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
  if (winner.issuerType === IssuerType.PRIMARY_AUTHORITY || winner.issuerType === IssuerType.SYSTEM) confidenceLevel = 'high';
  else if (winner.issuerType === IssuerType.HOSPITAL || winner.issuerType === IssuerType.CREDENTIALING_ORG) confidenceLevel = 'medium';

  const issuer = registry.find(r => r.issuerId === winner.issuerId);
  const policyApplied = `Trusted under policy: ${issuer?.policies.revocationPolicy || 'UNKNOWN'}, TTL: ${issuer?.policies.maxTtlMs}ms`;

  return {
    subjectNpi: conflict.subjectNpi,
    claimType: conflict.claimType,
    evaluatedClaims: conflict.conflictingClaims,
    winningClaim: {
      subjectNpi: conflict.subjectNpi,
      claimType: conflict.claimType,
      finalValue: winner.value,
      winningIssuerId: winner.issuerId,
      winningClaimId: winner.claimId,
      arbitrationReason: reason,
      confidenceLevel,
    },
    rejectedClaims,
    reasoningSteps,
    policyApplied,
    generatedAt: new Date().toISOString(),
  };
}
