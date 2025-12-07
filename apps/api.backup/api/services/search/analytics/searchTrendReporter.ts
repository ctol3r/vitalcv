/**
 * B232B-SEARCH-009: SearchTrendReporter
 *
 * Generates reports on trending queries and topics for admin and marketing teams.
 * Supports filters by region, time, entity type.
 * Produces charts and CSV export.
 */

import { PrismaClient } from '@prisma/client';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();

export interface TrendReportFilters {
  region?: string;
  startDate?: Date;
  endDate?: Date;
  entityType?: 'provider' | 'credential' | 'module' | 'contract' | 'job';
  minCount?: number; // Minimum query count to include
}

export interface TrendDataPoint {
  query: string;
  count: number;
  growth: number; // Percentage growth
  clickRate: number;
  conversionRate: number;
  entityType?: string;
  region?: string;
  timestamp: Date;
}

export interface TrendReport {
  title: string;
  period: {
    start: Date;
    end: Date;
  };
  filters: TrendReportFilters;
  summary: {
    totalQueries: number;
    uniqueQueries: number;
    averageClickRate: number;
    averageConversionRate: number;
  };
  trendingQueries: TrendDataPoint[];
  topQueries: TrendDataPoint[];
  charts: {
    timeSeries?: Array<{ date: string; count: number }>;
    byEntityType?: Array<{ entityType: string; count: number }>;
    byRegion?: Array<{ region: string; count: number }>;
  };
}

/**
 * SearchTrendReporter - Generates trend reports for search analytics
 */
