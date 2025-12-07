/**
 * B239B-COM-016: HIPAAComplianceAuditor
 *
 * Evaluates compliance with HIPAA:
 * - Checks risk analyses
 * - Access controls
 * - Audit logs
 * - Breach procedures
 * Generates detailed findings report.
 * No automatic sanctions.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { queryAuditLogs, getAuditStatistics } from '../audit/auditLogQueryService.js';

const prisma = new PrismaClient();
const log = getServiceLogger('compliance/auditors/hipaa');

export interface HIPAAAuditOptions {
  orgId?: string;
  startDate: Date;
  endDate: Date;
}

export interface HIPAAFinding {
  id: string;
  category: 'risk_analysis' | 'access_controls' | 'audit_logs' | 'breach_procedures' | 'encryption' | 'training';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  evidence: string[];
  recommendation: string;
  compliant: boolean;
}

export interface HIPAAAuditReport {
  generatedAt: Date;
  period: { start: Date; end: Date };
  orgId?: string;
  overallCompliance: 'compliant' | 'non_compliant' | 'needs_improvement';
  complianceScore: number; // 0-100
  findings: HIPAAFinding[];
  summary: {
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
    compliantAreas: number;
    nonCompliantAreas: number;
  };
  riskAnalysis: {
    performed: boolean;
    lastPerformed?: Date;
    documented: boolean;
    findings: string[];
  };
  accessControls: {
    implemented: boolean;
    documented: boolean;
    accessLogsAvailable: boolean;
    unauthorizedAccessAttempts: number;
    findings: string[];
  };
  auditLogs: {
    enabled: boolean;
    retentionPeriod: string;
    logIntegrity: boolean;
    reviewFrequency: string;
    findings: string[];
  };
  breachProcedures: {
    documented: boolean;
    tested: boolean;
    lastTestDate?: Date;
    breachIncidents: number;
    findings: string[];
  };
  encryption: {
    dataAtRest: boolean;
    dataInTransit: boolean;
    documented: boolean;
    findings: string[];
  };
  training: {
    provided: boolean;
    documented: boolean;
    lastTrainingDate?: Date;
    findings: string[];
  };
}

/**
 * Perform HIPAA compliance audit
 */
export async function performHIPAAAudit(
  options: HIPAAAuditOptions
): Promise<HIPAAAuditReport> {
  try {
    const { startDate, endDate, orgId } = options;

    // Get HIPAA-related audit events
    const hipaaLogs = await queryAuditLogs(
      {
        obligationId: 'HIPAA',
        startDate,
        endDate,
      },
      { orgId, requireAccessRights: !!orgId }
    );

    // Audit each HIPAA requirement area
    const riskAnalysis = await auditRiskAnalysis(orgId, startDate, endDate);
    const accessControls = await auditAccessControls(orgId, startDate, endDate, hipaaLogs.data);
    const auditLogs = await auditAuditLogs(orgId, startDate, endDate, hipaaLogs.data);
    const breachProcedures = await auditBreachProcedures(orgId, startDate, endDate, hipaaLogs.data);
    const encryption = await auditEncryption(orgId, startDate, endDate);
    const training = await auditTraining(orgId, startDate, endDate);

    // Compile all findings
    const findings = compileFindings([
      riskAnalysis,
      accessControls,
      auditLogs,
      breachProcedures,
      encryption,
      training,
    ]);

    // Calculate overall compliance
    const complianceScore = calculateComplianceScore(findings);
    const overallCompliance = determineOverallCompliance(complianceScore, findings);

    // Generate summary
    const summary = {
      totalFindings: findings.length,
      criticalFindings: findings.filter((f) => f.severity === 'critical').length,
      highFindings: findings.filter((f) => f.severity === 'high').length,
      mediumFindings: findings.filter((f) => f.severity === 'medium').length,
      lowFindings: findings.filter((f) => f.severity === 'low').length,
      compliantAreas: findings.filter((f) => f.compliant).length,
      nonCompliantAreas: findings.filter((f) => !f.compliant).length,
    };

    const report: HIPAAAuditReport = {
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      orgId,
      overallCompliance,
      complianceScore,
      findings,
      summary,
      riskAnalysis,
      accessControls,
      auditLogs,
      breachProcedures,
      encryption,
      training,
    };

    log.info('[performHIPAAAudit] HIPAA audit completed', {
      orgId,
      complianceScore,
      totalFindings: findings.length,
    });

    return report;
  } catch (error) {
    log.error('[performHIPAAAudit] Failed to perform HIPAA audit', { error, options });
    throw error;
  }
}

