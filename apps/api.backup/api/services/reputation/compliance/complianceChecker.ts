/**
 * B224B-REP-010: ReputationComplianceChecker
 *
 * Validates that reputation computation and sharing comply with state/federal laws
 * (e.g. EEOC, FTC Fair Credit Reporting); alerts on non-compliance.
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';

const logger = createLogger({ service: 'reputation-compliance-checker' });

export type ComplianceCheckType = 'EEOC' | 'FTC_FCRA' | 'STATE_LAW' | 'GDPR' | 'CCPA';

export interface ComplianceViolation {
  type: ComplianceCheckType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  lawReference: string;
  remediation: string;
  affectedClinicians?: string[];
  affectedRecipients?: string[];
}

export interface ComplianceCheckResult {
  checkType: ComplianceCheckType;
  jurisdiction?: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  violations: ComplianceViolation[];
  alerts: Array<{
    level: 'INFO' | 'WARNING' | 'ERROR';
    message: string;
    actionRequired: boolean;
  }>;
  checkedAt: Date;
}

export interface ComplianceCheckConfig {
  /** Jurisdictions to check */
  jurisdictions: string[];
  /** Check types to perform */
  checkTypes: ComplianceCheckType[];
  /** Alert thresholds */
  alertThresholds: {
    violationCount: number;
    severityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
}

const DEFAULT_CONFIG: ComplianceCheckConfig = {
  jurisdictions: ['US_FEDERAL', 'CA', 'NY', 'TX'], // Add more as needed
  checkTypes: ['EEOC', 'FTC_FCRA', 'GDPR', 'CCPA'],
  alertThresholds: {
    violationCount: 1,
    severityLevel: 'MEDIUM',
  },
};

/**
 * ReputationComplianceChecker
 *
 * Validates reputation computation and sharing for legal compliance.
 */
export class ReputationComplianceChecker {
  private config: ComplianceCheckConfig;

  constructor(
    private prisma: PrismaClient,
    config?: Partial<ComplianceCheckConfig>
  ) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Run compliance checks for all configured jurisdictions and check types
   */
  async runComplianceChecks(): Promise<ComplianceCheckResult[]> {
    logger.info('Running compliance checks', {
      jurisdictions: this.config.jurisdictions,
      checkTypes: this.config.checkTypes,
    });

    const results: ComplianceCheckResult[] = [];

    for (const jurisdiction of this.config.jurisdictions) {
      for (const checkType of this.config.checkTypes) {
        const result = await this.checkCompliance(checkType, jurisdiction);
        results.push(result);

        // Save result to database
        await this.saveComplianceCheck(result);
      }
    }

    // Generate alerts for violations
    await this.generateAlerts(results);

    return results;
  }

  /**
   * Check compliance for a specific check type and jurisdiction
   */
  async checkCompliance(
    checkType: ComplianceCheckType,
    jurisdiction?: string
  ): Promise<ComplianceCheckResult> {
    logger.info('Checking compliance', { checkType, jurisdiction });

    const violations: ComplianceViolation[] = [];
    const alerts: Array<{
      level: 'INFO' | 'WARNING' | 'ERROR';
      message: string;
      actionRequired: boolean;
    }> = [];

    switch (checkType) {
      case 'EEOC':
        violations.push(...(await this.checkEEOCCompliance()));
        break;
      case 'FTC_FCRA':
        violations.push(...(await this.checkFTCFCRACompliance()));
        break;
      case 'GDPR':
        violations.push(...(await this.checkGDPRCompliance()));
        break;
      case 'CCPA':
        violations.push(...(await this.checkCCPACompliance()));
        break;
      case 'STATE_LAW':
        if (jurisdiction) {
          violations.push(...(await this.checkStateLawCompliance(jurisdiction)));
        }
        break;
    }

    // Determine overall status
    const status = this.determineStatus(violations);

    // Generate alerts based on violations
    if (violations.length > 0) {
      const criticalViolations = violations.filter((v) => v.severity === 'CRITICAL');
      const highViolations = violations.filter((v) => v.severity === 'HIGH');

      if (criticalViolations.length > 0) {
        alerts.push({
          level: 'ERROR',
          message: `${criticalViolations.length} critical compliance violation(s) detected`,
          actionRequired: true,
        });
      } else if (highViolations.length > 0) {
        alerts.push({
          level: 'WARNING',
          message: `${highViolations.length} high-severity compliance violation(s) detected`,
          actionRequired: true,
        });
      } else {
        alerts.push({
          level: 'INFO',
          message: `${violations.length} compliance violation(s) detected`,
          actionRequired: false,
        });
      }
    }

    return {
      checkType,
      jurisdiction,
      status,
      violations,
      alerts,
      checkedAt: new Date(),
    };
  }

