/**
 * B225B-FIN-006: TaxReportGenerator
 * Generates end-of-period tax reports per org: total revenues, refunds, taxable amounts by region
 * Supports CSV and PDF export
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface TaxReportData {
  orgId: string;
  periodStart: Date;
  periodEnd: Date;
  totalRevenues: number; // in cents
  totalRefunds: number; // in cents
  taxableAmounts: Record<string, number>; // region -> amount in cents
  netRevenue: number; // totalRevenues - totalRefunds
}

export interface TaxReportOptions {
  orgId: string;
  periodStart: Date;
  periodEnd: Date;
  format: 'csv' | 'pdf';
}

export class TaxReportGenerator {
  /**
   * Generate tax report data for an organization
   */
  async generateReport(options: TaxReportOptions): Promise<TaxReportData | string> {
    const { orgId, periodStart, periodEnd } = options;

    // Aggregate revenues from RevenueRecognition
    const revenues = await prisma.revenueRecognition.findMany({
      where: {
        orgId,
        recognizedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        status: 'recognized',
      },
    });

    // Aggregate refunds from MarketplacePurchase (status: refunded)
    const refunds = await prisma.marketplacePurchase.findMany({
      where: {
        orgId,
        status: 'refunded',
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    // Calculate total revenues (convert VITA to fiat equivalent if needed)
    const totalRevenues = revenues.reduce((sum, r) => {
      // For VITA, you might need to convert to fiat equivalent
      // For now, assume all amounts are in cents
      return sum + r.amount;
    }, 0);

    // Calculate total refunds
    const totalRefunds = refunds.reduce((sum, r) => sum + r.amount, 0);

    // Group taxable amounts by region
    // Note: Region information might come from Organization metadata or separate table
    // For now, we'll use a placeholder approach
    const taxableAmounts: Record<string, number> = {};

    // Get organization metadata to determine regions
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    // For each revenue entry, determine region (this is simplified)
    // In production, you'd have a proper region mapping
    revenues.forEach((revenue) => {
      const region = this.determineRegion(orgId, revenue.metadata);
      taxableAmounts[region] = (taxableAmounts[region] || 0) + revenue.amount;
    });

    const reportData: TaxReportData = {
      orgId,
      periodStart,
      periodEnd,
      totalRevenues,
      totalRefunds,
      taxableAmounts,
      netRevenue: totalRevenues - totalRefunds,
    };

    if (options.format === 'csv') {
      return this.generateCSV(reportData);
    } else if (options.format === 'pdf') {
      return this.generatePDF(reportData);
    }

    return reportData;
  }

  /**
   * Determine region for tax purposes
   * This is a simplified implementation - in production, you'd have proper region mapping
   */
  private determineRegion(orgId: string, metadata: any): string {
    // Check metadata for region information
    if (metadata?.region) {
      return metadata.region;
    }

    // Default to 'US' if no region specified
    return 'US';
  }

  /**
   * Generate CSV format tax report
   */
  private generateCSV(data: TaxReportData): string {
    const lines: string[] = [];

    // Header
    lines.push('Tax Report');
    lines.push(`Organization ID: ${data.orgId}`);
    lines.push(`Period: ${data.periodStart.toISOString().split('T')[0]} to ${data.periodEnd.toISOString().split('T')[0]}`);
    lines.push('');

    // Summary
    lines.push('Summary');
    lines.push(`Total Revenues,${this.formatCurrency(data.totalRevenues)}`);
    lines.push(`Total Refunds,${this.formatCurrency(data.totalRefunds)}`);
    lines.push(`Net Revenue,${this.formatCurrency(data.netRevenue)}`);
    lines.push('');

    // Taxable amounts by region
    lines.push('Taxable Amounts by Region');
    lines.push('Region,Amount');
    Object.entries(data.taxableAmounts).forEach(([region, amount]) => {
      lines.push(`${region},${this.formatCurrency(amount)}`);
    });

    return lines.join('\n');
  }

  /**
   * Generate PDF format tax report
   * Note: This is a simplified implementation. In production, use a proper PDF library like pdfkit
   */
  private generatePDF(data: TaxReportData): string {
    // For now, return a base64-encoded simple text representation
    // In production, use pdfkit or similar library
    const csvContent = this.generateCSV(data);
    const buffer = Buffer.from(csvContent, 'utf-8');
    return buffer.toString('base64');
  }

  /**
   * Format currency amount (cents to dollars)
   */
  private formatCurrency(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  /**
   * Get tax report for multiple organizations (batch)
   */
  async generateBatchReports(
    orgIds: string[],
    periodStart: Date,
    periodEnd: Date,
    format: 'csv' | 'pdf' = 'csv'
  ): Promise<Map<string, TaxReportData | string>> {
    const reports = new Map<string, TaxReportData | string>();

    for (const orgId of orgIds) {
      const report = await this.generateReport({
        orgId,
        periodStart,
        periodEnd,
        format,
      });
      reports.set(orgId, report);
    }

    return reports;
  }
}

