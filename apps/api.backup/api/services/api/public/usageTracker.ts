/**
 * B235B-API-014: PublicAPIUsageTracker
 *
 * Collects usage metrics: requests per endpoint, latency, error rates, top consumers.
 * Stores anonymized logs and feeds dashboards.
 */

import { PrismaClient } from '@prisma/client';

export interface UsageMetrics {
  endpoint: string;
  method: string;
  requestCount: number;
  averageLatency: number;
  errorRate: number;
  totalDataTransfer: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface TopConsumer {
  apiKeyId: string;
  keyPrefix: string;
  requestCount: number;
  dataTransfer: number;
  errorCount: number;
}

export interface EndpointStats {
  endpoint: string;
  method: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  totalDataTransfer: number;
}

export class PublicAPIUsageTracker {
  constructor(private prisma: PrismaClient) {}

  /**
   * Record API usage
   */
  async recordUsage(params: {
    apiKeyId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    latencyMs: number;
    dataTransferBytes?: number;
    isSpecialOp?: boolean;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    // Anonymize IP address (remove last octet)
    const anonymizedIp = params.ipAddress
      ? this.anonymizeIP(params.ipAddress)
      : null;

    // Truncate user agent to prevent fingerprinting
    const truncatedUserAgent = params.userAgent
      ? this.truncateUserAgent(params.userAgent)
      : null;

    await this.prisma.aPIUsageLog.create({
      data: {
        apiKeyId: params.apiKeyId,
        endpoint: params.endpoint,
        method: params.method,
        statusCode: params.statusCode,
        latencyMs: params.latencyMs,
        dataTransferBytes: params.dataTransferBytes || 0,
        isSpecialOp: params.isSpecialOp || false,
        anonymizedIp,
        userAgent: truncatedUserAgent,
      },
    });

    // Update last used timestamp on API key
    await this.prisma.aPIKey.update({
      where: { id: params.apiKeyId },
      data: { lastUsedAt: new Date() },
    });
  }

  /**
   * Get usage metrics for a time period
   */
  async getUsageMetrics(
    startDate: Date,
    endDate: Date,
    filters?: {
      apiKeyId?: string;
      endpoint?: string;
      method?: string;
    }
  ): Promise<UsageMetrics[]> {
    const where: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (filters?.apiKeyId) {
      where.apiKeyId = filters.apiKeyId;
    }
    if (filters?.endpoint) {
      where.endpoint = filters.endpoint;
    }
    if (filters?.method) {
      where.method = filters.method;
    }

    const logs = await this.prisma.aPIUsageLog.groupBy({
      by: ['endpoint', 'method'],
      where,
      _count: { id: true },
      _avg: { latencyMs: true },
      _sum: { dataTransferBytes: true },
    });

    // Calculate error rates
    const errorLogs = await this.prisma.aPIUsageLog.groupBy({
      by: ['endpoint', 'method'],
      where: {
        ...where,
        statusCode: { gte: 400 },
      },
      _count: { id: true },
    });

    const errorMap = new Map<string, number>();
    errorLogs.forEach((log) => {
      const key = `${log.endpoint}:${log.method}`;
      errorMap.set(key, log._count.id);
    });

    return logs.map((log) => {
      const key = `${log.endpoint}:${log.method}`;
      const errorCount = errorMap.get(key) || 0;
      const totalCount = log._count.id;

      return {
        endpoint: log.endpoint,
        method: log.method,
        requestCount: totalCount,
        averageLatency: log._avg.latencyMs || 0,
        errorRate: totalCount > 0 ? errorCount / totalCount : 0,
        totalDataTransfer: log._sum.dataTransferBytes || 0,
        periodStart: startDate,
        periodEnd: endDate,
      };
    });
  }

  /**
   * Get top consumers (by request count)
   */
  async getTopConsumers(
    limit: number = 10,
    startDate?: Date,
    endDate?: Date
  ): Promise<TopConsumer[]> {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const grouped = await this.prisma.aPIUsageLog.groupBy({
      by: ['apiKeyId'],
      where,
      _count: { id: true },
      _sum: { dataTransferBytes: true },
    });

    // Get error counts
    const errorCounts = await this.prisma.aPIUsageLog.groupBy({
      by: ['apiKeyId'],
      where: {
        ...where,
        statusCode: { gte: 400 },
      },
      _count: { id: true },
    });

    const errorMap = new Map<string, number>();
    errorCounts.forEach((log) => {
      errorMap.set(log.apiKeyId, log._count.id);
    });

    // Fetch API key prefixes
    const apiKeyIds = grouped.map((g) => g.apiKeyId);
    const apiKeys = await this.prisma.aPIKey.findMany({
      where: { id: { in: apiKeyIds } },
      select: { id: true, keyPrefix: true },
    });

    const keyMap = new Map(apiKeys.map((k) => [k.id, k.keyPrefix]));

    const topConsumers = grouped
      .map((log) => ({
        apiKeyId: log.apiKeyId,
        keyPrefix: keyMap.get(log.apiKeyId) || 'unknown',
        requestCount: log._count.id,
        dataTransfer: log._sum.dataTransferBytes || 0,
        errorCount: errorMap.get(log.apiKeyId) || 0,
      }))
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, limit);

    return topConsumers;
  }

