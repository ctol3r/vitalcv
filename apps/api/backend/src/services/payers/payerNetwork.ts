/**
 * payerNetwork.ts — Wave 148: Payer Credential Network
 *
 * Manages payers as active trust nodes in the VitalCV network:
 *   - listPayerNetworks()                   — all payer network topologies
 *   - getPayerCoverage()                    — coverage regions + accepted types
 *   - validatePayerCredentialRequirements() — check if a clinician meets payer rules
 *   - getPayerNodes()                       — enriched payer nodes for GlobalTrustMap
 *   - getPayerTrustScore()                  — individual payer trust score
 *   - getPayerVerificationThroughput()      — verification volume stats
 */

import { log } from '../../obs/logger';
import { listPayerNodes, type PayerNode, verifyProviderEligibility } from './payerVerification';
import { listAllCredentials } from '../credentials/credentialWallet';
import { listIssuers } from '../registry/trustRegistry';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PayerNetworkTopology {
  payerId: string;
  payerName: string;
  tier: PayerNode['tier'];
  connectedIssuers: number;
  verifiedProviders: number;
  coverageRegions: string[];
  acceptedCredentialTypes: string[];
  networkHealth: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
  lastActivityAt: string;
}

export interface PayerCoverage {
  payerId: string;
  payerName: string;
  regions: string[];
  credentialRequirements: PayerCredentialRequirement[];
  totalCoveredProviders: number;
}

export interface PayerCredentialRequirement {
  credentialType: string;
  required: boolean;
  minimumIssuerTrustScore: number;
  acceptedIssuers: string[];
  description: string;
}

export interface PayerRequirementValidation {
  payerId: string;
  npi: string;
  meetsRequirements: boolean;
  requirementsMet: number;
  requirementsTotal: number;
  details: Array<{
    credentialType: string;
    required: boolean;
    met: boolean;
    reason: string;
  }>;
  validatedAt: string;
}

export interface PayerTrustNodeData {
  payerId: string;
  payerName: string;
  tier: PayerNode['tier'];
  trustScore: number;
  coverageRegions: string[];
  acceptedCredentialTypes: string[];
  verificationThroughput: number;
  connectedIssuers: number;
}

export interface PayerThroughput {
  payerId: string;
  payerName: string;
  totalVerifications: number;
  successfulVerifications: number;
  failedVerifications: number;
  successRate: number;
  averageResponseMs: number;
  measuredAt: string;
}

// ── Default credential requirements per payer tier ──────────────────────────────

const TIER_REQUIREMENTS: Record<PayerNode['tier'], PayerCredentialRequirement[]> = {
  NATIONAL: [
    { credentialType: 'medical-license', required: true, minimumIssuerTrustScore: 70, acceptedIssuers: [], description: 'Active state medical license' },
    { credentialType: 'board-certification', required: true, minimumIssuerTrustScore: 80, acceptedIssuers: [], description: 'Board certification in practice area' },
    { credentialType: 'npi-registration', required: true, minimumIssuerTrustScore: 60, acceptedIssuers: [], description: 'Valid NPI registration' },
    { credentialType: 'dea-registration', required: false, minimumIssuerTrustScore: 70, acceptedIssuers: [], description: 'DEA registration (if prescribing)' },
  ],
  REGIONAL: [
    { credentialType: 'medical-license', required: true, minimumIssuerTrustScore: 60, acceptedIssuers: [], description: 'Active state medical license' },
    { credentialType: 'npi-registration', required: true, minimumIssuerTrustScore: 50, acceptedIssuers: [], description: 'Valid NPI registration' },
  ],
  SPECIALTY: [
    { credentialType: 'board-certification', required: true, minimumIssuerTrustScore: 80, acceptedIssuers: [], description: 'Specialty board certification' },
    { credentialType: 'medical-license', required: true, minimumIssuerTrustScore: 70, acceptedIssuers: [], description: 'Active state medical license' },
  ],
};

// ── Simulated throughput (in production, tracked via audit ledger) ──────────────

const throughputStore = new Map<string, { total: number; success: number; fail: number }>();

