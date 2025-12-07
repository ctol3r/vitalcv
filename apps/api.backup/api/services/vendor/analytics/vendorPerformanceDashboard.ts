/**
 * B240B-VM-015: Vendor Performance Dashboard Service
 *
 * Calculates vendor performance indicators:
 * - Delivery times
 * - Service quality
 * - SLA adherence
 *
 * Provides aggregated stats and trends for dashboards.
 */

import { PrismaClient } from '@prisma/client';
import { getVendorPerformanceMetrics, getAggregatedMetric } from '../models/VendorPerformanceMetrics';
import { AggregationMethod } from '@prisma/client';

export interface PerformanceIndicator {
  kpiName: string;
  value: number;
  trend: 'improving' | 'declining' | 'stable';
  periodStart: Date;
  periodEnd: Date;
  previousValue?: number;
  changePercent?: number;
}

export interface VendorPerformanceSummary {
  vendorId: string;
  vendorName: string;
  indicators: PerformanceIndicator[];
  overallScore: number; // 0-100 composite score
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Calculate vendor performance indicators
 */
export async function calculateVendorPerformance(
  prisma: PrismaClient,
  vendorId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<VendorPerformanceSummary> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) {
    throw new Error(`Vendor ${vendorId} not found`);
  }

  // Calculate previous period for trend analysis
  const periodDuration = periodEnd.getTime() - periodStart.getTime();
  const previousPeriodStart = new Date(periodStart.getTime() - periodDuration);
  const previousPeriodEnd = periodStart;

  // Calculate key performance indicators
  const indicators: PerformanceIndicator[] = [];

  // 1. Delivery Time
  const deliveryTime = await calculateDeliveryTime(
    prisma,
    vendorId,
    periodStart,
    periodEnd,
    previousPeriodStart,
    previousPeriodEnd
  );
  if (deliveryTime) {
    indicators.push(deliveryTime);
  }

  // 2. Service Quality
  const serviceQuality = await calculateServiceQuality(
    prisma,
    vendorId,
    periodStart,
    periodEnd,
    previousPeriodStart,
    previousPeriodEnd
  );
  if (serviceQuality) {
    indicators.push(serviceQuality);
  }

  // 3. SLA Adherence
  const slaAdherence = await calculateSLAAdherence(
    prisma,
    vendorId,
    periodStart,
    periodEnd,
    previousPeriodStart,
    previousPeriodEnd
  );
  if (slaAdherence) {
    indicators.push(slaAdherence);
  }

  // Calculate overall composite score (weighted average)
  const overallScore = calculateOverallScore(indicators);

  return {
    vendorId,
    vendorName: vendor.name,
    indicators,
    overallScore,
    periodStart,
    periodEnd,
  };
}

/**
 * Calculate delivery time performance
 */
async function calculateDeliveryTime(
  prisma: PrismaClient,
  vendorId: string,
  periodStart: Date,
  periodEnd: Date,
  previousPeriodStart: Date,
  previousPeriodEnd: Date
): Promise<PerformanceIndicator | null> {
  const currentValue = await getAggregatedMetric(
    prisma,
    vendorId,
    'delivery_time',
    periodStart,
    periodEnd,
    AggregationMethod.AVG
  );

  if (currentValue === null) {
    return null;
  }

  const previousValue = await getAggregatedMetric(
    prisma,
    vendorId,
    'delivery_time',
    previousPeriodStart,
    previousPeriodEnd,
    AggregationMethod.AVG
  );

  const trend = calculateTrend(currentValue, previousValue, true); // Lower is better
  const changePercent = previousValue
    ? ((currentValue - previousValue) / previousValue) * 100
    : undefined;

  return {
    kpiName: 'delivery_time',
    value: currentValue,
    trend,
    periodStart,
    periodEnd,
    previousValue,
    changePercent,
  };
}

/**
 * Calculate service quality performance
 */
async function calculateServiceQuality(
  prisma: PrismaClient,
  vendorId: string,
  periodStart: Date,
  periodEnd: Date,
  previousPeriodStart: Date,
  previousPeriodEnd: Date
): Promise<PerformanceIndicator | null> {
  const currentValue = await getAggregatedMetric(
    prisma,
    vendorId,
    'service_quality',
    periodStart,
    periodEnd,
    AggregationMethod.AVG
  );

  if (currentValue === null) {
    return null;
  }

  const previousValue = await getAggregatedMetric(
    prisma,
    vendorId,
    'service_quality',
    previousPeriodStart,
    previousPeriodEnd,
    AggregationMethod.AVG
  );

  const trend = calculateTrend(currentValue, previousValue, false); // Higher is better
  const changePercent = previousValue
    ? ((currentValue - previousValue) / previousValue) * 100
    : undefined;

  return {
    kpiName: 'service_quality',
    value: currentValue,
    trend,
    periodStart,
    periodEnd,
    previousValue,
    changePercent,
  };
}

