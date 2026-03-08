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
import {
  getIssuer,
  initializeTrustRegistryPersistence,
  type TrustedIssuer,
} from '../registry/trustRegistry';
import { listAllCredentials } from '../credentials/credentialWallet';
import type { VerifiableCredential } from '../credentials/credentialModel';
import { verifyCredential } from '../credentials/credentialVerifier';
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

const QUALIFYING_ISSUER_TRUST_LEVELS = new Set<TrustedIssuer['trustLevel']>([
  'AUTHORITATIVE',
  'TRUSTED',
]);

// ── Helpers ────────────────────────────────────────────────────────────────────

function getPayerById(payerId: string): PayerNode | undefined {
  return payerRegistry.find((p) => p.payerId === payerId);
}

function getCredentialsForNpi(npi: string): VerifiableCredential[] {
  return listAllCredentials()
    .filter((credential) => credential.subject === npi)
    .sort((left, right) => left.credentialId.localeCompare(right.credentialId));
}

function getCredentialType(cred: VerifiableCredential): string {
  return (cred.claims?.type as string) ?? (cred.claims?.credentialType as string) ?? 'unknown';
}

function isCredentialExpired(credential: VerifiableCredential, now = Date.now()): boolean {
  if (credential.status === 'EXPIRED') {
    return true;
  }

  if (!credential.expiresAt) {
    return false;
  }

  const expiresAt = new Date(credential.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

function getIssuerTrustScore(issuer: TrustedIssuer | null): number {
  return issuer?.trustScore ?? 0;
}

function sortStrings(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function describePayerIssuerEligibility(issuerId: string): {
  qualifying: boolean;
  reason: string | null;
  trustScore: number;
} {
  const issuer = getIssuer(issuerId);

  if (!issuer) {
    return {
      qualifying: false,
      reason: `Credential issuer ${issuerId} is not trusted for payer verification`,
      trustScore: 0,
    };
  }

  if (issuer.status !== 'ACTIVE') {
    return {
      qualifying: false,
      reason: `Credential issuer ${issuerId} is ${issuer.status}`,
      trustScore: getIssuerTrustScore(issuer),
    };
  }

  if (issuer.trustLevel === 'PROVISIONAL') {
    return {
      qualifying: false,
      reason: `Credential issuer ${issuerId} has PROVISIONAL trust level`,
      trustScore: getIssuerTrustScore(issuer),
    };
  }

  if (!QUALIFYING_ISSUER_TRUST_LEVELS.has(issuer.trustLevel)) {
    return {
      qualifying: false,
      reason: `Credential issuer ${issuerId} trust level ${issuer.trustLevel} is not eligible for payer verification`,
      trustScore: getIssuerTrustScore(issuer),
    };
  }

  return {
    qualifying: true,
    reason: null,
    trustScore: getIssuerTrustScore(issuer),
  };
}

function summarizeBundleFailureReason(params: {
  credential: VerifiableCredential;
  npi: string;
  verification: Awaited<ReturnType<typeof verifyCredential>>;
}): string | null {
  const { credential, npi, verification } = params;

  if (credential.subject !== npi) {
    return 'Credential subject does not match requested provider';
  }

  const signatureFailure = verification.errors.find((error) =>
    error.startsWith('Signature verification failed'),
  );
  if (signatureFailure) {
    return 'Credential signature validation failed';
  }

  const issuerEligibility = describePayerIssuerEligibility(credential.issuer);
  if (!issuerEligibility.qualifying && issuerEligibility.reason) {
    return issuerEligibility.reason;
  }

  if (isRevoked(credential.credentialId)) {
    return 'Credential revoked';
  }

  if (isCredentialExpired(credential) || !verification.checks.notExpired) {
    return 'Credential expired';
  }

  if (!verification.checks.signature) {
    return 'Credential signature validation failed';
  }

  if (!verification.checks.statusActive) {
    return 'Credential is not active';
  }

  if (!verification.valid) {
    return verification.errors[0] ?? 'Credential failed verification';
  }

  return null;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Verify if a provider (by NPI) is eligible based on their credential portfolio.
 */
export async function verifyProviderEligibility(
  npi: string,
  payerId: string,
): Promise<EligibilityResult> {
  await initializeTrustRegistryPersistence();

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
  const reasonSet = new Set<string>();
  const verifiedTypeSet = new Set<string>();
  const now = Date.now();

  let active = 0;
  let expired = 0;
  let revoked = 0;
  let minTrustScore = Number.POSITIVE_INFINITY;
  let provisionalIssuerCount = 0;
  let ignoredIssuerCount = 0;

  for (const cred of credentials) {
    if (isRevoked(cred.credentialId) || cred.status === 'REVOKED') {
      revoked++;
      continue;
    }

    if (isCredentialExpired(cred, now)) {
      expired++;
      continue;
    }

    const issuerEligibility = describePayerIssuerEligibility(cred.issuer);
    if (!issuerEligibility.qualifying) {
      if (issuerEligibility.reason) {
        reasonSet.add(issuerEligibility.reason);
      }

      if (getIssuer(cred.issuer)?.trustLevel === 'PROVISIONAL') {
        provisionalIssuerCount++;
      } else {
        ignoredIssuerCount++;
      }
      continue;
    }

    active++;
    minTrustScore = Math.min(minTrustScore, issuerEligibility.trustScore);

    const credentialType = getCredentialType(cred);
    if (credentialType !== 'unknown') {
      verifiedTypeSet.add(credentialType);
    }
  }

  if (active === 0) {
    minTrustScore = 0;
  }

  let status: EligibilityStatus = 'ELIGIBLE';
  if (active === 0) {
    status = 'INELIGIBLE';
    if (credentials.length === 0 || expired > 0 || revoked > 0) {
      reasonSet.add('No active credentials found');
    } else {
      reasonSet.add('No active credentials from AUTHORITATIVE or TRUSTED issuers');
    }
  } else if (revoked > 0) {
    status = 'NEEDS_REVIEW';
    reasonSet.add(`${revoked} credential(s) revoked - manual review required`);
  } else if (expired > active) {
    status = 'NEEDS_REVIEW';
    reasonSet.add('More expired credentials than active - review freshness');
  } else if (provisionalIssuerCount > 0) {
    status = 'NEEDS_REVIEW';
  } else if (ignoredIssuerCount > 0) {
    reasonSet.add(`Ignored ${ignoredIssuerCount} credential(s) from inactive or non-qualifying issuers`);
  }

  if (status === 'ELIGIBLE') {
    reasonSet.add('All qualifying credential checks passed');
  }

  log('info', 'payer_eligibility_check', { npi, payerId, status, active, expired, revoked });

  return {
    npi,
    payerId,
    status,
    activeCredentials: active,
    expiredCredentials: expired,
    revokedCredentials: revoked,
    minIssuerTrustScore: Number.isFinite(minTrustScore) ? minTrustScore : 0,
    verifiedTypes: sortStrings(verifiedTypeSet),
    checkedAt: new Date().toISOString(),
    reasons: sortStrings(reasonSet),
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
  await initializeTrustRegistryPersistence();

  const allCredentials = new Map(
    listAllCredentials().map((credential) => [credential.credentialId, credential] as const),
  );
  const details: BundleVerificationResult['details'] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (const credId of [...credentialIds].sort((left, right) => left.localeCompare(right))) {
    const cred = allCredentials.get(credId);
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

    const verification = await verifyCredential(cred);
    const failureReason = summarizeBundleFailureReason({
      credential: cred,
      npi,
      verification,
    });

    if (failureReason) {
      details.push({
        credentialId: credId,
        credentialType: getCredentialType(cred),
        issuer: cred.issuer,
        valid: false,
        reason: failureReason,
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
