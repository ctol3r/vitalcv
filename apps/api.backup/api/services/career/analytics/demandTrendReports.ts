/**
 * B233B-CAREER-010: DemandTrendReports
 *
 * Generates region- and specialty-specific reports on credential demand trends
 * for administrators and partners;
 * exports to PDF/CSV and feeds dashboards
 */

import { PrismaClient } from '@prisma/client';
import { WorkforceDemandForecaster, DemandForecast } from './workforceDemandForecaster.js';

export interface ReportFilters {
  specialty?: string;
  region?: string;
  startDate?: Date;
  endDate?: Date;
  format?: 'json' | 'csv' | 'pdf';
}

export interface TrendReport {
  specialty: string;
  region: string;
  period: {
    start: Date;
    end: Date;
  };
  trends: {
    currentDemand: number;
    forecastedDemand: number;
    changePercent: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  topCredentials: Array<{
    credentialType: string;
    demandCount: number;
    percentage: number;
  }>;
  forecasts: DemandForecast[];
  generatedAt: Date;
}

export class DemandTrendReports {
  private demandForecaster: WorkforceDemandForecaster;

  constructor(
    private prisma: PrismaClient,
    demandForecaster?: WorkforceDemandForecaster
  ) {
    this.demandForecaster =
      demandForecaster || new WorkforceDemandForecaster(prisma);
  }

