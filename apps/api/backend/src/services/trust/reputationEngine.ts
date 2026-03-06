/**
 * reputationEngine.ts — Wave 105: Trust Network Reputation
 *
 * Calculates a trust score (0–100) for issuers based on:
 * - Verification success rate (higher = better)
 * - Revocation rate (higher = worse)
 * - Issuer history (trust level multiplier)
 * - Credential age distribution
 *
 * Scores update in memory and are written back into the trustRegistry.
 */

import { log } from '../../obs/logger';
import { listIssuers, updateIssuerReputation, type TrustedIssuer } from '../registry/trustRegistry';
import { listRevocations } from '../revocation/revocationRegistry';
import { listAllCredentials } from '../credentials/credentialWallet';

// ── Types ─────────────────────────────────────────────────────────────

export interface IssuerReputationInput {
  issuerId: string;
  totalCredentialsIssued: number;
  verificationSuccessCount: number;
  verificationFailureCount: number;
  revocationCount: number;
  trustLevel: TrustedIssuer['trustLevel'];
}

export interface IssuerReputationResult {
  issuerId: string;
  issuerName: string;
  trustScore: number;               // 0–100
  verificationSuccessRate: number;  // 0–1
  revocationRate: number;           // 0–1
  totalCredentials: number;
  revocationCount: number;
  verificationCount: number;
  calculatedAt: string;
}

// ── Trust level multipliers ───────────────────────────────────────────

const TRUST_LEVEL_MULTIPLIER: Record<TrustedIssuer['trustLevel'], number> = {
  AUTHORITATIVE: 1.0,
  TRUSTED: 0.90,
  PROVISIONAL: 0.70,
  UNTRUSTED: 0.30,
};

// ── Score calculation ─────────────────────────────────────────────────

function calculateTrustScore(input: IssuerReputationInput): number {
  const {
    totalCredentialsIssued,
    verificationSuccessCount,
    verificationFailureCount,
    revocationCount,
    trustLevel,
  } = input;

  if (totalCredentialsIssued === 0) {
    // New issuer — start at a trust-level-based baseline
    const baselineMap: Record<string, number> = {
      AUTHORITATIVE: 80,
      TRUSTED: 65,
      PROVISIONAL: 40,
      UNTRUSTED: 10,
    };
    return baselineMap[trustLevel] ?? 50;
  }

  const totalVerifications = verificationSuccessCount + verificationFailureCount;
  const successRate = totalVerifications > 0
    ? verificationSuccessCount / totalVerifications
    : 1.0; // No verifications yet → assume clean

  const revocationRate = revocationCount / totalCredentialsIssued;

  // Base score from success rate (0–70 points)
  const successScore = successRate * 70;

  // Deduction from revocation rate (0–30 point deduction)
  // A 5%+ revocation rate causes maximum deduction
  const revocationDeduction = Math.min(30, revocationRate * 600);

  // Raw score before multiplier
  const rawScore = successScore - revocationDeduction;

  // Apply trust level multiplier
  const multiplier = TRUST_LEVEL_MULTIPLIER[trustLevel] ?? 0.5;
  const finalScore = Math.max(0, Math.min(100, rawScore * multiplier + (30 * multiplier)));

  return Math.round(finalScore);
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Calculate reputation scores for all issuers in the trust registry.
 * Updates each issuer's trustScore, verificationCount, revocationCount in-place.
 */
export async function calculateAllReputations(): Promise<IssuerReputationResult[]> {
  const issuers = listIssuers();
  const allCredentials = listAllCredentials();
  const allRevocations = listRevocations();

  const results: IssuerReputationResult[] = [];

  for (const issuer of issuers) {
    // Count credentials issued by this issuer
    const issued = allCredentials.filter((c) => c.issuer === issuer.issuerId);
    const revoked = allRevocations.filter((r) => r.issuer === issuer.issuerId);

    // Verification success/failure from wallet status
    const verified = issued.filter((c) => c.status === 'ACTIVE').length;
    const failed = issued.filter((c) => c.status === 'REVOKED' || c.status === 'EXPIRED').length;

    const input: IssuerReputationInput = {
      issuerId: issuer.issuerId,
      totalCredentialsIssued: issued.length,
      verificationSuccessCount: verified,
      verificationFailureCount: failed,
      revocationCount: revoked.length,
      trustLevel: issuer.trustLevel,
    };

    const trustScore = calculateTrustScore(input);
    const totalVerifications = verified + failed;
    const successRate = totalVerifications > 0 ? verified / totalVerifications : 1;
    const revocationRate = issued.length > 0 ? revoked.length / issued.length : 0;

    const result: IssuerReputationResult = {
      issuerId: issuer.issuerId,
      issuerName: issuer.issuerName,
      trustScore,
      verificationSuccessRate: successRate,
      revocationRate,
      totalCredentials: issued.length,
      revocationCount: revoked.length,
      verificationCount: totalVerifications,
      calculatedAt: new Date().toISOString(),
    };

    // Persist back into trust registry (Wave 105 extension)
    updateIssuerReputation(issuer.issuerId, {
      trustScore,
      verificationCount: totalVerifications,
      revocationCount: revoked.length,
    });

    results.push(result);
  }

  log('info', 'reputation_calculated', {
    issuersScored: results.length,
    avgScore: results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.trustScore, 0) / results.length)
      : 0,
  });

  return results;
}

/**
 * Calculate reputation for a single issuer.
 */
export async function calculateReputation(issuerId: string): Promise<IssuerReputationResult | null> {
  const all = await calculateAllReputations();
  return all.find((r) => r.issuerId === issuerId) ?? null;
}
