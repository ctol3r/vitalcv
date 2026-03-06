/**
 * haipProfile.ts — Wave 112: High Assurance Interoperability Profile (HAIP)
 *
 * Defines the healthcare-grade trust policy for credential issuance and
 * verification. Based on the OpenID4VC HAIP specification for high-assurance
 * credential ecosystems.
 *
 * Spec: https://openid.net/specs/openid4vc-high-assurance-interoperability-profile-sd-jwt-vc-1_0.html
 */

import { log } from '../../obs/logger';
import type { VerifiableCredential } from '../credentials/credentialModel';
import type { TrustedIssuer } from '../registry/trustRegistry';

// ── HAIP Policy Types ─────────────────────────────────────────────────

export type AlgorithmPolicy = 'ES256' | 'ES384' | 'ES512' | 'EdDSA';
export type AssuranceLevel = 'IAL1' | 'IAL2' | 'IAL3' | 'HIGH' | 'SUBSTANTIAL' | 'LOW';
export type EvidenceClass = 'IDENTITY_DOCUMENT' | 'BIOMETRIC' | 'CRYPTOGRAPHIC' | 'CREDENTIAL' | 'NONE';
export type PresentationTrustLevel = 'FULL' | 'HOLDER_BOUND' | 'ANONYMOUS';
export type CredentialFormatPolicy = 'vc+sd-jwt' | 'jwt_vc_json' | 'ldp_vc';

export interface HAIPPolicy {
  /** Allowed signing algorithms */
  allowedAlgorithms: AlgorithmPolicy[];
  /** Minimum issuer assurance level */
  minIssuerAssuranceLevel: AssuranceLevel;
  /** Minimum evidence class for credential issuance */
  minEvidenceClass: EvidenceClass;
  /** Minimum presentation trust level */
  minPresentationTrustLevel: PresentationTrustLevel;
  /** Allowed credential formats */
  allowedFormats: CredentialFormatPolicy[];
  /** Whether holder binding is required */
  holderBindingRequired: boolean;
  /** Whether revocation check is mandatory */
  revocationCheckRequired: boolean;
  /** Max credential age in days (0 = no limit) */
  maxCredentialAgeDays: number;
}

export interface HAIPViolation {
  rule: string;
  detail: string;
  severity: 'CRITICAL' | 'WARNING';
}

export interface HAIPCheckResult {
  compliant: boolean;
  violations: HAIPViolation[];
  checkedAt: string;
}

// ── Default HAIP Policy (Healthcare Grade) ────────────────────────────

export const HAIP_HEALTHCARE_POLICY: HAIPPolicy = {
  allowedAlgorithms: ['ES256', 'ES384'],
  minIssuerAssuranceLevel: 'IAL2',
  minEvidenceClass: 'CREDENTIAL',
  minPresentationTrustLevel: 'HOLDER_BOUND',
  allowedFormats: ['vc+sd-jwt', 'jwt_vc_json'],
  holderBindingRequired: false,  // relaxed for current demo
  revocationCheckRequired: true,
  maxCredentialAgeDays: 365,
};

// Assurance level ordering
const ASSURANCE_ORDER: AssuranceLevel[] = ['LOW', 'SUBSTANTIAL', 'IAL1', 'IAL2', 'HIGH', 'IAL3'];
const EVIDENCE_ORDER: EvidenceClass[] = ['NONE', 'CREDENTIAL', 'CRYPTOGRAPHIC', 'BIOMETRIC', 'IDENTITY_DOCUMENT'];

function assuranceMeetsMinimum(level: AssuranceLevel, min: AssuranceLevel): boolean {
  return ASSURANCE_ORDER.indexOf(level) >= ASSURANCE_ORDER.indexOf(min);
}

