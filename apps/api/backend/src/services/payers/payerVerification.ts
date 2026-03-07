/**
 * payerVerification.ts — Wave 142: Payer Network Integration
 *
 * Allows insurance payers to verify clinician authority using VitalCV:
 *   - verifyProviderEligibility()  — check if a provider is active + credentialed
 *   - verifyCredentialBundle()     — validate a set of credentials against payer requirements
 *   - checkNetworkStatus()         — verify a provider's in-network standing
 *   - listPayerNodes()             — return payer trust nodes for GlobalTrustMap
 *
 * Integrates with trustRegistry, credentialWallet, and reputationEngine.
 */

import { log } from '../../obs/logger';
import { listIssuers, type TrustedIssuer } from '../registry/trustRegistry';
import { listAllCredentials } from '../credentials/credentialWallet';
import type { VerifiableCredential } from '../credentials/credentialModel';
import { isRevoked } from '../revocation/revocationRegistry';

// ── Types ──────────────────────────────────────────────────────────────────────

export type PayerTier = 'NATIONAL' | 'REGIONAL' | 'SPECIALTY';
export type NetworkStatus = 'IN_NETWORK' | 'OUT_OF_NETWORK' | 'PENDING' | 'TERMINATED';
export type EligibilityStatus = 'ELIGIBLE' | 'INELIGIBLE' | 'NEEDS_REVIEW' | 'EXPIRED';

export interface PayerNode {
  payerId: string;
  payerName: string;
  tier: PayerTier;
  networkType: string;
  coveredStates: string[];
  registeredAt: string;
  /** Trust score derived from verification history */
  trustScore: number;
}

export interface EligibilityResult {
  npi: string;
  payerId: string;
  status: EligibilityStatus;
  activeCredentials: number;
  expiredCredentials: number;
  revokedCredentials: number;
  /** Minimum issuer trust score across active credentials */
  minIssuerTrustScore: number;
  /** All credential types verified */
  verifiedTypes: string[];
  checkedAt: string;
  reasons: string[];
}

export interface BundleVerificationResult {
  payerId: string;
  npi: string;
  bundleSize: number;
  validCredentials: number;
  invalidCredentials: number;
  /** Per-credential detail */
  details: Array<{
    credentialId: string;
    credentialType: string;
    issuer: string;
    valid: boolean;
    reason?: string;
  }>;
  overallValid: boolean;
  checkedAt: string;
}

export interface NetworkStatusResult {
  npi: string;
  payerId: string;
  status: NetworkStatus;
  effectiveDate: string;
  /** If terminated, the date when terminated */
  terminationDate?: string;
  coveredSpecialties: string[];
  checkedAt: string;
}

// ── Seed payer data ────────────────────────────────────────────────────────────

const SEED_PAYERS: PayerNode[] = [
  {
    payerId: 'payer:unitedhealth',
    payerName: 'UnitedHealthcare',
    tier: 'NATIONAL',
    networkType: 'PPO/HMO',
    coveredStates: ['ALL'],
    registeredAt: '2025-03-01T00:00:00Z',
    trustScore: 92,
  },
  {
    payerId: 'payer:anthem',
    payerName: 'Anthem Blue Cross',
    tier: 'NATIONAL',
    networkType: 'PPO/EPO',
    coveredStates: ['CA', 'NY', 'OH', 'IN', 'VA'],
    registeredAt: '2025-03-01T00:00:00Z',
    trustScore: 89,
  },
  {
    payerId: 'payer:aetna',
    payerName: 'Aetna (CVS Health)',
    tier: 'NATIONAL',
    networkType: 'PPO/HMO',
    coveredStates: ['ALL'],
    registeredAt: '2025-03-15T00:00:00Z',
    trustScore: 91,
  },
  {
    payerId: 'payer:kaiser',
    payerName: 'Kaiser Permanente',
    tier: 'REGIONAL',
    networkType: 'HMO',
    coveredStates: ['CA', 'CO', 'GA', 'HI', 'MD', 'OR', 'VA', 'WA'],
    registeredAt: '2025-04-01T00:00:00Z',
    trustScore: 95,
  },
  {
    payerId: 'payer:cigna',
    payerName: 'Cigna Healthcare',
    tier: 'NATIONAL',
    networkType: 'PPO/HMO',
    coveredStates: ['ALL'],
    registeredAt: '2025-04-01T00:00:00Z',
    trustScore: 88,
  },
];

