const log = getServiceLogger('interop/tefca/metrics-exporter');
/**
 * B121B-TEFCA-014: TEFCA compliance metrics exporter
 *
 * Exports compliance metrics including:
 * - Uptime histograms
 * - Latency histograms
 * - Request/response metrics
 * - Error rates
 */

import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { getServiceLogger } from '../../logging/serviceLogger';

interface LatencyBucket {
  bucket: string; // e.g., "<100ms", "100-500ms", "500ms-1s", "1s-5s", ">5s"
  count: number;
  percentage: number;
}

interface UptimeMetric {
  period: string; // e.g., "1h", "24h", "7d", "30d"
  uptimePercentage: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
}

interface LatencyHistogram {
  endpoint: string;
  method: string;
  buckets: LatencyBucket[];
  p50: number; // milliseconds
  p95: number; // milliseconds
  p99: number; // milliseconds
  mean: number; // milliseconds
}

interface TEFCAMetrics {
  exportTimestamp: string;
  period: {
    start: string;
    end: string;
  };
  uptime: UptimeMetric[];
  latencyHistograms: LatencyHistogram[];
  summary: {
    overallUptime: number;
    averageLatency: number;
    totalRequests: number;
    totalErrors: number;
    errorRate: number;
  };
}

// In-memory metrics store (in production, use time-series DB like Prometheus/InfluxDB)
class MetricsStore {
  private latencyData: Map<string, number[]> = new Map();
  private requestCounts: Map<string, { success: number; error: number }> = new Map();
  private startTime: number = Date.now();

  recordLatency(endpoint: string, method: string, latencyMs: number): void {
    const key = `${method}:${endpoint}`;
    if (!this.latencyData.has(key)) {
      this.latencyData.set(key, []);
    }
    this.latencyData.get(key)!.push(latencyMs);

    // Keep only last 10000 measurements per endpoint
    const data = this.latencyData.get(key)!;
    if (data.length > 10000) {
      data.shift();
    }
  }

  recordRequest(endpoint: string, method: string, success: boolean): void {
    const key = `${method}:${endpoint}`;
    if (!this.requestCounts.has(key)) {
      this.requestCounts.set(key, { success: 0, error: 0 });
    }
    const counts = this.requestCounts.get(key)!;
    if (success) {
      counts.success++;
    } else {
      counts.error++;
    }
  }

