/**
 * B228A-LIN-005: LineageAggregationJob
 *
 * Nightly job that aggregates lineage data into summary statistics:
 * - Records processed
 * - Sources used
 * - Transformations invoked
 * Feeds dashboards and compliance reports.
 */

import cron from 'node-cron';
import { PrismaClient, OperationType } from '@prisma/client';

const prisma = new PrismaClient();

export interface LineageAggregationStats {
  date: string; // YYYY-MM-DD
  totalRecordsProcessed: number;
  recordsBySystem: Record<string, number>;
  recordsByOperationType: Record<OperationType, number>;
  uniqueSources: number;
  uniqueTransformations: number;
  transformationsInvoked: Record<string, number>; // transformationId -> count
  operatorsActive: number;
  topSources: Array<{ system: string; count: number }>;
  topTransformations: Array<{ transformationId: string; name: string; count: number }>;
  metadata?: Record<string, unknown>;
}

/**
 * Get date bounds for a given date (start and end of day in UTC)
 */
function getDayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/**
 * Run lineage aggregation for a specific date
 */
export async function runLineageAggregation(
  targetDate: Date = new Date()
): Promise<LineageAggregationStats> {
  const { start, end } = getDayBounds(targetDate);
  const dateLabel = start.toISOString().slice(0, 10);

  // Get all lineage entries for the day
  const lineageEntries = await prisma.dataLineage.findMany({
    where: {
      timestamp: {
        gte: start,
        lt: end,
      },
    },
    include: {
      transformation: true,
    },
  });

  // Initialize stats
  const stats: LineageAggregationStats = {
    date: dateLabel,
    totalRecordsProcessed: lineageEntries.length,
    recordsBySystem: {},
    recordsByOperationType: {
      CREATE: 0,
      UPDATE: 0,
      DELETE: 0,
    },
    uniqueSources: 0,
    uniqueTransformations: 0,
    transformationsInvoked: {},
    operatorsActive: 0,
    topSources: [],
    topTransformations: [],
  };

  // Track unique values
  const sourceSystems = new Set<string>();
  const transformationIds = new Set<string>();
  const operatorIds = new Set<string>();
  const transformationCounts = new Map<string, { name: string; count: number }>();
  const sourceCounts = new Map<string, number>();

  // Process each lineage entry
  for (const entry of lineageEntries) {
    // Count by system
    sourceSystems.add(entry.sourceSystem);
    sourceCounts.set(entry.sourceSystem, (sourceCounts.get(entry.sourceSystem) || 0) + 1);

    // Count by operation type
    stats.recordsByOperationType[entry.operationType]++;

    // Track transformations
    if (entry.transformationId) {
      transformationIds.add(entry.transformationId);
      const transformationName = entry.transformation?.name || 'Unknown';
      const current = transformationCounts.get(entry.transformationId) || { name: transformationName, count: 0 };
      current.count++;
      transformationCounts.set(entry.transformationId, current);
      stats.transformationsInvoked[entry.transformationId] = current.count;
    }

    // Track operators
    if (entry.operatorId) {
      operatorIds.add(entry.operatorId);
    }
  }

  // Set unique counts
  stats.uniqueSources = sourceSystems.size;
  stats.uniqueTransformations = transformationIds.size;
  stats.operatorsActive = operatorIds.size;

  // Build recordsBySystem
  for (const [system, count] of sourceCounts.entries()) {
    stats.recordsBySystem[system] = count;
  }

  // Get top sources (top 10)
  stats.topSources = Array.from(sourceCounts.entries())
    .map(([system, count]) => ({ system, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Get top transformations (top 10)
  stats.topTransformations = Array.from(transformationCounts.entries())
    .map(([transformationId, data]) => ({
      transformationId,
      name: data.name,
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Store aggregation results (you might want to create a LineageAggregation table)
  // For now, we'll just return the stats
  // In production, you might want to store this in a LineageAggregation table

  return stats;
}

/**
 * Schedule nightly aggregation job (runs at 2 AM UTC)
 */
export function scheduleLineageAggregation(): void {
  // Run at 2 AM UTC every day
  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('[LineageAggregation] Starting nightly aggregation...');
      const stats = await runLineageAggregation();
      console.log('[LineageAggregation] Aggregation complete:', {
        date: stats.date,
        totalRecords: stats.totalRecordsProcessed,
        uniqueSources: stats.uniqueSources,
        uniqueTransformations: stats.uniqueTransformations,
      });
    } catch (error) {
      console.error('[LineageAggregation] Error during aggregation:', error);
    }
  });
}

/**
 * Run aggregation for a date range (useful for backfilling)
 */
export async function runLineageAggregationRange(
  startDate: Date,
  endDate: Date
): Promise<LineageAggregationStats[]> {
  const results: LineageAggregationStats[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const stats = await runLineageAggregation(new Date(currentDate));
    results.push(stats);
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return results;
}

/**
 * Get aggregation stats for a specific date
 */
export async function getAggregationStats(date: Date): Promise<LineageAggregationStats | null> {
  try {
    return await runLineageAggregation(date);
  } catch (error) {
    console.error('[LineageAggregation] Error getting stats:', error);
    return null;
  }
}

// Export for manual execution
if (require.main === module) {
  // Run aggregation for yesterday if called directly
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  runLineageAggregation(yesterday)
    .then((stats) => {
      console.log('Aggregation stats:', JSON.stringify(stats, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

