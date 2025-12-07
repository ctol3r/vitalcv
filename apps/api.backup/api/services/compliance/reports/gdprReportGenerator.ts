/**
 * B239B-COM-015: GDPRReportGenerator
 *
 * Specific report for GDPR compliance:
 * - Details data handling
 * - Retention policies
 * - Subject rights requests processed
 * Integrates with PersonalDataVault logs.
 * Formatted for EU regulators.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { queryAuditLogs, getAuditStatistics } from '../audit/auditLogQueryService.js';

const prisma = new PrismaClient();
const log = getServiceLogger('compliance/reports/gdpr');

export interface GDPRReportOptions {
  orgId?: string;
  startDate: Date;
  endDate: Date;
  jurisdiction?: string; // Should be 'EU' for GDPR
}

export interface GDPRReport {
  generatedAt: Date;
  period: { start: Date; end: Date };
  organization: {
    orgId?: string;
    name?: string;
    jurisdiction: string;
  };
  dataHandling: {
    totalDataExports: number;
    dataAccessRequests: number;
    dataDeletionRequests: number;
    dataModificationRequests: number;
    dataPortabilityRequests: number;
  };
  retentionPolicies: Array<{
    dataType: string;
    retentionPeriod: string;
    recordsCount: number;
    compliant: boolean;
  }>;
  subjectRightsRequests: Array<{
    requestId: string;
    type: 'access' | 'deletion' | 'modification' | 'portability';
    status: 'pending' | 'completed' | 'rejected';
    requestedAt: Date;
    completedAt?: Date;
    responseTime?: number; // in days
  }>;
  dataBreaches: Array<{
    incidentId: string;
    date: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedRecords: number;
    notified: boolean;
    notificationDate?: Date;
  }>;
  complianceMetrics: {
    dataProcessingAgreements: number;
    consentRecords: number;
    optOutRecords: number;
    anonymizationEvents: number;
  };
  recommendations: string[];
}

/**
 * Generate a GDPR-specific compliance report
 */
export async function generateGDPRReport(
  options: GDPRReportOptions
): Promise<GDPRReport> {
  try {
    const { startDate, endDate, orgId, jurisdiction = 'EU' } = options;

    // Get GDPR-related audit events
    const gdprLogs = await queryAuditLogs(
      {
        obligationId: 'GDPR',
        jurisdiction,
        startDate,
        endDate,
      },
      { orgId, requireAccessRights: !!orgId }
    );

    // Analyze data handling activities
    const dataHandling = analyzeDataHandling(gdprLogs.data);

    // Get retention policy compliance
    const retentionPolicies = await analyzeRetentionPolicies(orgId);

    // Get subject rights requests
    const subjectRightsRequests = await getSubjectRightsRequests(
      startDate,
      endDate,
      orgId
    );

    // Get data breach incidents
    const dataBreaches = await getDataBreaches(startDate, endDate, orgId);

    // Get compliance metrics
    const complianceMetrics = await getGDPRComplianceMetrics(
      startDate,
      endDate,
      orgId
    );

    // Generate recommendations
    const recommendations = generateGDPRRecommendations(
      dataHandling,
      retentionPolicies,
      subjectRightsRequests,
      dataBreaches
    );

    // Get org info if available
    let orgName: string | undefined;
    if (orgId) {
      const org = await prisma.org.findUnique({
        where: { id: orgId },
        select: { name: true },
      });
      orgName = org?.name;
    }

    const report: GDPRReport = {
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      organization: {
        orgId,
        name: orgName,
        jurisdiction,
      },
      dataHandling,
      retentionPolicies,
      subjectRightsRequests,
      dataBreaches,
      complianceMetrics,
      recommendations,
    };

    log.info('[generateGDPRReport] GDPR report generated', {
      orgId,
      period: { start: startDate, end: endDate },
      totalEvents: gdprLogs.total,
    });

    return report;
  } catch (error) {
    log.error('[generateGDPRReport] Failed to generate GDPR report', { error, options });
    throw error;
  }
}

