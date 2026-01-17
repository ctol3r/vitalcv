/**
 * MetricsCollector
 * Captures custom metrics for queue lengths, job durations, error rates, resource usage
 * Publishes to Prometheus and provides helper decorators
 */

import { Request, Response } from 'express';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export interface QueueMetrics {
  queueName: string;
  length: number;
  processing: number;
  failed: number;
}

export interface JobMetrics {
  jobType: string;
  duration: number;
  status: 'success' | 'error' | 'timeout';
}

export interface ErrorMetrics {
  errorType: string;
  service: string;
  count: number;
}

export interface ResourceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  memoryLimit?: number;
  diskUsage?: number;
}

/**
 * Comprehensive metrics collector for observability
 */
export class MetricsCollector {
  private registry: Registry;

  // Queue metrics
  private queueLengthGauge: Gauge<string>;
  private queueProcessingGauge: Gauge<string>;
  private queueFailedCounter: Counter<string>;

  // Job metrics
  private jobDurationHistogram: Histogram<string>;
  private jobTotalCounter: Counter<string>;

  // Error metrics
  private errorCounter: Counter<string>;
  private errorRateGauge: Gauge<string>;

  // Resource metrics
  private cpuUsageGauge: Gauge<string>;
  private memoryUsageGauge: Gauge<string>;
  private memoryLimitGauge: Gauge<string>;
  private diskUsageGauge: Gauge<string>;

  // HTTP metrics
  private httpRequestDuration: Histogram<string>;
  private httpRequestTotal: Counter<string>;

  // Custom business metrics
  private customCounters: Map<string, Counter<string>>;
  private customGauges: Map<string, Gauge<string>>;
  private customHistograms: Map<string, Histogram<string>>;

