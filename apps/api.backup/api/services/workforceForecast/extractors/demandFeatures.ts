/**
 * B206A-WF-002: DemandFeatureExtractor
 *
 * Extracts historical features for demand forecasting:
 * - Seasonality (daily, weekly, monthly, yearly patterns)
 * - Day-of-week effects
 * - Month effects
 * - Holiday indicators
 * - Surge patterns
 * - Department backlog
 */

import { PrismaClient } from '@prisma/client';

export interface DemandFeatures {
  // Temporal features
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  dayOfMonth: number; // 1-31
  month: number; // 1-12
  quarter: number; // 1-4
  isWeekend: boolean;
  isHoliday: boolean;
  daysSinceHoliday: number | null;

  // Seasonal features
  seasonalityDaily: number; // Daily pattern coefficient
  seasonalityWeekly: number; // Weekly pattern coefficient
  seasonalityMonthly: number; // Monthly pattern coefficient

  // Lag features
  lag1Day: number | null; // Previous day's demand
  lag7Day: number | null; // Same day last week
  lag30Day: number | null; // Same day last month
  lag90Day: number | null; // Same day last quarter

  // Rolling statistics
  rollingMean7Day: number | null;
  rollingMean30Day: number | null;
  rollingStd7Day: number | null;
  rollingStd30Day: number | null;

  // Trend features
  trend7Day: number | null; // 7-day linear trend
  trend30Day: number | null; // 30-day linear trend

  // Surge patterns
  surgeIndicator: number; // 0-1 indicator of surge
  backlogIndicator: number | null; // Department backlog metric

  // Context features
  department: string | null;
  specialty: string | null;
  role: string | null;
}

export interface FeatureExtractionOptions {
  orgId?: string;
  department?: string;
  specialty?: string;
  role?: string;
  startDate?: Date;
  endDate?: Date;
  minHistoryDays?: number; // Minimum days of history required
}

/**
 * US Federal holidays for demand pattern detection
 */
const FEDERAL_HOLIDAYS = [
  '01-01', // New Year's Day
  '07-04', // Independence Day
  '12-25', // Christmas
  '11-11', // Veterans Day
  '12-31', // New Year's Eve (partial)
];

/**
 * Major healthcare surge periods (adjust based on local patterns)
 */
const SURGE_PERIODS = [
  { month: 11, days: [25, 26, 27, 28, 29, 30] }, // Thanksgiving week
  { month: 12, days: [24, 25, 26, 31] }, // Christmas/New Year
  { month: 1, days: [1] }, // New Year's Day
];

/**
 * Check if a date is a US federal holiday
 */
function isFederalHoliday(date: Date): boolean {
  const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return FEDERAL_HOLIDAYS.includes(monthDay);
}

/**
 * Check if date is in a surge period
 */
function isSurgePeriod(date: Date): boolean {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return SURGE_PERIODS.some(period =>
    period.month === month && period.days.includes(day)
  );
}

/**
 * Calculate days since last holiday
 */
