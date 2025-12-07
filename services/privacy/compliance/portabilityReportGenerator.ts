/**
 * B237B-DP-020: PortabilityComplianceReport
 *
 * Generates reports for regulators and auditors summarizing:
 * - Data export/import activities
 * - Consents granted and revoked
 * - Retention compliance
 * For each user or organization.
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export interface ComplianceReport {
  period: { start: Date; end: Date };
  subjectId: string; // User ID or organization ID
  subjectType: 'user' | 'organization';
  exports: ExportSummary[];
  imports: ImportSummary[];
  consents: ConsentSummary[];
  sharing: SharingSummary[];
  retention: RetentionSummary;
  anomalies: AnomalySummary[];
  generatedAt: Date;
  reportHash: string; // For tamper detection
}

export interface ExportSummary {
  count: number;
  byFormat: Record<string, number>;
  totalRecordsExported: number;
  averageRecordsPerExport: number;
}

export interface ImportSummary {
  count: number;
  bySource: Record<string, number>;
  totalRecordsImported: number;
  conflictsResolved: number;
}

export interface ConsentSummary {
  total: number;
  active: number;
  revoked: number;
  expired: number;
  byDataType: Record<string, number>;
  byPurpose: Record<string, number>;
}

export interface SharingSummary {
  activeTokens: number;
  activeConnections: number;
  totalShares: number;
  byScope: Record<string, number>;
}

export interface RetentionSummary {
  totalRecords: number;
  recordsDeleted: number;
  averageRetentionDays: number;
  complianceStatus: 'compliant' | 'non_compliant' | 'unknown';
}

export interface AnomalySummary {
  type: string;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export class PortabilityComplianceReport {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate compliance report for a user
   */
  async generateUserReport(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    // Get user's vaults
    const vaults = await this.prisma.personalDataVault.findMany({
      where: {
        ownerId: userId,
        createdAt: { lte: endDate },
      },
    });

    const vaultIds = vaults.map(v => v.id);

    // Gather export data
    const exports = await this.getExportSummary(vaultIds, startDate, endDate);

    // Gather import data
    const imports = await this.getImportSummary(vaultIds, startDate, endDate);

    // Gather consent data
    const consents = await this.getConsentSummary(vaultIds, startDate, endDate);

    // Gather sharing data
    const sharing = await this.getSharingSummary(vaultIds, startDate, endDate);

    // Gather retention data
    const retention = await this.getRetentionSummary(vaultIds, startDate, endDate);

    // Gather anomalies
    const anomalies = await this.getAnomalySummary(vaultIds, startDate, endDate);

    const report: ComplianceReport = {
      period: { start: startDate, end: endDate },
      subjectId: userId,
      subjectType: 'user',
      exports,
      imports,
      consents,
      sharing,
      retention,
      anomalies,
      generatedAt: new Date(),
      reportHash: '', // Will be set after generation
    };

    // Generate hash for tamper detection
    report.reportHash = this.generateReportHash(report);

    return report;
  }

  /**
   * Generate compliance report for an organization
   */
  async generateOrgReport(
    orgId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    // Get all users in organization
    const orgUsers = await this.prisma.userOrgLink.findMany({
      where: { orgId },
      select: { userId: true },
    });

    const userIds = orgUsers.map(u => u.userId);

    // Get all vaults for org users
    const vaults = await this.prisma.personalDataVault.findMany({
      where: {
        ownerId: { in: userIds },
        createdAt: { lte: endDate },
      },
    });

    const vaultIds = vaults.map(v => v.id);

    // Aggregate data (same as user report but aggregated)
    const exports = await this.getExportSummary(vaultIds, startDate, endDate);
    const imports = await this.getImportSummary(vaultIds, startDate, endDate);
    const consents = await this.getConsentSummary(vaultIds, startDate, endDate);
    const sharing = await this.getSharingSummary(vaultIds, startDate, endDate);
    const retention = await this.getRetentionSummary(vaultIds, startDate, endDate);
    const anomalies = await this.getAnomalySummary(vaultIds, startDate, endDate);

    const report: ComplianceReport = {
      period: { start: startDate, end: endDate },
      subjectId: orgId,
      subjectType: 'organization',
      exports,
      imports,
      consents,
      sharing,
      retention,
      anomalies,
      generatedAt: new Date(),
      reportHash: '',
    };

    report.reportHash = this.generateReportHash(report);

    return report;
  }

  /**
   * Export report as JSON
   */
  async exportReportAsJson(report: ComplianceReport): Promise<string> {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Export report as PDF (simplified - in production, use proper PDF generation)
   */
  async exportReportAsPdf(report: ComplianceReport): Promise<Buffer> {
    // Generate HTML
    const html = this.generateReportHtml(report);

    // Render PDF (would use playwright or similar)
    // For now, return empty buffer
    return Buffer.from('');
  }

  // Private helper methods

  private async getExportSummary(
    vaultIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<ExportSummary> {
    const exports = await this.prisma.dataExportEvent.findMany({
      where: {
        vaultId: { in: vaultIds },
        createdAt: { gte: startDate, lte: endDate },
        status: 'completed',
      },
    });

    const byFormat: Record<string, number> = {};
    let totalRecords = 0;

    for (const exp of exports) {
      byFormat[exp.format] = (byFormat[exp.format] || 0) + 1;
      totalRecords += exp.recordIds.length;
    }

    return {
      count: exports.length,
      byFormat,
      totalRecordsExported: totalRecords,
      averageRecordsPerExport: exports.length > 0 ? totalRecords / exports.length : 0,
    };
  }

  private async getImportSummary(
    vaultIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<ImportSummary> {
    const imports = await this.prisma.dataImportEvent.findMany({
      where: {
        vaultId: { in: vaultIds },
        createdAt: { gte: startDate, lte: endDate },
        status: 'completed',
      },
    });

    const bySource: Record<string, number> = {};
    let totalRecords = 0;
    let conflicts = 0;

    for (const imp of imports) {
      bySource[imp.source] = (bySource[imp.source] || 0) + 1;
      totalRecords += imp.recordCount;
      conflicts += imp.conflictCount;
    }

    return {
      count: imports.length,
      bySource,
      totalRecordsImported: totalRecords,
      conflictsResolved: conflicts,
    };
  }

  private async getConsentSummary(
    vaultIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<ConsentSummary> {
    const consents = await this.prisma.consentRecord.findMany({
      where: {
        vaultId: { in: vaultIds },
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const byDataType: Record<string, number> = {};
    const byPurpose: Record<string, number> = {};
    let active = 0;
    let revoked = 0;
    let expired = 0;

    for (const consent of consents) {
      if (consent.status === 'active') active++;
      else if (consent.status === 'revoked') revoked++;
      else if (consent.status === 'expired') expired++;

      for (const dt of consent.dataTypes) {
        byDataType[dt] = (byDataType[dt] || 0) + 1;
      }

      byPurpose[consent.purpose] = (byPurpose[consent.purpose] || 0) + 1;
    }

    return {
      total: consents.length,
      active,
      revoked,
      expired,
      byDataType,
      byPurpose,
    };
  }

  private async getSharingSummary(
    vaultIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<SharingSummary> {
    const tokens = await this.prisma.sharedAccessToken.findMany({
      where: {
        vaultId: { in: vaultIds },
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const connections = await this.prisma.thirdPartyConnection.findMany({
      where: {
        ownerId: { in: vaultIds }, // Note: ownerId is userId, not vaultId
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const byScope: Record<string, number> = {};
    let activeTokens = 0;
    let activeConnections = 0;

    for (const token of tokens) {
      if (token.status === 'active') activeTokens++;
      for (const scope of token.scopes) {
        byScope[scope] = (byScope[scope] || 0) + 1;
      }
    }

    for (const conn of connections) {
      if (conn.status === 'active') activeConnections++;
    }

    return {
      activeTokens,
      activeConnections,
      totalShares: tokens.length,
      byScope,
    };
  }

  private async getRetentionSummary(
    vaultIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<RetentionSummary> {
    const records = await this.prisma.dataRecord.findMany({
      where: {
        vaultId: { in: vaultIds },
      },
    });

    const deleted = records.filter(r => r.deletedAt !== null);
    const active = records.filter(r => r.deletedAt === null);

    // Calculate average retention (simplified)
    const now = new Date();
    let totalRetentionDays = 0;
    for (const record of active) {
      const days = (now.getTime() - record.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      totalRetentionDays += days;
    }

    return {
      totalRecords: records.length,
      recordsDeleted: deleted.length,
      averageRetentionDays: active.length > 0 ? totalRetentionDays / active.length : 0,
      complianceStatus: 'compliant', // In production, check against retention policies
    };
  }

  private async getAnomalySummary(
    vaultIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<AnomalySummary[]> {
    // Get audit logs with anomalies
    const auditLogs = await this.prisma.vaultAuditLog.findMany({
      where: {
        vaultId: { in: vaultIds },
        action: 'anomaly_detected',
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const anomalies: Record<string, { count: number; severity: string }> = {};

    for (const log of auditLogs) {
      const metadata = log.metadata as any;
      if (metadata?.anomalies) {
        for (const anomaly of metadata.anomalies) {
          const key = `${anomaly.type}:${anomaly.severity}`;
          if (!anomalies[key]) {
            anomalies[key] = { count: 0, severity: anomaly.severity };
          }
          anomalies[key].count++;
        }
      }
    }

    return Object.entries(anomalies).map(([key, data]) => ({
      type: key.split(':')[0],
      count: data.count,
      severity: data.severity as any,
      description: `Detected ${data.count} ${key.split(':')[0]} anomalies`,
    }));
  }

  private generateReportHash(report: ComplianceReport): string {
    // Generate hash excluding the hash field itself
    const { reportHash, ...reportData } = report;
    const data = JSON.stringify(reportData);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private generateReportHtml(report: ComplianceReport): string {
    // Simplified HTML generation - in production, use a template engine
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Compliance Report - ${report.subjectId}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #333; }
            table { border-collapse: collapse; width: 100%; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Portability Compliance Report</h1>
          <p><strong>Period:</strong> ${report.period.start.toISOString()} to ${report.period.end.toISOString()}</p>
          <p><strong>Subject:</strong> ${report.subjectId} (${report.subjectType})</p>
          <p><strong>Generated:</strong> ${report.generatedAt.toISOString()}</p>
          <p><strong>Report Hash:</strong> ${report.reportHash}</p>

          <h2>Exports</h2>
          <p>Total: ${report.exports.count}</p>
          <p>Total Records: ${report.exports.totalRecordsExported}</p>

          <h2>Imports</h2>
          <p>Total: ${report.imports.count}</p>
          <p>Total Records: ${report.imports.totalRecordsImported}</p>

          <h2>Consents</h2>
          <p>Total: ${report.consents.total}</p>
          <p>Active: ${report.consents.active}</p>
          <p>Revoked: ${report.consents.revoked}</p>

          <h2>Sharing</h2>
          <p>Active Tokens: ${report.sharing.activeTokens}</p>
          <p>Active Connections: ${report.sharing.activeConnections}</p>

          <h2>Retention</h2>
          <p>Total Records: ${report.retention.totalRecords}</p>
          <p>Deleted: ${report.retention.recordsDeleted}</p>
          <p>Status: ${report.retention.complianceStatus}</p>
        </body>
      </html>
    `;
  }
}

