import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
const chainClient = new ChainClient();

export interface PerformanceStabilityData {
  overallStability: number; // 0-1
  hiringQuality: {
    variance: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  safetyStability: {
    score: number;
    volatility: number;
  };
  systemLevelStability: number;
  stressRecovery: number;
  metrics: {
    hiringVariance: number;
    safetyVariance: number;
    outcomesVariance: number;
  };
}

/**
 * Task 359.2 — Performance volatility detector
 * Measure variance in employer hiring quality
 */
export async function detectHiringVolatility(
  orgId: string,
): Promise<{ variance: number; trend: 'improving' | 'stable' | 'declining' }> {
  const hiringEvents = await prisma.hiringEvent.findMany({
    where: { employerId: orgId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  if (hiringEvents.length < 3) {
    return { variance: 0, trend: 'stable' };
  }

  // Calculate variance in hiring frequency
  const intervals: number[] = [];
  for (let i = 1; i < hiringEvents.length; i++) {
    const diff = hiringEvents[i - 1].createdAt.getTime() - hiringEvents[i].createdAt.getTime();
    intervals.push(diff);
  }

  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
  const normalizedVariance = Math.min(1, variance / (mean * mean));

  // Determine trend
  const recentAvg = intervals.slice(0, Math.floor(intervals.length / 2)).reduce((a, b) => a + b, 0) / (intervals.length / 2);
  const olderAvg = intervals.slice(Math.floor(intervals.length / 2)).reduce((a, b) => a + b, 0) / (intervals.length / 2);

  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (recentAvg < olderAvg * 0.9) trend = 'improving';
  if (recentAvg > olderAvg * 1.1) trend = 'declining';

  return { variance: normalizedVariance, trend };
}

/**
 * Task 359.3 — Safety-stability analyzer
 * Score how stable employer safety performance is
 */
export async function analyzeSafetyStability(
  orgId: string,
): Promise<{ score: number; volatility: number }> {
  // Get safety signals from clinicians hired by this org
  const hiringEvents = await prisma.hiringEvent.findMany({
    where: { employerId: orgId },
    select: { clinicianId: true },
    distinct: ['clinicianId'],
  });

  const clinicianIds = hiringEvents.map(e => e.clinicianId);

  if (clinicianIds.length === 0) {
    return { score: 1, volatility: 0 };
  }

  const safetySignals = await prisma.safetySignal.findMany({
    where: {
      clinicianId: { in: clinicianIds },
    },
    orderBy: { reportedAt: 'desc' },
    take: 100,
  });

  // Calculate safety score (fewer signals = higher score)
  const signalCount = safetySignals.length;
  const score = Math.max(0, Math.min(1, 1 - (signalCount / (clinicianIds.length * 10))));

  // Calculate volatility (variance in signal frequency over time)
  const monthlySignals: number[] = Array(12).fill(0);
  const now = new Date();
  safetySignals.forEach(signal => {
    const monthsAgo = Math.floor((now.getTime() - signal.reportedAt.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (monthsAgo >= 0 && monthsAgo < 12) {
      monthlySignals[11 - monthsAgo]++;
    }
  });

  const mean = monthlySignals.reduce((a, b) => a + b, 0) / monthlySignals.length;
  const variance = monthlySignals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / monthlySignals.length;
  const volatility = Math.min(1, variance / (mean + 1));

  return { score, volatility };
}

/**
 * Task 359.5 — System-level stability map
 * Map stability across entire health systems
 */
export async function calculateSystemLevelStability(
  orgId: string,
): Promise<number> {
  const hiringVolatility = await detectHiringVolatility(orgId);
  const safetyStability = await analyzeSafetyStability(orgId);

  // Combine metrics
  const hiringStability = 1 - hiringVolatility.variance;
  const safetyScore = safetyStability.score;

  return (hiringStability * 0.5 + safetyScore * 0.5);
}

/**
 * Task 359.6 — Performance stress recovery model
 * Predict employer's ability to recover from crises
 */
export async function predictStressRecovery(
  orgId: string,
): Promise<number> {
  // Check recent hiring activity after disruptions
  const recentEvents = await prisma.hiringEvent.findMany({
    where: { employerId: orgId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  if (recentEvents.length < 5) {
    return 0.5; // Default for new orgs
  }

  // Look for gaps and recovery patterns
  const gaps: number[] = [];
  for (let i = 1; i < recentEvents.length; i++) {
    const gap = (recentEvents[i - 1].createdAt.getTime() - recentEvents[i].createdAt.getTime()) / (1000 * 60 * 60 * 24);
    gaps.push(gap);
  }

  // Shorter recent gaps indicate better recovery
  const recentGaps = gaps.slice(0, Math.floor(gaps.length / 2));
  const olderGaps = gaps.slice(Math.floor(gaps.length / 2));

  const recentAvg = recentGaps.reduce((a, b) => a + b, 0) / recentGaps.length;
  const olderAvg = olderGaps.reduce((a, b) => a + b, 0) / olderGaps.length;

  // Recovery score: if recent gaps are shorter, recovery is better
  const recoveryScore = olderAvg > 0 ? Math.max(0, Math.min(1, 1 - (recentAvg / olderAvg))) : 0.5;

  return recoveryScore;
}

/**
 * Get complete performance stability data
 */
export async function getPerformanceStability(
  orgId: string,
): Promise<PerformanceStabilityData> {
  const stability = await prisma.performanceStability.findUnique({
    where: { orgId },
  });

  if (stability) {
    return stability.stability as PerformanceStabilityData;
  }

  // Create initial stability record
  const hiringQuality = await detectHiringVolatility(orgId);
  const safetyStability_ = await analyzeSafetyStability(orgId);
  const systemLevelStability_ = await calculateSystemLevelStability(orgId);
  const stressRecovery = await predictStressRecovery(orgId);

  const data: PerformanceStabilityData = {
    overallStability: (systemLevelStability_ * 0.7 + stressRecovery * 0.3),
    hiringQuality,
    safetyStability: safetyStability_,
    systemLevelStability: systemLevelStability_,
    stressRecovery,
    metrics: {
      hiringVariance: hiringQuality.variance,
      safetyVariance: safetyStability_.volatility,
      outcomesVariance: 0, // Would need outcome data
    },
  };

  await prisma.performanceStability.create({
    data: {
      orgId,
      stability: data,
    },
  });

  return data;
}

/**
 * Task 359.8 — Stability-driven routing engine
 * Favor stable employers in talent routing
 */
export async function getStabilityScore(orgId: string): Promise<number> {
  const stability = await getPerformanceStability(orgId);
  return stability.overallStability;
}

/**
 * Task 359.9 — Stability export bundle
 * Performance reliability report
 */
export async function exportStabilityReport(
  orgId: string,
): Promise<{
  stability: PerformanceStabilityData;
  summary: string;
  recommendations: string[];
}> {
  const stability = await getPerformanceStability(orgId);

  const recommendations: string[] = [];

  if (stability.overallStability < 0.6) {
    recommendations.push('Overall stability is below optimal - review hiring and safety practices');
  }
  if (stability.safetyStability.volatility > 0.7) {
    recommendations.push('High safety volatility detected - implement stability measures');
  }
  if (stability.stressRecovery < 0.5) {
    recommendations.push('Low stress recovery capacity - develop resilience strategies');
  }

  const summary = `Performance stability: ${(stability.overallStability * 100).toFixed(1)}%.
    Hiring quality trend: ${stability.hiringQuality.trend}.
    Safety stability: ${(stability.safetyStability.score * 100).toFixed(1)}%.`;

  return {
    stability,
    summary,
    recommendations,
  };
}

/**
 * Task 359.10 — Anchor stability core snapshot
 */
export async function anchorStabilitySnapshot(
  orgId: string,
): Promise<string> {
  const stability = await getPerformanceStability(orgId);

  const receipt = await chainClient.submitAuditEvent({
    eventType: 'performanceStabilityAnchored',
    correlationId: orgId,
    tags: ['performance', 'stability', 'snapshot'],
    payload: {
      orgId,
      overallStability: stability.overallStability,
      safetyStability: stability.safetyStability.score,
      stressRecovery: stability.stressRecovery,
      anchoredAt: new Date().toISOString(),
    },
  });

  return receipt.txHash || receipt.eventId;
}

