/**
 * B240B-VM-012: Risk Scoring Service
 *
 * Assigns risk scores to vendors based on objective metrics:
 * - Service uptime
 * - Incident history
 * - Financial solvency
 * - Due diligence results
 *
 * Avoids using sensitive personal data in calculations.
 */

import { PrismaClient } from '@prisma/client';
import { getVendorDueDiligenceEvaluations } from './dueDiligenceEvaluationService';

export interface RiskScoreComponents {
  uptime?: number; // 0-100, based on service availability
  incidents?: number; // 0-100, based on incident frequency/severity
  financial?: number; // 0-100, based on financial health indicators
  dueDiligence?: number; // 0-100, based on due diligence evaluation scores
  compliance?: number; // 0-100, based on compliance status
}

export interface RiskScoreResult {
  id: string;
  vendorId: string;
  score: number; // 0-100, where 100 is highest risk
  scoreComponents: RiskScoreComponents;
  calculationLog: {
    timestamp: Date;
    components: RiskScoreComponents;
    weights: {
      uptime: number;
      incidents: number;
      financial: number;
      dueDiligence: number;
      compliance: number;
    };
    calculationSteps: string[];
  };
  calculatedAt: Date;
}

// Default weights for risk components
const DEFAULT_WEIGHTS = {
  uptime: 0.2,
  incidents: 0.25,
  financial: 0.2,
  dueDiligence: 0.25,
  compliance: 0.1,
};

/**
 * Calculate risk score for a vendor
 * Uses only objective metrics, avoids sensitive personal data
 */
export async function calculateVendorRiskScore(
  prisma: PrismaClient,
  vendorId: string,
  options?: {
    weights?: Partial<typeof DEFAULT_WEIGHTS>;
    includeCalculationLog?: boolean;
  }
): Promise<RiskScoreResult> {
  const weights = { ...DEFAULT_WEIGHTS, ...options?.weights };
  const calculationSteps: string[] = [];
  const components: RiskScoreComponents = {};

  // 1. Calculate uptime risk (inverse: lower uptime = higher risk)
  const uptimeRisk = await calculateUptimeRisk(prisma, vendorId);
  components.uptime = uptimeRisk.score;
  calculationSteps.push(`Uptime risk: ${uptimeRisk.score} (availability: ${uptimeRisk.availability}%)`);

  // 2. Calculate incident risk
  const incidentRisk = await calculateIncidentRisk(prisma, vendorId);
  components.incidents = incidentRisk.score;
  calculationSteps.push(`Incident risk: ${incidentRisk.score} (incidents: ${incidentRisk.count})`);

  // 3. Calculate financial risk (stub - would integrate with financial data)
  const financialRisk = await calculateFinancialRisk(prisma, vendorId);
  components.financial = financialRisk.score;
  calculationSteps.push(`Financial risk: ${financialRisk.score}`);

  // 4. Calculate due diligence risk (inverse: lower score = higher risk)
  const dueDiligenceRisk = await calculateDueDiligenceRisk(prisma, vendorId);
  components.dueDiligence = dueDiligenceRisk.score;
  calculationSteps.push(`Due diligence risk: ${dueDiligenceRisk.score} (avg score: ${dueDiligenceRisk.avgScore}%)`);

  // 5. Calculate compliance risk
  const complianceRisk = await calculateComplianceRisk(prisma, vendorId);
  components.compliance = complianceRisk.score;
  calculationSteps.push(`Compliance risk: ${complianceRisk.score} (status: ${complianceRisk.status})`);

  // Calculate weighted total risk score
  const totalScore =
    (components.uptime ?? 0) * weights.uptime +
    (components.incidents ?? 0) * weights.incidents +
    (components.financial ?? 0) * weights.financial +
    (components.dueDiligence ?? 0) * weights.dueDiligence +
    (components.compliance ?? 0) * weights.compliance;

  // Cap at 100
  const finalScore = Math.min(100, Math.max(0, totalScore));

  // Store risk score
  const riskScore = await prisma.vendorRiskScore.create({
    data: {
      vendorId,
      score: finalScore,
      scoreComponents: components as any,
      calculationLog: options?.includeCalculationLog
        ? ({
            timestamp: new Date(),
            components,
            weights,
            calculationSteps,
          } as any)
        : undefined,
      calculatedBy: 'RiskScoringService',
    },
  });

  return {
    id: riskScore.id,
    vendorId: riskScore.vendorId,
    score: finalScore,
    scoreComponents: components,
    calculationLog: {
      timestamp: new Date(),
      components,
      weights,
      calculationSteps,
    },
    calculatedAt: riskScore.calculatedAt,
  };
}

/**
 * Calculate uptime risk based on service availability
 * Uses performance metrics, not personal data
 */
