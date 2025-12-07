/**
 * B242A-ACC-007: AccessibilityReportGenerator
 *
 * Generates periodic accessibility compliance reports:
 * - Summarizes audit results
 * - Highlights improvements and regressions
 * - Exports in PDF/CSV formats
 * - Supports scheduled and on-demand generation
 */

import { WCAGAuditResult } from '../audit/wcagComplianceAuditService';
import { FormValidationResult } from '../validation/accessibleFormValidator';

export interface ReportSummary {
  reportId: string;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  totalPagesAudited: number;
  overallCompliance: 'pass' | 'fail' | 'partial';
  totalViolations: number;
  violationsByType: {
    errors: number;
    warnings: number;
    info: number;
  };
  violationsByCriterion: Record<string, number>;
  improvements: string[];
  regressions: string[];
}

export interface AccessibilityReport {
  summary: ReportSummary;
  auditResults: WCAGAuditResult[];
  formValidationResults: FormValidationResult[];
  recommendations: string[];
}

export class AccessibilityReportGenerator {
  /**
   * Generate a summary report from multiple audit results
   */
  generateSummary(
    auditResults: WCAGAuditResult[],
    formValidationResults: FormValidationResult[] = [],
    periodStart?: Date,
    periodEnd?: Date
  ): AccessibilityReport {
    const now = new Date();
    const start = periodStart || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const end = periodEnd || now;

    // Aggregate violations
    const allViolations = auditResults.flatMap((result) => result.violations);
    const violationsByType = {
      errors: allViolations.filter((v) => v.type === 'error').length,
      warnings: allViolations.filter((v) => v.type === 'warning').length,
      info: allViolations.filter((v) => v.type === 'info').length,
    };

    // Group violations by criterion
    const violationsByCriterion: Record<string, number> = {};
    allViolations.forEach((violation) => {
      violationsByCriterion[violation.criterion] =
        (violationsByCriterion[violation.criterion] || 0) + 1;
    });

    // Determine overall compliance
    const overallCompliance =
      violationsByType.errors === 0
        ? violationsByType.warnings === 0
          ? 'pass'
          : 'partial'
        : 'fail';

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      auditResults,
      formValidationResults
    );

    const summary: ReportSummary = {
      reportId: `acc-report-${now.toISOString()}`,
      generatedAt: now,
      periodStart: start,
      periodEnd: end,
      totalPagesAudited: auditResults.length,
      overallCompliance,
      totalViolations: allViolations.length,
      violationsByType,
      violationsByCriterion,
      improvements: [], // Would be populated by comparing with previous reports
      regressions: [], // Would be populated by comparing with previous reports
    };

