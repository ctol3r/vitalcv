import { PrismaClient } from '@prisma/client';
import { computeTrustTrajectory, type TrustTrajectory } from './trajectory';

const prisma = new PrismaClient();

export interface CrossOrgTrajectory {
  clinicianId: string;
  aggregatedScore: number;
  employerScores: Array<{ employerId: string; score: number; weight: number }>;
  overallTrend: 'increasing' | 'decreasing' | 'stable';
  consensus: number; // 0-1, how much employers agree
}

/**
 * Aggregate trust trajectory across all employers
 */
export async function aggregateCrossOrgTrajectory(
  clinicianId: string,
): Promise<CrossOrgTrajectory> {
  // Get all contract health records for this clinician
  const contracts = await prisma.contractHealth.findMany({
    where: { clinicianId },
  });

  // Get individual trajectory
  const individualTrajectory = await computeTrustTrajectory(clinicianId);

  // Extract employer-specific scores from contract health
  const employerScores: Array<{ employerId: string; score: number; weight: number }> = [];

  for (const contract of contracts) {
    const health = contract.health as Record<string, unknown>;
    const trustScore = (health.trustScore as number) || 0.5;
    const weight = (health.weight as number) || 1.0; // Weight based on contract importance

    employerScores.push({
      employerId: contract.employerId,
      score: trustScore,
      weight,
    });
  }

  // Compute weighted average
  const totalWeight = employerScores.reduce((sum, e) => sum + e.weight, 0);
  const aggregatedScore = totalWeight > 0
    ? employerScores.reduce((sum, e) => sum + e.score * e.weight, 0) / totalWeight
    : individualTrajectory.currentScore;

  // Compute consensus (lower variance = higher consensus)
  const scores = employerScores.map(e => e.score);
  const mean = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : aggregatedScore;
  const variance = scores.length > 0
    ? scores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / scores.length
    : 0;
  const consensus = Math.max(0, 1 - Math.sqrt(variance) * 2); // Normalize to 0-1

  // Determine overall trend
  const overallTrend = individualTrajectory.trend;

  return {
    clinicianId,
    aggregatedScore,
    employerScores,
    overallTrend,
    consensus,
  };
}