function daysSinceHoliday(date: Date): number | null {
  // Simple implementation: check last 90 days
  let checkDate = new Date(date);
  checkDate.setDate(checkDate.getDate() - 1);

  for (let i = 0; i < 90; i++) {
    if (isFederalHoliday(checkDate)) {
      return i + 1;
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return null;
}

/**
 * Extract seasonal coefficients using Fourier analysis
 */
function extractSeasonality(
  historicalData: Array<{ date: Date; value: number }>,
  period: number
): number {
  if (historicalData.length < period * 2) {
    return 0;
  }

  // Simple seasonal coefficient: average value at this position in cycle
  const position = historicalData.length % period;
  const samePositionValues = [];

  for (let i = position; i < historicalData.length; i += period) {
    samePositionValues.push(historicalData[i].value);
  }

  if (samePositionValues.length === 0) return 0;

  const avg = samePositionValues.reduce((a, b) => a + b, 0) / samePositionValues.length;
  const overallAvg = historicalData.reduce((sum, d) => sum + d.value, 0) / historicalData.length;

  return overallAvg > 0 ? avg / overallAvg : 0;
}

export class DemandFeatureExtractor {
  constructor(private prisma: PrismaClient) {}

  /**
   * Extract features for a specific date and context
   */
  async extractFeatures(
    date: Date,
    options: FeatureExtractionOptions = {}
  ): Promise<DemandFeatures> {
    const {
      orgId,
      department,
      specialty,
      role,
      minHistoryDays = 90,
    } = options;

    // Fetch historical data
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() - 1); // Exclude the target date
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - minHistoryDays);

    const historicalData = await this.fetchHistoricalData({
      orgId,
      department,
      specialty,
      role,
      startDate,
      endDate,
    });

    // Sort by date
    historicalData.sort((a, b) => a.date.getTime() - b.date.getTime());

    const values = historicalData.map(d => d.shiftCount || d.volume || 0);

    // Temporal features
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1;
    const quarter = Math.floor((month - 1) / 3) + 1;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = isFederalHoliday(date);
    const daysSinceHolidayValue = daysSinceHoliday(date);

    // Seasonal features
    const seasonalityDaily = extractSeasonality(
      historicalData.map(d => ({ date: d.date, value: d.shiftCount || d.volume || 0 })),
      7 // Weekly pattern for daily
    );
    const seasonalityWeekly = extractSeasonality(
      historicalData.map(d => ({ date: d.date, value: d.shiftCount || d.volume || 0 })),
      4 // Monthly pattern for weekly
    );
    const seasonalityMonthly = extractSeasonality(
      historicalData.map(d => ({ date: d.date, value: d.shiftCount || d.volume || 0 })),
      12 // Yearly pattern for monthly
    );

    // Lag features
    const lag1Day = this.getLagValue(historicalData, date, 1);
    const lag7Day = this.getLagValue(historicalData, date, 7);
    const lag30Day = this.getLagValue(historicalData, date, 30);
    const lag90Day = this.getLagValue(historicalData, date, 90);

    // Rolling statistics
    const rollingMean7Day = this.getRollingMean(historicalData, 7);
    const rollingMean30Day = this.getRollingMean(historicalData, 30);
    const rollingStd7Day = this.getRollingStd(historicalData, 7);
    const rollingStd30Day = this.getRollingStd(historicalData, 30);

    // Trend features
    const trend7Day = this.getTrend(historicalData, 7);
    const trend30Day = this.getTrend(historicalData, 30);

    // Surge patterns
    const surgeIndicator = isSurgePeriod(date) ? 1.0 : 0.0;

    // Backlog indicator (from metadata if available)
    const recentData = historicalData.slice(-7);
    const backlogIndicator = this.extractBacklogIndicator(recentData);

    return {
      dayOfWeek,
      dayOfMonth,
      month,
      quarter,
      isWeekend,
      isHoliday,
      daysSinceHoliday: daysSinceHolidayValue,
      seasonalityDaily,
      seasonalityWeekly,
      seasonalityMonthly,
      lag1Day,
      lag7Day,
      lag30Day,
      lag90Day,
      rollingMean7Day,
      rollingMean30Day,
      rollingStd7Day,
      rollingStd30Day,
      trend7Day,
      trend30Day,
      surgeIndicator,
      backlogIndicator,
      department: department || null,
      specialty: specialty || null,
      role: role || null,
    };
  }

  /**
   * Fetch historical demand data
   */
  private async fetchHistoricalData(options: {
    orgId?: string;
    department?: string;
    specialty?: string;
    role?: string;
    startDate: Date;
    endDate: Date;
  }): Promise<Array<{ date: Date; shiftCount: number; volume: number; acuityLevel: number | null; metadata: any }>> {
    const where: any = {
      date: {
        gte: options.startDate,
        lte: options.endDate,
      },
    };

    if (options.orgId) where.orgId = options.orgId;
    if (options.department) where.department = options.department;
    if (options.specialty) where.specialty = options.specialty;
    if (options.role) where.role = options.role;

    const records = await this.prisma.demandTimeSeries.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    return records.map(r => ({
      date: r.date,
      shiftCount: r.shiftCount,
      volume: r.volume,
      acuityLevel: r.acuityLevel,
      metadata: r.metadata,
    }));
  }

  /**
   * Get lagged value (n days ago)
   */
  private getLagValue(
    historicalData: Array<{ date: Date; shiftCount: number; volume: number }>,
    targetDate: Date,
    daysAgo: number
  ): number | null {
    const target = new Date(targetDate);
    target.setDate(target.getDate() - daysAgo);

    // Find closest date
    const closest = historicalData.find(d => {
      const diff = Math.abs(d.date.getTime() - target.getTime());
      return diff < 24 * 60 * 60 * 1000; // Within 1 day
    });

    if (!closest) return null;
    return closest.shiftCount || closest.volume || null;
  }

  /**
   * Calculate rolling mean
   */
  private getRollingMean(
    historicalData: Array<{ shiftCount: number; volume: number }>,
    window: number
  ): number | null {
    if (historicalData.length < window) return null;

    const recent = historicalData.slice(-window);
    const values = recent.map(d => d.shiftCount || d.volume || 0);
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  /**
   * Calculate rolling standard deviation
   */
  private getRollingStd(
    historicalData: Array<{ shiftCount: number; volume: number }>,
    window: number
  ): number | null {
    if (historicalData.length < window) return null;

    const recent = historicalData.slice(-window);
    const values = recent.map(d => d.shiftCount || d.volume || 0);
    const mean = this.getRollingMean(historicalData, window);
    if (mean === null) return null;

    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate linear trend
   */
  private getTrend(
    historicalData: Array<{ date: Date; shiftCount: number; volume: number }>,
    window: number
  ): number | null {
    if (historicalData.length < window) return null;

    const recent = historicalData.slice(-window);
    if (recent.length < 2) return null;

    // Simple linear regression slope
    const n = recent.length;
    const x = recent.map((_, i) => i);
    const y = recent.map(d => d.shiftCount || d.volume || 0);

    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (x[i] - xMean) * (y[i] - yMean);
      denominator += Math.pow(x[i] - xMean, 2);
    }

    return denominator !== 0 ? numerator / denominator : 0;
  }

  /**
   * Extract backlog indicator from metadata
   */
  private extractBacklogIndicator(
    recentData: Array<{ metadata: any }>
  ): number | null {
    const backlogValues = recentData
      .map(d => {
        if (d.metadata && typeof d.metadata === 'object') {
          const backlog = (d.metadata as any).backlog;
          return typeof backlog === 'number' ? backlog : null;
        }
        return null;
      })
      .filter(v => v !== null) as number[];

    if (backlogValues.length === 0) return null;

    // Return average backlog
    return backlogValues.reduce((a, b) => a + b, 0) / backlogValues.length;
  }
}

