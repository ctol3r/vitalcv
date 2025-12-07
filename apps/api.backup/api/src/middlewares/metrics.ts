import { NextFunction, Request, Response } from 'express';

interface LatencyRecord {
  values: number[];
  count: number;
}

interface Metrics {
  latencies: Map<string, LatencyRecord>;
  counters: Map<string, number>;
  gauges: Map<string, number>;
}

/**
 * Prometheus-style metrics collector with HTTP middleware.
 * Tracks request latencies, counters, and custom metrics.
 */
export class MetricsCollector {
  private metrics: Metrics = {
    latencies: new Map(),
    counters: new Map(),
    gauges: new Map(),
  };

  /**
   * Record a latency measurement (in milliseconds).
   */
  recordLatency(name: string, value: number): void {
    const record = this.metrics.latencies.get(name);
    if (record) {
      record.values.push(value);
      record.count++;
      // Keep only last 1000 values to prevent memory issues
      if (record.values.length > 1000) {
        record.values.shift();
      }
    } else {
      this.metrics.latencies.set(name, { values: [value], count: 1 });
    }
  }

  /**
   * Increment a counter.
   */
  increment(name: string, value: number = 1): void {
    const current = this.metrics.counters.get(name) || 0;
    this.metrics.counters.set(name, current + value);
  }

  /**
   * Set a gauge value.
   */
  setGauge(name: string, value: number): void {
    this.metrics.gauges.set(name, value);
  }

  /**
   * Express middleware to track HTTP request metrics.
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        const path = req.route?.path || req.path;
        const method = req.method;

        // Record latency
        this.recordLatency(`http_request_duration_ms`, duration);
        this.recordLatency(`http_${method}_${path}_duration_ms`, duration);

        // Count requests
        this.increment('http_requests_total');
        this.increment(`http_${res.statusCode}_count`);
        this.increment(`http_${method}_${path}_count`);

        // Track specific NPI endpoints
        if (path.includes('/npi/lookup')) {
          this.recordLatency('npi_lookup_latency_ms', duration);
        } else if (path.includes('/claim/basic')) {
          this.increment('claim_level1_attempts');
        } else if (path.includes('/claim/verify-pin')) {
          if (res.statusCode === 200) {
            this.increment('claim_level1_success');
          }
        } else if (path.includes('/claim/doc')) {
          this.increment('claim_level2_attempts');
          if (res.statusCode === 200) {
            this.increment('claim_level2_success');
          }
        } else if (path.includes('/issuer/attest-request')) {
          this.increment('claim_level3_requests');
        }
      });

      next();
    };
  }

  /**
   * Get metrics in JSON format.
   */
  getMetrics() {
    const result: any = {
      latencies: {},
      counters: Object.fromEntries(this.metrics.counters),
      gauges: Object.fromEntries(this.metrics.gauges),
    };

    // Calculate percentiles for latencies
    for (const [name, record] of this.metrics.latencies.entries()) {
      const sorted = [...record.values].sort((a, b) => a - b);
      const len = sorted.length;

      if (len === 0) continue;

      result.latencies[name] = {
        count: record.count,
        min: sorted[0],
        max: sorted[len - 1],
        mean: sorted.reduce((a, b) => a + b, 0) / len,
        p50: sorted[Math.floor(len * 0.5)],
        p95: sorted[Math.floor(len * 0.95)],
        p99: sorted[Math.floor(len * 0.99)],
      };
    }

    return result;
  }

  /**
   * Get metrics in Prometheus text format.
   */
  getPrometheusFormat(): string {
    const lines: string[] = [];

    // Counters
    for (const [name, value] of this.metrics.counters) {
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
    }

    // Gauges
    for (const [name, value] of this.metrics.gauges) {
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }

    // Latencies (as summaries)
    for (const [name, record] of this.metrics.latencies) {
      const sorted = [...record.values].sort((a, b) => a - b);
      const len = sorted.length;

      if (len === 0) continue;

      const sum = sorted.reduce((a, b) => a + b, 0);

      lines.push(`# TYPE ${name} summary`);
      lines.push(`${name}_sum ${sum}`);
      lines.push(`${name}_count ${record.count}`);
      lines.push(`${name}{quantile="0.5"} ${sorted[Math.floor(len * 0.5)]}`);
      lines.push(`${name}{quantile="0.95"} ${sorted[Math.floor(len * 0.95)]}`);
      lines.push(`${name}{quantile="0.99"} ${sorted[Math.floor(len * 0.99)]}`);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Reset all metrics (useful for testing).
   */
  reset(): void {
    this.metrics.latencies.clear();
    this.metrics.counters.clear();
    this.metrics.gauges.clear();
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();

/**
 * Metrics endpoint handler.
 */
export function metricsHandler(req: Request, res: Response) {
  const accept = req.headers.accept || '';

  if (accept.includes('application/openmetrics-text') || accept.includes('text/plain')) {
    // Prometheus format
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(metricsCollector.getPrometheusFormat());
  } else {
    // JSON format
    res.json(metricsCollector.getMetrics());
  }
}
