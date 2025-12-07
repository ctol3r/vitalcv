/**
 * B205B-CCI-010: Integrate CCI into Eligibility and Workforce Matching Engines
 *
 * CCI influences supply ranking, privilege compatibility, readiness scoring, mobility decisions.
 */

import { PrismaClient } from '@prisma/client';
import type { ClinicianProfile, MatchCandidate, CoverageSnapshot } from '../matching/types.js';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const prisma = new PrismaClient();
const log = getServiceLogger('services/workforce/integration/cciIntegration');

export interface CCIIntegrationOptions {
  cciWeight?: number; // Weight of CCI in overall scoring (0-1)
  minCCIThreshold?: number; // Minimum CCI score for eligibility (0-100)
  useCCIForRanking?: boolean; // Whether to use CCI for ranking
  useCCIForReadiness?: boolean; // Whether to use CCI for readiness scoring
}

const DEFAULT_OPTIONS: Required<CCIIntegrationOptions> = {
  cciWeight: 0.15, // 15% weight in overall score
  minCCIThreshold: 40, // Minimum CCI of 40 for eligibility
  useCCIForRanking: true,
  useCCIForReadiness: true,
};

/**
 * Get latest CCI score for a clinician
 */
export async function getLatestCCI(clinicianId: string): Promise<number | null> {
  try {
    const latest = await prisma.competencyCompositeIndex.findFirst({
      where: { clinicianId },
      orderBy: { computedAt: 'desc' },
      select: { cciScore: true },
    });

    return latest?.cciScore ?? null;
  } catch (error) {
    log.error('Failed to get latest CCI', { clinicianId, error });
    return null;
  }
}

/**
 * Check if clinician meets CCI eligibility threshold
 */
export async function meetsCCIThreshold(
  clinicianId: string,
  threshold: number = DEFAULT_OPTIONS.minCCIThreshold
): Promise<boolean> {
  const cci = await getLatestCCI(clinicianId);
  if (cci === null) {
    // If no CCI available, allow (graceful degradation)
    return true;
  }
  return cci >= threshold;
}

/**
 * Enhance match candidate with CCI score
 */
export async function enhanceMatchCandidateWithCCI(
  candidate: MatchCandidate,
  options: CCIIntegrationOptions = {}
): Promise<MatchCandidate> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cci = await getLatestCCI(candidate.clinicianId);

  if (cci === null) {
    // No CCI available, return candidate as-is
    return candidate;
  }

  // Adjust score based on CCI
  if (opts.useCCIForRanking) {
    const cciNormalized = cci / 100; // Normalize to 0-1
    const cciContribution = cciNormalized * opts.cciWeight;
    const baseScore = candidate.score * (1 - opts.cciWeight);
    candidate.score = Math.min(1, baseScore + cciContribution);
  }

  // Add CCI to highlights
  candidate.highlights.push({
    label: 'Competency Index',
    detail: `CCI: ${cci.toFixed(1)}/100`,
    sentiment: cci >= 70 ? 'positive' : cci >= 50 ? 'neutral' : 'warning',
  });

  return candidate;
}

/**
 * Enhance coverage snapshot with CCI-based readiness
 */
export async function enhanceCoverageWithCCI(
  coverage: CoverageSnapshot,
  clinicianId: string,
  options: CCIIntegrationOptions = {}
): Promise<CoverageSnapshot> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cci = await getLatestCCI(clinicianId);

  if (cci === null || !opts.useCCIForReadiness) {
    return coverage;
  }

  // Adjust risk modifier based on CCI
  // Higher CCI = lower risk = higher modifier
  const cciRiskFactor = cci / 100; // 0-1, where 1 = best
  const adjustedRiskModifier = coverage.riskModifier * (0.7 + 0.3 * cciRiskFactor);

  return {
    ...coverage,
    riskModifier: Math.min(1, adjustedRiskModifier),
  };
}

/**
 * Filter clinicians by CCI threshold
 */
export async function filterByCCIThreshold(
  clinicianIds: string[],
  threshold: number = DEFAULT_OPTIONS.minCCIThreshold
): Promise<string[]> {
  const eligible: string[] = [];

  for (const clinicianId of clinicianIds) {
    const meets = await meetsCCIThreshold(clinicianId, threshold);
    if (meets) {
      eligible.push(clinicianId);
    }
  }

  return eligible;
}

/**
 * Rank clinicians by CCI score (for supply ranking)
 */
export async function rankByCCI(clinicianIds: string[]): Promise<Array<{ clinicianId: string; cci: number }>> {
  const rankings: Array<{ clinicianId: string; cci: number }> = [];

  for (const clinicianId of clinicianIds) {
    const cci = await getLatestCCI(clinicianId);
    if (cci !== null) {
      rankings.push({ clinicianId, cci });
    }
  }

  // Sort by CCI descending
  rankings.sort((a, b) => b.cci - a.cci);

  return rankings;
}

/**
 * Check privilege compatibility using CCI
 * Higher CCI may indicate better privilege compatibility
 */
export async function checkPrivilegeCompatibilityWithCCI(
  clinicianId: string,
  requiredPrivileges: string[]
): Promise<{ compatible: boolean; cciContribution: number }> {
  const cci = await getLatestCCI(clinicianId);

  if (cci === null) {
    // No CCI available, assume compatible
    return { compatible: true, cciContribution: 0 };
  }

  // Higher CCI = better privilege compatibility
  // Threshold: CCI >= 60 for good compatibility
  const compatible = cci >= 60;
  const cciContribution = cci / 100; // Normalized contribution

  return { compatible, cciContribution };
}

/**
 * Calculate readiness score with CCI
 */
export async function calculateReadinessScoreWithCCI(
  clinicianId: string,
  baseReadiness: number,
  options: CCIIntegrationOptions = {}
): Promise<number> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cci = await getLatestCCI(clinicianId);

  if (cci === null || !opts.useCCIForReadiness) {
    return baseReadiness;
  }

  // Blend base readiness with CCI
  const cciNormalized = cci / 100;
  const cciWeight = opts.cciWeight;
  const blended = baseReadiness * (1 - cciWeight) + cciNormalized * cciWeight;

  return Math.min(1, blended);
}

/**
 * Influence mobility decisions with CCI
 * Higher CCI may indicate better mobility readiness
 */
export async function assessMobilityReadinessWithCCI(
  clinicianId: string
): Promise<{ ready: boolean; reason: string; cciScore: number | null }> {
  const cci = await getLatestCCI(clinicianId);

  if (cci === null) {
    return {
      ready: true, // Default to ready if no CCI
      reason: 'CCI not available, defaulting to ready',
      cciScore: null,
    };
  }

  // Higher CCI = better mobility readiness
  if (cci >= 70) {
    return {
      ready: true,
      reason: `High CCI (${cci.toFixed(1)}) indicates strong competency and mobility readiness`,
      cciScore: cci,
    };
  } else if (cci >= 50) {
    return {
      ready: true,
      reason: `Moderate CCI (${cci.toFixed(1)}) indicates acceptable competency for mobility`,
      cciScore: cci,
    };
  } else {
    return {
      ready: false,
      reason: `Low CCI (${cci.toFixed(1)}) may indicate competency concerns affecting mobility`,
      cciScore: cci,
    };
  }
}