export class SearchTrendReporter {
  /**
   * Generate a trend report
   */
  async generateReport(filters: TrendReportFilters = {}): Promise<TrendReport> {
    const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const endDate = filters.endDate || new Date();
    const minCount = filters.minCount || 1;

    // Build query conditions
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    conditions.push(`timestamp >= $${paramIndex++}`);
    params.push(startDate);

    conditions.push(`timestamp <= $${paramIndex++}`);
    params.push(endDate);

    if (filters.region) {
      conditions.push(`region = $${paramIndex++}`);
      params.push(filters.region);
    }

    if (filters.entityType) {
      conditions.push(`"entityType" = $${paramIndex++}`);
      params.push(filters.entityType);
    }

    const whereClause = conditions.join(' AND ');

    // Get trending queries (comparing current period vs previous period)
    const previousStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));

    const currentQueries = await prisma.$queryRawUnsafe<Array<{
      query: string;
      count: bigint;
      "entityType": string | null;
      region: string | null;
    }>>(`
      SELECT
        query,
        COUNT(*)::bigint as count,
        "entityType",
        region
      FROM "SearchQuery"
      WHERE ${whereClause}
      GROUP BY query, "entityType", region
      HAVING COUNT(*) >= ${minCount}
      ORDER BY count DESC
    `, ...params);

    const previousQueries = await prisma.$queryRawUnsafe<Array<{
      query: string;
      count: bigint;
    }>>(`
      SELECT
        query,
        COUNT(*)::bigint as count
      FROM "SearchQuery"
      WHERE timestamp >= $1 AND timestamp < $2
        ${filters.region ? `AND region = $3` : ''}
        ${filters.entityType ? `AND "entityType" = $${filters.region ? '4' : '3'}` : ''}
      GROUP BY query
    `, previousStartDate, startDate, ...(filters.region ? [filters.region] : []), ...(filters.entityType ? [filters.entityType] : []));

    const previousMap = new Map(previousQueries.map((q) => [q.query, Number(q.count)]));

    // Get click and conversion rates for each query
    const queriesWithMetrics = await Promise.all(
      currentQueries.map(async (q) => {
        const query = q.query;
        const count = Number(q.count);

        // Get click rate
        const clicks = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
          SELECT COUNT(DISTINCT sct.id)::bigint as count
          FROM "SearchClickThrough" sct
          JOIN "SearchQuery" sq ON sct."queryId" = sq.id
          WHERE sq.query = $1 AND sq.timestamp >= $2 AND sq.timestamp <= $3
        `, query, startDate, endDate);

        // Get conversion rate
        const conversions = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
          SELECT COUNT(DISTINCT sc.id)::bigint as count
          FROM "SearchConversion" sc
          JOIN "SearchQuery" sq ON sc."queryId" = sq.id
          WHERE sq.query = $1 AND sq.timestamp >= $2 AND sq.timestamp <= $3
        `, query, startDate, endDate);

        const clickCount = Number(clicks[0]?.count || 0);
        const conversionCount = Number(conversions[0]?.count || 0);

        const previousCount = previousMap.get(query) || 0;
        const growth = previousCount > 0 ? ((count - previousCount) / previousCount) * 100 : 100;

        return {
          query,
          count,
          growth,
          clickRate: count > 0 ? clickCount / count : 0,
          conversionRate: count > 0 ? conversionCount / count : 0,
          entityType: q.entityType || undefined,
          region: q.region || undefined,
          timestamp: endDate,
        };
      })
    );

    // Sort by growth for trending queries
    const trendingQueries = queriesWithMetrics
      .filter((q) => q.growth > 0)
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 20);

    // Sort by count for top queries
    const topQueries = queriesWithMetrics
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Calculate summary statistics
    const totalQueries = queriesWithMetrics.reduce((sum, q) => sum + q.count, 0);
    const uniqueQueries = queriesWithMetrics.length;
    const averageClickRate =
      queriesWithMetrics.length > 0
        ? queriesWithMetrics.reduce((sum, q) => sum + q.clickRate, 0) / queriesWithMetrics.length
        : 0;
    const averageConversionRate =
      queriesWithMetrics.length > 0
        ? queriesWithMetrics.reduce((sum, q) => sum + q.conversionRate, 0) / queriesWithMetrics.length
        : 0;

    // Generate time series data
    const timeSeries = await this.generateTimeSeries(startDate, endDate, filters);

    // Generate data by entity type
    const byEntityType = await this.generateByEntityType(startDate, endDate, filters);

    // Generate data by region
    const byRegion = await this.generateByRegion(startDate, endDate, filters);

    return {
      title: `Search Trend Report - ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      period: {
        start: startDate,
        end: endDate,
      },
      filters,
      summary: {
        totalQueries,
        uniqueQueries,
        averageClickRate,
        averageConversionRate,
      },
      trendingQueries,
      topQueries,
      charts: {
        timeSeries,
        byEntityType,
        byRegion,
      },
    };
  }

  /**
   * Generate time series data for charts
   */
  private async generateTimeSeries(
    startDate: Date,
    endDate: Date,
    filters: TrendReportFilters
  ): Promise<Array<{ date: string; count: number }>> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    conditions.push(`timestamp >= $${paramIndex++}`);
    params.push(startDate);

    conditions.push(`timestamp <= $${paramIndex++}`);
    params.push(endDate);

    if (filters.region) {
      conditions.push(`region = $${paramIndex++}`);
      params.push(filters.region);
    }

    if (filters.entityType) {
      conditions.push(`"entityType" = $${paramIndex++}`);
      params.push(filters.entityType);
    }

    const whereClause = conditions.join(' AND ');

    const timeSeriesData = await prisma.$queryRawUnsafe<Array<{
      date: string;
      count: bigint;
    }>>(`
      SELECT
        DATE(timestamp)::text as date,
        COUNT(*)::bigint as count
      FROM "SearchQuery"
      WHERE ${whereClause}
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `, ...params);

    return timeSeriesData.map((row) => ({
      date: row.date,
      count: Number(row.count),
    }));
  }

  /**
   * Generate data grouped by entity type
   */
  private async generateByEntityType(
    startDate: Date,
    endDate: Date,
    filters: TrendReportFilters
  ): Promise<Array<{ entityType: string; count: number }>> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    conditions.push(`timestamp >= $${paramIndex++}`);
    params.push(startDate);

    conditions.push(`timestamp <= $${paramIndex++}`);
    params.push(endDate);

    if (filters.region) {
      conditions.push(`region = $${paramIndex++}`);
      params.push(filters.region);
    }

    const whereClause = conditions.join(' AND ');

    const entityTypeData = await prisma.$queryRawUnsafe<Array<{
      entityType: string | null;
      count: bigint;
    }>>(`
      SELECT
        COALESCE("entityType", 'unknown') as "entityType",
        COUNT(*)::bigint as count
      FROM "SearchQuery"
      WHERE ${whereClause}
      GROUP BY "entityType"
      ORDER BY count DESC
    `, ...params);

    return entityTypeData.map((row) => ({
      entityType: row.entityType || 'unknown',
      count: Number(row.count),
    }));
  }

  /**
   * Generate data grouped by region
   */
  private async generateByRegion(
    startDate: Date,
    endDate: Date,
    filters: TrendReportFilters
  ): Promise<Array<{ region: string; count: number }>> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    conditions.push(`timestamp >= $${paramIndex++}`);
    params.push(startDate);

    conditions.push(`timestamp <= $${paramIndex++}`);
    params.push(endDate);

    if (filters.entityType) {
      conditions.push(`"entityType" = $${paramIndex++}`);
      params.push(filters.entityType);
    }

    const whereClause = conditions.join(' AND ');

    const regionData = await prisma.$queryRawUnsafe<Array<{
      region: string | null;
      count: bigint;
    }>>(`
      SELECT
        COALESCE(region, 'unknown') as region,
        COUNT(*)::bigint as count
      FROM "SearchQuery"
      WHERE ${whereClause}
      GROUP BY region
      ORDER BY count DESC
    `, ...params);

    return regionData.map((row) => ({
      region: row.region || 'unknown',
      count: Number(row.count),
    }));
  }

  /**
   * Export report to CSV
   */
  async exportToCSV(report: TrendReport, filePath?: string): Promise<string> {
    const csvLines: string[] = [];

    // Header
    csvLines.push('Query,Count,Growth (%),Click Rate,Conversion Rate,Entity Type,Region');

    // Data rows
    for (const query of report.topQueries) {
      csvLines.push(
        `"${query.query}",${query.count},${query.growth.toFixed(2)},${query.clickRate.toFixed(4)},${query.conversionRate.toFixed(4)},"${query.entityType || ''}","${query.region || ''}"`
      );
    }

    const csvContent = csvLines.join('\n');
    const finalPath = filePath || join(process.cwd(), `trend-report-${Date.now()}.csv`);

    await writeFile(finalPath, csvContent, 'utf-8');

    return finalPath;
  }

  /**
   * Generate chart data in a format suitable for common charting libraries
   */
  generateChartData(report: TrendReport): {
    timeSeries: Array<{ x: string; y: number }>;
    entityType: Array<{ label: string; value: number }>;
    region: Array<{ label: string; value: number }>;
  } {
    return {
      timeSeries: (report.charts.timeSeries || []).map((d) => ({
        x: d.date,
        y: d.count,
      })),
      entityType: (report.charts.byEntityType || []).map((d) => ({
        label: d.entityType,
        value: d.count,
      })),
      region: (report.charts.byRegion || []).map((d) => ({
        label: d.region,
        value: d.count,
      })),
    };
  }
}

// Export singleton instance
export const searchTrendReporter = new SearchTrendReporter();

