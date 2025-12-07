/**
 * B239B-COM-014: ComplianceReportGenerator
 *
 * Generates general compliance reports summarizing adherence to obligations:
 * - Top policies
 * - Outstanding issues
 * - Audit events count
 * Supports PDF/CSV export.
 * Can be triggered on demand or scheduled.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { queryAuditLogs, getAuditStatistics } from '../audit/auditLogQueryService.js';

const prisma = new PrismaClient();
const log = getServiceLogger('compliance/reports/generator');

export interface ComplianceReportOptions {
  orgId?: string;
  startDate: Date;
  endDate: Date;
  obligationIds?: string[];
  format?: 'json' | 'csv' | 'pdf';
}

export interface ComplianceReport {
  generatedAt: Date;
  period: { start: Date; end: Date };
  summary: {
    totalEvents: number;
    totalObligations: number;
    complianceScore: number;
  };
  topPolicies: Array<{
    obligationId: string;
    eventCount: number;
    complianceRate: number;
  }>;
  outstandingIssues: Array<{
    obligationId: string;
    issue: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    count: number;
  }>;
  auditEventsByObligation: Record<string, {
    total: number;
    byAction: Record<string, number>;
  }>;
  recommendations: string[];
}

/**
 * Generate a compliance report
 */
export async function generateComplianceReport(
  options: ComplianceReportOptions
): Promise<ComplianceReport> {
  try {
    const { startDate, endDate, obligationIds, orgId } = options;

    // Get audit statistics
    const stats = await getAuditStatistics(startDate, endDate, {
      orgId,
      requireAccessRights: !!orgId,
    });

    // Get obligations to analyze
    const obligations = obligationIds || Object.keys(stats.byObligation);

    // Build report data
    const topPolicies = obligations
      .map((obligationId) => ({
        obligationId,
        eventCount: stats.byObligation[obligationId] || 0,
        complianceRate: calculateComplianceRate(obligationId, stats),
      }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    // Identify outstanding issues
    const outstandingIssues = await identifyOutstandingIssues(
      obligations,
      startDate,
      endDate,
      orgId
    );

    // Get detailed audit events by obligation
    const auditEventsByObligation: Record<string, { total: number; byAction: Record<string, number> }> = {};
    for (const obligationId of obligations) {
      const logs = await queryAuditLogs(
        {
          obligationId,
          startDate,
          endDate,
        },
        { orgId, requireAccessRights: !!orgId }
      );

      const byAction: Record<string, number> = {};
      for (const event of logs.data) {
        byAction[event.action] = (byAction[event.action] || 0) + 1;
      }

      auditEventsByObligation[obligationId] = {
        total: logs.total,
        byAction,
      };
    }

    // Calculate overall compliance score
    const complianceScore = calculateOverallComplianceScore(
      topPolicies,
      outstandingIssues
    );

    // Generate recommendations
    const recommendations = generateRecommendations(topPolicies, outstandingIssues);

    const report: ComplianceReport = {
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      summary: {
        totalEvents: stats.totalEvents,
        totalObligations: obligations.length,
        complianceScore,
      },
      topPolicies,
      outstandingIssues,
      auditEventsByObligation,
      recommendations,
    };

    log.info('[generateComplianceReport] Report generated', {
      orgId,
      period: { start: startDate, end: endDate },
      totalEvents: stats.totalEvents,
      complianceScore,
    });

    return report;
  } catch (error) {
    log.error('[generateComplianceReport] Failed to generate report', { error, options });
    throw error;
  }
}

function calculateComplianceRate(
  obligationId: string,
  stats: Awaited<ReturnType<typeof getAuditStatistics>>
): number {
  // Simple heuristic: compliance rate based on event distribution
  // In production, this would use more sophisticated logic
  const totalEvents = stats.totalEvents;
  const obligationEvents = stats.byObligation[obligationId] || 0;

  if (totalEvents === 0) return 100;

  // Higher event count for an obligation might indicate better tracking
  // This is a simplified calculation - real compliance scoring would be more complex
  const baseRate = Math.min(100, (obligationEvents / totalEvents) * 200);
  return Math.round(baseRate);
}

async function identifyOutstandingIssues(
  obligationIds: string[],
  startDate: Date,
  endDate: Date,
  orgId?: string
): Promise<ComplianceReport['outstandingIssues']> {
  const issues: ComplianceReport['outstandingIssues'] = [];

  for (const obligationId of obligationIds) {
    // Check for missing audit events (indicating potential non-compliance)
    const logs = await queryAuditLogs(
      {
        obligationId,
        startDate,
        endDate,
      },
      { orgId, requireAccessRights: !!orgId }
    );

    // Example: If no events for a critical obligation, that's an issue
    if (logs.total === 0 && ['GDPR', 'HIPAA'].includes(obligationId)) {
      issues.push({
        obligationId,
        issue: `No audit events recorded for ${obligationId} in this period`,
        severity: 'high',
        count: 1,
      });
    }

    // Check for high-risk actions
    const highRiskActions = logs.data.filter(
      (event) => ['delete', 'revoke', 'reject'].includes(event.action)
    );

    if (highRiskActions.length > 10) {
      issues.push({
        obligationId,
        issue: `High number of high-risk actions (${highRiskActions.length})`,
        severity: 'medium',
        count: highRiskActions.length,
      });
    }
  }

  return issues;
}

function calculateOverallComplianceScore(
  topPolicies: ComplianceReport['topPolicies'],
  outstandingIssues: ComplianceReport['outstandingIssues']
): number {
  // Simple scoring: start at 100 and deduct for issues
  let score = 100;

  for (const issue of outstandingIssues) {
    const deduction = {
      low: 1,
      medium: 5,
      high: 10,
      critical: 20,
    }[issue.severity];
    score -= deduction * issue.count;
  }

  // Boost score based on policy coverage
  const avgComplianceRate =
    topPolicies.reduce((sum, p) => sum + p.complianceRate, 0) / topPolicies.length || 0;
  score = (score + avgComplianceRate) / 2;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function generateRecommendations(
  topPolicies: ComplianceReport['topPolicies'],
  outstandingIssues: ComplianceReport['outstandingIssues']
): string[] {
  const recommendations: string[] = [];

  if (outstandingIssues.length > 0) {
    recommendations.push(
      `Address ${outstandingIssues.length} outstanding compliance issue(s)`
    );
  }

  const lowCompliancePolicies = topPolicies.filter((p) => p.complianceRate < 70);
  if (lowCompliancePolicies.length > 0) {
    recommendations.push(
      `Improve compliance tracking for: ${lowCompliancePolicies.map((p) => p.obligationId).join(', ')}`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue monitoring compliance metrics');
  }

  return recommendations;
}

/**
 * Export report to CSV format
 */
export function exportReportToCSV(report: ComplianceReport): string {
  const lines: string[] = [];

  // Header
  lines.push('Compliance Report');
  lines.push(`Generated: ${report.generatedAt.toISOString()}`);
  lines.push(`Period: ${report.period.start.toISOString()} to ${report.period.end.toISOString()}`);
  lines.push('');

  // Summary
  lines.push('Summary');
  lines.push(`Total Events,${report.summary.totalEvents}`);
  lines.push(`Total Obligations,${report.summary.totalObligations}`);
  lines.push(`Compliance Score,${report.summary.complianceScore}`);
  lines.push('');

  // Top Policies
  lines.push('Top Policies');
  lines.push('Obligation,Event Count,Compliance Rate');
  for (const policy of report.topPolicies) {
    lines.push(`${policy.obligationId},${policy.eventCount},${policy.complianceRate}%`);
  }
  lines.push('');

  // Outstanding Issues
  lines.push('Outstanding Issues');
  lines.push('Obligation,Issue,Severity,Count');
  for (const issue of report.outstandingIssues) {
    lines.push(`${issue.obligationId},"${issue.issue}",${issue.severity},${issue.count}`);
  }

  return lines.join('\n');
}

/**
 * Export report to JSON format (already structured)
 */
export function exportReportToJSON(report: ComplianceReport): string {
  return JSON.stringify(report, null, 2);
}

// PDF export would require a library like pdfkit or puppeteer
// For now, we'll provide a placeholder
export async function exportReportToPDF(report: ComplianceReport): Promise<Buffer> {
  // TODO: Implement PDF generation using pdfkit or similar
  log.warn('[exportReportToPDF] PDF export not yet implemented');
  throw new Error('PDF export not yet implemented');
}

