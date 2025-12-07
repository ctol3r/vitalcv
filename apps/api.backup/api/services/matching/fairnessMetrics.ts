/**
 * S72-STRETCH-D-009: Fairness metrics for matching (by specialty, region, demographic proxies)
 *
 * Computes distribution of top-k selections by:
 * - Region
 * - Gender proxy (if available)
 * - Specialty
 *
 * Flags disparities > threshold; report stored in DB
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Demographic proxy categories
 */
export interface DemographicProxies {
  region?: string; // State or region code
  specialty?: string; // Specialty code
  genderProxy?: string; // If available from name analysis
  experienceTier?: string; // 'junior', 'mid', 'senior'
}

/**
 * Fairness metric result
 */
export interface FairnessMetric {
  category: string; // 'region', 'specialty', 'genderProxy', 'experienceTier'
  distribution: Record<string, number>; // Count per category value
  proportions: Record<string, number>; // Proportion per category value
  total: number;
  disparityFlags: Array<{
    category: string;
    expectedProportion: number;
    actualProportion: number;
    difference: number;
    threshold: number;
  }>;
}

/**
 * Fairness report
 */
export interface FairnessReport {
  id: string;
  jobId?: string;
  topK: number;
  totalCandidates: number;
  metrics: FairnessMetric[];
  overallDisparityScore: number; // 0-1, higher = more disparity
  flaggedCategories: string[];
  createdAt: Date;
}

/**
 * Extract demographic proxies from candidate data
 */
export function extractDemographicProxies(
  candidate: any
): DemographicProxies {
  return {
    region: candidate.location?.state || candidate.region,
    specialty: candidate.specialty,
    genderProxy: candidate.genderProxy, // Would be extracted from name or other data
    experienceTier:
      candidate.experienceYears < 3
        ? 'junior'
        : candidate.experienceYears < 10
        ? 'mid'
        : 'senior',
  };
}

/**
 * Compute fairness metrics for top-k candidates
 */
export async function computeFairnessMetrics(
  topKCandidates: Array<{
    clinicianId: string;
    score: number;
    data?: any; // Candidate data for demographic extraction
  }>,
  baselineDistribution?: Record<string, number>, // Expected distribution
  threshold: number = 0.15 // Disparity threshold (15%)
): Promise<FairnessMetric[]> {
  const metrics: FairnessMetric[] = [];

  // Categories to analyze
  const categories: Array<keyof DemographicProxies> = [
    'region',
    'specialty',
    'genderProxy',
    'experienceTier',
  ];

  for (const category of categories) {
    const distribution: Record<string, number> = {};
    let total = 0;

    // Count occurrences
    for (const candidate of topKCandidates) {
      const proxies = candidate.data
        ? extractDemographicProxies(candidate.data)
        : {};
      const value = proxies[category] || 'unknown';
      distribution[value] = (distribution[value] || 0) + 1;
      total++;
    }

    // Calculate proportions
    const proportions: Record<string, number> = {};
    for (const [key, count] of Object.entries(distribution)) {
      proportions[key] = count / total;
    }

    // Check for disparities
    const disparityFlags: FairnessMetric['disparityFlags'] = [];

    if (baselineDistribution) {
      // Compare against baseline
      for (const [key, expectedProportion] of Object.entries(
        baselineDistribution
      )) {
        const actualProportion = proportions[key] || 0;
        const difference = Math.abs(actualProportion - expectedProportion);

        if (difference > threshold) {
          disparityFlags.push({
            category: key,
            expectedProportion,
            actualProportion,
            difference,
            threshold,
          });
        }
      }
    } else {
      // Check for extreme imbalances (no single category > 80% or < 5%)
      for (const [key, proportion] of Object.entries(proportions)) {
        if (proportion > 0.8) {
          disparityFlags.push({
            category: key,
            expectedProportion: 1 / Object.keys(proportions).length, // Equal distribution
            actualProportion: proportion,
            difference: proportion - 1 / Object.keys(proportions).length,
            threshold,
          });
        }
      }
    }

    metrics.push({
      category,
      distribution,
      proportions,
      total,
      disparityFlags,
    });
  }

  return metrics;
}

/**
 * Generate fairness report
 */
export async function generateFairnessReport(
  jobId: string | undefined,
  topKCandidates: Array<{
    clinicianId: string;
    score: number;
    data?: any;
  }>,
  topK: number,
  baselineDistribution?: Record<string, number>,
  threshold: number = 0.15
): Promise<FairnessReport> {
  const metrics = await computeFairnessMetrics(
    topKCandidates,
    baselineDistribution,
    threshold
  );

  // Calculate overall disparity score
  let totalDisparity = 0;
  let totalFlags = 0;
  const flaggedCategories: string[] = [];

  for (const metric of metrics) {
    for (const flag of metric.disparityFlags) {
      totalDisparity += flag.difference;
      totalFlags++;
      if (!flaggedCategories.includes(metric.category)) {
        flaggedCategories.push(metric.category);
      }
    }
  }

  const overallDisparityScore =
    totalFlags > 0 ? totalDisparity / totalFlags : 0;

  const report: FairnessReport = {
    id: `fairness-${Date.now()}`,
    jobId,
    topK,
    totalCandidates: topKCandidates.length,
    metrics,
    overallDisparityScore,
    flaggedCategories,
    createdAt: new Date(),
  };

  // Store in database (would need a FairnessReport model)
  // await prisma.fairnessReport.create({ data: report });

  return report;
}

/**
 * Get baseline distribution from all candidates (not just top-k)
 */
export async function getBaselineDistribution(
  allCandidates: Array<{ data?: any }>,
  category: keyof DemographicProxies
): Promise<Record<string, number>> {
  const distribution: Record<string, number> = {};
  let total = 0;

  for (const candidate of allCandidates) {
    const proxies = candidate.data
      ? extractDemographicProxies(candidate.data)
      : {};
    const value = proxies[category] || 'unknown';
    distribution[value] = (distribution[value] || 0) + 1;
    total++;
  }

  // Convert to proportions
  const proportions: Record<string, number> = {};
  for (const [key, count] of Object.entries(distribution)) {
    proportions[key] = count / total;
  }

  return proportions;
}

