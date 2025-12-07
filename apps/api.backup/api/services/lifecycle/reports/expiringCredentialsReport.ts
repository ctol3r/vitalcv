/**
 * B238B-LIFE-016: ExpiringCredentialsReport
 *
 * Generates scheduled reports listing credentials expiring in a given time frame by org,
 * type, owner; includes renewal status; export to CSV/PDF.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger';

const log = getServiceLogger('lifecycle/reports/expiring');

/**
 * Report options
 */
export interface ExpiringCredentialsReportOptions {
  orgId?: string;
  credentialType?: string;
  ownerId?: string;
  startDate: Date;
  endDate: Date;
  includeRenewalStatus?: boolean;
  format?: 'json' | 'csv' | 'pdf';
}

/**
 * Expiring credential entry
 */
export interface ExpiringCredentialEntry {
  credentialId: string;
  credentialType: string;
  ownerId: string;
  ownerName?: string;
  orgId?: string;
  orgName?: string;
  issuedDate: Date;
  expirationDate: Date;
  daysUntilExpiration: number;
  renewalStatus?: 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  renewalRequestId?: string;
}

/**
 * Report result
 */
export interface ExpiringCredentialsReportResult {
  generatedAt: Date;
  options: ExpiringCredentialsReportOptions;
  totalCount: number;
  entries: ExpiringCredentialEntry[];
  summary: {
    byOrg: Record<string, number>;
    byType: Record<string, number>;
    byRenewalStatus: Record<string, number>;
  };
  data?: string; // CSV or PDF data if format is csv/pdf
}

/**
 * ExpiringCredentialsReportService generates reports for expiring credentials
 */
export class ExpiringCredentialsReportService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate expiring credentials report
   */
  async generateReport(options: ExpiringCredentialsReportOptions): Promise<ExpiringCredentialsReportResult> {
    const where: any = {
      expirationDate: {
        gte: options.startDate,
        lte: options.endDate,
      },
      ...(options.orgId && { orgId: options.orgId }),
      ...(options.credentialType && { credentialType: options.credentialType }),
      ...(options.ownerId && { ownerId: options.ownerId }),
    };

    // Fetch credentials (adjust based on your actual credential model)
    const credentials = await this.prisma.credential.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        ...(options.orgId && {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        }),
      },
    });

    // Build entries
    const entries: ExpiringCredentialEntry[] = await Promise.all(
      credentials.map(async (cred) => {
        const expirationDate = cred.expirationDate || new Date();
        const daysUntilExpiration = Math.ceil(
          (expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );

        let renewalStatus: ExpiringCredentialEntry['renewalStatus'] | undefined;
        let renewalRequestId: string | undefined;

        if (options.includeRenewalStatus) {
          const renewalRequest = await this.prisma.renewalRequest.findFirst({
            where: {
              credentialId: cred.id,
              status: { in: ['PENDING', 'APPROVED', 'REJECTED'] },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (renewalRequest) {
            renewalRequestId = renewalRequest.id;
            renewalStatus = renewalRequest.status as ExpiringCredentialEntry['renewalStatus'];
          } else {
            renewalStatus = 'NOT_STARTED';
          }
        }

        return {
          credentialId: cred.id,
          credentialType: cred.credentialType || 'UNKNOWN',
          ownerId: cred.ownerId,
          ownerName: (cred as any).owner?.name,
          orgId: cred.orgId || undefined,
          orgName: (cred as any).organization?.name,
          issuedDate: cred.issuedAt || cred.createdAt,
          expirationDate,
          daysUntilExpiration,
          renewalStatus,
          renewalRequestId,
        };
      })
    );

    // Generate summary
    const summary = {
      byOrg: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      byRenewalStatus: {} as Record<string, number>,
    };

    entries.forEach((entry) => {
      // Count by org
      const orgKey = entry.orgId || 'UNKNOWN';
      summary.byOrg[orgKey] = (summary.byOrg[orgKey] || 0) + 1;

      // Count by type
      summary.byType[entry.credentialType] = (summary.byType[entry.credentialType] || 0) + 1;

      // Count by renewal status
      if (entry.renewalStatus) {
        summary.byRenewalStatus[entry.renewalStatus] = (summary.byRenewalStatus[entry.renewalStatus] || 0) + 1;
      }
    });

    const result: ExpiringCredentialsReportResult = {
      generatedAt: new Date(),
      options,
      totalCount: entries.length,
      entries,
      summary,
    };

    // Generate formatted data if requested
    if (options.format === 'csv') {
      result.data = this.generateCSV(entries);
    } else if (options.format === 'pdf') {
      // PDF generation would require a library like pdfkit or puppeteer
      // For now, we'll return JSON
      log.warn('PDF generation not yet implemented, returning JSON');
    }

    log.info('Expiring credentials report generated', {
      totalCount: entries.length,
      format: options.format,
    });

    return result;
  }

  /**
   * Generate CSV format
   */
  private generateCSV(entries: ExpiringCredentialEntry[]): string {
    const headers = [
      'Credential ID',
      'Credential Type',
      'Owner ID',
      'Owner Name',
      'Organization ID',
      'Organization Name',
      'Issued Date',
      'Expiration Date',
      'Days Until Expiration',
      'Renewal Status',
      'Renewal Request ID',
    ];

    const rows = entries.map((entry) => [
      entry.credentialId,
      entry.credentialType,
      entry.ownerId,
      entry.ownerName || '',
      entry.orgId || '',
      entry.orgName || '',
      entry.issuedDate.toISOString(),
      entry.expirationDate.toISOString(),
      entry.daysUntilExpiration.toString(),
      entry.renewalStatus || '',
      entry.renewalRequestId || '',
    ]);

    const csvRows = [headers, ...rows].map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    );

    return csvRows.join('\n');
  }

  /**
   * Schedule a recurring report
   */
  async scheduleReport(
    options: Omit<ExpiringCredentialsReportOptions, 'startDate' | 'endDate'>,
    schedule: {
      frequency: 'daily' | 'weekly' | 'monthly';
      timeOfDay?: string; // HH:MM format
      dayOfWeek?: number; // 0-6 for weekly
      dayOfMonth?: number; // 1-31 for monthly
    },
    recipients: string[] // Email addresses or user IDs
  ): Promise<string> {
    // This would integrate with a job scheduler (e.g., Bull, node-cron)
    // For now, return a placeholder schedule ID
    const scheduleId = `schedule-${Date.now()}`;

    log.info('Report scheduled', {
      scheduleId,
      frequency: schedule.frequency,
      recipients,
    });

    return scheduleId;
  }
}

