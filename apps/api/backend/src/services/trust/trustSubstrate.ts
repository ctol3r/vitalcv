/**
 * trustSubstrate.ts — Substrate Consolidation: Phase 1
 *
 * Healthcare-native trust substrate — the single authoritative entry point
 * for computing the trust state of a clinician (by NPI/DID subject).
 *
 * Unifies:
 *   - credentialVerifier      — signature, issuer, DID, expiry, revocation
 *   - revocationRegistry      — hard revocation checks
 *   - reputationEngine        — issuer trust scores (0–100)
 *   - trustRegistry           — issuer records + HAIP profile flags
 *   - haipProfile             — HAIP compliance checks
 *   - federationMetadata      — OpenID Federation entity trust health
 *
 * Trust Band (L0–L3):
 *   L3  Authoritative  — All creds valid, HAIP compliant, authoritative
 *                         issuers (score ≥ 80), no revocations, federation OK
 *   L2  Trusted        — Valid creds, trusted issuers (score ≥ 60), no
 *                         active revocations, minor HAIP warnings only
 *   L1  Provisional    — Some valid creds, mixed/provisional issuers,
 *                         warnings present, reputation < 60
 *   L0  Untrusted      — No valid credentials, revoked creds, critical HAIP
 *                         violations, or entirely untrusted issuers
 */

import { log } from '../../obs/logger';
import { getCredentialsForSubject } from '../credentials/credentialWallet';
import { verifyCredential } from '../credentials/credentialVerifier';
import { isRevoked } from '../revocation/revocationRegistry';
import {
  getIssuer,
  initializeTrustRegistryPersistence,
  listIssuers,
} from '../registry/trustRegistry';
import { calculateTrustScore } from './reputationEngine';
import { checkCredentialHAIP, checkIssuerHAIP, HAIP_HEALTHCARE_POLICY } from './haipProfile';
import {
  validateFederationTrust,
  listFederationEntities,
  type FederationTrustResult,
} from '../federation/federationMetadata';
import type { VerifiableCredential } from '../credentials/credentialModel';
import type { TrustedIssuer } from '../registry/trustRegistry';
import type { HAIPCheckResult, HAIPViolation } from './haipProfile';

// ── Trust Band ────────────────────────────────────────────────────────

export type TrustBand = 'L0' | 'L1' | 'L2' | 'L3';

export const TRUST_BAND_LABELS: Record<TrustBand, string> = {
  L3: 'Authoritative',
  L2: 'Trusted',
  L1: 'Provisional',
  L0: 'Untrusted',
};

// ── Result Types ──────────────────────────────────────────────────────

export interface IssuerTrustDetail {
  issuerId: string;
  issuerName: string;
  trustLevel: string;
  trustScore: number;
  haipCompliant: boolean;
  status: string;
}

export interface CredentialRiskDetail {
  credentialId: string;
  issuer: string;
  status: string;
  revoked: boolean;
  expired: boolean;
  haipViolations: HAIPViolation[];
  verificationErrors: string[];
}

export interface RevocationStateDetail {
  revokedCount: number;
  revokedCredentialIds: string[];
  hasActiveRevocations: boolean;
}

export interface FederationTrustHealth {
  totalEntities: number;
  trustedEntities: number;
  degradedEntities: string[];
  healthScore: number; // 0–100
}

export interface SubstrateTrustResult {
  /** Subject NPI or DID that was evaluated */
  subject: string;
  /** Computed trust band */
  band: TrustBand;
  /** Human-readable label for the band */
  bandLabel: string;
  /** Explanation of why this band was assigned */
  explanation: string;
  /** Per-issuer trust details for all issuers of subject's credentials */
  issuerTrust: IssuerTrustDetail[];
  /** Risk details for each credential */
  credentialRisk: CredentialRiskDetail[];
  /** Revocation state */
  revocationState: RevocationStateDetail;
  /** Overall HAIP compliance result */
  haipCompliance: HAIPCheckResult;
  /** Federation trust health snapshot */
  federationTrustHealth: FederationTrustHealth;
  /** ISO-8601 timestamp of this computation */
  computedAt: string;
}

// ── Internal helpers ──────────────────────────────────────────────────

function buildIssuerTrustDetail(issuer: TrustedIssuer): IssuerTrustDetail {
  const haipResult = checkIssuerHAIP(issuer, HAIP_HEALTHCARE_POLICY);
  const trustScore = calculateTrustScore({
    issuerId: issuer.issuerId,
    totalCredentialsIssued: issuer.verificationCount ?? 0,
    verificationSuccessCount: Math.max(0, (issuer.verificationCount ?? 0) - (issuer.revocationCount ?? 0)),
    verificationFailureCount: issuer.revocationCount ?? 0,
    revocationCount: issuer.revocationCount ?? 0,
    trustLevel: issuer.trustLevel,
  });
  return {
    issuerId: issuer.issuerId,
    issuerName: issuer.issuerName,
    trustLevel: issuer.trustLevel,
    trustScore: issuer.trustScore ?? trustScore,
    haipCompliant: haipResult.compliant,
    status: issuer.status,
  };
}