async function auditRiskAnalysis(
  orgId: string | undefined,
  startDate: Date,
  endDate: Date
): Promise<HIPAAAuditReport['riskAnalysis']> {
  // Check for risk analysis documentation in audit logs
  const logs = await queryAuditLogs(
    {
      obligationId: 'HIPAA',
      action: 'access', // Risk analyses might be logged as access events
      startDate,
      endDate,
    },
    { orgId, requireAccessRights: !!orgId }
  );

  const riskAnalysisEvents = logs.data.filter((event) => {
    const details = event.details as Record<string, unknown> | null;
    return details?.documentType === 'risk_analysis' || details?.riskAnalysis === true;
  });

  const performed = riskAnalysisEvents.length > 0;
  const lastPerformed = performed
    ? riskAnalysisEvents[0]?.timestamp
    : undefined;
  const documented = riskAnalysisEvents.some((event) => {
    const details = event.details as Record<string, unknown> | null;
    return details?.documented === true;
  });

  const findings: string[] = [];
  if (!performed) {
    findings.push('No risk analysis performed in the audit period');
  }
  if (!documented) {
    findings.push('Risk analysis not properly documented');
  }

  return {
    performed,
    lastPerformed,
    documented,
    findings,
  };
}

async function auditAccessControls(
  orgId: string | undefined,
  startDate: Date,
  endDate: Date,
  auditEvents: Array<{ action: string; details: unknown }>
): Promise<HIPAAAuditReport['accessControls']> {
  // Check for access control events
  const accessEvents = auditEvents.filter((event) => event.action === 'access');
  const unauthorizedAttempts = auditEvents.filter((event) => {
    const details = event.details as Record<string, unknown> | null;
    return details?.unauthorized === true || details?.accessDenied === true;
  });

  const implemented = accessEvents.length > 0;
  const documented = accessEvents.some((event) => {
    const details = event.details as Record<string, unknown> | null;
    return details?.accessControl === true;
  });
  const accessLogsAvailable = accessEvents.length > 0;

  const findings: string[] = [];
  if (!implemented) {
    findings.push('Access controls not properly implemented or logged');
  }
  if (unauthorizedAttempts.length > 0) {
    findings.push(
      `${unauthorizedAttempts.length} unauthorized access attempt(s) detected`
    );
  }

  return {
    implemented,
    documented,
    accessLogsAvailable,
    unauthorizedAccessAttempts: unauthorizedAttempts.length,
    findings,
  };
}

async function auditAuditLogs(
  orgId: string | undefined,
  startDate: Date,
  endDate: Date,
  auditEvents: Array<{ timestamp: Date }>
): Promise<HIPAAAuditReport['auditLogs']> {
  const enabled = auditEvents.length > 0;
  const retentionPeriod = '10 years'; // HIPAA requirement
  const logIntegrity = true; // Would check for tampering in production
  const reviewFrequency = 'monthly'; // Should be configurable

  const findings: string[] = [];
  if (!enabled) {
    findings.push('Audit logging not enabled or no events recorded');
  }

  return {
    enabled,
    retentionPeriod,
    logIntegrity,
    reviewFrequency,
    findings,
  };
}

async function auditBreachProcedures(
  orgId: string | undefined,
  startDate: Date,
  endDate: Date,
  auditEvents: Array<{ details: unknown }>
): Promise<HIPAAAuditReport['breachProcedures']> {
  const breachEvents = auditEvents.filter((event) => {
    const details = event.details as Record<string, unknown> | null;
    return details?.breach === true || details?.incidentType === 'breach';
  });

  const documented = breachEvents.some((event) => {
    const details = event.details as Record<string, unknown> | null;
    return details?.documented === true;
  });
  const tested = breachEvents.some((event) => {
    const details = event.details as Record<string, unknown> | null;
    return details?.tested === true;
  });
  const lastTestDate = breachEvents.find((event) => {
    const details = event.details as Record<string, unknown> | null;
    return details?.tested === true;
  })?.details as { testDate?: string } | null;
  const breachIncidents = breachEvents.length;

  const findings: string[] = [];
  if (!documented) {
    findings.push('Breach procedures not documented');
  }
  if (!tested) {
    findings.push('Breach procedures not tested');
  }
  if (breachIncidents > 0) {
    findings.push(`${breachIncidents} breach incident(s) in audit period`);
  }

  return {
    documented,
    tested,
    lastTestDate: lastTestDate?.testDate ? new Date(lastTestDate.testDate) : undefined,
    breachIncidents,
    findings,
  };
}