  getLatencyHistogram(endpoint: string, method: string): LatencyHistogram | null {
    const key = `${method}:${endpoint}`;
    const latencies = this.latencyData.get(key);
    if (!latencies || latencies.length === 0) {
      return null;
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;

    // Define buckets
    const buckets: LatencyBucket[] = [
      { bucket: '<100ms', count: 0, percentage: 0 },
      { bucket: '100-500ms', count: 0, percentage: 0 },
      { bucket: '500ms-1s', count: 0, percentage: 0 },
      { bucket: '1s-5s', count: 0, percentage: 0 },
      { bucket: '>5s', count: 0, percentage: 0 },
    ];

    sorted.forEach(latency => {
      if (latency < 100) buckets[0].count++;
      else if (latency < 500) buckets[1].count++;
      else if (latency < 1000) buckets[2].count++;
      else if (latency < 5000) buckets[3].count++;
      else buckets[4].count++;
    });

    buckets.forEach(bucket => {
      bucket.percentage = (bucket.count / sorted.length) * 100;
    });

    return {
      endpoint,
      method,
      buckets,
      p50,
      p95,
      p99,
      mean: Math.round(mean),
    };
  }

  getUptimeMetrics(): UptimeMetric[] {
    const now = Date.now();
    const uptime = (now - this.startTime) / 1000; // seconds

    const periods = [
      { label: '1h', seconds: 3600 },
      { label: '24h', seconds: 86400 },
      { label: '7d', seconds: 604800 },
      { label: '30d', seconds: 2592000 },
    ];

    return periods.map(period => {
      let totalSuccess = 0;
      let totalError = 0;

      this.requestCounts.forEach((counts) => {
        totalSuccess += counts.success;
        totalError += counts.error;
      });

      const totalRequests = totalSuccess + totalError;
      const uptimePercentage = totalRequests > 0
        ? (totalSuccess / totalRequests) * 100
        : 100;
      const errorRate = totalRequests > 0
        ? (totalError / totalRequests) * 100
        : 0;

      return {
        period: period.label,
        uptimePercentage: Math.round(uptimePercentage * 100) / 100,
        totalRequests,
        successfulRequests: totalSuccess,
        failedRequests: totalError,
        errorRate: Math.round(errorRate * 100) / 100,
      };
    });
  }

  getSummary() {
    let totalSuccess = 0;
    let totalError = 0;
    let totalLatency = 0;
    let latencyCount = 0;

    this.requestCounts.forEach((counts) => {
      totalSuccess += counts.success;
      totalError += counts.error;
    });

    this.latencyData.forEach((latencies) => {
      latencies.forEach(latency => {
        totalLatency += latency;
        latencyCount++;
      });
    });

    const totalRequests = totalSuccess + totalError;
    const overallUptime = totalRequests > 0
      ? (totalSuccess / totalRequests) * 100
      : 100;
    const averageLatency = latencyCount > 0
      ? totalLatency / latencyCount
      : 0;
    const errorRate = totalRequests > 0
      ? (totalError / totalRequests) * 100
      : 0;

    return {
      overallUptime: Math.round(overallUptime * 100) / 100,
      averageLatency: Math.round(averageLatency),
      totalRequests,
      totalErrors: totalError,
      errorRate: Math.round(errorRate * 100) / 100,
    };
  }

  getAllLatencyHistograms(): LatencyHistogram[] {
    const histograms: LatencyHistogram[] = [];

    this.latencyData.forEach((_, key) => {
      const [method, ...endpointParts] = key.split(':');
      const endpoint = endpointParts.join(':');
      const histogram = this.getLatencyHistogram(endpoint, method);
      if (histogram) {
        histograms.push(histogram);
      }
    });

    return histograms;
  }
}

// Singleton metrics store
const metricsStore = new MetricsStore();

/**
 * Middleware to record request metrics
 */
export function recordTEFCAMetrics(req: Request, res: Response, next: () => void): void {
  const startTime = Date.now();
  const endpoint = req.path;
  const method = req.method;

  // Override res.end to capture response status
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const latency = Date.now() - startTime;
    const success = res.statusCode >= 200 && res.statusCode < 400;

    metricsStore.recordLatency(endpoint, method, latency);
    metricsStore.recordRequest(endpoint, method, success);

    originalEnd.call(this, chunk, encoding);
  };

  next();
}

/**
 * B121B-TEFCA-014: Export TEFCA compliance metrics
 * GET /tefca/metrics/export
 */
export function exportTEFCAMetrics(req: Request, res: Response): void {
  try {
    const periodStart = req.query.start as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const periodEnd = req.query.end as string || new Date().toISOString();

    const metrics: TEFCAMetrics = {
      exportTimestamp: new Date().toISOString(),
      period: {
        start: periodStart,
        end: periodEnd,
      },
      uptime: metricsStore.getUptimeMetrics(),
      latencyHistograms: metricsStore.getAllLatencyHistograms(),
      summary: metricsStore.getSummary(),
    };

    // Set response headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Metrics-Export-Timestamp', metrics.exportTimestamp);
    res.setHeader('X-Metrics-Period-Start', periodStart);
    res.setHeader('X-Metrics-Period-End', periodEnd);

    res.json(metrics);
  } catch (error) {
    log.error('TEFCA metrics export error:', error);
    res.status(500).json({
      error: 'metrics_export_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /tefca/metrics/summary
 * Quick summary of TEFCA metrics
 */
export function getTEFCAMetricsSummary(req: Request, res: Response): void {
  try {
    res.json({
      summary: metricsStore.getSummary(),
      uptime: metricsStore.getUptimeMetrics(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('TEFCA metrics summary error:', error);
    res.status(500).json({
      error: 'metrics_summary_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export { metricsStore };