async function buildCredentialRisk(cred: VerifiableCredential): Promise<CredentialRiskDetail> {
  const revokedEntry = isRevoked(cred.credentialId);
  const now = new Date();
  const expired = cred.expiresAt ? new Date(cred.expiresAt) <= now : false;

  // HAIP credential check
  const haipResult = checkCredentialHAIP(cred, HAIP_HEALTHCARE_POLICY);

  // Full verification (signature + issuer + revocation + status)
  let verificationErrors: string[] = [];
  try {
    const verifyResult = await verifyCredential(cred);
    if (!verifyResult.valid) {
      verificationErrors = verifyResult.errors;
    }
  } catch (err) {
    verificationErrors = [err instanceof Error ? err.message : 'Unknown verification error'];
  }

  return {
    credentialId: cred.credentialId,
    issuer: cred.issuer,
    status: cred.status,
    revoked: !!revokedEntry,
    expired,
    haipViolations: haipResult.violations,
    verificationErrors,
  };
}

function computeFederationHealth(
  federationResults: FederationTrustResult[],
): FederationTrustHealth {
  const entities = listFederationEntities();
  const totalEntities = entities.length;
  const trustedCount = federationResults.filter((r) => r.trusted).length;
  const degradedEntities = federationResults
    .filter((r) => !r.trusted)
    .map((r) => r.entityId);

  const healthScore = totalEntities === 0
    ? 100 // No federation configured → not degraded
    : Math.round((trustedCount / totalEntities) * 100);

  return {
    totalEntities,
    trustedEntities: trustedCount,
    degradedEntities,
    healthScore,
  };
}

function mergeHAIPResults(results: HAIPCheckResult[]): HAIPCheckResult {
  const allViolations: HAIPViolation[] = results.flatMap((r) => r.violations);
  return {
    compliant: allViolations.filter((v) => v.severity === 'CRITICAL').length === 0,
    violations: allViolations,
    checkedAt: new Date().toISOString(),
  };
}

