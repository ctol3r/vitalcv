/**
 * B240B-VM-014: VendorPerformanceMetrics model
 *
 * Tracks performance KPIs per vendor with support for multiple metrics.
 */

import { PrismaClient, AggregationMethod } from '@prisma/client';

export interface PerformanceMetricInput {
  vendorId: string;
  kpiName: string;
  value: number;
  periodStart: Date;
  periodEnd: Date;
  aggregationMethod?: AggregationMethod;
  metadata?: Record<string, any>;
}

export interface PerformanceMetric {
  id: string;
  vendorId: string;
  kpiName: string;
  value: number;
  periodStart: Date;
  periodEnd: Date;
  aggregationMethod: AggregationMethod;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a performance metric
 */
export async function createPerformanceMetric(
  prisma: PrismaClient,
  input: PerformanceMetricInput
): Promise<PerformanceMetric> {
  return prisma.vendorPerformanceMetrics.create({
    data: {
      vendorId: input.vendorId,
      kpiName: input.kpiName,
      value: input.value,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      aggregationMethod: input.aggregationMethod ?? AggregationMethod.AVG,
      metadata: input.metadata ?? {},
    },
  });
}

/**
 * Get metrics for a vendor
 */
export async function getVendorPerformanceMetrics(
  prisma: PrismaClient,
  vendorId: string,
  options?: {
    kpiName?: string;
    periodStart?: Date;
    periodEnd?: Date;
    limit?: number;
  }
): Promise<PerformanceMetric[]> {
  return prisma.vendorPerformanceMetrics.findMany({
    where: {
      vendorId,
      ...(options?.kpiName && { kpiName: options.kpiName }),
      ...(options?.periodStart && { periodStart: { gte: options.periodStart } }),
      ...(options?.periodEnd && { periodEnd: { lte: options.periodEnd } }),
    },
    orderBy: { periodStart: 'desc' },
    take: options?.limit,
  });
}

/**
 * Get aggregated metric value for a vendor
 */
export async function getAggregatedMetric(
  prisma: PrismaClient,
  vendorId: string,
  kpiName: string,
  periodStart: Date,
  periodEnd: Date,
  aggregationMethod: AggregationMethod = AggregationMethod.AVG
): Promise<number | null> {
  const metrics = await prisma.vendorPerformanceMetrics.findMany({
    where: {
      vendorId,
      kpiName,
      periodStart: { gte: periodStart },
      periodEnd: { lte: periodEnd },
    },
  });

  if (metrics.length === 0) {
    return null;
  }

  const values = metrics.map((m) => m.value);

  switch (aggregationMethod) {
    case AggregationMethod.AVG:
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    case AggregationMethod.SUM:
      return values.reduce((sum, v) => sum + v, 0);
    case AggregationMethod.MAX:
      return Math.max(...values);
    case AggregationMethod.MIN:
      return Math.min(...values);
    default:
      return values.reduce((sum, v) => sum + v, 0) / values.length;
  }
}

/**
 * Update a performance metric
 */
export async function updatePerformanceMetric(
  prisma: PrismaClient,
  id: string,
  input: Partial<PerformanceMetricInput>
): Promise<PerformanceMetric> {
  return prisma.vendorPerformanceMetrics.update({
    where: { id },
    data: {
      ...(input.value !== undefined && { value: input.value }),
      ...(input.periodStart && { periodStart: input.periodStart }),
      ...(input.periodEnd && { periodEnd: input.periodEnd }),
      ...(input.aggregationMethod && { aggregationMethod: input.aggregationMethod }),
      ...(input.metadata && { metadata: input.metadata }),
    },
  });
}

/**
 * Delete a performance metric
 */
export async function deletePerformanceMetric(
  prisma: PrismaClient,
  id: string
): Promise<void> {
  await prisma.vendorPerformanceMetrics.delete({
    where: { id },
  });
}