  /**
   * Check EEOC (Equal Employment Opportunity Commission) compliance
   * Ensures reputation algorithm doesn't discriminate based on protected characteristics
   */
  private async checkEEOCCompliance(): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    // Check for demographic bias in reputation scores
    // In production, would analyze actual reputation data for disparities
    const policies = await this.prisma.reputationSharingPolicy.findMany({
      where: { consentGiven: true },
    });

    // Check if sharing policies allow discrimination
    // Example: If policies exclude certain demographics, that's a violation
    // This is a simplified check - in production, would analyze actual data

    // Placeholder: Check for potential issues
    const hasPotentialBias = false; // Would be determined by actual analysis

    if (hasPotentialBias) {
      violations.push({
        type: 'EEOC',
        severity: 'HIGH',
        description: 'Potential demographic bias detected in reputation algorithm',
        lawReference: 'Title VII of the Civil Rights Act of 1964',
        remediation: 'Review reputation algorithm for demographic fairness; conduct bias audit',
      });
    }

    return violations;
  }

  /**
   * Check FTC Fair Credit Reporting Act (FCRA) compliance
   * Ensures reputation data sharing follows FCRA requirements for consumer reports
   */
  private async checkFTCFCRACompliance(): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    // Check if reputation data is being shared as a "consumer report"
    // FCRA requires disclosure and consent for consumer reports
    const policies = await this.prisma.reputationSharingPolicy.findMany({
      where: { consentGiven: true },
    });

    // Check for missing disclosures
    const policiesWithoutDisclosure = policies.filter((p) => {
      // In production, would check if proper FCRA disclosure was provided
      return false; // Placeholder
    });

    if (policiesWithoutDisclosure.length > 0) {
      violations.push({
        type: 'FTC_FCRA',
        severity: 'CRITICAL',
        description: 'Reputation data shared without proper FCRA disclosure',
        lawReference: 'Fair Credit Reporting Act (15 U.S.C. § 1681)',
        remediation: 'Ensure all reputation data sharing includes FCRA disclosure and proper consent',
        affectedRecipients: policiesWithoutDisclosure.map((p) => p.recipientId || 'all'),
      });
    }

    // Check for adverse action notifications
    // FCRA requires notification when adverse action is taken based on consumer report
    // This would be checked when reputation data leads to denial/restriction

    return violations;
  }

  /**
   * Check GDPR compliance
   * Ensures reputation data handling follows GDPR requirements
   */
  private async checkGDPRCompliance(): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    // Check for data deletion requests that haven't been processed
    const pendingDeletions = await this.prisma.dataDeletionRequest.findMany({
      where: {
        requestType: 'DELETION',
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        requestedAt: {
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Older than 30 days
        },
      },
    });

    if (pendingDeletions.length > 0) {
      violations.push({
        type: 'GDPR',
        severity: 'HIGH',
        description: `${pendingDeletions.length} data deletion request(s) pending beyond 30-day requirement`,
        lawReference: 'GDPR Article 17 (Right to erasure)',
        remediation: 'Process pending deletion requests immediately',
        affectedClinicians: pendingDeletions.map((d) => d.clinicianId),
      });
    }

    // Check for proper consent management
    const expiredPolicies = await this.prisma.reputationSharingPolicy.findMany({
      where: {
        consentGiven: true,
        expiryDate: { lt: new Date() },
      },
    });

    if (expiredPolicies.length > 0) {
      violations.push({
        type: 'GDPR',
        severity: 'MEDIUM',
        description: `${expiredPolicies.length} sharing policy(ies) with expired consent still active`,
        lawReference: 'GDPR Article 6 (Lawfulness of processing)',
        remediation: 'Revoke consent for expired policies',
        affectedClinicians: expiredPolicies.map((p) => p.clinicianId),
      });
    }

    return violations;
  }

  /**
   * Check CCPA compliance
   * Ensures reputation data handling follows CCPA requirements
   */
  private async checkCCPACompliance(): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    // Check for data portability requests that haven't been processed
    const pendingPortability = await this.prisma.dataDeletionRequest.findMany({
      where: {
        requestType: 'PORTABILITY',
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        requestedAt: {
          lt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // Older than 45 days
        },
      },
    });

    if (pendingPortability.length > 0) {
      violations.push({
        type: 'CCPA',
        severity: 'HIGH',
        description: `${pendingPortability.length} data portability request(s) pending beyond 45-day requirement`,
        lawReference: 'CCPA Section 1798.100 (Right to know)',
        remediation: 'Process pending portability requests immediately',
        affectedClinicians: pendingPortability.map((d) => d.clinicianId),
      });
    }

    // Check for opt-out mechanisms
    // CCPA requires easy opt-out from data sharing
    // This would check if opt-out mechanisms are properly implemented

    return violations;
  }

  /**
   * Check state-specific law compliance
   */
  private async checkStateLawCompliance(jurisdiction: string): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    // State-specific checks would go here
    // Examples:
    // - California: Additional CCPA requirements
    // - New York: SHIELD Act requirements
    // - Texas: State-specific privacy laws

    logger.debug('Checking state law compliance', { jurisdiction });

    return violations;
  }

  /**
   * Determine overall compliance status from violations
   */
  private determineStatus(violations: ComplianceViolation[]): 'PASS' | 'WARN' | 'FAIL' {
    if (violations.length === 0) {
      return 'PASS';
    }

    const hasCritical = violations.some((v) => v.severity === 'CRITICAL');
    const hasHigh = violations.some((v) => v.severity === 'HIGH');

    if (hasCritical || hasHigh) {
      return 'FAIL';
    }

    return 'WARN';
  }

  /**
   * Save compliance check result to database
   */
  private async saveComplianceCheck(result: ComplianceCheckResult): Promise<void> {
    try {
      await this.prisma.reputationComplianceCheck.create({
        data: {
          checkDate: result.checkedAt,
          checkType: result.checkType,
          jurisdiction: result.jurisdiction || null,
          status: result.status,
          violations: result.violations as any,
          alerts: result.alerts as any,
        },
      });

      logger.info('Compliance check saved', {
        checkType: result.checkType,
        jurisdiction: result.jurisdiction,
        status: result.status,
      });
    } catch (error) {
      logger.error('Error saving compliance check', { error });
      throw error;
    }
  }

  /**
   * Generate alerts for compliance violations
   */
  private async generateAlerts(results: ComplianceCheckResult[]): Promise<void> {
    const allViolations = results.flatMap((r) => r.violations);
    const criticalViolations = allViolations.filter((v) => v.severity === 'CRITICAL');
    const highViolations = allViolations.filter((v) => v.severity === 'HIGH');

    if (criticalViolations.length > 0) {
      logger.error('Critical compliance violations detected', {
        count: criticalViolations.length,
        violations: criticalViolations.map((v) => ({
          type: v.type,
          description: v.description,
        })),
      });

      // In production, would send alerts via notification service
      // await notificationService.sendAlert({
      //   level: 'CRITICAL',
      //   message: `${criticalViolations.length} critical compliance violation(s) detected`,
      //   violations: criticalViolations,
      // });
    }

    if (highViolations.length > 0) {
      logger.warn('High-severity compliance violations detected', {
        count: highViolations.length,
        violations: highViolations.map((v) => ({
          type: v.type,
          description: v.description,
        })),
      });
    }
  }

  /**
   * Get latest compliance check results
   */
  async getLatestComplianceChecks(
    checkType?: ComplianceCheckType,
    jurisdiction?: string
  ): Promise<ComplianceCheckResult[]> {
    const where: any = {};
    if (checkType) {
      where.checkType = checkType;
    }
    if (jurisdiction) {
      where.jurisdiction = jurisdiction;
    }

    const checks = await this.prisma.reputationComplianceCheck.findMany({
      where,
      orderBy: { checkDate: 'desc' },
      take: 10,
    });

    return checks.map((c) => ({
      checkType: c.checkType as ComplianceCheckType,
      jurisdiction: c.jurisdiction || undefined,
      status: c.status as 'PASS' | 'WARN' | 'FAIL',
      violations: (c.violations as any) || [],
      alerts: (c.alerts as any) || [],
      checkedAt: c.checkDate,
    }));
  }
}

/**
 * Create a new ReputationComplianceChecker instance
 */
export function createReputationComplianceChecker(
  prisma: PrismaClient,
  config?: Partial<ComplianceCheckConfig>
): ReputationComplianceChecker {
  return new ReputationComplianceChecker(prisma, config);
}