function deriveBand(
  credentials: VerifiableCredential[],
  credentialRisks: CredentialRiskDetail[],
  issuerTrust: IssuerTrustDetail[],
  revocationState: RevocationStateDetail,
  haipCompliance: HAIPCheckResult,
  federationHealth: FederationTrustHealth,
): { band: TrustBand; explanation: string } {
  const activeCredentials = credentialRisks.filter(
    (r) => !r.revoked && !r.expired && r.verificationErrors.length === 0,
  );
  const criticalHAIPViolations = haipCompliance.violations.filter(
    (v) => v.severity === 'CRITICAL',
  );

  // L0: hard blockers
  if (credentials.length === 0) {
    return { band: 'L0', explanation: 'No credentials on record for this subject.' };
  }
  if (revocationState.hasActiveRevocations) {
    return {
      band: 'L0',
      explanation: `Subject has ${revocationState.revokedCount} revoked credential(s).`,
    };
  }
  if (criticalHAIPViolations.length > 0) {
    return {
      band: 'L0',
      explanation: `Critical HAIP violations: ${criticalHAIPViolations.map((v) => v.rule).join(', ')}.`,
    };
  }
  if (issuerTrust.every((i) => i.trustLevel === 'UNTRUSTED')) {
    return { band: 'L0', explanation: 'All issuers are marked UNTRUSTED.' };
  }
  if (activeCredentials.length === 0) {
    return { band: 'L0', explanation: 'No valid (non-revoked, non-expired, verified) credentials.' };
  }

  // L3: all conditions at maximum assurance
  const allIssuersAuthoritative = issuerTrust.every(
    (i) => i.trustLevel === 'AUTHORITATIVE' && i.trustScore >= 80,
  );
  const noHAIPWarnings = haipCompliance.violations.length === 0;
  const federationHealthy = federationHealth.healthScore >= 80 || federationHealth.totalEntities === 0;
  const allCredentialsValid = activeCredentials.length === credentials.length;
  const allHAIPCompliant = issuerTrust.every((i) => i.haipCompliant);

  if (
    allIssuersAuthoritative &&
    noHAIPWarnings &&
    federationHealthy &&
    allCredentialsValid &&
    allHAIPCompliant
  ) {
    return {
      band: 'L3',
      explanation:
        'All credentials valid. Issuers are authoritative with high reputation. HAIP compliant. Federation healthy.',
    };
  }

  // L2: trusted with minor issues
  const mostIssuersGood = issuerTrust.every(
    (i) => i.trustLevel !== 'UNTRUSTED' && i.trustScore >= 60,
  );
  const noHAIPCritical = criticalHAIPViolations.length === 0;
  const mostCredentialsValid = activeCredentials.length > 0;

  if (mostIssuersGood && noHAIPCritical && mostCredentialsValid) {
    const reasons: string[] = [];
    if (haipCompliance.violations.length > 0) reasons.push('minor HAIP warnings');
    if (!federationHealthy) reasons.push('degraded federation entities');
    if (!allIssuersAuthoritative) reasons.push('non-authoritative issuers');
    if (!allCredentialsValid) reasons.push('some credentials expired or invalid');
    return {
      band: 'L2',
      explanation: `Valid credentials, trusted issuers.${reasons.length > 0 ? ` Note: ${reasons.join('; ')}.` : ''}`,
    };
  }

  // L1: provisional
  return {
    band: 'L1',
    explanation:
      'Some valid credentials present, but issuer reputation, HAIP compliance, or federation health is below trusted threshold.',
  };
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Compute the full trust state for a clinician subject (NPI or DID).
 * This is the single authoritative entry point for all trust decisions.
 */
export async function computeSubstrateTrustState(
  subject: string,
): Promise<SubstrateTrustResult> {
  await initializeTrustRegistryPersistence();
  const startMs = Date.now();

  // 1. Load credentials for subject
  const credentials = getCredentialsForSubject(subject);

  // 2. Build credential risk profiles (parallel)
  const credentialRisks = await Promise.all(credentials.map(buildCredentialRisk));

  // 3. Collect unique issuers and build trust details
  const issuerIds = [...new Set(credentials.map((c) => c.issuer))];
  const issuerTrust: IssuerTrustDetail[] = [];
  for (const issuerId of issuerIds) {
    const issuerRecord = getIssuer(issuerId);
    if (issuerRecord) {
      issuerTrust.push(buildIssuerTrustDetail(issuerRecord));
    } else {
      // Unknown issuer → mark untrusted
      issuerTrust.push({
        issuerId,
        issuerName: 'Unknown Issuer',
        trustLevel: 'UNTRUSTED',
        trustScore: 0,
        haipCompliant: false,
        status: 'UNKNOWN',
      });
    }
  }

  // 4. Revocation state
  const revokedRisks = credentialRisks.filter((r) => r.revoked);
  const revocationState: RevocationStateDetail = {
    revokedCount: revokedRisks.length,
    revokedCredentialIds: revokedRisks.map((r) => r.credentialId),
    hasActiveRevocations: revokedRisks.length > 0,
  };

  // 5. Merged HAIP compliance across all credentials
  const credentialHAIPResults = credentials.map((cred) =>
    checkCredentialHAIP(cred, HAIP_HEALTHCARE_POLICY),
  );
  const issuerHAIPResults = issuerTrust
    .map((it) => {
      const rec = getIssuer(it.issuerId);
      return rec ? checkIssuerHAIP(rec, HAIP_HEALTHCARE_POLICY) : null;
    })
    .filter(Boolean) as HAIPCheckResult[];
  const haipCompliance = mergeHAIPResults([...credentialHAIPResults, ...issuerHAIPResults]);

  // 6. Federation trust health
  const federationEntities = listFederationEntities();
  const federationResults = await Promise.all(
    federationEntities.map((e) => validateFederationTrust(e.entityId)),
  );
  const federationTrustHealth = computeFederationHealth(federationResults);

  // 7. Derive band
  const { band, explanation } = deriveBand(
    credentials,
    credentialRisks,
    issuerTrust,
    revocationState,
    haipCompliance,
    federationTrustHealth,
  );

  const result: SubstrateTrustResult = {
    subject,
    band,
    bandLabel: TRUST_BAND_LABELS[band],
    explanation,
    issuerTrust,
    credentialRisk: credentialRisks,
    revocationState,
    haipCompliance,
    federationTrustHealth,
    computedAt: new Date().toISOString(),
  };

  log('info', 'substrate_trust_computed', {
    subject,
    band,
    credentialCount: credentials.length,
    issuerCount: issuerTrust.length,
    revokedCount: revocationState.revokedCount,
    haipCompliant: haipCompliance.compliant,
    federationScore: federationTrustHealth.healthScore,
    elapsedMs: Date.now() - startMs,
  });

  return result;
}

/**
 * Lightweight band-only check — for use in hot paths where you only
 * need the band without the full risk breakdown.
 */
export async function getSubstrateBand(subject: string): Promise<TrustBand> {
  const result = await computeSubstrateTrustState(subject);
  return result.band;
}
