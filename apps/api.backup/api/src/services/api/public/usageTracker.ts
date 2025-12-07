// B235B-API-014: PublicAPIUsageTracker - Collects usage metrics

import { PrismaClient } from '@prisma/client';

export interface UsageMetrics {
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs?: number;
  dataTransferBytes?: number;
  isSpecialOp?: boolean;
  anonymizedIp?: string;
  userAgent?: string;
}

export interface EndpointStats {
  endpoint: string;
  method: string;
  requestCount: number;
  avgLatencyMs: number;
  errorRate: number; // Percentage of 4xx/5xx responses
  totalDataTransferBytes: number;
}

export interface TopConsumer {
  apiKeyId: string;
  keyPrefix: string;
  requestCount: number;
  dataTransferBytes: number;
}

export class PublicAPIUsageTracker {
  constructor(private prisma: PrismaClient) {}

  /**
   * Record API usage
   */
  async recordUsage(metrics: UsageMetrics): Promise<void> {
    await this.prisma.aPIUsageLog.create({
      data: {
        apiKeyId: metrics.apiKeyId,
        endpoint: metrics.endpoint,
        method: metrics.method,
        statusCode: metrics.statusCode,
        latencyMs: metrics.latencyMs,
        dataTransferBytes: metrics.dataTransferBytes,
        isSpecialOp: metrics.isSpecialOp || false,
        anonymizedIp: this.anonymizeIP(metrics.anonymizedIp),
        userAgent: this.truncateUserAgent(metrics.userAgent),
      },
    });
  }

  /**
   * Get usage metrics per endpoint
   */
  async getEndpointStats(
    startDate: Date,
    endDate: Date,
    apiKeyId?: string
  ): Promise<EndpointStats[]> {
    const where: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (apiKeyId) {
      where.apiKeyId = apiKeyId;
    }

    const logs = await this.prisma.aPIUsageLog.findMany({
      where,
    });

    // Group by endpoint and method
    const statsMap = new Map<string, EndpointStats>();

    for (const log of logs) {
      const key = `${log.method}:${log.endpoint}`;
      const existing = statsMap.get(key) || {
        endpoint: log.endpoint,
        method: log.method,
        requestCount: 0,
        totalLatencyMs: 0,
        errorCount: 0,
        totalDataTransferBytes: 0,
      };

      existing.requestCount++;
      if (log.latencyMs) {
        existing.totalLatencyMs += log.latencyMs;
      }
      if (log.statusCode >= 400) {
        existing.errorCount++;
      }
      if (log.dataTransferBytes) {
        existing.totalDataTransferBytes += log.dataTransferBytes;
      }

      statsMap.set(key, existing);
    }

    // Convert to EndpointStats array
    return Array.from(statsMap.values()).map((stat) => ({
      endpoint: stat.endpoint,
      method: stat.method,
      requestCount: stat.requestCount,
      avgLatencyMs:
        stat.requestCount > 0
          ? stat.totalLatencyMs / stat.requestCount
          : 0,
      errorRate: (stat.errorCount / stat.requestCount) * 100,
      totalDataTransferBytes: stat.totalDataTransferBytes,
    }));
  }

  /**
   * Get top consumers by request count
   */
  async getTopConsumers(
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<TopConsumer[]> {
    const logs = await this.prisma.aPIUsageLog.groupBy({
      by: ['apiKeyId'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        id: true,
      },
      _sum: {
        dataTransferBytes: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: limit,
    });

    // Get API key prefixes
    const apiKeyIds = logs.map((log) => log.apiKeyId);
    const apiKeys = await this.prisma.aPIKey.findMany({
      where: {
        id: { in: apiKeyIds },
      },
      select: {
        id: true,
        keyPrefix: true,
      },
    });

    const keyMap = new Map(apiKeys.map((k) => [k.id, k.keyPrefix]));

    return logs.map((log) => ({
      apiKeyId: log.apiKeyId,
      keyPrefix: keyMap.get(log.apiKeyId) || 'unknown',
      requestCount: log._count.id,
      dataTransferBytes: log._sum.dataTransferBytes || 0,
    }));
  }

  /**
   * Get error rates per endpoint
   */
  async getErrorRates(
    startDate: Date,
    endDate: Date,
    apiKeyId?: string
  ): Promise<Map<string, number>> {
    const where: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      statusCode: {
        gte: 400,
      },
    };

    if (apiKeyId) {
      where.apiKeyId = apiKeyId;
    }

    const errorLogs = await this.prisma.aPIUsageLog.findMany({
      where,
      select: {
        endpoint: true,
        statusCode: true,
      },
    });

    const endpointErrors = new Map<string, { errors: number; total: number }>();

    // Get total requests per endpoint
    const totalLogs = await this.prisma.aPIUsageLog.groupBy({
      by: ['endpoint'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(apiKeyId && { apiKeyId }),
      },
      _count: {
        id: true,
      },
    });

    const totalMap = new Map(
      totalLogs.map((log) => [log.endpoint, log._count.id])
    );

    // Count errors per endpoint
    for (const log of errorLogs) {
      const existing = endpointErrors.get(log.endpoint) || {
        errors: 0,
        total: totalMap.get(log.endpoint) || 0,
      };
      existing.errors++;
      endpointErrors.set(log.endpoint, existing);
    }

    // Calculate error rates
    const errorRates = new Map<string, number>();
    for (const [endpoint, counts] of endpointErrors.entries()) {
      const rate = counts.total > 0 ? (counts.errors / counts.total) * 100 : 0;
      errorRates.set(endpoint, rate);
    }

    return errorRates;
  }

  /**
   * Get latency percentiles for an endpoint
   */
  async getLatencyPercentiles(
    endpoint: string,
    startDate: Date,
    endDate: Date,
    percentiles: number[] = [50, 75, 90, 95, 99]
  ): Promise<Map<number, number>> {
    const logs = await this.prisma.aPIUsageLog.findMany({
      where: {
        endpoint,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        latencyMs: {
          not: null,
        },
      },
      select: {
        latencyMs: true,
      },
      orderBy: {
        latencyMs: 'asc',
      },
    });

    const latencies = logs
      .map((log) => log.latencyMs!)
      .filter((latency) => latency !== null && latency !== undefined);

    if (latencies.length === 0) {
      return new Map();
    }

    const result = new Map<number, number>();

    for (const percentile of percentiles) {
      const index = Math.ceil((percentile / 100) * latencies.length) - 1;
      result.set(percentile, latencies[Math.max(0, index)]);
    }

    return result;
  }

  /**
   * Anonymize IP address (remove last octet)
   */
  private anonymizeIP(ip?: string | null): string | null {
    if (!ip) return null;
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    }
    return ip; // IPv6 or invalid format, return as-is
  }

  /**
   * Truncate user agent to first 100 chars
   */
  private truncateUserAgent(ua?: string | null): string | null {
    if (!ua) return null;
    return ua.substring(0, 100);
  }
}

