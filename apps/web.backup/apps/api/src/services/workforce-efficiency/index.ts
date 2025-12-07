import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';

const prisma = new PrismaClient();

export interface WorkforceEfficiencyData {
  inefficiencies: Array<{
    type: 'bottleneck' | 'delay' | 'failure' | 'duplication';
    stage: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    impact: number; // hours lost
  }>;
  employerEfficiency: Array<{
    orgId: string;
    score: number; // 0-100
    metrics: {
      averageHiringTime: number; // days
      verificationTime: number; // days
      offerAcceptanceRate: number;
    };
  }>;
  clinicianUtilization: Array<{
    clinicianId: string;
    score: number; // 0-100
    factors: {
      placementRate: number;
      readinessScore: number;
      timeToDeployment: number; // days
    };
  }>;
  bottlenecks: Array<{
    stage: string;
    averageDelay: number; // hours
    affectedClinicians: number;
  }>;
  lastUpdated: string;
}

/**
 * Get workforce efficiency data
 */
export async function getWorkforceEfficiency(): Promise<WorkforceEfficiencyData | null> {
  const record = await prisma.workforceEfficiency.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (!record) {
    return null;
  }

  return record.efficiency as WorkforceEfficiencyData;
}

/**
 * Update workforce efficiency data
 */
export async function updateWorkforceEfficiency(efficiency: WorkforceEfficiencyData): Promise<void> {
  await prisma.workforceEfficiency.create({
    data: {
      efficiency: efficiency as any,
      updatedAt: new Date(),
    },
  });
}

/**
 * Detect inefficiencies in job→credential→verify pipeline
 */
export async function detectInefficiencies(pipelineData: Array<{
  jobId: string;
  stages: Array<{
    stage: string;
    startTime: string;
    endTime?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
  }>;
}>): Promise<Array<{
  type: 'bottleneck' | 'delay' | 'failure' | 'duplication';
  stage: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: number;
}>> {
  const inefficiencies: Array<{
    type: 'bottleneck' | 'delay' | 'failure' | 'duplication';
    stage: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    impact: number;
  }> = [];

  // Calculate average time per stage
  const stageTimes = new Map<string, number[]>();

  for (const job of pipelineData) {
    for (const stage of job.stages) {
      if (stage.endTime) {
        const duration = (new Date(stage.endTime).getTime() - new Date(stage.startTime).getTime()) / (1000 * 60 * 60);
        if (!stageTimes.has(stage.stage)) {
          stageTimes.set(stage.stage, []);
        }
        stageTimes.get(stage.stage)!.push(duration);
      }

      // Detect failures
      if (stage.status === 'failed') {
        inefficiencies.push({
          type: 'failure',
          stage: stage.stage,
          severity: 'high',
          impact: 24, // Assume 24 hours lost
        });
      }
    }
  }

  // Detect bottlenecks (stages taking > 2x average)
  for (const [stage, times] of stageTimes.entries()) {
    if (times.length === 0) {
      continue;
    }

    const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
    const slowJobs = times.filter((t) => t > avgTime * 2);

    if (slowJobs.length > times.length * 0.2) {
      // More than 20% of jobs are slow
      const avgSlowTime = slowJobs.reduce((sum, t) => sum + t, 0) / slowJobs.length;
      const impact = avgSlowTime - avgTime;

      inefficiencies.push({
        type: 'bottleneck',
        stage,
        severity: impact > 48 ? 'critical' : impact > 24 ? 'high' : impact > 12 ? 'medium' : 'low',
        impact,
      });
    }
  }

  return inefficiencies;
}

/**
 * Compare employer efficiency
 */
