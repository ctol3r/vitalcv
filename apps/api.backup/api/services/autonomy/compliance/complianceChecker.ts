/**
 * B222B-ETH-007: RegulatoryComplianceChecker
 *
 * Validates that autonomous actions comply with CMS/State licensing rules, HIPAA, TEFCA, and privilege compacts;
 * logs exceptions.
 */

import { createLogger } from '@chai-vc/logging-core';
import { PrismaClient } from '@prisma/client';

const logger = createLogger({ service: 'autonomy-compliance-checker' });
const prisma = new PrismaClient();

/**
 * Regulatory frameworks to check
 */
export enum RegulatoryFramework {
  CMS = 'CMS',
  STATE_LICENSING = 'STATE_LICENSING',
  HIPAA = 'HIPAA',
  TEFCA = 'TEFCA',
  PRIVILEGE_COMPACT = 'PRIVILEGE_COMPACT',
}

/**
 * Compliance check result
 */
export interface ComplianceCheckResult {
  /** Whether the action is compliant */
  compliant: boolean;
  /** Framework that failed (if any) */
  failedFramework?: RegulatoryFramework;
  /** Violations found */
  violations: ComplianceViolation[];
  /** Warnings (non-blocking issues) */
  warnings: ComplianceWarning[];
  /** Timestamp of check */
  checkedAt: Date;
}

/**
 * Compliance violation
 */
export interface ComplianceViolation {
  /** Framework violated */
  framework: RegulatoryFramework;
  /** Rule violated */
  rule: string;
  /** Description of violation */
  description: string;
  /** Severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Remediation steps */
  remediation?: string[];
}

/**
 * Compliance warning (non-blocking)
 */
export interface ComplianceWarning {
  /** Framework */
  framework: RegulatoryFramework;
  /** Warning message */
  message: string;
  /** Recommendation */
  recommendation?: string;
}

/**
 * Autonomous action context for compliance checking
 */
export interface AutonomousActionContext {
  /** Action ID */
  actionId: string;
  /** Action type */
  actionType: string;
  /** Organization ID */
  orgId?: string;
  /** Region/state */
  region?: string;
  /** State code (for state-specific rules) */
  stateCode?: string;
  /** Clinician ID (if applicable) */
  clinicianId?: string;
  /** Patient data involved (anonymized) */
  involvesPHI?: boolean;
  /** Data sharing involved */
  involvesDataSharing?: boolean;
  /** Cross-border involved */
  crossBorder?: boolean;
  /** Action metadata */
  metadata?: Record<string, unknown>;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Compliance checker configuration
 */
export interface ComplianceCheckerConfig {
  /** Enable strict mode (block on warnings) */
  strictMode: boolean;
  /** Frameworks to check */
  enabledFrameworks: RegulatoryFramework[];
  /** State-specific rules mapping */
  stateRules?: Record<string, string[]>;
}

/**
 * Default compliance checker configuration
 */
const DEFAULT_CONFIG: ComplianceCheckerConfig = {
  strictMode: false,
  enabledFrameworks: [
    RegulatoryFramework.CMS,
    RegulatoryFramework.STATE_LICENSING,
    RegulatoryFramework.HIPAA,
    RegulatoryFramework.TEFCA,
    RegulatoryFramework.PRIVILEGE_COMPACT,
  ],
};

/**
 * RegulatoryComplianceChecker
 *
 * Validates autonomous actions for regulatory compliance.
 */
export class RegulatoryComplianceChecker {
  private config: ComplianceCheckerConfig;

  constructor(config?: Partial<ComplianceCheckerConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Check if an autonomous action is compliant
   */
  async checkCompliance(
    context: AutonomousActionContext
  ): Promise<ComplianceCheckResult> {
    logger.info('Checking compliance for autonomous action', {
      actionId: context.actionId,
      actionType: context.actionType,
    });

    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];

    // Check each enabled framework
    for (const framework of this.config.enabledFrameworks) {
      const result = await this.checkFramework(context, framework);
      violations.push(...result.violations);
      warnings.push(...result.warnings);
    }

    const compliant = violations.length === 0;

    const checkResult: ComplianceCheckResult = {
      compliant,
      failedFramework: violations.length > 0 ? violations[0].framework : undefined,
      violations,
      warnings,
      checkedAt: new Date(),
    };

    // Log exceptions (non-compliant actions)
    if (!compliant) {
      await this.logComplianceException(context, checkResult);
    }

    return checkResult;
  }

