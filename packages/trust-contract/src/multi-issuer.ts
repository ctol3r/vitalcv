// ── VitalCV Multi-Issuer Trust Network ───────────────────────────
// Transforms VitalCV from a single-issuer system into a multi-issuer trust network.
// Multiple organizations can issue claims, and verifiers consult the Registry to arbitrate trust.

import { IssuerStatus, ClaimVerificationPolicy, type TrustRegistryEntry } from './trust-registry';

// ── Issuer Types ─────────────────────────────────────────────────

export enum IssuerType {
  /** The core VitalCV automated engine (Primary Source Verification) */
  SYSTEM = 'system_issuer',
  /** A hospital or health system (e.g. verifying employment history) */
  HOSPITAL = 'hospital',
  /** A staffing agency (e.g. verifying a background check) */
  STAFFING_AGENCY = 'staffing_agency',
  /** A specialized credentials verification organization (CVO) */
  CREDENTIALING_ORG = 'credentialing_org',
  /** Future: Direct state or national boards (NCCPA, FSMB, CA PA Board) */
  PRIMARY_AUTHORITY = 'primary_authority',
}

// ── Multi-Issuer Network Registry ────────────────────────────────

export interface NetworkIssuer extends TrustRegistryEntry {
  type: IssuerType;
  /** Human-readable description of what this issuer does */
  description: string;
}

// ── 1. The Core System Issuer (VitalCV) ──────────────────────────

export const VITALCV_SYSTEM_ISSUER: NetworkIssuer = {
  issuerId: 'did:web:vitalcv.com',
  name: 'VitalCV Automated Verification Engine',
  type: IssuerType.SYSTEM,
  description: 'The core VitalCV system performing automated primary source verifications (NPPES, OIG, PECOS).',
  publicKey: 'pubkey_system_v1', // In reality, this would be a real JWK/Ed25519 key
  status: IssuerStatus.ACTIVE,
  authorizedClaimTypes: ['*'], // The system can issue any core claim type
  policies: {
    maxTtlMs: 30 * 24 * 60 * 60 * 1000, // 30 days max for system claims
    revocationPolicy: ClaimVerificationPolicy.TRUST_AT_VERIFICATION,
    decisionGradeEligible: true,
  },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-04-14T00:00:00Z',
  version: 1,
};

// ── 2. A Staffing Agency Issuer ──────────────────────────────────

export const STAFFING_AGENCY_ISSUER: NetworkIssuer = {
  issuerId: 'did:web:ayahealthcare.com',
  name: 'Aya Healthcare',
  type: IssuerType.STAFFING_AGENCY,
  description: 'Issues claims for completed background checks and drug screens.',
  publicKey: 'pubkey_aya_v1',
  status: IssuerStatus.ACTIVE,
  authorizedClaimTypes: [
    'background_check.status',
    'drug_screen.status',
    'employment.history',
  ],
  policies: {
    maxTtlMs: 365 * 24 * 60 * 60 * 1000, // Background checks valid for 1 year
    revocationPolicy: ClaimVerificationPolicy.TRUST_AT_ISSUANCE, // If Aya is suspended later, old background checks are still valid
    decisionGradeEligible: false, // Supplementary claims, not primary source core
  },
  createdAt: '2026-02-15T00:00:00Z',
  updatedAt: '2026-02-15T00:00:00Z',
  version: 1,
};

// ── 3. A Primary Authority Issuer (Future) ───────────────────────

export const PRIMARY_AUTHORITY_ISSUER: NetworkIssuer = {
  issuerId: 'did:web:nccpa.net',
  name: 'National Commission on Certification of Physician Assistants',
  type: IssuerType.PRIMARY_AUTHORITY,
  description: 'Direct issuer of PA-C certification claims.',
  publicKey: 'pubkey_nccpa_v1',
  status: IssuerStatus.ACTIVE,
  authorizedClaimTypes: [
    'certification.pac_status',
  ],
  policies: {
    maxTtlMs: 2 * 365 * 24 * 60 * 60 * 1000, // 2 year certification cycle
    revocationPolicy: ClaimVerificationPolicy.TRUST_AT_VERIFICATION, // If NCCPA revokes their key, we must drop trust immediately
    decisionGradeEligible: true, // Direct primary source
  },
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
  version: 1,
};

// ── Network Verification Engine ──────────────────────────────────

export interface SignedClaimPayload {
  claimId: string;
  claimType: string;
  issuerId: string;
  issuedAt: string;
  signature: string;
}

/**
 * The 4-step Multi-Issuer Verification Process:
 * 1. resolve issuer in registry
 * 2. validate signature (mocked here, relies on issuer.publicKey)
 * 3. validate issuer permissions
 * 4. validate policy
 */
export function verifyNetworkClaim(
  registry: NetworkIssuer[],
  claim: SignedClaimPayload
): { valid: boolean; reason: string | null } {
  
  // Step 1: Resolve issuer
  const issuer = registry.find(r => r.issuerId === claim.issuerId);
  if (!issuer) {
    return { valid: false, reason: `Issuer ${claim.issuerId} not found in Network Trust Registry` };
  }

  // Step 2: Validate Signature
  if (!claim.signature || claim.signature === '') {
    return { valid: false, reason: `Claim ${claim.claimId} lacks a cryptographic signature` };
  }
  // (In a real system, we verify `claim.signature` using `issuer.publicKey` here)

  // Step 3: Validate Issuer Permissions
  const authorized = issuer.authorizedClaimTypes.includes('*') || issuer.authorizedClaimTypes.includes(claim.claimType);
  if (!authorized) {
    return { valid: false, reason: `Issuer ${issuer.name} is not authorized to issue claims of type ${claim.claimType}` };
  }

  // Step 4: Validate Policy (TTL & Revocation)
  const ageMs = Date.now() - new Date(claim.issuedAt).getTime();
  if (ageMs > issuer.policies.maxTtlMs) {
    return { valid: false, reason: `Claim expired. Issuer policy max TTL is ${issuer.policies.maxTtlMs}ms` };
  }

  if (issuer.status === IssuerStatus.REVOKED || issuer.status === IssuerStatus.SUSPENDED) {
    if (issuer.policies.revocationPolicy === ClaimVerificationPolicy.TRUST_AT_VERIFICATION) {
      return { valid: false, reason: `Issuer ${issuer.name} is currently ${issuer.status}` };
    }
  }

  return { valid: true, reason: null };
}
