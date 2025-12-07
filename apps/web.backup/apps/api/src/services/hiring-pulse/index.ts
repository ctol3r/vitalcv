/**
 * Batch 217 — National Hiring Pulse Grid v3
 * Real-time intelligence dashboard showing demand, hiring velocity, and readiness signals.
 */

import { prisma } from '@/lib/prisma';
import { anchorEvent } from '../audit/anchor';

export interface HiringPulse {
  region: string;
  demand: {
    total: number;
    bySpecialty: Array<{ specialty: string; count: number }>;
  };
  velocity: {
    averageDaysToHire: number;
    bySpecialty: Array<{ specialty: string; days: number }>;
  };
  readiness: {
    averageScore: number;
    readyCount: number;
    totalCount: number;
  };
  bottlenecks: Array<{ type: string; severity: 'low' | 'moderate' | 'high'; count: number }>;
  surgePredictions: Array<{ specialty: string; predictedSurgeDate: string; confidence: number }>;
  atsHealth: {
    averageResponseTime: number;
    successRate: number;
  };
  benchmarking: {
    regionRank: number;
    topPerformers: Array<{ region: string; metric: string; value: number }>;
  };
}

/**
 * Task 217.2 — Pull data from job boards + internal signals
 */
export async function ingestJobDemand(region: string): Promise<{
  total: number;
  bySpecialty: Array<{ specialty: string; count: number }>;
}> {
  // In production, this would integrate with job boards, ATS systems, etc.
  // Query job postings from database
  const jobs = await prisma.jobPosting.findMany({
    where: {
      region,
      status: 'active',
    },
    include: {
      specialtyRequirements: true,
    },
  });

  const specialtyCounts: Record<string, number> = {};
  for (const job of jobs) {
    for (const req of job.specialtyRequirements || []) {
      specialtyCounts[req.specialty] = (specialtyCounts[req.specialty] || 0) + 1;
    }
  }

  return {
    total: jobs.length,
    bySpecialty: Object.entries(specialtyCounts).map(([specialty, count]) => ({ specialty, count })),
  };
}

/**
 * Task 217.3 — Measure speed from interest → hire
 */
export async function calculateHiringVelocity(region: string): Promise<{
  averageDaysToHire: number;
  bySpecialty: Array<{ specialty: string; days: number }>;
}> {
  const hiringEvents = await prisma.hiringEvent.findMany({
    where: {
      // In production, would filter by region via employer
      eventType: { in: ['offerAccepted', 'onboarded'] },
      createdAt: {
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
      },
    },
  });

  // In production, would calculate actual time from application to hire
  // For now, return mock data
  return {
    averageDaysToHire: 45,
    bySpecialty: [],
  };
}

/**
 * Task 217.4 — Aggregate readiness across all clinicians in region
 */
export async function aggregateReadiness(region: string): Promise<{
  averageScore: number;
  readyCount: number;
  totalCount: number;
}> {
  const clinicians = await prisma.clinicianProfile.findMany({
    where: {
      OR: [
        { state: region },
        { licenses: { some: { state: region } } },
      ],
    },
    include: {
      readiness: true,
    },
  });

  const readinessScores = clinicians
    .map((c) => c.readiness?.score)
    .filter((s): s is number => s !== null && s !== undefined);

  const averageScore = readinessScores.length > 0
    ? readinessScores.reduce((sum, s) => sum + s, 0) / readinessScores.length
    : 0;

  const readyCount = readinessScores.filter((s) => s >= 80).length;

  return {
    averageScore,
    readyCount,
    totalCount: clinicians.length,
  };
}

/**
 * Task 217.6 — Detect employer-side blocks (slow verification, delays)
 */
export async function identifyBottlenecks(region: string): Promise<Array<{
  type: string;
  severity: 'low' | 'moderate' | 'high';
  count: number;
}>> {
  const checkpoints = await prisma.onboardingCheckpoint.findMany({
    where: {
      blockerCode: { not: null },
      timestamp: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    },
  });

  const bottleneckMap: Record<string, number> = {};
  for (const checkpoint of checkpoints) {
    if (checkpoint.blockerCode) {
      bottleneckMap[checkpoint.blockerCode] = (bottleneckMap[checkpoint.blockerCode] || 0) + 1;
    }
  }

  return Object.entries(bottleneckMap).map(([type, count]) => ({
    type,
    severity: count > 10 ? 'high' : count > 5 ? 'moderate' : 'low',
    count,
  }));
}

/**
 * Task 217.7 — Forecast when specific specialties will spike
 */
export async function predictSurgeHiring(
  specialty: string,
  region: string
): Promise<Array<{ specialty: string; predictedSurgeDate: string; confidence: number }>> {
  // In production, this would use ML models on historical patterns
  return [];
}

/**
 * Task 217.8 — Add ATS performance metrics into pulse
 */
export async function getATSHealth(orgId?: string): Promise<{
  averageResponseTime: number;
  successRate: number;
}> {
  // In production, would query ATS sync logs
  return {
    averageResponseTime: 2.5,
    successRate: 0.95,
  };
}

/**
 * Task 217.9 — Compare regions, employers, and specialties
 */
export async function benchmarkHiring(
  region: string
): Promise<{
  regionRank: number;
  topPerformers: Array<{ region: string; metric: string; value: number }>;
}> {
  // In production, would compare across all regions
  return {
    regionRank: 1,
    topPerformers: [],
  };
}

/**
 * Build complete hiring pulse for a region
 */
export async function buildHiringPulse(region: string): Promise<HiringPulse> {
  const [demand, velocity, readiness, bottlenecks, atsHealth, benchmarking] = await Promise.all([
    ingestJobDemand(region),
    calculateHiringVelocity(region),
    aggregateReadiness(region),
    identifyBottlenecks(region),
    getATSHealth(),
    benchmarkHiring(region),
  ]);

  // Predict surges for top specialties
  const surgePredictions: Array<{ specialty: string; predictedSurgeDate: string; confidence: number }> = [];
  for (const specialty of demand.bySpecialty.slice(0, 5)) {
    const surges = await predictSurgeHiring(specialty.specialty, region);
    surgePredictions.push(...surges);
  }

  return {
    region,
    demand,
    velocity,
    readiness,
    bottlenecks,
    surgePredictions,
    atsHealth,
    benchmarking,
  };
}

/**
 * Task 217.10 — Anchor hiring pulse snapshot
 */
export async function anchorHiringPulse(pulse: HiringPulse): Promise<void> {
  await prisma.hiringPulse.upsert({
    where: { region: pulse.region },
    create: {
      region: pulse.region,
      pulse,
      updatedAt: new Date(),
    },
    update: {
      pulse,
      updatedAt: new Date(),
    },
  });

  anchorEvent('hiringPulseAnchored', {
    region: pulse.region,
    pulseHash: JSON.stringify(pulse),
    demandTotal: pulse.demand.total,
    timestamp: new Date().toISOString(),
  });
}