/**
 * Calculate SLA adherence performance
 */
async function calculateSLAAdherence(
  prisma: PrismaClient,
  vendorId: string,
  periodStart: Date,
  periodEnd: Date,
  previousPeriodStart: Date,
  previousPeriodEnd: Date
): Promise<PerformanceIndicator | null> {
  const currentValue = await getAggregatedMetric(
    prisma,
    vendorId,
    'sla_adherence',
    periodStart,
    periodEnd,
    AggregationMethod.AVG
  );

  if (currentValue === null) {
    return null;
  }

  const previousValue = await getAggregatedMetric(
    prisma,
    vendorId,
    'sla_adherence',
    previousPeriodStart,
    previousPeriodEnd,
    AggregationMethod.AVG
  );

  const trend = calculateTrend(currentValue, previousValue, false); // Higher is better
  const changePercent = previousValue
    ? ((currentValue - previousValue) / previousValue) * 100
    : undefined;

  return {
    kpiName: 'sla_adherence',
    value: currentValue,
    trend,
    periodStart,
    periodEnd,
    previousValue,
    changePercent,
  };
}

/**
 * Calculate trend direction
 */
function calculateTrend(
  currentValue: number,
  previousValue: number | null,
  lowerIsBetter: boolean
): 'improving' | 'declining' | 'stable' {
  if (previousValue === null) {
    return 'stable';
  }

  const change = currentValue - previousValue;
  const threshold = Math.abs(previousValue) * 0.05; // 5% threshold for stability

  if (Math.abs(change) < threshold) {
    return 'stable';
  }

  if (lowerIsBetter) {
    return change < 0 ? 'improving' : 'declining';
  } else {
    return change > 0 ? 'improving' : 'declining';
  }
}

/**
 * Calculate overall composite score from indicators
 */
function calculateOverallScore(indicators: PerformanceIndicator[]): number {
  if (indicators.length === 0) {
    return 0;
  }

  // Normalize values to 0-100 scale and calculate weighted average
  // Weights: delivery_time (30%), service_quality (40%), sla_adherence (30%)
  const weights: Record<string, number> = {
    delivery_time: 0.3,
    service_quality: 0.4,
    sla_adherence: 0.3,
  };

  let totalWeight = 0;
  let weightedSum = 0;

  for (const indicator of indicators) {
    const weight = weights[indicator.kpiName] ?? 1 / indicators.length;
    totalWeight += weight;

    // Normalize value (assume 0-100 scale, adjust if needed)
    let normalizedValue = indicator.value;
    if (indicator.kpiName === 'delivery_time') {
      // For delivery time, invert: lower is better
      // Assume max delivery time is 30 days = 0 score, 0 days = 100 score
      normalizedValue = Math.max(0, Math.min(100, 100 - (indicator.value / 30) * 100));
    } else {
      // For quality and SLA, assume already 0-100 scale
      normalizedValue = Math.max(0, Math.min(100, indicator.value));
    }

    weightedSum += normalizedValue * weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Get performance trends for multiple vendors
 */
export async function getVendorPerformanceTrends(
  prisma: PrismaClient,
  vendorIds: string[],
  periodStart: Date,
  periodEnd: Date
): Promise<VendorPerformanceSummary[]> {
  const summaries: VendorPerformanceSummary[] = [];

  for (const vendorId of vendorIds) {
    try {
      const summary = await calculateVendorPerformance(
        prisma,
        vendorId,
        periodStart,
        periodEnd
      );
      summaries.push(summary);
    } catch (error) {
      console.error(`Error calculating performance for vendor ${vendorId}:`, error);
    }
  }

  return summaries;
}

/**
 * Export performance data for dashboard
 */
export async function exportPerformanceData(
  prisma: PrismaClient,
  vendorId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{
  summary: VendorPerformanceSummary;
  rawMetrics: Array<{
    kpiName: string;
    value: number;
    periodStart: Date;
    periodEnd: Date;
  }>;
}> {
  const summary = await calculateVendorPerformance(
    prisma,
    vendorId,
    periodStart,
    periodEnd
  );

  const rawMetrics = await getVendorPerformanceMetrics(prisma, vendorId, {
    periodStart,
    periodEnd,
  });

  return {
    summary,
    rawMetrics: rawMetrics.map((m) => ({
      kpiName: m.kpiName,
      value: m.value,
      periodStart: m.periodStart,
      periodEnd: m.periodEnd,
    })),
  };
}

