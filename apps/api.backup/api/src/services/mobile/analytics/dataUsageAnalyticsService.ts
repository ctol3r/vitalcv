import { LocalDataStoreService } from '../models/LocalDataStore';
import { SyncQueueService } from '../models/SyncQueue';
import { OfflineCacheService } from '../services/offlineCacheService';

export interface DataUsageMetrics {
  cacheSize: number; // Bytes
  cacheEntries: number;
  syncQueueSize: number;
  syncQueuePending: number;
  syncQueueErrors: number;
  dataStoreSize: number;
  dataStoreEntries: number;
  lastSyncTime?: Date;
  errorRate: number; // 0-1
  timestamp: Date;
}

export interface DataUsageSummary {
  totalCacheSize: number;
  totalDataStoreSize: number;
  totalSyncOperations: number;
  successRate: number;
  averageErrorRate: number;
  period: {
    start: Date;
    end: Date;
  };
}

/**
 * DataUsageAnalyticsService tracks offline data and network usage
 * Collects metrics on cache size, sync bandwidth, error rates
 */
export class DataUsageAnalyticsService {
  private metricsHistory: DataUsageMetrics[] = [];
  private readonly maxHistorySize: number = 1000;

  constructor(
    private localDataStore: LocalDataStoreService,
    private syncQueue: SyncQueueService,
    private cacheService: OfflineCacheService
  ) {}

  /**
   * Collect current metrics
   */
  async collectMetrics(userId?: string): Promise<DataUsageMetrics> {
    const [cacheStats, syncStats, dataStoreCount] = await Promise.all([
      this.getCacheStats(),
      this.getSyncStats(userId),
      this.localDataStore.count({ userId }),
    ]);

    const metrics: DataUsageMetrics = {
      cacheSize: cacheStats.sizeBytes,
      cacheEntries: cacheStats.entries,
      syncQueueSize: syncStats.total,
      syncQueuePending: syncStats.pending,
      syncQueueErrors: syncStats.errors,
      dataStoreSize: cacheStats.sizeBytes, // Approximate
      dataStoreEntries: dataStoreCount,
      lastSyncTime: syncStats.lastSyncTime,
      errorRate: syncStats.total > 0 ? syncStats.errors / syncStats.total : 0,
      timestamp: new Date(),
    };

    // Store in history
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    // Persist to local data store
    await this.localDataStore.save({
      key: `metrics_${metrics.timestamp.getTime()}`,
      value: JSON.stringify(metrics),
      entityType: 'analytics',
      userId,
    });

    return metrics;
  }

  /**
   * Get summary for a time period
   */
  async getSummary(startDate: Date, endDate: Date, userId?: string): Promise<DataUsageSummary> {
    const metrics = await this.localDataStore.query({
      entityType: 'analytics',
      userId,
    });

    const periodMetrics = metrics
      .map((m) => {
        try {
          return JSON.parse(m.value) as DataUsageMetrics;
        } catch {
          return null;
        }
      })
      .filter((m): m is DataUsageMetrics => {
        if (!m) return false;
        const timestamp = new Date(m.timestamp);
        return timestamp >= startDate && timestamp <= endDate;
      });

    if (periodMetrics.length === 0) {
      return {
        totalCacheSize: 0,
        totalDataStoreSize: 0,
        totalSyncOperations: 0,
        successRate: 1,
        averageErrorRate: 0,
        period: { start: startDate, end: endDate },
      };
    }

    const totalCacheSize = periodMetrics.reduce((sum, m) => sum + m.cacheSize, 0);
    const totalDataStoreSize = periodMetrics.reduce((sum, m) => sum + m.dataStoreSize, 0);
    const totalSyncOperations = periodMetrics.reduce((sum, m) => sum + m.syncQueueSize, 0);
    const totalErrors = periodMetrics.reduce((sum, m) => sum + m.syncQueueErrors, 0);
    const averageErrorRate =
      periodMetrics.reduce((sum, m) => sum + m.errorRate, 0) / periodMetrics.length;

    return {
      totalCacheSize,
      totalDataStoreSize,
      totalSyncOperations,
      successRate: totalSyncOperations > 0 ? 1 - totalErrors / totalSyncOperations : 1,
      averageErrorRate,
      period: { start: startDate, end: endDate },
    };
  }

  /**
   * Get current metrics
   */
  async getCurrentMetrics(userId?: string): Promise<DataUsageMetrics> {
    return this.collectMetrics(userId);
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): DataUsageMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Detect anomalies in metrics (e.g., sudden spike in errors)
   */
  detectAnomalies(): Array<{ type: string; severity: 'low' | 'medium' | 'high'; message: string }> {
    const anomalies: Array<{ type: string; severity: 'low' | 'medium' | 'high'; message: string }> = [];

    if (this.metricsHistory.length < 2) {
      return anomalies;
    }

    const recent = this.metricsHistory.slice(-10);
    const avgErrorRate = recent.reduce((sum, m) => sum + m.errorRate, 0) / recent.length;
    const latest = this.metricsHistory[this.metricsHistory.length - 1];

    // Check for error rate spike
    if (latest.errorRate > avgErrorRate * 2 && latest.errorRate > 0.1) {
      anomalies.push({
        type: 'error_rate_spike',
        severity: latest.errorRate > 0.5 ? 'high' : 'medium',
        message: `Error rate increased to ${(latest.errorRate * 100).toFixed(1)}%`,
      });
    }

    // Check for cache size anomaly
    const avgCacheSize = recent.reduce((sum, m) => sum + m.cacheSize, 0) / recent.length;
    if (latest.cacheSize > avgCacheSize * 1.5) {
      anomalies.push({
        type: 'cache_size_spike',
        severity: 'low',
        message: `Cache size increased significantly to ${(latest.cacheSize / 1024 / 1024).toFixed(2)} MB`,
      });
    }

    // Check for sync queue backlog
    if (latest.syncQueuePending > 100) {
      anomalies.push({
        type: 'sync_backlog',
        severity: latest.syncQueuePending > 500 ? 'high' : 'medium',
        message: `Sync queue has ${latest.syncQueuePending} pending items`,
      });
    }

    return anomalies;
  }

  /**
   * Get cache statistics
   */
  private async getCacheStats(): Promise<{ sizeBytes: number; entries: number }> {
    const stats = this.cacheService.getCacheStats();
    // Approximate size calculation (in real implementation, calculate actual bytes)
    const sizeBytes = stats.size * 1024; // Rough estimate: 1KB per entry
    return {
      sizeBytes,
      entries: stats.size,
    };
  }

  /**
   * Get sync statistics
   */
  private async getSyncStats(userId?: string): Promise<{
    total: number;
    pending: number;
    errors: number;
    lastSyncTime?: Date;
  }> {
    const [pending, errors, synced] = await Promise.all([
      this.syncQueue.countByStatus('PENDING' as any, userId),
      this.syncQueue.countByStatus('ERROR' as any, userId),
      this.syncQueue.countByStatus('SYNCED' as any, userId),
    ]);

    const total = pending + errors + synced;

    // Get last synced item timestamp
    const syncedItems = await this.syncQueue.query({
      status: 'SYNCED' as any,
      userId,
      limit: 1,
    });
    const lastSyncTime = syncedItems[0]?.syncedAt;

    return {
      total,
      pending,
      errors,
      lastSyncTime: lastSyncTime ? new Date(lastSyncTime) : undefined,
    };
  }

  /**
   * Clear metrics history
   */
  clearHistory(): void {
    this.metricsHistory = [];
  }
}

