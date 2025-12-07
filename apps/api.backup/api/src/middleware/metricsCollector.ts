import { NextFunction, Request, Response } from 'express';

/**
 * Simple metrics collector for observability.
 * In production, integrate with Prometheus, DataDog, or CloudWatch.
 */
export class MetricsCollector {
  private metrics: Map<string, number[]> = new Map();
  private counters: Map<string, number> = new Map();

  /**
   * Record a latency metric.
   */
  recordLatency(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  /**
   * Increment a counter metric.
   */
  incrementCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  /**
   * Get all metrics.
   */
  getMetrics(): { latencies: Record<string, any>; counters: Record<string, number> } {
    const latencies: Record<string, any> = {};

    for (const [name, values] of this.metrics.entries()) {
      if (values.length === 0) continue;

      const sorted = values.slice().sort((a, b) => a - b);
      latencies[name] = {
        count: values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
      };
    }

    return {
      latencies,
      counters: Object.fromEntries(this.counters),
    };
  }

  /**
   * Clear all metrics (useful for periodic reporting).
   */
  clear(): void {
    this.metrics.clear();
    this.counters.clear();
  }

  /**
   * Express middleware to track request latency.
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const route = `${req.method} ${req.route?.path || req.path}`;

        this.recordLatency(`http_request_duration_ms`, duration);
        this.recordLatency(`${route}_duration_ms`, duration);
        this.incrementCounter(`http_requests_total`);
        this.incrementCounter(`http_${res.statusCode}`);

        // Track specific metrics for NPI endpoints
        if (req.path.includes('/npi/lookup')) {
          this.recordLatency('npi_lookup_latency_ms', duration);
        } else if (req.path.includes('/claim/basic')) {
          this.incrementCounter('claim_level1_rate');
        } else if (req.path.includes('/claim/doc')) {
          this.incrementCounter('claim_level2_attempts');
          if (res.statusCode === 200) {
            this.incrementCounter('claim_level2_success');
          }
        } else if (req.path.includes('/attest-request')) {
          this.incrementCounter('claim_level3_requests');
        }
      });

      next();
    };
  }

  /**
   * Record face match score for analytics.
   */
  recordFaceMatchScore(score: number): void {
    this.recordLatency('face_match_score', score);
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();

/**
 * Endpoint to expose metrics for scraping.
 */
export function getMetricsHandler(req: Request, res: Response) {
  const metrics = metricsCollector.getMetrics();
  res.json(metrics);
}
