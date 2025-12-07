/**
 * B240B-VM-019: Vendor Risk Alerts Service
 *
 * Monitors risk scores and compliance status.
 * Sends alerts to admins when risk crosses thresholds or due diligence is overdue.
 * Logs all actions.
 */

import { PrismaClient } from '@prisma/client';
import { getLatestVendorRiskScore } from '../services/riskScoringService';
import { getVendorComplianceStatus, flagNonCompliantVendors } from '../services/complianceCheckService';
import { getVendorDueDiligenceEvaluations } from '../services/dueDiligenceEvaluationService';

export interface RiskAlert {
  id: string;
  vendorId: string;
  vendorName: string;
  alertType: 'risk_threshold' | 'compliance_issue' | 'due_diligence_overdue' | 'performance_degraded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, any>;
  createdAt: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

export interface AlertThresholds {
  riskScoreHigh: number; // Alert if risk score exceeds this
  riskScoreCritical: number; // Critical alert if risk score exceeds this
  dueDiligenceDaysOverdue: number; // Alert if due diligence is overdue by this many days
  performanceScoreLow: number; // Alert if performance score is below this
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  riskScoreHigh: 70,
  riskScoreCritical: 85,
  dueDiligenceDaysOverdue: 90,
  performanceScoreLow: 50,
};

/**
 * Check vendors and generate risk alerts
 */
export async function checkAndGenerateRiskAlerts(
  prisma: PrismaClient,
  thresholds: Partial<AlertThresholds> = {}
): Promise<RiskAlert[]> {
  const finalThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const alerts: RiskAlert[] = [];

  // Get all active vendors
  const vendors = await prisma.vendor.findMany({
    where: {
      status: 'ACTIVE',
    },
  });

  for (const vendor of vendors) {
    // Check risk score
    const riskAlerts = await checkRiskScoreAlerts(
      prisma,
      vendor.id,
      vendor.name,
      finalThresholds
    );
    alerts.push(...riskAlerts);

    // Check compliance
    const complianceAlerts = await checkComplianceAlerts(
      prisma,
      vendor.id,
      vendor.name
    );
    alerts.push(...complianceAlerts);

    // Check due diligence
    const dueDiligenceAlerts = await checkDueDiligenceAlerts(
      prisma,
      vendor.id,
      vendor.name,
      finalThresholds
    );
    alerts.push(...dueDiligenceAlerts);

    // Check performance
    const performanceAlerts = await checkPerformanceAlerts(
      prisma,
      vendor.id,
      vendor.name,
      finalThresholds
    );
    alerts.push(...performanceAlerts);
  }

  // Store alerts (in production, would use an Alert table)
  // For now, log them
  for (const alert of alerts) {
    await logAlert(prisma, alert);
  }

  return alerts;
}

/**
 * Check risk score and generate alerts if threshold exceeded
 */
async function checkRiskScoreAlerts(
  prisma: PrismaClient,
  vendorId: string,
  vendorName: string,
  thresholds: AlertThresholds
): Promise<RiskAlert[]> {
  const alerts: RiskAlert[] = [];
  const riskScore = await getLatestVendorRiskScore(prisma, vendorId);

  if (!riskScore) {
    return alerts;
  }

  if (riskScore.score >= thresholds.riskScoreCritical) {
    alerts.push({
      id: `risk-${vendorId}-${Date.now()}`,
      vendorId,
      vendorName,
      alertType: 'risk_threshold',
      severity: 'critical',
      message: `Critical risk score: ${riskScore.score.toFixed(1)} exceeds threshold ${thresholds.riskScoreCritical}`,
      details: {
        riskScore: riskScore.score,
        threshold: thresholds.riskScoreCritical,
        components: riskScore.scoreComponents,
      },
      createdAt: new Date(),
      acknowledged: false,
    });
  } else if (riskScore.score >= thresholds.riskScoreHigh) {
    alerts.push({
      id: `risk-${vendorId}-${Date.now()}`,
      vendorId,
      vendorName,
      alertType: 'risk_threshold',
      severity: 'high',
      message: `High risk score: ${riskScore.score.toFixed(1)} exceeds threshold ${thresholds.riskScoreHigh}`,
      details: {
        riskScore: riskScore.score,
        threshold: thresholds.riskScoreHigh,
        components: riskScore.scoreComponents,
      },
      createdAt: new Date(),
      acknowledged: false,
    });
  }

  return alerts;
}

/**
 * Check compliance and generate alerts
 */
async function checkComplianceAlerts(
  prisma: PrismaClient,
  vendorId: string,
  vendorName: string
): Promise<RiskAlert[]> {
  const alerts: RiskAlert[] = [];
  const complianceStatus = await getVendorComplianceStatus(prisma, vendorId);

  if (!complianceStatus) {
    return alerts;
  }

  if (!complianceStatus.compliant) {
    const nonCompliantReqs = complianceStatus.requirements.filter(
      (r) => r.status !== 'compliant'
    );

    const criticalReqs = nonCompliantReqs.filter(
      (r) => r.status === 'expired' || r.status === 'missing'
    );

    alerts.push({
      id: `compliance-${vendorId}-${Date.now()}`,
      vendorId,
      vendorName,
      alertType: 'compliance_issue',
      severity: criticalReqs.length > 0 ? 'high' : 'medium',
      message: `Compliance issues detected: ${nonCompliantReqs.length} requirement(s) non-compliant`,
      details: {
        nonCompliantRequirements: nonCompliantReqs.map((r) => ({
          type: r.type,
          status: r.status,
          expiryDate: r.expiryDate,
        })),
      },
      createdAt: new Date(),
      acknowledged: false,
    });
  }

  return alerts;
}

/**
 * Check due diligence and generate alerts if overdue
 */
async function checkDueDiligenceAlerts(
  prisma: PrismaClient,
  vendorId: string,
  vendorName: string,
  thresholds: AlertThresholds
): Promise<RiskAlert[]> {
  const alerts: RiskAlert[] = [];
  const evaluations = await getVendorDueDiligenceEvaluations(prisma, vendorId);

  if (evaluations.length === 0) {
    // No evaluation = overdue
    alerts.push({
      id: `dd-${vendorId}-${Date.now()}`,
      vendorId,
      vendorName,
      alertType: 'due_diligence_overdue',
      severity: 'high',
      message: 'Due diligence evaluation is missing',
      details: {
        daysOverdue: thresholds.dueDiligenceDaysOverdue,
      },
      createdAt: new Date(),
      acknowledged: false,
    });
    return alerts;
  }

  // Check if latest evaluation is old
  const latestEvaluation = evaluations[0];
  const daysSinceEvaluation = Math.floor(
    (Date.now() - latestEvaluation.evaluatedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceEvaluation > thresholds.dueDiligenceDaysOverdue) {
    alerts.push({
      id: `dd-${vendorId}-${Date.now()}`,
      vendorId,
      vendorName,
      alertType: 'due_diligence_overdue',
      severity: daysSinceEvaluation > thresholds.dueDiligenceDaysOverdue * 2 ? 'critical' : 'high',
      message: `Due diligence evaluation is ${daysSinceEvaluation} days old (threshold: ${thresholds.dueDiligenceDaysOverdue} days)`,
      details: {
        daysSinceEvaluation,
        threshold: thresholds.dueDiligenceDaysOverdue,
        lastEvaluationDate: latestEvaluation.evaluatedAt,
      },
      createdAt: new Date(),
      acknowledged: false,
    });
  }

  return alerts;
}

/**
 * Check performance and generate alerts if degraded
 */
async function checkPerformanceAlerts(
  prisma: PrismaClient,
  vendorId: string,
  vendorName: string,
  thresholds: AlertThresholds
): Promise<RiskAlert[]> {
  const alerts: RiskAlert[] = [];

  // Get latest performance metrics
  const metrics = await prisma.vendorPerformanceMetrics.findMany({
    where: { vendorId },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });

  if (metrics.length === 0) {
    return alerts;
  }

  // Check if performance score is low
  const latestMetric = metrics[0];
  if (latestMetric.value < thresholds.performanceScoreLow) {
    alerts.push({
      id: `perf-${vendorId}-${Date.now()}`,
      vendorId,
      vendorName,
      alertType: 'performance_degraded',
      severity: latestMetric.value < thresholds.performanceScoreLow * 0.7 ? 'high' : 'medium',
      message: `Performance score ${latestMetric.value.toFixed(1)} is below threshold ${thresholds.performanceScoreLow}`,
      details: {
        kpiName: latestMetric.kpiName,
        value: latestMetric.value,
        threshold: thresholds.performanceScoreLow,
      },
      createdAt: new Date(),
      acknowledged: false,
    });
  }

  return alerts;
}

/**
 * Log alert (in production, would store in Alert table)
 */
async function logAlert(prisma: PrismaClient, alert: RiskAlert): Promise<void> {
  // In production, create an Alert model and store here
  // For now, we'll use audit logging or a separate alert table
  console.log(`[VENDOR_RISK_ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`, alert);
}

/**
 * Get active alerts for a vendor
 */
export async function getVendorAlerts(
  prisma: PrismaClient,
  vendorId: string,
  acknowledged?: boolean
): Promise<RiskAlert[]> {
  // In production, would query Alert table
  // For now, generate fresh alerts
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) {
    return [];
  }

  const alerts = await checkAndGenerateRiskAlerts(prisma);
  return alerts.filter(
    (a) => a.vendorId === vendorId && (acknowledged === undefined || a.acknowledged === acknowledged)
  );
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(
  prisma: PrismaClient,
  alertId: string,
  acknowledgedBy: string
): Promise<void> {
  // In production, would update Alert table
  // For now, stub implementation
  console.log(`Alert ${alertId} acknowledged by ${acknowledgedBy}`);
}

/**
 * Get all non-compliant vendors (convenience method)
 */
export async function getNonCompliantVendorAlerts(
  prisma: PrismaClient
): Promise<RiskAlert[]> {
  const nonCompliant = await flagNonCompliantVendors(prisma);

  return nonCompliant.map((vendor) => ({
    id: `compliance-${vendor.vendorId}-${Date.now()}`,
    vendorId: vendor.vendorId,
    vendorName: vendor.vendorName,
    alertType: 'compliance_issue' as const,
    severity: 'high' as const,
    message: `Vendor has ${vendor.nonCompliantRequirements.length} non-compliant requirement(s)`,
    details: {
      nonCompliantRequirements: vendor.nonCompliantRequirements,
    },
    createdAt: new Date(),
    acknowledged: false,
  }));
}