async function calculateUptimeRisk(
  prisma: PrismaClient,
  vendorId: string
): Promise<{ score: number; availability: number }> {
  // Get recent uptime metrics (last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const uptimeMetrics = await prisma.vendorPerformanceMetrics.findMany({
    where: {
      vendorId,
      kpiName: 'service_uptime',
      periodStart: { gte: ninetyDaysAgo },
    },
    orderBy: { periodStart: 'desc' },
    take: 10,
  });

  if (uptimeMetrics.length === 0) {
    // No data = medium risk
    return { score: 50, availability: 0 };
  }

  // Calculate average uptime
  const avgUptime =
    uptimeMetrics.reduce((sum, m) => sum + m.value, 0) / uptimeMetrics.length;

  // Convert to risk score: 100% uptime = 0 risk, 0% uptime = 100 risk
  const riskScore = 100 - avgUptime;

  return { score: Math.max(0, Math.min(100, riskScore)), availability: avgUptime };
}

/**
 * Calculate incident risk based on complaint/incident history
 * Uses complaint data, not personal identifiers
 */
async function calculateIncidentRisk(
  prisma: PrismaClient,
  vendorId: string
): Promise<{ score: number; count: number }> {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const complaints = await prisma.vendorComplaint.findMany({
    where: {
      vendorId,
      date: { gte: oneYearAgo },
    },
  });

  const count = complaints.length;

  // Calculate risk based on complaint count and severity
  let riskScore = 0;
  if (count === 0) {
    riskScore = 0;
  } else if (count <= 2) {
    riskScore = 20;
  } else if (count <= 5) {
    riskScore = 40;
  } else if (count <= 10) {
    riskScore = 60;
  } else {
    riskScore = 80;
  }

  // Adjust for severity
  const criticalCount = complaints.filter((c) => c.severity === 'CRITICAL').length;
  const highCount = complaints.filter((c) => c.severity === 'HIGH').length;

  if (criticalCount > 0) {
    riskScore = Math.min(100, riskScore + criticalCount * 10);
  }
  if (highCount > 0) {
    riskScore = Math.min(100, riskScore + highCount * 5);
  }

  return { score: Math.max(0, Math.min(100, riskScore)), count };
}

/**
 * Calculate financial risk (stub implementation)
 * In production, would integrate with financial data sources
 */
async function calculateFinancialRisk(
  prisma: PrismaClient,
  vendorId: string
): Promise<{ score: number }> {
  // Stub: would check financial solvency indicators
  // For now, return medium risk if no data
  return { score: 50 };
}

/**
 * Calculate due diligence risk
 * Lower due diligence scores = higher risk
 */
async function calculateDueDiligenceRisk(
  prisma: PrismaClient,
  vendorId: string
): Promise<{ score: number; avgScore: number }> {
  const evaluations = await getVendorDueDiligenceEvaluations(prisma, vendorId);

  if (evaluations.length === 0) {
    // No evaluation = high risk
    return { score: 80, avgScore: 0 };
  }

  // Get average percentage score
  const avgScore =
    evaluations.reduce((sum, e) => sum + e.percentageScore, 0) / evaluations.length;

  // Convert to risk: 100% score = 0 risk, 0% score = 100 risk
  const riskScore = 100 - avgScore;

  return { score: Math.max(0, Math.min(100, riskScore)), avgScore };
}

/**
 * Calculate compliance risk
 * Based on compliance check results
 */
async function calculateComplianceRisk(
  prisma: PrismaClient,
  vendorId: string
): Promise<{ score: number; status: string }> {
  // This would integrate with ComplianceCheckService
  // For now, stub implementation
  return { score: 30, status: 'unknown' };
}

/**
 * Get latest risk score for a vendor
 */
export async function getLatestVendorRiskScore(
  prisma: PrismaClient,
  vendorId: string
): Promise<RiskScoreResult | null> {
  const riskScore = await prisma.vendorRiskScore.findFirst({
    where: { vendorId },
    orderBy: { calculatedAt: 'desc' },
  });

  if (!riskScore) {
    return null;
  }

  return {
    id: riskScore.id,
    vendorId: riskScore.vendorId,
    score: riskScore.score,
    scoreComponents: riskScore.scoreComponents as RiskScoreComponents,
    calculationLog: riskScore.calculationLog as any,
    calculatedAt: riskScore.calculatedAt,
  };
}

/**
 * Get risk score history for a vendor
 */
export async function getVendorRiskScoreHistory(
  prisma: PrismaClient,
  vendorId: string,
  limit: number = 10
): Promise<RiskScoreResult[]> {
  const riskScores = await prisma.vendorRiskScore.findMany({
    where: { vendorId },
    orderBy: { calculatedAt: 'desc' },
    take: limit,
  });

  return riskScores.map((rs) => ({
    id: rs.id,
    vendorId: rs.vendorId,
    score: rs.score,
    scoreComponents: rs.scoreComponents as RiskScoreComponents,
    calculationLog: rs.calculationLog as any,
    calculatedAt: rs.calculatedAt,
  }));
}