  constructor(serviceName: string = 'vitalcv') {
    this.registry = new Registry();

    // Collect default Node.js metrics
    collectDefaultMetrics({ register: this.registry, prefix: `${serviceName}_` });

    // Queue metrics
    this.queueLengthGauge = new Gauge({
      name: `${serviceName}_queue_length`,
      help: 'Current length of the queue',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.queueProcessingGauge = new Gauge({
      name: `${serviceName}_queue_processing`,
      help: 'Number of items currently being processed',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.queueFailedCounter = new Counter({
      name: `${serviceName}_queue_failed_total`,
      help: 'Total number of failed queue items',
      labelNames: ['queue_name', 'error_type'],
      registers: [this.registry],
    });

    // Job metrics
    this.jobDurationHistogram = new Histogram({
      name: `${serviceName}_job_duration_seconds`,
      help: 'Duration of job execution in seconds',
      labelNames: ['job_type', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
      registers: [this.registry],
    });

    this.jobTotalCounter = new Counter({
      name: `${serviceName}_job_total`,
      help: 'Total number of jobs processed',
      labelNames: ['job_type', 'status'],
      registers: [this.registry],
    });

    // Error metrics
    this.errorCounter = new Counter({
      name: `${serviceName}_errors_total`,
      help: 'Total number of errors',
      labelNames: ['error_type', 'service'],
      registers: [this.registry],
    });

    this.errorRateGauge = new Gauge({
      name: `${serviceName}_error_rate`,
      help: 'Current error rate (errors per second)',
      labelNames: ['service'],
      registers: [this.registry],
    });

    // Resource metrics
    this.cpuUsageGauge = new Gauge({
      name: `${serviceName}_cpu_usage_percent`,
      help: 'CPU usage percentage',
      registers: [this.registry],
    });

    this.memoryUsageGauge = new Gauge({
      name: `${serviceName}_memory_usage_bytes`,
      help: 'Memory usage in bytes',
      registers: [this.registry],
    });

    this.memoryLimitGauge = new Gauge({
      name: `${serviceName}_memory_limit_bytes`,
      help: 'Memory limit in bytes',
      registers: [this.registry],
    });

    this.diskUsageGauge = new Gauge({
      name: `${serviceName}_disk_usage_bytes`,
      help: 'Disk usage in bytes',
      labelNames: ['path'],
      registers: [this.registry],
    });

    // HTTP metrics
    this.httpRequestDuration = new Histogram({
      name: `${serviceName}_http_request_duration_seconds`,
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.httpRequestTotal = new Counter({
      name: `${serviceName}_http_requests_total`,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // Custom metrics storage
    this.customCounters = new Map();
    this.customGauges = new Map();
    this.customHistograms = new Map();

    // Start resource monitoring
    this.startResourceMonitoring();
  }

  /**
   * Record queue metrics
   */
  recordQueueMetrics(metrics: QueueMetrics): void {
    this.queueLengthGauge.set({ queue_name: metrics.queueName }, metrics.length);
    this.queueProcessingGauge.set({ queue_name: metrics.queueName }, metrics.processing);
    if (metrics.failed > 0) {
      this.queueFailedCounter.inc(
        { queue_name: metrics.queueName, error_type: 'unknown' },
        metrics.failed,
      );
    }
  }

  /**
   * Record job metrics
   */
  recordJobMetrics(metrics: JobMetrics): void {
    this.jobDurationHistogram.observe(
      { job_type: metrics.jobType, status: metrics.status },
      metrics.duration / 1000, // Convert ms to seconds
    );
    this.jobTotalCounter.inc({ job_type: metrics.jobType, status: metrics.status });
  }

  /**
   * Record error metrics
   */
  recordError(service: string, errorType: string, count: number = 1): void {
    this.errorCounter.inc({ error_type: errorType, service }, count);
  }

  /**
   * Record resource metrics
   */
  recordResourceMetrics(metrics: ResourceMetrics): void {
    this.cpuUsageGauge.set(metrics.cpuUsage);
    this.memoryUsageGauge.set(metrics.memoryUsage);
    if (metrics.memoryLimit) {
      this.memoryLimitGauge.set(metrics.memoryLimit);
    }
    if (metrics.diskUsage) {
      this.diskUsageGauge.set({ path: '/' }, metrics.diskUsage);
    }
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.httpRequestDuration.observe(
      { method, route, status_code: statusCode.toString() },
      duration / 1000, // Convert ms to seconds
    );
    this.httpRequestTotal.inc({ method, route, status_code: statusCode.toString() });
  }

  /**
   * Create or get a custom counter
   */
  getCounter(name: string, help: string, labelNames: string[] = []): Counter<string> {
    if (!this.customCounters.has(name)) {
      const counter = new Counter({
        name,
        help,
        labelNames,
        registers: [this.registry],
      });
      this.customCounters.set(name, counter);
    }
    return this.customCounters.get(name)!;
  }

  /**
   * Create or get a custom gauge
   */
  getGauge(name: string, help: string, labelNames: string[] = []): Gauge<string> {
    if (!this.customGauges.has(name)) {
      const gauge = new Gauge({
        name,
        help,
        labelNames,
        registers: [this.registry],
      });
      this.customGauges.set(name, gauge);
    }
    return this.customGauges.get(name)!;
  }

  /**
   * Create or get a custom histogram
   */
  getHistogram(
    name: string,
    help: string,
    buckets: number[] = [0.1, 0.5, 1, 2, 5, 10],
    labelNames: string[] = [],
  ): Histogram<string> {
    if (!this.customHistograms.has(name)) {
      const histogram = new Histogram({
        name,
        help,
        buckets,
        labelNames,
        registers: [this.registry],
      });
      this.customHistograms.set(name, histogram);
    }
    return this.customHistograms.get(name)!;
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get registry
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Start monitoring system resources
   */
  private startResourceMonitoring(): void {
    setInterval(() => {
      try {
        const usage = process.cpuUsage();
        const memUsage = process.memoryUsage();

        // Calculate CPU usage (simplified)
        const cpuPercent = (usage.user + usage.system) / 1000000; // Convert to seconds

        this.recordResourceMetrics({
          cpuUsage: cpuPercent,
          memoryUsage: memUsage.heapUsed,
          memoryLimit: memUsage.heapTotal,
        });
      } catch (error) {
        // Silently fail resource monitoring
        console.error('[MetricsCollector] Error monitoring resources:', error);
      }
    }, 10000); // Update every 10 seconds
  }
}

/**
 * Decorator to automatically track function execution time and errors
 */
export function TrackMetrics(metricName: string, labels?: Record<string, string>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const collector = new MetricsCollector();
    const baseLabelNames = labels ? Object.keys(labels) : [];
    const counterLabelNames = baseLabelNames.includes('status')
      ? baseLabelNames
      : [...baseLabelNames, 'status'];

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const histogram = collector.getHistogram(
        `${metricName}_duration_seconds`,
        `Duration of ${metricName} in seconds`,
        [0.1, 0.5, 1, 2, 5, 10],
        baseLabelNames,
      );
      const counter = collector.getCounter(
        `${metricName}_total`,
        `Total number of ${metricName} executions`,
        counterLabelNames,
      );

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        histogram.observe(labels || {}, duration / 1000);
        counter.inc({ ...(labels ?? {}), status: 'success' });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        histogram.observe(labels || {}, duration / 1000);
        counter.inc({ ...(labels ?? {}), status: 'error' });

        collector.recordError(
          labels?.service || 'unknown',
          error instanceof Error ? error.constructor.name : 'UnknownError',
        );

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Express middleware for HTTP metrics
 */
export function metricsMiddleware(collector: MetricsCollector) {
  return (req: Request, res: Response, next: () => void) => {
    const startTime = Date.now();
    const route = req.route?.path || req.path;

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      collector.recordHttpRequest(req.method, route, res.statusCode, duration);
    });

    next();
  };
}

/**
 * Prometheus metrics endpoint handler
 */
export function metricsHandler(collector: MetricsCollector) {
  return async (req: Request, res: Response) => {
    try {
      const metrics = await collector.getMetrics();
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(metrics);
    } catch (error) {
      console.error('[MetricsCollector] Error generating metrics:', error);
      res.status(500).json({ error: 'Failed to generate metrics' });
    }
  };
}

// Singleton instance
let defaultCollector: MetricsCollector | null = null;

/**
 * Get or create default metrics collector
 */
export function getDefaultMetricsCollector(serviceName?: string): MetricsCollector {
  if (!defaultCollector) {
    defaultCollector = new MetricsCollector(serviceName);
  }
  return defaultCollector;
}

export default MetricsCollector;