function recordVerification(payerId: string, success: boolean): void {
  if (!throughputStore.has(payerId)) {
    throughputStore.set(payerId, { total: 0, success: 0, fail: 0 });
  }
  const t = throughputStore.get(payerId)!;
  t.total++;
  if (success) t.success++;
  else t.fail++;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * List all payer network topologies with enriched metadata.
 */
export function listPayerNetworks(): PayerNetworkTopology[] {
  const payers = listPayerNodes();
  const issuers = listIssuers();
  const allCreds = listAllCredentials();

  return payers.map((p) => {
    const connectedIssuers = issuers.filter((i) => i.status === 'ACTIVE').length;
    const providerNpis = new Set(allCreds.filter((c) => c.status === 'ACTIVE').map((c) => c.subject));
    const throughput = throughputStore.get(p.payerId);

    return {
      payerId: p.payerId,
      payerName: p.payerName,
      tier: p.tier,
      connectedIssuers,
      verifiedProviders: providerNpis.size,
      coverageRegions: p.coveredStates,
      acceptedCredentialTypes: TIER_REQUIREMENTS[p.tier].map((r) => r.credentialType),
      networkHealth: p.trustScore >= 80 ? 'HEALTHY' : p.trustScore >= 50 ? 'DEGRADED' : 'OFFLINE',
      lastActivityAt: throughput ? new Date().toISOString() : p.registeredAt,
    };
  });
}

/**
 * Get coverage details for a specific payer.
 */
export function getPayerCoverage(payerId: string): PayerCoverage | null {
  const payers = listPayerNodes();
  const payer = payers.find((p) => p.payerId === payerId);
  if (!payer) return null;

  const allCreds = listAllCredentials();
  const activeProviderCount = new Set(
    allCreds.filter((c) => c.status === 'ACTIVE').map((c) => c.subject),
  ).size;

  return {
    payerId: payer.payerId,
    payerName: payer.payerName,
    regions: payer.coveredStates,
    credentialRequirements: TIER_REQUIREMENTS[payer.tier],
    totalCoveredProviders: activeProviderCount,
  };
}

/**
 * Validate whether a clinician (by NPI) meets a payer's credential requirements.
 */
export async function validatePayerCredentialRequirements(
  npi: string,
  payerId: string,
): Promise<PayerRequirementValidation> {
  const payers = listPayerNodes();
  const payer = payers.find((p) => p.payerId === payerId);

  if (!payer) {
    return {
      payerId,
      npi,
      meetsRequirements: false,
      requirementsMet: 0,
      requirementsTotal: 0,
      details: [{ credentialType: 'n/a', required: true, met: false, reason: 'Unknown payer' }],
      validatedAt: new Date().toISOString(),
    };
  }

  const requirements = TIER_REQUIREMENTS[payer.tier];
  const eligibility = await verifyProviderEligibility(npi, payerId);
  const verifiedTypes = new Set(eligibility.verifiedTypes);

  const details: PayerRequirementValidation['details'] = [];
  let met = 0;

  for (const req of requirements) {
    const hasCred = verifiedTypes.has(req.credentialType);
    const trustOk = eligibility.minIssuerTrustScore >= req.minimumIssuerTrustScore;
    const satisfied = hasCred && trustOk;

    if (satisfied) met++;
    details.push({
      credentialType: req.credentialType,
      required: req.required,
      met: satisfied,
      reason: !hasCred
        ? `Missing ${req.credentialType} credential`
        : !trustOk
          ? `Issuer trust score (${eligibility.minIssuerTrustScore}) below minimum (${req.minimumIssuerTrustScore})`
          : 'Requirement satisfied',
    });
  }

  const requiredMet = details.filter((d) => d.required && d.met).length;
  const requiredTotal = details.filter((d) => d.required).length;
  const meetsRequirements = requiredMet === requiredTotal;

  // Track throughput
  recordVerification(payerId, meetsRequirements);

  log('info', 'payer_requirement_validation', { npi, payerId, meetsRequirements, met, total: requirements.length });

  return {
    payerId,
    npi,
    meetsRequirements,
    requirementsMet: met,
    requirementsTotal: requirements.length,
    details,
    validatedAt: new Date().toISOString(),
  };
}

/**
 * Enriched payer nodes for GlobalTrustMap rendering.
 */
export function getPayerNodes(): PayerTrustNodeData[] {
  const payers = listPayerNodes();
  const issuers = listIssuers();

  return payers.map((p) => ({
    payerId: p.payerId,
    payerName: p.payerName,
    tier: p.tier,
    trustScore: p.trustScore,
    coverageRegions: p.coveredStates,
    acceptedCredentialTypes: TIER_REQUIREMENTS[p.tier].map((r) => r.credentialType),
    verificationThroughput: throughputStore.get(p.payerId)?.total ?? 0,
    connectedIssuers: issuers.filter((i) => i.status === 'ACTIVE').length,
  }));
}

/**
 * Get a specific payer's trust score.
 */
export function getPayerTrustScore(payerId: string): { payerId: string; trustScore: number; tier: string } | null {
  const payers = listPayerNodes();
  const payer = payers.find((p) => p.payerId === payerId);
  if (!payer) return null;
  return { payerId: payer.payerId, trustScore: payer.trustScore, tier: payer.tier };
}

/**
 * Get verification throughput for all payers.
 */
export function getPayerVerificationThroughput(): PayerThroughput[] {
  const payers = listPayerNodes();

  return payers.map((p) => {
    const stats = throughputStore.get(p.payerId) ?? { total: 0, success: 0, fail: 0 };
    return {
      payerId: p.payerId,
      payerName: p.payerName,
      totalVerifications: stats.total,
      successfulVerifications: stats.success,
      failedVerifications: stats.fail,
      successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
      averageResponseMs: Math.round(50 + Math.random() * 100), // Simulated
      measuredAt: new Date().toISOString(),
    };
  });
}
