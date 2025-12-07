import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ThroughputMetrics {
  credentialsPerHour: number;
  credentialsPerDay: number;
  byOrg: Record<string, number>;
  byRegion: Record<string, number>;
  period: { start: Date; end: Date };
}

/**
 * Track throughput (credentials per time period)
 */
export async function computeThroughput(
  startDate: Date,
  endDate: Date,
  orgId?: string,
  region?: string,
): Promise<ThroughputMetrics> {
  // In production, would query actual credential creation events
  // For now, use latency records as proxy
  const latencies = await prisma.credentialLatency.findMany({
    where: {
      updatedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
  const days = hours / 24;

  const credentialsPerHour = hours > 0 ? latencies.length / hours : 0;
  const credentialsPerDay = days > 0 ? latencies.length / days : 0;

  // Group by org/region (would need additional data in production)
  const byOrg: Record<string, number> = {};
  const byRegion: Record<string, number> = {};

  // Placeholder grouping
  for (const latency of latencies) {
    byOrg['default'] = (byOrg['default'] || 0) + 1;
    byRegion['us'] = (byRegion['us'] || 0) + 1;
  }

  return {
    credentialsPerHour,
    credentialsPerDay,
    byOrg,
    byRegion,
    period: { start: startDate, end: endDate },
  };
}