let payerRegistry: PayerNode[] = [...SEED_PAYERS];

// ── Helpers ────────────────────────────────────────────────────────────────────

function getPayerById(payerId: string): PayerNode | undefined {
  return payerRegistry.find((p) => p.payerId === payerId);
}

function getCredentialsForNpi(npi: string): VerifiableCredential[] {
  const all = listAllCredentials();
  return all.filter((c) => c.subject === npi || c.subject?.includes(npi));
}

function getCredentialType(cred: VerifiableCredential): string {
  return (cred.claims?.type as string) ?? (cred.claims?.credentialType as string) ?? 'unknown';
}

function getIssuerTrustScore(issuerId: string): number {
  const issuers = listIssuers();
  const issuer = issuers.find((i) => i.issuerId === issuerId);
  return issuer?.trustScore ?? 50;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Verify if a provider (by NPI) is eligible based on their credential portfolio.
 */
export async function verifyProviderEligibility(
  npi: string,
  payerId: string,
): Promise<EligibilityResult> {
  const payer = getPayerById(payerId);
  if (!payer) {
    return {
      npi,
      payerId,
      status: 'INELIGIBLE',
      activeCredentials: 0,
      expiredCredentials: 0,
      revokedCredentials: 0,
      minIssuerTrustScore: 0,
      verifiedTypes: [],
      checkedAt: new Date().toISOString(),
      reasons: ['Unknown payer ID'],
    };
  }

  const credentials = getCredentialsForNpi(npi);
  const reasons: string[] = [];

  let active = 0;
  let expired = 0;
  let revoked = 0;
  let minTrustScore = 100;
  const verifiedTypes: string[] = [];

  for (const cred of credentials) {
    const credRevoked = isRevoked(cred.credentialId);

    if (credRevoked) {
      revoked++;
      continue;
    }

    if (cred.status === 'EXPIRED') {
      expired++;
      continue;
    }

    active++;
    const issuerScore = getIssuerTrustScore(cred.issuer);
    minTrustScore = Math.min(minTrustScore, issuerScore);
    const ct = getCredentialType(cred);
    if (ct !== 'unknown' && !verifiedTypes.includes(ct)) {
      verifiedTypes.push(ct);
    }
  }

  if (active === 0 && credentials.length === 0) minTrustScore = 0;

  let status: EligibilityStatus = 'ELIGIBLE';
  if (active === 0) {
    status = 'INELIGIBLE';
    reasons.push('No active credentials found');
  } else if (revoked > 0) {
    status = 'NEEDS_REVIEW';
    reasons.push(`${revoked} credential(s) revoked — manual review required`);
  } else if (expired > active) {
    status = 'NEEDS_REVIEW';
    reasons.push('More expired credentials than active — review freshness');
  } else if (minTrustScore < 50) {
    status = 'NEEDS_REVIEW';
    reasons.push(`Low issuer trust score (${minTrustScore}) — review credential sources`);
  }

  if (status === 'ELIGIBLE') {
    reasons.push('All credential checks passed');
  }

  log('info', 'payer_eligibility_check', { npi, payerId, status, active, expired, revoked });

  return {
    npi,
    payerId,
    status,
    activeCredentials: active,
    expiredCredentials: expired,
    revokedCredentials: revoked,
    minIssuerTrustScore: active > 0 ? minTrustScore : 0,
    verifiedTypes,
    checkedAt: new Date().toISOString(),
    reasons,
  };
}

/**
 * Validate a specific credential bundle against payer requirements.
 */
export async function verifyCredentialBundle(
  npi: string,
  payerId: string,
  credentialIds: string[],
): Promise<BundleVerificationResult> {
  const allCredentials = listAllCredentials();
  const details: BundleVerificationResult['details'] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (const credId of credentialIds) {
    const cred = allCredentials.find((c) => c.credentialId === credId);
    if (!cred) {
      details.push({
        credentialId: credId,
        credentialType: 'unknown',
        issuer: 'unknown',
        valid: false,
        reason: 'Credential not found',
      });
      invalidCount++;
      continue;
    }

    const revoked = isRevoked(credId);
    if (revoked) {
      details.push({
        credentialId: credId,
        credentialType: getCredentialType(cred),
        issuer: cred.issuer,
        valid: false,
        reason: 'Credential revoked',
      });
      invalidCount++;
      continue;
    }

    if (cred.status === 'EXPIRED') {
      details.push({
        credentialId: credId,
        credentialType: getCredentialType(cred),
        issuer: cred.issuer,
        valid: false,
        reason: 'Credential expired',
      });
      invalidCount++;
      continue;
    }

    const issuerScore = getIssuerTrustScore(cred.issuer);
    if (issuerScore < 30) {
      details.push({
        credentialId: credId,
        credentialType: getCredentialType(cred),
        issuer: cred.issuer,
        valid: false,
        reason: `Issuer trust score too low (${issuerScore})`,
      });
      invalidCount++;
      continue;
    }

    details.push({
      credentialId: credId,
      credentialType: getCredentialType(cred),
      issuer: cred.issuer,
      valid: true,
    });
    validCount++;
  }

  log('info', 'payer_bundle_verification', { npi, payerId, total: credentialIds.length, valid: validCount, invalid: invalidCount });

  return {
    payerId,
    npi,
    bundleSize: credentialIds.length,
    validCredentials: validCount,
    invalidCredentials: invalidCount,
    details,
    overallValid: invalidCount === 0 && validCount > 0,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Check a provider's network status with a payer.
 * Simulates lookup — in production would hit payer APIs.
 */
export async function checkNetworkStatus(
  npi: string,
  payerId: string,
): Promise<NetworkStatusResult> {
  const payer = getPayerById(payerId);
  if (!payer) {
    return {
      npi,
      payerId,
      status: 'OUT_OF_NETWORK',
      effectiveDate: new Date().toISOString(),
      coveredSpecialties: [],
      checkedAt: new Date().toISOString(),
    };
  }

  // Simulate network check based on credential status
  const eligibility = await verifyProviderEligibility(npi, payerId);

  let status: NetworkStatus = 'OUT_OF_NETWORK';
  if (eligibility.status === 'ELIGIBLE' && eligibility.activeCredentials >= 2) {
    status = 'IN_NETWORK';
  } else if (eligibility.status === 'ELIGIBLE' || eligibility.status === 'NEEDS_REVIEW') {
    status = 'PENDING';
  }

  log('info', 'payer_network_check', { npi, payerId, status });

  return {
    npi,
    payerId,
    status,
    effectiveDate: '2025-01-01T00:00:00Z',
    coveredSpecialties: eligibility.verifiedTypes,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * List all payer trust nodes for GlobalTrustMap rendering.
 */
export function listPayerNodes(): PayerNode[] {
  return [...payerRegistry];
}

/**
 * Register a new payer node.
 */
export function registerPayer(payer: Omit<PayerNode, 'registeredAt' | 'trustScore'>): PayerNode {
  const node: PayerNode = {
    ...payer,
    trustScore: 50, // Starts at baseline
    registeredAt: new Date().toISOString(),
  };
  payerRegistry.push(node);
  log('info', 'payer_registered', { payerId: node.payerId, payerName: node.payerName });
  return node;
}
