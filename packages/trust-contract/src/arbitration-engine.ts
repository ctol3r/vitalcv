// ── VitalCV Trust Arbitration Engine ───────────────────────────────
// Resolves conflicts when multiple issuers make claims about the same subject.
// The system MUST always produce ONE final deterministic state.

import { IssuerStatus, ClaimVerificationPolicy } from './trust-registry';
import { IssuerType, type NetworkIssuer } from './multi-issuer';

// ── Conflict Model ───────────────────────────────────────────────

export interface ConflictingClaim {
  claimId: string;
  issuerId: string;
  issuerType: IssuerType;
  value: string | number | boolean | null;
  issuedAt: string;
  signatureValid: boolean;
}

export interface ClaimConflict {
  subjectNpi: string;
  claimType: string;
  conflictingClaims: ConflictingClaim[];
  detectedAt: string;
}

// ── Arbitration Output ───────────────────────────────────────────

export interface ArbitratedClaim {
  subjectNpi: string;
  claimType: string;
  finalValue: string | number | boolean | null;
  winningIssuerId: string;
  winningClaimId: string;
  arbitrationReason: string;
  confidenceLevel: 'high' | 'medium' | 'low';
}

// ── Arbitration Rules ────────────────────────────────────────────

/**
 * Priority mapping for issuer types. Lower number = higher authority.
 * 1. Regulatory sources (OIG, CMS, State Boards) -> PRIMARY_AUTHORITY
 * 2. Primary-source systems -> SYSTEM (VitalCV core automated checks)
 * 3. Verified institutions -> HOSPITAL / CREDENTIALING_ORG
 * 4. Staffing agencies -> STAFFING_AGENCY
 */
const ISSUER_PRIORITY: Record<IssuerType, number> = {
  [IssuerType.PRIMARY_AUTHORITY]: 1,
  [IssuerType.SYSTEM]: 2,
  [IssuerType.HOSPITAL]: 3,
  [IssuerType.CREDENTIALING_ORG]: 3,
  [IssuerType.STAFFING_AGENCY]: 4,
};

export class ArbitrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArbitrationError';
  }
}

/**
 * Arbitrates a conflict between multiple claims of the same type.
 * Returns ONE deterministic final claim.
 */
export function arbitrateConflict(
  conflict: ClaimConflict,
  registry: NetworkIssuer[]
): ArbitratedClaim {
  if (conflict.conflictingClaims.length === 0) {
    throw new ArbitrationError(`No claims provided for arbitration of ${conflict.claimType}`);
  }

  // 1. Filter out cryptographically invalid claims
  let candidates = conflict.conflictingClaims.filter(c => c.signatureValid);
  if (candidates.length === 0) {
    throw new ArbitrationError(`All claims for ${conflict.claimType} failed signature validation`);
  }

  // 2. Filter out claims from revoked/suspended issuers (respecting revocation policy)
  candidates = candidates.filter(c => {
    const issuer = registry.find(r => r.issuerId === c.issuerId);
    if (!issuer) return false;

    // Is the claim expired?
    const ageMs = Date.now() - new Date(c.issuedAt).getTime();
    if (ageMs > issuer.policies.maxTtlMs) return false;

    // Is the issuer revoked?
    if (issuer.status !== IssuerStatus.ACTIVE) {
      if (issuer.policies.revocationPolicy === ClaimVerificationPolicy.TRUST_AT_VERIFICATION) {
        return false; // Drop claim immediately
      }
      // If TRUST_AT_ISSUANCE, we keep it assuming it was valid when signed
    }
    return true;
  });

  if (candidates.length === 0) {
    throw new ArbitrationError(`All claims for ${conflict.claimType} were expired or from revoked issuers`);
  }

  // 3. If only one candidate remains, it wins by default
  if (candidates.length === 1) {
    return buildArbitrated(conflict.subjectNpi, conflict.claimType, candidates[0], 'Only valid claim remaining after filtering');
  }

  // 4. Sort by Issuer Priority (Authority Level)
  candidates.sort((a, b) => ISSUER_PRIORITY[a.issuerType] - ISSUER_PRIORITY[b.issuerType]);

  const highestPriority = ISSUER_PRIORITY[candidates[0].issuerType];
  const topTierCandidates = candidates.filter(c => ISSUER_PRIORITY[c.issuerType] === highestPriority);

  // 5. If one candidate has the highest priority, it wins
  if (topTierCandidates.length === 1) {
    return buildArbitrated(
      conflict.subjectNpi,
      conflict.claimType,
      topTierCandidates[0],
      `Won via superior issuer authority (${topTierCandidates[0].issuerType})`
    );
  }

  // 6. Tie-breaker: Recency (Most recently issued wins)
  topTierCandidates.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

  return buildArbitrated(
    conflict.subjectNpi,
    conflict.claimType,
    topTierCandidates[0],
    `Won tie-breaker via recency (${topTierCandidates[0].issuedAt}) among equal-authority issuers`
  );
}

function buildArbitrated(subjectNpi: string, claimType: string, winner: ConflictingClaim, reason: string): ArbitratedClaim {
  let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
  
  if (winner.issuerType === IssuerType.PRIMARY_AUTHORITY || winner.issuerType === IssuerType.SYSTEM) {
    confidenceLevel = 'high';
  } else if (winner.issuerType === IssuerType.HOSPITAL || winner.issuerType === IssuerType.CREDENTIALING_ORG) {
    confidenceLevel = 'medium';
  }

  return {
    subjectNpi,
    claimType,
    finalValue: winner.value,
    winningIssuerId: winner.issuerId,
    winningClaimId: winner.claimId,
    arbitrationReason: reason,
    confidenceLevel,
  };
}