    return {
      summary,
      auditResults,
      formValidationResults,
      recommendations,
    };
  }

  /**
   * Generate recommendations based on audit results
   */
  private generateRecommendations(
    auditResults: WCAGAuditResult[],
    formValidationResults: FormValidationResult[]
  ): string[] {
    const recommendations: string[] = [];

    // Check for common issues
    const allViolations = auditResults.flatMap((result) => result.violations);
    const contrastIssues = allViolations.filter((v) =>
      v.criterion.includes('Contrast')
    ).length;
    const labelIssues = allViolations.filter((v) =>
      v.criterion.includes('Name, Role, Value')
    ).length;
    const focusIssues = allViolations.filter((v) =>
      v.criterion.includes('Focus')
    ).length;

    if (contrastIssues > 0) {
      recommendations.push(
        `Address ${contrastIssues} color contrast issue(s) to meet WCAG AA standards`
      );
    }

    if (labelIssues > 0) {
      recommendations.push(
        `Add accessible names to ${labelIssues} interactive element(s) using aria-label or visible text`
      );
    }

    if (focusIssues > 0) {
      recommendations.push(
        `Fix focus order issues on ${focusIssues} element(s) for proper keyboard navigation`
      );
    }

    const formIssues = formValidationResults.filter((r) => !r.valid).length;
    if (formIssues > 0) {
      recommendations.push(
        `Fix accessibility issues in ${formIssues} form(s) to ensure proper error handling and labeling`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('No critical accessibility issues found. Continue monitoring for regressions.');
    }

    return recommendations;
  }

  /**
   * Export report as CSV
   */
  exportToCSV(report: AccessibilityReport): string {
    const lines: string[] = [];

    // Header
    lines.push('Accessibility Compliance Report');
    lines.push(`Generated: ${report.summary.generatedAt.toISOString()}`);
    lines.push(`Period: ${report.summary.periodStart.toISOString()} to ${report.summary.periodEnd.toISOString()}`);
    lines.push('');

    // Summary
    lines.push('Summary');
    lines.push('Metric,Value');
    lines.push(`Total Pages Audited,${report.summary.totalPagesAudited}`);
    lines.push(`Overall Compliance,${report.summary.overallCompliance}`);
    lines.push(`Total Violations,${report.summary.totalViolations}`);
    lines.push(`Errors,${report.summary.violationsByType.errors}`);
    lines.push(`Warnings,${report.summary.violationsByType.warnings}`);
    lines.push('');

    // Violations by criterion
    lines.push('Violations by Criterion');
    lines.push('Criterion,Count');
    Object.entries(report.summary.violationsByCriterion).forEach(([criterion, count]) => {
      lines.push(`${criterion},${count}`);
    });
    lines.push('');

    // Detailed violations
    lines.push('Detailed Violations');
    lines.push('Type,Criterion,Element,Message,Suggestion');
    report.auditResults.forEach((audit) => {
      audit.violations.forEach((violation) => {
        const row = [
          violation.type,
          violation.criterion,
          violation.element || '',
          `"${violation.message.replace(/"/g, '""')}"`,
          violation.suggestion ? `"${violation.suggestion.replace(/"/g, '""')}"` : '',
        ];
        lines.push(row.join(','));
      });
    });

    return lines.join('\n');
  }

  /**
   * Export report as JSON
   */
  exportToJSON(report: AccessibilityReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate a markdown report
   */
  exportToMarkdown(report: AccessibilityReport): string {
    const lines: string[] = [];

    lines.push('# Accessibility Compliance Report');
    lines.push('');
    lines.push(`**Generated:** ${report.summary.generatedAt.toISOString()}`);
    lines.push(`**Period:** ${report.summary.periodStart.toISOString()} to ${report.summary.periodEnd.toISOString()}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Total Pages Audited:** ${report.summary.totalPagesAudited}`);
    lines.push(`- **Overall Compliance:** ${report.summary.overallCompliance.toUpperCase()}`);
    lines.push(`- **Total Violations:** ${report.summary.totalViolations}`);
    lines.push(`  - Errors: ${report.summary.violationsByType.errors}`);
    lines.push(`  - Warnings: ${report.summary.violationsByType.warnings}`);
    lines.push(`  - Info: ${report.summary.violationsByType.info}`);
    lines.push('');

    // Violations by criterion
    if (Object.keys(report.summary.violationsByCriterion).length > 0) {
      lines.push('## Violations by Criterion');
      lines.push('');
      lines.push('| Criterion | Count |');
      lines.push('|-----------|-------|');
      Object.entries(report.summary.violationsByCriterion)
        .sort((a, b) => b[1] - a[1])
        .forEach(([criterion, count]) => {
          lines.push(`| ${criterion} | ${count} |`);
        });
      lines.push('');
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      lines.push('## Recommendations');
      lines.push('');
      report.recommendations.forEach((rec) => {
        lines.push(`- ${rec}`);
      });
      lines.push('');
    }

    // Detailed violations
    if (report.auditResults.length > 0) {
      lines.push('## Detailed Violations');
      lines.push('');
      report.auditResults.forEach((audit, index) => {
        if (audit.violations.length > 0) {
          lines.push(`### Page ${index + 1}${audit.pageUrl ? `: ${audit.pageUrl}` : ''}`);
          lines.push('');
          audit.violations.forEach((violation) => {
            lines.push(`- **${violation.type.toUpperCase()}** [${violation.criterion}]`);
            if (violation.element) {
              lines.push(`  - Element: ${violation.element}`);
            }
            lines.push(`  - ${violation.message}`);
            if (violation.suggestion) {
              lines.push(`  - Suggestion: ${violation.suggestion}`);
            }
            lines.push('');
          });
        }
      });
    }

    return lines.join('\n');
  }

  /**
   * Compare two reports to identify improvements and regressions
   */
  compareReports(
    currentReport: AccessibilityReport,
    previousReport: AccessibilityReport
  ): {
    improvements: string[];
    regressions: string[];
  } {
    const improvements: string[] = [];
    const regressions: string[] = [];

    const currentViolations = currentReport.summary.totalViolations;
    const previousViolations = previousReport.summary.totalViolations;

    if (currentViolations < previousViolations) {
      improvements.push(
        `Reduced total violations from ${previousViolations} to ${currentViolations}`
      );
    } else if (currentViolations > previousViolations) {
      regressions.push(
        `Increased total violations from ${previousViolations} to ${currentViolations}`
      );
    }

    // Compare by criterion
    Object.keys(currentReport.summary.violationsByCriterion).forEach((criterion) => {
      const current = currentReport.summary.violationsByCriterion[criterion] || 0;
      const previous = previousReport.summary.violationsByCriterion[criterion] || 0;

      if (current < previous) {
        improvements.push(
          `Reduced ${criterion} violations from ${previous} to ${current}`
        );
      } else if (current > previous) {
        regressions.push(
          `Increased ${criterion} violations from ${previous} to ${current}`
        );
      }
    });

    return { improvements, regressions };
  }
}

export const accessibilityReportGenerator = new AccessibilityReportGenerator();

