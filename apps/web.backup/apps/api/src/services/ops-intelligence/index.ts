import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export interface OpsSignal {
  atsMetrics: {
    latency: number;
    throughput: number;
    errorRate: number;
  };
  verificationLatency: number;
  complianceTiming: number;
  timestamp: string;
}

export interface OperationalMaturity {
  score: number;
  dimensions: Record<string, number>;
  bottlenecks: Array<{
    type: string;
    severity: number;
    rootCause: string;
  }>;
  anomalies: Array<{
    type: string;
    severity: number;
    detectedAt: string;
  }>;
  improvements: Array<{
    area: string;
    impact: number;
    effort: number;
  }>;
  benchmarking: Record<string, number>;
  timeline: Array<{
    date: string;
    score: number;
    changes: string[];
  }>;
}

export interface OperationalIntelligenceMatrix {
  orgId: string;
  matrix: OperationalMaturity;
  updatedAt: string;
}

/**
 * Task 354.2 — Ops-signal ingestion v4
 * ATS metrics, verification latency, compliance timing
 */
export async function ingestOpsSignals(orgId: string): Promise<OpsSignal[]> {
  const signals: OpsSignal[] = [];

  // Get ATS metrics
  const atsConnections = await prisma.employerATS.findMany({
    where: { orgId },
  });

  // Get verification latency
  const verifications = await prisma.verifierCheck.findMany({
    where: { verifierId: orgId },
    orderBy: { timestamp: 'desc' },
    take: 100,
  });

  const avgVerificationLatency =
    verifications.length > 0
      ? verifications.reduce((sum, v) => {
          const result = v.result as { latency?: number };
          return sum + (result?.latency || 0);
        }, 0) / verifications.length
      : 0;

  // Get compliance timing
  const complianceChecks = await prisma.complianceCheck.findMany({
    where: {},
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const avgComplianceTiming =
    complianceChecks.length > 0
      ? complianceChecks.reduce((sum, c) => {
          const result = c.result as { timing?: number };
          return sum + (result?.timing || 0);
        }, 0) / complianceChecks.length
      : 0;

  signals.push({
    atsMetrics: {
      latency: avgVerificationLatency,
      throughput: atsConnections.length * 10, // Estimate
      errorRate: 0.05, // Estimate
    },
    verificationLatency: avgVerificationLatency,
    complianceTiming: avgComplianceTiming,
    timestamp: new Date().toISOString(),
  });

  return signals;
}

/**
 * Task 354.3 — Operational maturity scorer v3
 * Score how mature employer workflows are
 */
export async function scoreOperationalMaturity(
  orgId: string,
  signals: OpsSignal[],
): Promise<OperationalMaturity> {
  const dimensions: Record<string, number> = {
    ats_integration: 0,
    verification_speed: 0,
    compliance_efficiency: 0,
    automation_level: 0,
  };

  if (signals.length > 0) {
    const signal = signals[0];

    // ATS integration score (based on latency and throughput)
    dimensions.ats_integration =
      signal.atsMetrics.latency < 1000 ? 0.9 : signal.atsMetrics.latency < 5000 ? 0.7 : 0.5;

    // Verification speed score
    dimensions.verification_speed =
      signal.verificationLatency < 24 ? 0.9 : signal.verificationLatency < 72 ? 0.7 : 0.5;

    // Compliance efficiency score
    dimensions.compliance_efficiency =
      signal.complianceTiming < 48 ? 0.9 : signal.complianceTiming < 168 ? 0.7 : 0.5;

    // Automation level (estimate based on ATS connections)
    const atsConnections = await prisma.employerATS.findMany({
      where: { orgId },
    });
    dimensions.automation_level = atsConnections.length > 0 ? 0.8 : 0.4;
  }

  // Overall score
  const score =
    (dimensions.ats_integration +
      dimensions.verification_speed +
      dimensions.compliance_efficiency +
      dimensions.automation_level) /
    4;

  // Detect bottlenecks
  const bottlenecks = await detectBottlenecks(orgId, signals);

  // Detect anomalies
  const anomalies = await detectOpsAnomalies(orgId, signals);

  // Generate improvements
  const improvements = await generateOpsImprovements(orgId, dimensions);

  // Benchmarking
  const benchmarking = await benchmarkOpsAcrossRegions(orgId);

  // Timeline
  const timeline = await buildOpsTimeline(orgId);

  return {
    score,
    dimensions,
    bottlenecks,
    anomalies,
    improvements,
    benchmarking,
    timeline,
  };
}

/**
 * Task 354.5 — Bottleneck exploration engine
 * Map operational bottlenecks to root causes
 */
export async function detectBottlenecks(
  orgId: string,
  signals: OpsSignal[],
): Promise<Array<{ type: string; severity: number; rootCause: string }>> {
  const bottlenecks: Array<{ type: string; severity: number; rootCause: string }> = [];

  if (signals.length > 0) {
    const signal = signals[0];

    // Check verification latency
    if (signal.verificationLatency > 72) {
      bottlenecks.push({
        type: 'verification_latency',
        severity: 0.8,
        rootCause: 'Manual verification processes causing delays',
      });
    }

    // Check compliance timing
    if (signal.complianceTiming > 168) {
      bottlenecks.push({
        type: 'compliance_timing',
        severity: 0.7,
        rootCause: 'Inefficient compliance check workflows',
      });
    }

    // Check ATS latency
    if (signal.atsMetrics.latency > 5000) {
      bottlenecks.push({
        type: 'ats_latency',
        severity: 0.6,
        rootCause: 'Slow ATS integration or API response times',
      });
    }
  }

  return bottlenecks;
}

/**
 * Task 354.6 — Ops anomaly detector
 * Detect operational breakdowns
 */
export async function detectOpsAnomalies(
  orgId: string,
  signals: OpsSignal[],
): Promise<Array<{ type: string; severity: number; detectedAt: string }>> {
  const anomalies: Array<{ type: string; severity: number; detectedAt: string }> = [];

  if (signals.length > 0) {
    const signal = signals[0];

    // Check for high error rates
    if (signal.atsMetrics.errorRate > 0.1) {
      anomalies.push({
        type: 'high_error_rate',
        severity: 0.9,
        detectedAt: new Date().toISOString(),
      });
    }

    // Check for extreme latencies
    if (signal.verificationLatency > 168) {
      anomalies.push({
        type: 'extreme_verification_latency',
        severity: 0.8,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return anomalies;
}

/**
 * Task 354.7 — Predictive ops improvement engine
 * Suggest changes to improve operational performance
 */
export async function generateOpsImprovements(
  orgId: string,
  dimensions: Record<string, number>,
): Promise<Array<{ area: string; impact: number; effort: number }>> {
  const improvements: Array<{ area: string; impact: number; effort: number }> = [];

  // Identify low-scoring dimensions
  for (const [dimension, score] of Object.entries(dimensions)) {
    if (score < 0.7) {
      improvements.push({
        area: dimension,
        impact: 1 - score, // Higher impact for lower scores
        effort: 0.5, // Medium effort estimate
      });
    }
  }

  return improvements;
}

/**
 * Task 354.8 — Ops benchmarking across regions
 * Compare operational quality of employers
 */
export async function benchmarkOpsAcrossRegions(orgId: string): Promise<Record<string, number>> {
  // Get all operational matrices
  const allMatrices = await prisma.operationalIntelligenceMatrix.findMany({
    take: 100,
  });

  const scores: number[] = allMatrices.map((m) => {
    const matrix = m.matrix as OperationalMaturity;
    return matrix.score;
  });

  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.5;

  // Get current org score
  const current = await prisma.operationalIntelligenceMatrix.findFirst({
    where: { orgId },
    orderBy: { updatedAt: 'desc' },
  });

  const currentScore = current
    ? (current.matrix as OperationalMaturity).score
    : 0.5;

  return {
    average: avgScore,
    current: currentScore,
    percentile: currentScore > avgScore ? 0.75 : 0.5,
  };
}

/**
 * Task 354.9 — Operational-integrity timeline
 * Track improvements & regressions
 */
export async function buildOpsTimeline(orgId: string): Promise<
  Array<{
    date: string;
    score: number;
    changes: string[];
  }>
> {
  const matrices = await prisma.operationalIntelligenceMatrix.findMany({
    where: { orgId },
    orderBy: { updatedAt: 'asc' },
    take: 20,
  });

  return matrices.map((m) => {
    const matrix = m.matrix as OperationalMaturity;
    return {
      date: m.updatedAt.toISOString(),
      score: matrix.score,
      changes: matrix.improvements.map((i) => i.area),
    };
  });
}

/**
 * Task 354.1 — Get or create operational intelligence matrix
 */
export async function getOrCreateOpsMatrix(orgId: string): Promise<OperationalIntelligenceMatrix> {
  const existing = await prisma.operationalIntelligenceMatrix.findFirst({
    where: { orgId },
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) {
    return {
      orgId,
      matrix: existing.matrix as OperationalMaturity,
      updatedAt: existing.updatedAt.toISOString(),
    };
  }

  // Create new matrix
  const signals = await ingestOpsSignals(orgId);
  const matrix = await scoreOperationalMaturity(orgId, signals);

  const opsMatrix: OperationalIntelligenceMatrix = {
    orgId,
    matrix,
    updatedAt: new Date().toISOString(),
  };

  await prisma.operationalIntelligenceMatrix.create({
    data: {
      orgId,
      matrix: matrix as unknown as Record<string, unknown>,
    },
  });

  return opsMatrix;
}

/**
 * Task 354.10 — Anchor ops matrix snapshot
 */
export async function anchorOpsMatrixSnapshot(orgId: string): Promise<void> {
  const matrix = await getOrCreateOpsMatrix(orgId);

  const matrixHash = createHash('sha256')
    .update(JSON.stringify(matrix))
    .digest('hex');

  anchorEvent('operationalIntelligenceAnchored', {
    orgId,
    matrixHash,
    maturityScore: matrix.matrix.score,
    bottleneckCount: matrix.matrix.bottlenecks.length,
    anomalyCount: matrix.matrix.anomalies.length,
    timestamp: new Date().toISOString(),
  });
}