function analyzeDataHandling(
  events: Array<{ action: string; entityType: string; details: unknown }>
): GDPRReport['dataHandling'] {
  const dataHandling = {
    totalDataExports: 0,
    dataAccessRequests: 0,
    dataDeletionRequests: 0,
    dataModificationRequests: 0,
    dataPortabilityRequests: 0,
  };

  for (const event of events) {
    if (event.entityType === 'data_export' && event.action === 'export') {
      dataHandling.totalDataExports++;
    }

    const details = event.details as Record<string, unknown> | null;
    if (details?.requestType === 'access') {
      dataHandling.dataAccessRequests++;
    } else if (details?.requestType === 'deletion') {
      dataHandling.dataDeletionRequests++;
    } else if (details?.requestType === 'modification') {
      dataHandling.dataModificationRequests++;
    } else if (details?.requestType === 'portability') {
      dataHandling.dataPortabilityRequests++;
    }
  }

  return dataHandling;
}

async function analyzeRetentionPolicies(
  orgId?: string
): Promise<GDPRReport['retentionPolicies']> {
  // In a real implementation, this would query retention policy configurations
  // and check compliance against actual data retention
  // For now, return a placeholder structure
  return [
    {
      dataType: 'user_data',
      retentionPeriod: '7 years',
      recordsCount: 0, // Would be calculated from actual data
      compliant: true,
    },
    {
      dataType: 'audit_logs',
      retentionPeriod: '10 years',
      recordsCount: 0,
      compliant: true,
    },
  ];
}

async function getSubjectRightsRequests(
  startDate: Date,
  endDate: Date,
  orgId?: string
): Promise<GDPRReport['subjectRightsRequests']> {
  // Query audit logs for subject rights requests
  const logs = await queryAuditLogs(
    {
      obligationId: 'GDPR',
      action: 'access', // Subject rights requests typically show as access actions
      startDate,
      endDate,
    },
    { orgId, requireAccessRights: !!orgId }
  );

  return logs.data
    .filter((event) => {
      const details = event.details as Record<string, unknown> | null;
      return details?.requestType && ['access', 'deletion', 'modification', 'portability'].includes(details.requestType as string);
    })
    .map((event) => {
      const details = event.details as Record<string, unknown> | null;
      const requestType = details?.requestType as string;
      const completedAt = details?.completedAt
        ? new Date(details.completedAt as string)
        : undefined;
      const responseTime = completedAt
        ? Math.ceil((completedAt.getTime() - event.timestamp.getTime()) / (1000 * 60 * 60 * 24))
        : undefined;

      return {
        requestId: event.id,
        type: requestType as 'access' | 'deletion' | 'modification' | 'portability',
        status: completedAt ? 'completed' : 'pending' as 'pending' | 'completed' | 'rejected',
        requestedAt: event.timestamp,
        completedAt,
        responseTime,
      };
    });
}

async function getDataBreaches(
  startDate: Date,
  endDate: Date,
  orgId?: string
): Promise<GDPRReport['dataBreaches']> {
  // Query for breach-related events
  const logs = await queryAuditLogs(
    {
      obligationId: 'GDPR',
      startDate,
      endDate,
    },
    { orgId, requireAccessRights: !!orgId }
  );

  return logs.data
    .filter((event) => {
      const details = event.details as Record<string, unknown> | null;
      return details?.incidentType === 'breach' || details?.breach === true;
    })
    .map((event) => {
      const details = event.details as Record<string, unknown> | null;
      return {
        incidentId: event.id,
        date: event.timestamp,
        severity: (details?.severity as string) || 'medium' as 'low' | 'medium' | 'high' | 'critical',
        affectedRecords: (details?.affectedRecords as number) || 0,
        notified: (details?.notified as boolean) || false,
        notificationDate: details?.notificationDate
          ? new Date(details.notificationDate as string)
          : undefined,
      };
    });
}