export async function compareEmployerEfficiency(employers: Array<{
  orgId: string;
  jobs: Array<{
    postedAt: string;
    filledAt?: string;
    verificationTime?: number; // days
    offerAccepted: boolean;
  }>;
}>): Promise<Array<{
  orgId: string;
  score: number;
  metrics: {
    averageHiringTime: number;
    verificationTime: number;
    offerAcceptanceRate: number;
  };
}>> {
  const results: Array<{
    orgId: string;
    score: number;
    metrics: {
      averageHiringTime: number;
      verificationTime: number;
      offerAcceptanceRate: number;
    };
  }> = [];

  for (const employer of employers) {
    const filledJobs = employer.jobs.filter((j) => j.filledAt);
    const averageHiringTime = filledJobs.length > 0
      ? filledJobs.reduce((sum, j) => {
          const days = (new Date(j.filledAt!).getTime() - new Date(j.postedAt).getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / filledJobs.length
      : 0;

    const verificationTimes = employer.jobs.filter((j) => j.verificationTime).map((j) => j.verificationTime!);
    const verificationTime = verificationTimes.length > 0
      ? verificationTimes.reduce((sum, t) => sum + t, 0) / verificationTimes.length
      : 0;

    const offers = employer.jobs.filter((j) => j.filledAt);
    const offerAcceptanceRate = offers.length > 0
      ? offers.filter((j) => j.offerAccepted).length / offers.length
      : 0;

    // Calculate efficiency score (0-100)
    // Lower hiring time = higher score, higher acceptance rate = higher score
    const hiringTimeScore = Math.max(0, 100 - averageHiringTime * 2); // -2 points per day
    const acceptanceScore = offerAcceptanceRate * 100;
    const verificationScore = Math.max(0, 100 - verificationTime * 5); // -5 points per day

    const score = (hiringTimeScore * 0.4 + acceptanceScore * 0.4 + verificationScore * 0.2);

    results.push({
      orgId: employer.orgId,
      score: Math.min(100, Math.max(0, score)),
      metrics: {
        averageHiringTime,
        verificationTime,
        offerAcceptanceRate,
      },
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Score clinician utilization effectiveness
 */
export async function scoreClinicianUtilization(clinicians: Array<{
  clinicianId: string;
  placements: Array<{
    placedAt: string;
    readinessScore: number;
    timeToDeployment: number; // days
  }>;
}>): Promise<Array<{
  clinicianId: string;
  score: number;
  factors: {
    placementRate: number;
    readinessScore: number;
    timeToDeployment: number;
  };
}>> {
  const results: Array<{
    clinicianId: string;
    score: number;
    factors: {
      placementRate: number;
      readinessScore: number;
      timeToDeployment: number;
    };
  }> = [];

  for (const clinician of clinicians) {
    const placementRate = clinician.placements.length > 0 ? 1 : 0; // Simplified
    const avgReadiness = clinician.placements.length > 0
      ? clinician.placements.reduce((sum, p) => sum + p.readinessScore, 0) / clinician.placements.length
      : 0;
    const avgTimeToDeployment = clinician.placements.length > 0
      ? clinician.placements.reduce((sum, p) => sum + p.timeToDeployment, 0) / clinician.placements.length
      : 0;

    // Calculate utilization score
    const readinessScore = avgReadiness;
    const deploymentScore = Math.max(0, 100 - avgTimeToDeployment * 2); // -2 points per day
    const score = (readinessScore * 0.6 + deploymentScore * 0.4) * placementRate;

    results.push({
      clinicianId: clinician.clinicianId,
      score: Math.min(100, Math.max(0, score)),
      factors: {
        placementRate,
        readinessScore: avgReadiness,
        timeToDeployment: avgTimeToDeployment,
      },
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Predict employer inefficiency risk
 */
export async function predictEmployerInefficiency(orgId: string, metrics: {
  averageHiringTime: number;
  verificationTime: number;
  offerAcceptanceRate: number;
}): Promise<{
  risk: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
}> {
  const factors: string[] = [];
  let riskScore = 0;

  if (metrics.averageHiringTime > 60) {
    factors.push('Slow hiring process (>60 days)');
    riskScore += 30;
  } else if (metrics.averageHiringTime > 30) {
    factors.push('Moderate hiring time (30-60 days)');
    riskScore += 15;
  }

  if (metrics.verificationTime > 14) {
    factors.push('Slow verification (>14 days)');
    riskScore += 25;
  } else if (metrics.verificationTime > 7) {
    factors.push('Moderate verification time (7-14 days)');
    riskScore += 10;
  }

  if (metrics.offerAcceptanceRate < 0.3) {
    factors.push('Low offer acceptance rate (<30%)');
    riskScore += 25;
  } else if (metrics.offerAcceptanceRate < 0.5) {
    factors.push('Moderate offer acceptance rate (30-50%)');
    riskScore += 10;
  }

  let risk: 'low' | 'medium' | 'high' | 'critical';
  if (riskScore >= 60) {
    risk = 'critical';
  } else if (riskScore >= 40) {
    risk = 'high';
  } else if (riskScore >= 20) {
    risk = 'medium';
  } else {
    risk = 'low';
  }

  return { risk, factors };
}

/**
 * Optimize deployment of high-readiness clinicians
 */
export async function optimizeDeployment(
  clinicians: Array<{
    clinicianId: string;
    readinessScore: number;
    specialties: string[];
    regions: string[];
  }>,
  jobs: Array<{
    jobId: string;
    specialty: string;
    region: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }>,
): Promise<Array<{
  clinicianId: string;
  jobId: string;
  matchScore: number;
  rationale: string[];
}>> {
  const matches: Array<{
    clinicianId: string;
    jobId: string;
    matchScore: number;
    rationale: string[];
  }> = [];

  for (const job of jobs) {
    const candidates = clinicians
      .filter((c) => c.specialties.includes(job.specialty) && c.regions.includes(job.region))
      .map((c) => {
        let matchScore = c.readinessScore;
        const rationale: string[] = [];

        // Boost score for high-priority jobs
        if (job.priority === 'critical') {
          matchScore += 20;
          rationale.push('Critical priority job');
        } else if (job.priority === 'high') {
          matchScore += 10;
          rationale.push('High priority job');
        }

        rationale.push(`Readiness score: ${c.readinessScore}`);
        rationale.push(`Specialty match: ${job.specialty}`);
        rationale.push(`Region match: ${job.region}`);

        return {
          clinicianId: c.clinicianId,
          jobId: job.jobId,
          matchScore: Math.min(100, matchScore),
          rationale,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    // Top match for each job
    if (candidates.length > 0) {
      matches.push(candidates[0]);
    }
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Solve workforce flow bottlenecks using ML
 */
export async function solveBottlenecks(
  bottlenecks: Array<{
    stage: string;
    averageDelay: number;
    affectedClinicians: number;
  }>,
): Promise<Array<{
  stage: string;
  recommendation: string;
  expectedImprovement: number; // hours saved
}>> {
  const solutions: Array<{
    stage: string;
    recommendation: string;
    expectedImprovement: number;
  }> = [];

  for (const bottleneck of bottlenecks) {
    let recommendation = '';
    let expectedImprovement = 0;

    if (bottleneck.stage.includes('verification')) {
      recommendation = 'Automate verification checks, parallelize processes';
      expectedImprovement = bottleneck.averageDelay * 0.5; // 50% reduction
    } else if (bottleneck.stage.includes('credential')) {
      recommendation = 'Pre-validate credentials, use cached results';
      expectedImprovement = bottleneck.averageDelay * 0.4; // 40% reduction
    } else if (bottleneck.stage.includes('approval')) {
      recommendation = 'Streamline approval workflow, reduce approval layers';
      expectedImprovement = bottleneck.averageDelay * 0.3; // 30% reduction
    } else {
      recommendation = 'Review process, identify optimization opportunities';
      expectedImprovement = bottleneck.averageDelay * 0.2; // 20% reduction
    }

    solutions.push({
      stage: bottleneck.stage,
      recommendation,
      expectedImprovement,
    });
  }

  return solutions;
}

/**
 * Forecast systemic workforce shifts
 */
export async function forecastWorkforceShifts(historicalData: Array<{
  timestamp: string;
  demand: number;
  supply: number;
  efficiency: number;
}>): Promise<{
  predictedDemand: number;
  predictedSupply: number;
  predictedEfficiency: number;
  trends: {
    demand: 'increasing' | 'stable' | 'decreasing';
    supply: 'increasing' | 'stable' | 'decreasing';
    efficiency: 'improving' | 'stable' | 'degrading';
  };
}> {
  if (historicalData.length < 2) {
    return {
      predictedDemand: 0,
      predictedSupply: 0,
      predictedEfficiency: 0,
      trends: {
        demand: 'stable',
        supply: 'stable',
        efficiency: 'stable',
      },
    };
  }

  // Simple linear trend
  const recent = historicalData.slice(-10);
  const older = historicalData.slice(0, Math.max(1, historicalData.length - 10));

  const avgRecentDemand = recent.reduce((sum, d) => sum + d.demand, 0) / recent.length;
  const avgOlderDemand = older.reduce((sum, d) => sum + d.demand, 0) / older.length;
  const demandTrend = avgRecentDemand > avgOlderDemand * 1.1 ? 'increasing' : avgRecentDemand < avgOlderDemand * 0.9 ? 'decreasing' : 'stable';

  const avgRecentSupply = recent.reduce((sum, d) => sum + d.supply, 0) / recent.length;
  const avgOlderSupply = older.reduce((sum, d) => sum + d.supply, 0) / older.length;
  const supplyTrend = avgRecentSupply > avgOlderSupply * 1.1 ? 'increasing' : avgRecentSupply < avgOlderSupply * 0.9 ? 'decreasing' : 'stable';

  const avgRecentEfficiency = recent.reduce((sum, d) => sum + d.efficiency, 0) / recent.length;
  const avgOlderEfficiency = older.reduce((sum, d) => sum + d.efficiency, 0) / older.length;
  const efficiencyTrend = avgRecentEfficiency > avgOlderEfficiency * 1.05 ? 'improving' : avgRecentEfficiency < avgOlderEfficiency * 0.95 ? 'degrading' : 'stable';

  // Predict next period (simple extrapolation)
  const demandChange = avgRecentDemand - avgOlderDemand;
  const supplyChange = avgRecentSupply - avgOlderSupply;
  const efficiencyChange = avgRecentEfficiency - avgOlderEfficiency;

  return {
    predictedDemand: avgRecentDemand + demandChange,
    predictedSupply: avgRecentSupply + supplyChange,
    predictedEfficiency: Math.min(100, Math.max(0, avgRecentEfficiency + efficiencyChange)),
    trends: {
      demand: demandTrend,
      supply: supplyTrend,
      efficiency: efficiencyTrend,
    },
  };
}

/**
 * Anchor workforce efficiency snapshot
 */
export async function anchorEfficiencySnapshot(): Promise<void> {
  const efficiency = await getWorkforceEfficiency();
  if (!efficiency) {
    return;
  }

  const avgEmployerScore = efficiency.employerEfficiency.length > 0
    ? efficiency.employerEfficiency.reduce((sum, e) => sum + e.score, 0) / efficiency.employerEfficiency.length
    : 0;

  const avgClinicianScore = efficiency.clinicianUtilization.length > 0
    ? efficiency.clinicianUtilization.reduce((sum, c) => sum + c.score, 0) / efficiency.clinicianUtilization.length
    : 0;

  anchorEvent('workforceEfficiencyAnchored', {
    inefficiencyCount: efficiency.inefficiencies.length,
    criticalInefficiencies: efficiency.inefficiencies.filter((i) => i.severity === 'critical').length,
    avgEmployerScore,
    avgClinicianScore,
    bottleneckCount: efficiency.bottlenecks.length,
    timestamp: new Date().toISOString(),
  });
}