  /**
   * Check compliance for a specific framework
   */
  private async checkFramework(
    context: AutonomousActionContext,
    framework: RegulatoryFramework
  ): Promise<{
    violations: ComplianceViolation[];
    warnings: ComplianceWarning[];
  }> {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];

    switch (framework) {
      case RegulatoryFramework.CMS:
        const cmsResult = await this.checkCMS(context);
        violations.push(...cmsResult.violations);
        warnings.push(...cmsResult.warnings);
        break;

      case RegulatoryFramework.STATE_LICENSING:
        const stateResult = await this.checkStateLicensing(context);
        violations.push(...stateResult.violations);
        warnings.push(...stateResult.warnings);
        break;

      case RegulatoryFramework.HIPAA:
        const hipaaResult = await this.checkHIPAA(context);
        violations.push(...hipaaResult.violations);
        warnings.push(...hipaaResult.warnings);
        break;

      case RegulatoryFramework.TEFCA:
        const tefcaResult = await this.checkTEFCA(context);
        violations.push(...tefcaResult.violations);
        warnings.push(...tefcaResult.warnings);
        break;

      case RegulatoryFramework.PRIVILEGE_COMPACT:
        const compactResult = await this.checkPrivilegeCompact(context);
        violations.push(...compactResult.violations);
        warnings.push(...compactResult.warnings);
        break;
    }

    return { violations, warnings };
  }

  /**
   * Check CMS compliance
   */
  private async checkCMS(
    context: AutonomousActionContext
  ): Promise<{
    violations: ComplianceViolation[];
    warnings: ComplianceWarning[];
  }> {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];

    // CMS rules typically involve:
    // - Medicare/Medicaid eligibility
    // - Provider enrollment requirements
    // - Quality reporting requirements

    // Example: Check if action involves CMS-covered services
    if (context.actionType.includes('medicare') || context.actionType.includes('medicaid')) {
      // Verify provider is enrolled in CMS
      if (context.clinicianId) {
        const isEnrolled = await this.checkCMSEnrollment(context.clinicianId);
        if (!isEnrolled) {
          violations.push({
            framework: RegulatoryFramework.CMS,
            rule: 'CMS_PROVIDER_ENROLLMENT',
            description: 'Action involves CMS-covered services but provider is not enrolled',
            severity: 'high',
            remediation: [
              'Verify provider CMS enrollment status',
              'Complete CMS enrollment before proceeding',
            ],
          });
        }
      }
    }