async function getGDPRComplianceMetrics(
  startDate: Date,
  endDate: Date,
  orgId?: string
): Promise<GDPRReport['complianceMetrics']> {
  const logs = await queryAuditLogs(
    {
      obligationId: 'GDPR',
      startDate,
      endDate,
    },
    { orgId, requireAccessRights: !!orgId }
  );

  let dataProcessingAgreements = 0;
  let consentRecords = 0;
  let optOutRecords = 0;
  let anonymizationEvents = 0;

  for (const event of logs.data) {
    const details = event.details as Record<string, unknown> | null;
    if (details?.agreementType === 'data_processing') {
      dataProcessingAgreements++;
    }
    if (details?.consent === true) {
      consentRecords++;
    }
    if (details?.optOut === true) {
      optOutRecords++;
    }
    if (details?.anonymization === true) {
      anonymizationEvents++;
    }
  }

  return {
    dataProcessingAgreements,
    consentRecords,
    optOutRecords,
    anonymizationEvents,
  };
}

function generateGDPRRecommendations(
  dataHandling: GDPRReport['dataHandling'],
  retentionPolicies: GDPRReport['retentionPolicies'],
  subjectRightsRequests: GDPRReport['subjectRightsRequests'],
  dataBreaches: GDPRReport['dataBreaches']
): string[] {
  const recommendations: string[] = [];

  // Check response times for subject rights requests (GDPR requires response within 30 days)
  const slowRequests = subjectRightsRequests.filter(
    (req) => req.responseTime && req.responseTime > 30
  );
  if (slowRequests.length > 0) {
    recommendations.push(
      `Improve response time for ${slowRequests.length} subject rights request(s) - GDPR requires response within 30 days`
    );
  }

  // Check for pending requests
  const pendingRequests = subjectRightsRequests.filter((req) => req.status === 'pending');
  if (pendingRequests.length > 0) {
    recommendations.push(
      `Process ${pendingRequests.length} pending subject rights request(s)`
    );
  }

  // Check data breach notifications
  const unnotifiedBreaches = dataBreaches.filter((b) => !b.notified);
  if (unnotifiedBreaches.length > 0) {
    recommendations.push(
      `Notify authorities about ${unnotifiedBreaches.length} data breach(es) - GDPR requires notification within 72 hours`
    );
  }

  // Check retention policy compliance
  const nonCompliantPolicies = retentionPolicies.filter((p) => !p.compliant);
  if (nonCompliantPolicies.length > 0) {
    recommendations.push(
      `Review retention policies for: ${nonCompliantPolicies.map((p) => p.dataType).join(', ')}`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('GDPR compliance metrics are within acceptable ranges');
  }

  return recommendations;
}

/**
 * Export GDPR report in EU regulator format (JSON)
 */
export function exportGDPRReportToRegulatorFormat(report: GDPRReport): string {
  // Format specifically for EU regulators
  return JSON.stringify(
    {
      reportType: 'GDPR_COMPLIANCE',
      generatedAt: report.generatedAt.toISOString(),
      reportingPeriod: {
        start: report.period.start.toISOString(),
        end: report.period.end.toISOString(),
      },
      organization: report.organization,
      dataHandlingSummary: {
        totalExports: report.dataHandling.totalDataExports,
        subjectRightsRequestsProcessed: report.subjectRightsRequests.length,
      },
      dataBreaches: report.dataBreaches.map((b) => ({
        date: b.date.toISOString(),
        severity: b.severity,
        affectedRecords: b.affectedRecords,
        notified: b.notified,
        notificationDate: b.notificationDate?.toISOString(),
      })),
      complianceStatus: {
        retentionPoliciesCompliant: report.retentionPolicies.every((p) => p.compliant),
        subjectRightsRequestsProcessed: report.subjectRightsRequests.filter(
          (r) => r.status === 'completed'
        ).length,
      },
    },
    null,
    2
  );
}