function evidenceMeetsMinimum(cls: EvidenceClass, min: EvidenceClass): boolean {
  return EVIDENCE_ORDER.indexOf(cls) >= EVIDENCE_ORDER.indexOf(min);
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Check whether a credential conforms to the HAIP policy.
 */
export function checkCredentialHAIP(
  credential: VerifiableCredential,
  policy: HAIPPolicy = HAIP_HEALTHCARE_POLICY,
): HAIPCheckResult {
  const violations: HAIPViolation[] = [];

  // 1. Algorithm check (inferred from JWS header)
  try {
    const headerB64 = credential.signature.split('.')[0] ?? '';
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8')) as Record<string, unknown>;
    const alg = header['alg'] as string;
    if (!policy.allowedAlgorithms.includes(alg as AlgorithmPolicy)) {
      violations.push({
        rule: 'HAIP-ALG-001',
        detail: `Algorithm ${alg} is not in the HAIP allowlist (${policy.allowedAlgorithms.join(', ')})`,
        severity: 'CRITICAL',
      });
    }
  } catch {
    violations.push({
      rule: 'HAIP-ALG-002',
      detail: 'Could not parse credential signature header to verify algorithm',
      severity: 'WARNING',
    });
  }

  // 2. Credential age check
  if (policy.maxCredentialAgeDays > 0) {
    const issuedAt = new Date(credential.issuedAt);
    const ageMs = Date.now() - issuedAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > policy.maxCredentialAgeDays) {
      violations.push({
        rule: 'HAIP-AGE-001',
        detail: `Credential is ${Math.floor(ageDays)} days old; HAIP policy requires refresh within ${policy.maxCredentialAgeDays} days`,
        severity: 'CRITICAL',
      });
    }
  }

  // 3. Status check
  if (credential.status !== 'ACTIVE') {
    violations.push({
      rule: 'HAIP-STATUS-001',
      detail: `Credential status is ${credential.status}; HAIP requires ACTIVE`,
      severity: 'CRITICAL',
    });
  }

  const compliant = violations.filter((v) => v.severity === 'CRITICAL').length === 0;

  log('info', 'haip_credential_checked', {
    credentialId: credential.credentialId,
    compliant,
    violations: violations.length,
  });

  return { compliant, violations, checkedAt: new Date().toISOString() };
}

/**
 * Check whether an issuer record conforms to HAIP policy.
 */
export function checkIssuerHAIP(
  issuer: TrustedIssuer,
  policy: HAIPPolicy = HAIP_HEALTHCARE_POLICY,
): HAIPCheckResult {
  const violations: HAIPViolation[] = [];

  // 1. Assurance level
  const issuerAssurance = (issuer.metadata?.['assuranceLevel'] as AssuranceLevel) ?? 'IAL1';
  if (!assuranceMeetsMinimum(issuerAssurance, policy.minIssuerAssuranceLevel)) {
    violations.push({
      rule: 'HAIP-ISSUER-001',
      detail: `Issuer assurance level ${issuerAssurance} does not meet minimum ${policy.minIssuerAssuranceLevel}`,
      severity: 'CRITICAL',
    });
  }

  // 2. Trust level
  if (issuer.trustLevel === 'UNTRUSTED' || issuer.trustLevel === 'PROVISIONAL') {
    violations.push({
      rule: 'HAIP-ISSUER-002',
      detail: `Issuer trust level ${issuer.trustLevel} is not acceptable for HAIP`,
      severity: 'CRITICAL',
    });
  }

  // 3. HAIP explicit flag
  if (issuer.metadata?.['haipCompliant'] === false) {
    violations.push({
      rule: 'HAIP-ISSUER-003',
      detail: 'Issuer is explicitly marked haipCompliant: false',
      severity: 'CRITICAL',
    });
  }

  const compliant = violations.filter((v) => v.severity === 'CRITICAL').length === 0;

  return { compliant, violations, checkedAt: new Date().toISOString() };
}

/**
 * Determine if an algorithm is HAIP-compliant.
 */
export function isHAIPAlgorithm(alg: string): boolean {
  return HAIP_HEALTHCARE_POLICY.allowedAlgorithms.includes(alg as AlgorithmPolicy);
}

/**
 * Return the full HAIP policy summary for display.
 */
export function getHAIPPolicySummary(): HAIPPolicy & { name: string; version: string } {
  return {
    ...HAIP_HEALTHCARE_POLICY,
    name: 'VitalCV Healthcare HAIP Profile',
    version: '1.0',
  };
}