  /**
   * Generate trend report for region and specialty
   */
  async generateReport(filters: ReportFilters = {}): Promise<TrendReport> {
    const {
      specialty,
      region,
      startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
      endDate = new Date(),
    } = filters;

    // Get historical data
    const historicalData = await this.demandForecaster.aggregateMarketData(
      startDate,
      endDate,
      specialty,
      region
    );

    // Get forecasts
    const forecasts = await this.demandForecaster.predictDemand({
      specialty,
      region,
      horizonDays: [30, 90, 180],
    });

    // Calculate current demand (average of last 30 days)
    const recentData = historicalData.filter(
      (d) => d.date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    const currentDemand =
      recentData.length > 0
        ? recentData.reduce((sum, d) => sum + d.jobPostingCount, 0) /
          recentData.length
        : 0;

    // Get forecasted demand (30-day forecast)
    const forecast30Day = forecasts.find((f) => f.horizonDays === 30);
    const forecastedDemand = forecast30Day?.predictedDemand || currentDemand;

    // Calculate change
    const changePercent =
      currentDemand > 0
        ? ((forecastedDemand - currentDemand) / currentDemand) * 100
        : 0;

    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (changePercent > 10) trend = 'increasing';
    else if (changePercent < -10) trend = 'decreasing';

    // Aggregate top credentials
    const credentialCounts = new Map<string, number>();
    for (const data of historicalData) {
      for (const cred of data.requiredCredentials) {
        credentialCounts.set(cred, (credentialCounts.get(cred) || 0) + 1);
      }
    }

    const totalCredentialMentions = Array.from(credentialCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    const topCredentials = Array.from(credentialCounts.entries())
      .map(([credentialType, demandCount]) => ({
        credentialType,
        demandCount,
        percentage:
          totalCredentialMentions > 0
            ? (demandCount / totalCredentialMentions) * 100
            : 0,
      }))
      .sort((a, b) => b.demandCount - a.demandCount)
      .slice(0, 10);

    return {
      specialty: specialty || 'all',
      region: region || 'all',
      period: {
        start: startDate,
        end: endDate,
      },
      trends: {
        currentDemand: Math.round(currentDemand),
        forecastedDemand: Math.round(forecastedDemand),
        changePercent: Math.round(changePercent * 100) / 100,
        trend,
      },
      topCredentials,
      forecasts,
      generatedAt: new Date(),
    };
  }

  /**
   * Export report as CSV
   */
  async exportCSV(filters: ReportFilters = {}): Promise<string> {
    const report = await this.generateReport(filters);

    const lines: string[] = [];

    // Header
    lines.push('Specialty,Region,Period Start,Period End,Current Demand,Forecasted Demand,Change %,Trend');

    // Main data row
    lines.push(
      [
        report.specialty,
        report.region,
        report.period.start.toISOString(),
        report.period.end.toISOString(),
        report.trends.currentDemand,
        report.trends.forecastedDemand,
        report.trends.changePercent,
        report.trends.trend,
      ].join(',')
    );

    // Credentials section
    lines.push('');
    lines.push('Top Credentials');
    lines.push('Credential Type,Demand Count,Percentage');
    for (const cred of report.topCredentials) {
      lines.push(
        [
          cred.credentialType,
          cred.demandCount,
          cred.percentage.toFixed(2),
        ].join(',')
      );
    }

    // Forecasts section
    lines.push('');
    lines.push('Forecasts');
    lines.push('Horizon Days,Predicted Demand,Lower Bound,Upper Bound,Confidence,Trend');
    for (const forecast of report.forecasts) {
      lines.push(
        [
          forecast.horizonDays,
          forecast.predictedDemand,
          forecast.lowerBound,
          forecast.upperBound,
          forecast.confidenceLevel.toFixed(2),
          forecast.trend,
        ].join(',')
      );
    }

    return lines.join('\n');
  }

  /**
   * Export report as JSON
   */
  async exportJSON(filters: ReportFilters = {}): Promise<string> {
    const report = await this.generateReport(filters);
    return JSON.stringify(report, null, 2);
  }

  /**
   * Export report as PDF (stub - would use a PDF library like pdfkit or puppeteer)
   */
  async exportPDF(filters: ReportFilters = {}): Promise<Buffer> {
    const report = await this.generateReport(filters);

    // In production, use a PDF library like pdfkit, puppeteer, or jsPDF
    // For now, return a placeholder
    const pdfContent = `
DEMAND TREND REPORT
===================

Specialty: ${report.specialty}
Region: ${report.region}
Period: ${report.period.start.toISOString()} to ${report.period.end.toISOString()}

TRENDS
------
Current Demand: ${report.trends.currentDemand}
Forecasted Demand: ${report.trends.forecastedDemand}
Change: ${report.trends.changePercent}%
Trend: ${report.trends.trend}

TOP CREDENTIALS
--------------
${report.topCredentials
  .map(
    (c) =>
      `${c.credentialType}: ${c.demandCount} (${c.percentage.toFixed(2)}%)`
  )
  .join('\n')}

FORECASTS
---------
${report.forecasts
  .map(
    (f) =>
      `${f.horizonDays} days: ${f.predictedDemand} (${f.lowerBound}-${f.upperBound})`
  )
  .join('\n')}

Generated: ${report.generatedAt.toISOString()}
`;

    // Return as Buffer (in production, convert to actual PDF)
    return Buffer.from(pdfContent, 'utf-8');
  }

  /**
   * Generate dashboard data (summary format)
   */
  async generateDashboardData(
    filters: ReportFilters = {}
  ): Promise<{
    summary: {
      currentDemand: number;
      forecastedDemand: number;
      changePercent: number;
      trend: string;
    };
    topCredentials: Array<{
      credentialType: string;
      demandCount: number;
      percentage: number;
    }>;
    forecasts: Array<{
      horizonDays: number;
      predictedDemand: number;
      lowerBound: number;
      upperBound: number;
      trend: string;
    }>;
  }> {
    const report = await this.generateReport(filters);

    return {
      summary: {
        currentDemand: report.trends.currentDemand,
        forecastedDemand: report.trends.forecastedDemand,
        changePercent: report.trends.changePercent,
        trend: report.trends.trend,
      },
      topCredentials: report.topCredentials,
      forecasts: report.forecasts.map((f) => ({
        horizonDays: f.horizonDays,
        predictedDemand: f.predictedDemand,
        lowerBound: f.lowerBound,
        upperBound: f.upperBound,
        trend: f.trend,
      })),
    };
  }
}