    return { violations, warnings };
  }

  /**
   * Check state licensing compliance
   */
  private async checkStateLicensing(
    context: AutonomousActionContext
  ): Promise<{
    violations: ComplianceViolation[];
    warnings: ComplianceWarning[];
  }> {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];

    if (!context.stateCode) {
      warnings.push({
        framework: RegulatoryFramework.STATE_LICENSING,
        message: 'State code not provided, cannot verify state licensing requirements',
        recommendation: 'Provide state code for state-specific compliance checking',
      });
      return { violations, warnings };
    }

    // Check if clinician has valid state license
    if (context.clinicianId && context.stateCode) {
      const hasLicense = await this.checkStateLicense(context.clinicianId, context.stateCode);
      if (!hasLicense) {
        violations.push({
          framework: RegulatoryFramework.STATE_LICENSING,
          rule: 'STATE_LICENSE_REQUIRED',
          description: `Clinician does not have valid license in state ${context.stateCode}`,
          severity: 'critical',
          remediation: [
            `Verify license status in ${context.stateCode}`,
            'Ensure license is active and in good standing',
            'Check for any restrictions or limitations',
          ],
        });
      }
    }

    // Check state-specific rules
    const stateRules = this.config.stateRules?.[context.stateCode];
    if (stateRules) {
      for (const rule of stateRules) {
        const compliant = await this.checkStateRule(context, rule);
        if (!compliant) {
          violations.push({
            framework: RegulatoryFramework.STATE_LICENSING,
            rule: `STATE_RULE_${rule}`,
            description: `Violates state-specific rule: ${rule}`,
            severity: 'medium',
          });
        }
      }
    }

    return { violations, warnings };
  }

  /**
   * Check HIPAA compliance
   */
  private async checkHIPAA(
    context: AutonomousActionContext
  ): Promise<{
    violations: ComplianceViolation[];
    warnings: ComplianceWarning[];
  }> {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];

    // HIPAA rules:
    // - PHI access must be authorized
    // - Minimum necessary rule
    // - Audit logging required
    // - Business Associate Agreements (BAAs)

    if (context.involvesPHI) {
      // Check if PHI access is authorized
      const isAuthorized = await this.checkPHIAuthorization(context);
      if (!isAuthorized) {
        violations.push({
          framework: RegulatoryFramework.HIPAA,
          rule: 'HIPAA_PHI_AUTHORIZATION',
          description: 'Action involves PHI but authorization not verified',
          severity: 'critical',
          remediation: [
            'Verify patient authorization for PHI access',
            'Ensure minimum necessary rule is followed',
            'Document PHI access in audit log',
          ],
        });
      }

      // Check if audit logging is enabled
      const hasAuditLog = await this.checkAuditLogging(context);
      if (!hasAuditLog) {
        violations.push({
          framework: RegulatoryFramework.HIPAA,
          rule: 'HIPAA_AUDIT_LOGGING',
          description: 'PHI access requires audit logging',
          severity: 'high',
          remediation: ['Enable audit logging for PHI access'],
        });
      }
    }

    // Check BAA requirements for data sharing
    if (context.involvesDataSharing) {
      const hasBAA = await this.checkBAA(context);
      if (!hasBAA) {
        violations.push({
          framework: RegulatoryFramework.HIPAA,
          rule: 'HIPAA_BAA_REQUIRED',
          description: 'Data sharing requires Business Associate Agreement',
          severity: 'high',
          remediation: [
            'Verify BAA is in place with data recipient',
            'Ensure BAA covers the type of data sharing',
          ],
        });
      }
    }

    return { violations, warnings };
  }

  /**
   * Check TEFCA compliance
   */
  private async checkTEFCA(
    context: AutonomousActionContext
  ): Promise<{
    violations: ComplianceViolation[];
    warnings: ComplianceWarning[];
  }> {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];

    // TEFCA (Trusted Exchange Framework and Common Agreement) rules:
    // - Health information exchange requirements
    // - Patient consent management
    // - Interoperability standards

    if (context.involvesDataSharing) {
      // Check if organization is TEFCA-compliant
      const isTEFCACompliant = await this.checkTEFCACompliance(context.orgId);
      if (!isTEFCACompliant) {
        warnings.push({
          framework: RegulatoryFramework.TEFCA,
          message: 'Organization may not be TEFCA-compliant for health information exchange',
          recommendation: 'Verify TEFCA compliance status before data sharing',
        });
      }

      // Check patient consent
      const hasConsent = await this.checkPatientConsent(context);
      if (!hasConsent) {
        violations.push({
          framework: RegulatoryFramework.TEFCA,
          rule: 'TEFCA_PATIENT_CONSENT',
          description: 'TEFCA requires patient consent for health information exchange',
          severity: 'high',
          remediation: [
            'Obtain patient consent for data sharing',
            'Verify consent is current and valid',
            'Document consent in audit trail',
          ],
        });
      }
    }

    return { violations, warnings };
  }

  /**
   * Check privilege compact compliance
   */
  private async checkPrivilegeCompact(
    context: AutonomousActionContext
  ): Promise<{
    violations: ComplianceViolation[];
    warnings: ComplianceWarning[];
  }> {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];

    // Privilege compacts (e.g., IMLC, PSYPACT) allow clinicians to practice across state lines
    // Rules vary by compact type

    if (context.crossBorder && context.stateCode) {
      // Check if clinician has privilege compact authorization
      const hasCompactAuth = await this.checkPrivilegeCompactAuth(
        context.clinicianId,
        context.stateCode
      );
      if (!hasCompactAuth) {
        violations.push({
          framework: RegulatoryFramework.PRIVILEGE_COMPACT,
          rule: 'PRIVILEGE_COMPACT_AUTHORIZATION',
          description: `Cross-border action requires privilege compact authorization for ${context.stateCode}`,
          severity: 'high',
          remediation: [
            'Verify privilege compact enrollment',
            'Check if compact covers target state',
            'Ensure compact is active and in good standing',
          ],
        });
      }
    }

    return { violations, warnings };
  }

  /**
   * Helper methods (stubs - would be implemented with actual data sources)
   */

  private async checkCMSEnrollment(clinicianId: string): Promise<boolean> {
    // In production, would query CMS enrollment database
    logger.debug('Checking CMS enrollment', { clinicianId });
    return true; // Placeholder
  }

  private async checkStateLicense(clinicianId: string, stateCode: string): Promise<boolean> {
    // In production, would query state licensing board database
    logger.debug('Checking state license', { clinicianId, stateCode });
    return true; // Placeholder
  }

  private async checkStateRule(
    context: AutonomousActionContext,
    rule: string
  ): Promise<boolean> {
    // In production, would evaluate state-specific rule
    logger.debug('Checking state rule', { rule, actionId: context.actionId });
    return true; // Placeholder
  }

  private async checkPHIAuthorization(context: AutonomousActionContext): Promise<boolean> {
    // In production, would check authorization records
    logger.debug('Checking PHI authorization', { actionId: context.actionId });
    return true; // Placeholder
  }

  private async checkAuditLogging(context: AutonomousActionContext): Promise<boolean> {
    // In production, would check if audit logging is enabled
    logger.debug('Checking audit logging', { actionId: context.actionId });
    return true; // Placeholder
  }

  private async checkBAA(context: AutonomousActionContext): Promise<boolean> {
    // In production, would check BAA database
    logger.debug('Checking BAA', { actionId: context.actionId });
    return true; // Placeholder
  }

  private async checkTEFCACompliance(orgId?: string): Promise<boolean> {
    // In production, would check TEFCA compliance status
    logger.debug('Checking TEFCA compliance', { orgId });
    return true; // Placeholder
  }

  private async checkPatientConsent(context: AutonomousActionContext): Promise<boolean> {
    // In production, would check consent records
    logger.debug('Checking patient consent', { actionId: context.actionId });
    return true; // Placeholder
  }

  private async checkPrivilegeCompactAuth(
    clinicianId?: string,
    stateCode?: string
  ): Promise<boolean> {
    // In production, would check privilege compact enrollment
    logger.debug('Checking privilege compact auth', { clinicianId, stateCode });
    return true; // Placeholder
  }

  /**
   * Log compliance exception
   */
  private async logComplianceException(
    context: AutonomousActionContext,
    result: ComplianceCheckResult
  ): Promise<void> {
    try {
      logger.error('Compliance violation detected', {
        actionId: context.actionId,
        actionType: context.actionType,
        failedFramework: result.failedFramework,
        violations: result.violations.map((v) => ({
          framework: v.framework,
          rule: v.rule,
          severity: v.severity,
        })),
      });

      // TODO: Integrate with EthicsAuditTrail service
      // await ethicsAuditTrail.logComplianceCheck(context, result);
    } catch (error) {
      logger.error('Error logging compliance exception', { error });
    }
  }
}

/**
 * Create a new RegulatoryComplianceChecker instance
 */
export function createRegulatoryComplianceChecker(
  config?: Partial<ComplianceCheckerConfig>
): RegulatoryComplianceChecker {
  return new RegulatoryComplianceChecker(config);
}