async function auditEncryption(
  orgId: string | undefined,
  startDate: Date,
  endDate: Date
): Promise<HIPAAAuditReport['encryption']> {
  // Check for encryption-related events
  const logs = await queryAuditLogs(
    {
      obligationId: 'HIPAA',
      startDate,
      endDate,
    },
    { orgId, requireAccessRights: !!orgId }
  );

  const encryptionEvents = logs.data.filter((event) => {
    const details = event.details as Record<string, unknown> | null;
    return details?.encryption === true;
  });

  const dataAtRest = encryptionEvents.some((event) => {
    const details = event.details as Record<string, unknown> | null;
    return details?.encryptionType === 'at_rest';
  });
  const dataInTransit = encryptionEvents.some((event) => {
    const details = event.details as Record<string, unknown> | null;
    return details?.encryptionType === 'in_transit';
  });
  const documented = encryptionEvents.some((event) => {
    const details = event.details as Record<string, unknown> | null;
    return details?.documented === true;
  });

  const findings: string[] = [];
  if (!dataAtRest) {
    findings.push('Data at rest encryption not implemented or documented');
  }
  if (!dataInTransit) {
    findings.push('Data in transit encryption not implemented or documented');
  }

  return {
    dataAtRest,
    dataInTransit,
    documented,
    findings,
  };
}

async function auditTraining(
  orgId: string | undefined,
  startDate: Date,
  endDate: Date
): Promise<HIPAAAuditReport['training']> {
  // Check for training-related events
  const logs = await queryAuditLogs(
    {
      obligationId: 'HIPAA',
      startDate,
      endDate,
    },
    { orgId, requireAccessRights: !!orgId }
  );

  const trainingEvents = logs.data.filter((event) => {
    const details = event.details as Record<string, unknown> | null;
    return details?.training === true || details?.eventType === 'training';
  });

  const provided = trainingEvents.length > 0;
  const documented = trainingEvents.some((event) => {
    const details = event.details as Record<string, unknown> | null;
    return details?.documented === true;
  });
  const lastTrainingDate = trainingEvents[0]?.timestamp;

  const findings: string[] = [];
  if (!provided) {
    findings.push('HIPAA training not provided or documented');
  }

  return {
    provided,
    documented,
    lastTrainingDate,
    findings,
  };
}

function compileFindings(
  areas: Array<{ findings: string[] }>
): HIPAAFinding[] {
  const findings: HIPAAFinding[] = [];
  let findingId = 1;

  for (const area of areas) {
    for (const finding of area.findings) {
      findings.push({
        id: `HIPAA-${findingId++}`,
        category: 'risk_analysis', // Would be determined from context
        severity: determineSeverity(finding),
        title: finding,
        description: finding,
        evidence: [],
        recommendation: generateRecommendation(finding),
        compliant: false,
      });
    }
  }

  return findings;
}

function determineSeverity(finding: string): HIPAAFinding['severity'] {
  const lower = finding.toLowerCase();
  if (lower.includes('critical') || lower.includes('breach')) {
    return 'critical';
  }
  if (lower.includes('unauthorized') || lower.includes('failed')) {
    return 'high';
  }
  if (lower.includes('not') || lower.includes('missing')) {
    return 'medium';
  }
  return 'low';
}

function generateRecommendation(finding: string): string {
  if (finding.includes('risk analysis')) {
    return 'Perform and document a comprehensive risk analysis';
  }
  if (finding.includes('access control')) {
    return 'Implement and document access controls';
  }
  if (finding.includes('encryption')) {
    return 'Implement encryption for data at rest and in transit';
  }
  if (finding.includes('training')) {
    return 'Provide HIPAA training to all staff and document completion';
  }
  return 'Review and address the identified issue';
}

function calculateComplianceScore(findings: HIPAAFinding[]): number {
  if (findings.length === 0) return 100;

  let score = 100;
  for (const finding of findings) {
    if (!finding.compliant) {
      const deduction = {
        critical: 20,
        high: 10,
        medium: 5,
        low: 2,
      }[finding.severity];
      score -= deduction;
    }
  }

  return Math.max(0, Math.min(100, score));
}

function determineOverallCompliance(
  score: number,
  findings: HIPAAFinding[]
): HIPAAAuditReport['overallCompliance'] {
  const criticalFindings = findings.filter((f) => f.severity === 'critical' && !f.compliant);
  if (criticalFindings.length > 0) {
    return 'non_compliant';
  }
  if (score >= 90) {
    return 'compliant';
  }
  if (score >= 70) {
    return 'needs_improvement';
  }
  return 'non_compliant';
}