  /**
   * Get endpoint statistics
   */
  async getEndpointStats(
    endpoint: string,
    method: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<EndpointStats | null> {
    const where: any = {
      endpoint,
      method,
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const logs = await this.prisma.aPIUsageLog.findMany({
      where,
      select: {
        statusCode: true,
        latencyMs: true,
        dataTransferBytes: true,
      },
    });

    if (logs.length === 0) {
      return null;
    }

    const totalRequests = logs.length;
    const successCount = logs.filter((l) => l.statusCode < 400).length;
    const errorCount = totalRequests - successCount;

    const latencies = logs
      .map((l) => l.latencyMs || 0)
      .filter((l) => l > 0)
      .sort((a, b) => a - b);

    const averageLatency =
      latencies.reduce((sum, l) => sum + l, 0) / latencies.length || 0;

    const p50Index = Math.floor(latencies.length * 0.5);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);

    const totalDataTransfer =
      logs.reduce((sum, l) => sum + (l.dataTransferBytes || 0), 0) || 0;

    return {
      endpoint,
      method,
      totalRequests,
      successCount,
      errorCount,
      averageLatency,
      p50Latency: latencies[p50Index] || 0,
      p95Latency: latencies[p95Index] || 0,
      p99Latency: latencies[p99Index] || 0,
      totalDataTransfer,
    };
  }

  /**
   * Get error rate trends
   */
  async getErrorRateTrends(
    startDate: Date,
    endDate: Date,
    intervalHours: number = 24
  ): Promise<Array<{ timestamp: Date; errorRate: number; requestCount: number }>> {
    // This would require more complex SQL queries
    // For now, return simplified version
    const logs = await this.prisma.aPIUsageLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
        statusCode: true,
      },
    });

    // Group by time intervals
    const intervalMs = intervalHours * 60 * 60 * 1000;
    const intervals = new Map<number, { total: number; errors: number }>();

    logs.forEach((log) => {
      const intervalStart =
        Math.floor(log.createdAt.getTime() / intervalMs) * intervalMs;
      const existing = intervals.get(intervalStart) || { total: 0, errors: 0 };
      existing.total++;
      if (log.statusCode >= 400) {
        existing.errors++;
      }
      intervals.set(intervalStart, existing);
    });

    return Array.from(intervals.entries())
      .map(([timestamp, data]) => ({
        timestamp: new Date(timestamp),
        errorRate: data.total > 0 ? data.errors / data.total : 0,
        requestCount: data.total,
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Anonymize IP address (remove last octet)
   */
  private anonymizeIP(ip: string): string {
    // IPv4: 192.168.1.100 -> 192.168.1.0
    // IPv6: simplify to first 64 bits
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
      }
    }
    // For IPv6, just return first 4 segments
    if (ip.includes(':')) {
      const parts = ip.split(':');
      return parts.slice(0, 4).join(':') + '::';
    }
    return ip;
  }

  /**
   * Truncate user agent to prevent fingerprinting
   */
  private truncateUserAgent(userAgent: string): string {
    // Keep only browser name and major version
    const match = userAgent.match(/^([^/]+)\/([0-9]+)/);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
    // Fallback: truncate to 50 chars
    return userAgent.substring(0, 50);
  }
}

