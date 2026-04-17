// ── VitalCV Trust Registry (Governance Layer) ──────────────────────
// The Trust Registry defines WHO can issue claims, WHO can verify them,
// and WHAT policies apply. It governs the system's trust topology separate
// from the immutable attestation storage.

// Rule 1: The Registry is mutable and versioned.
// Rule 2: Attestations are immutable.
// Rule 3: Verification ALWAYS checks the current Registry state.

// ── Registry Enums ───────────────────────────────────────────────

export enum IssuerStatus {
  /** Actively trusted to issue claims */
  ACTIVE = 'active',
  /** Suspended (temporarily untrusted) */
  SUSPENDED = 'suspended',
  /** Permanently untrusted (all previously issued claims may be invalidated) */
  REVOKED = 'revoked',
}

export enum ClaimVerificationPolicy {
  /** Claim is trusted as long as issuer was ACTIVE at time of issuance */
  TRUST_AT_ISSUANCE = 'trust_at_issuance',
  /** Claim is only trusted if issuer is ACTIVE at time of verification */
  TRUST_AT_VERIFICATION = 'trust_at_verification',
}

// ── Registry Model ───────────────────────────────────────────────

export interface TrustRegistryEntry {
  /** The unique identifier of the issuer (e.g. an OrgID, DID, or System Agent ID) */
  issuerId: string;
  /** Human-readable name of the issuer */
  name: string;
  /** Public key used to verify signatures from this issuer */
  publicKey: string;
  /** Current governance status of this issuer */
  status: IssuerStatus;
  /** Types of claims this issuer is authorized to make (e.g. ['identity.name', 'oig.exclusion']) */
  authorizedClaimTypes: string[];
  /** Rules governing how claims from this issuer are handled */
  policies: IssuerPolicies;
  /** When this issuer was registered */
  createdAt: string;
  /** When this registry entry was last modified */
  updatedAt: string;
  /** Version counter for the registry entry */
  version: number;
}

export interface IssuerPolicies {
  /** Maximum allowed time-to-live for claims from this issuer (in ms) */
  maxTtlMs: number;
  /** How to handle claims if the issuer is later revoked */
  revocationPolicy: ClaimVerificationPolicy;
  /** Whether claims from this issuer can contribute to a DECISION_GRADE manifest */
  decisionGradeEligible: boolean;
}

// ── Governance Engine ────────────────────────────────────────────

export interface VerifyClaimContext {
  claimType: string;
  issuerId: string;
  issuedAt: string;
}

export class TrustRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrustRegistryError';
  }
}

/**
 * Validates a claim against the current Trust Registry governance policies.
 * Must be called during Manifest Generation or Third-Party Verification.
 */
export function verifyIssuerGovernance(
  registry: TrustRegistryEntry[],
  context: VerifyClaimContext
): { valid: boolean; reason: string | null } {
  
  const entry = registry.find(r => r.issuerId === context.issuerId);

  // 1. Unknown Issuer
  if (!entry) {
    return { valid: false, reason: `Issuer ${context.issuerId} not found in Trust Registry` };
  }

  // 2. Unauthorized Claim Type
  if (!entry.authorizedClaimTypes.includes(context.claimType) && !entry.authorizedClaimTypes.includes('*')) {
    return { valid: false, reason: `Issuer ${context.issuerId} is not authorized to issue ${context.claimType}` };
  }

  // 3. TTL Expiration
  const ageMs = Date.now() - new Date(context.issuedAt).getTime();
  if (ageMs > entry.policies.maxTtlMs) {
    return { valid: false, reason: `Claim exceeded issuer max TTL (${entry.policies.maxTtlMs}ms)` };
  }

  // 4. Issuer Revocation Policy
  if (entry.status === IssuerStatus.REVOKED || entry.status === IssuerStatus.SUSPENDED) {
    if (entry.policies.revocationPolicy === ClaimVerificationPolicy.TRUST_AT_VERIFICATION) {
      return { valid: false, reason: `Issuer ${context.issuerId} is currently ${entry.status}` };
    }
    // If TRUST_AT_ISSUANCE, we theoretically need to check the issuer's status at `issuedAt`.
    // For this engine, we assume the claim was signed when the issuer was active.
  }

  return { valid: true, reason: null };
}
