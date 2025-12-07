import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export interface MetricsRegistryOptions {
  serviceName: string;
  enableDefaultMetrics?: boolean;
  defaultLabels?: Record<string, string>;
  registry?: Registry;
}

export function createMetricsRegistry(options: MetricsRegistryOptions): Registry {
  const registry = options.registry ?? new Registry();
  const defaultLabels = {
    service: options.serviceName,
    ...(options.defaultLabels ?? {}),
  };
  registry.setDefaultLabels(defaultLabels);

  if (options.enableDefaultMetrics ?? true) {
    collectDefaultMetrics({ register: registry });
  }

  return registry;
}

export interface Timer {
  end(): number;
}

export function createTimer(): Timer {
  const start = process.hrtime.bigint();
  return {
    end(): number {
      const durationNs = process.hrtime.bigint() - start;
      return Number(durationNs) / 1_000_000_000;
    },
  };
}

function metricName(namespace: string, name: string): string {
  return `${namespace}_${name}`
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/__+/g, '_')
    .toLowerCase();
}

const MONITORED_JOB_TYPES = [
  'NCI_PUBLISH_PROOFS',
  'FUSION_UPDATE',
  'SAFETY_SWEEP',
  'MOBILITY_EVALUATE_ORG',
] as const;

export interface QueueMetrics {
  depth: Gauge<'queue_name'>;
  processingDuration: Histogram<'queue_name'>;
  processingFailures: Counter<'queue_name' | 'reason'>;
  latencySeconds: Gauge<string>;
  jobDispatch: Counter<'job_type'>;
  jobDispatchHandles: Record<
    (typeof MONITORED_JOB_TYPES)[number],
    ReturnType<Counter<'job_type'>['labels']>
  >;
}

export function createQueueMetrics(namespace: string, register?: Registry): QueueMetrics {
  const registry =
    register ??
    createMetricsRegistry({
      serviceName: namespace,
      enableDefaultMetrics: false,
    });

  const depth = new Gauge({
    name: metricName(namespace, 'queue_depth'),
    help: 'Queue depth by queue name',
    labelNames: ['queue_name'] as const,
    registers: [registry],
  });

  const processingDuration = new Histogram({
    name: metricName(namespace, 'job_duration_seconds'),
    help: 'Duration to process queue jobs',
    labelNames: ['queue_name'] as const,
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    registers: [registry],
  });

  const processingFailures = new Counter({
    name: metricName(namespace, 'job_failures_total'),
    help: 'Queue job failures by queue and reason',
    labelNames: ['queue_name', 'reason'] as const,
    registers: [registry],
  });

  const latencySeconds = new Gauge({
    name: metricName(namespace, 'job_latency_seconds'),
    help: 'Moving average of queue job latency in seconds',
    registers: [registry],
  });

  const jobDispatch = new Counter({
    name: metricName(namespace, 'job_dispatch_total'),
    help: 'Dispatch counts for monitored queue jobs',
    labelNames: ['job_type'] as const,
    registers: [registry],
  });

  type DispatchHandle = ReturnType<typeof jobDispatch.labels>;

  const jobDispatchHandles = MONITORED_JOB_TYPES.reduce<Record<string, DispatchHandle>>(
    (acc, jobType) => {
      acc[jobType] = jobDispatch.labels(jobType);
      return acc;
    },
    {},
  );

  return {
    depth,
    processingDuration,
    processingFailures,
    latencySeconds,
    jobDispatch,
    jobDispatchHandles: jobDispatchHandles as Record<
      (typeof MONITORED_JOB_TYPES)[number],
      DispatchHandle
    >,
  };
}

export interface MetricEvent {
  name: string;
  labels: Record<string, string | number | boolean>;
  timestamp: Date;
}

export type MetricEmitter = (event: MetricEvent) => void | Promise<void>;

let metricEmitter: MetricEmitter | null = null;

export function configureMetricEmitter(emitter: MetricEmitter | null): void {
  metricEmitter = emitter;
}

export function getMetricEmitter(): MetricEmitter | null {
  return metricEmitter;
}

export async function emitMetric(
  name: string,
  labels: Record<string, string | number | boolean> = {},
): Promise<void> {
  const event: MetricEvent = {
    name,
    labels,
    timestamp: new Date(),
  };

  if (metricEmitter) {
    await metricEmitter(event);
    return;
  }

  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.debug('[metric]', event.name, event.labels);
  }
}

export type { Registry } from 'prom-client';
export type MetricValue = string | number | boolean | null | undefined;
export type MetricAttributes = Record<string, MetricValue>;

/**
 * Lightweight metric emitter used by shared packages.
 * In production this should fan out to OTLP, StatsD, etc.
 */
export async function emitMetric(
  name: string,
  attributes: MetricAttributes = {}
): Promise<void> {
  if (process.env.METRICS_DEBUG === '1') {
    // eslint-disable-next-line no-console
    console.debug(`[metrics] ${name}`, attributes);
  }
}

export type MetricPrimitive = string | number | boolean | undefined;

export interface MetricLabels {
  [key: string]: MetricPrimitive;
}

export interface MetricEvent {
  name: string;
  value?: number;
  labels?: MetricLabels;
  timestamp?: number;
}

export interface MetricsCollector {
  record(event: MetricEvent): Promise<void> | void;
}

class ConsoleMetricsCollector implements MetricsCollector {
  async record(event: MetricEvent): Promise<void> {
    const { name, value, labels, timestamp } = event;
    const payload = {
      value,
      labels,
      timestamp: timestamp ?? Date.now(),
    };
    // eslint-disable-next-line no-console
    console.debug(`[metrics] ${name}`, payload);
  }
}

let activeCollector: MetricsCollector = new ConsoleMetricsCollector();

export function setMetricsCollector(collector: MetricsCollector): void {
  activeCollector = collector;
}

export function getMetricsCollector(): MetricsCollector {
  return activeCollector;
}

/**
 * Emit a metric event via the active collector.
 */
export async function emitMetric(
  name: string,
  labels?: MetricLabels,
  value = 1,
  timestamp = Date.now()
): Promise<void> {
  await activeCollector.record({ name, labels, value, timestamp });
}

/**
 * Helper to time an async function and emit metrics for success/failure.
 */
export async function timeMetric<T>(
  name: string,
  labels: MetricLabels | undefined,
  fn: () => Promise<T> | T
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    await emitMetric(name, { ...labels, status: 'success', durationMs: Date.now() - start });
    return result;
  } catch (error) {
    await emitMetric(name, {
      ...labels,
      status: 'error',
      durationMs: Date.now() - start,
      reason: error instanceof Error ? error.message : 'unknown',
    });
    throw error;
  }
}
import type { NextFunction, Request, Response } from 'express';
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Summary
} from 'prom-client';
import type {
  CounterConfiguration,
  HistogramConfiguration,
  SummaryConfiguration
} from 'prom-client';

export interface MetricsConfig {
  serviceName: string;
  enableDefaultMetrics?: boolean;
  defaultMetricsInterval?: number;
  defaultLabels?: Record<string, string>;
}

export interface MetricsInitOptions extends MetricsConfig {
  app?: MetricsEndpointTarget;
  endpoint?: string;
}

export interface MetricsEndpointTarget {
  get(path: string, handler: (req: Request, res: Response) => void | Promise<void>): unknown;
}

export interface CounterFactoryConfig<T extends string> extends CounterConfiguration<T> {
  registers?: Registry[];
}

export interface HistogramFactoryConfig<T extends string> extends HistogramConfiguration<T> {
  registers?: Registry[];
}

export interface SummaryFactoryConfig<T extends string> extends SummaryConfiguration<T> {
  registers?: Registry[];
}

const DEFAULT_HTTP_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.5, 1, 5, 10];
const DEFAULT_QUEUE_BUCKETS = [0.1, 0.5, 1, 5, 10, 30, 60, 300];

/**
 * Initialize metrics for a service and optionally register the /metrics endpoint.
 */
export function initMetrics(options: MetricsInitOptions): Registry {
  const register = createMetricsRegistry(options);

  if (options.app) {
    registerMetricsEndpoint(options.app, register, options.endpoint);
  }

  return register;
}

/**
 * Creates a Prometheus registry with default configuration and labels.
 */
export function createMetricsRegistry(config: MetricsConfig): Registry {
  const register = new Registry();
  const defaultLabels = {
    service: config.serviceName,
    ...(config.defaultLabels || {})
  };

  register.setDefaultLabels(defaultLabels);

  if (config.enableDefaultMetrics !== false) {
    collectDefaultMetrics({
      register,
      prefix: `${config.serviceName}_`,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
      eventLoopMonitoringPrecision: 10,
      timeout: config.defaultMetricsInterval
    });
  }

  return register;
}

/**
 * Helper factories for counters, histograms, and summaries that automatically attach to a registry.
 */
export function createCounterMetric<T extends string>(
  register: Registry,
  config: CounterFactoryConfig<T>
): Counter<T> {
  return new Counter({
    ...config,
    registers: config.registers ?? [register]
  });
}

export function createHistogramMetric<T extends string>(
  register: Registry,
  config: HistogramFactoryConfig<T>
): Histogram<T> {
  return new Histogram({
    ...config,
    registers: config.registers ?? [register]
  });
}

export function createSummaryMetric<T extends string>(
  register: Registry,
  config: SummaryFactoryConfig<T>
): Summary<T> {
  return new Summary({
    ...config,
    registers: config.registers ?? [register]
  });
}

/**
 * HTTP metrics definition shared by API services.
 */
export interface HttpMetrics {
  requestsTotal: Counter<string>;
  requestDuration: Histogram<string>;
  requestSizeBytes: Histogram<string>;
  responseSizeBytes: Histogram<string>;
}

export interface HttpMetricsMiddlewareOptions {
  ignoredPaths?: Array<RegExp | string>;
  normalizeRoutes?: boolean;
}

const DEFAULT_IGNORED_PATHS = [/^\/health/i, /^\/metrics/i];

export function createHttpMetrics(serviceName: string, register: Registry): HttpMetrics {
  return {
    requestsTotal: createCounterMetric(register, {
      name: `${serviceName}_http_requests_total`,
      help: `Total HTTP requests received by ${serviceName}`,
      labelNames: ['method', 'route', 'status']
    }),
    requestDuration: createHistogramMetric(register, {
      name: `${serviceName}_http_request_duration_seconds`,
      help: `HTTP request duration in seconds for ${serviceName}`,
      labelNames: ['method', 'route', 'status'],
      buckets: DEFAULT_HTTP_BUCKETS
    }),
    requestSizeBytes: createHistogramMetric(register, {
      name: `${serviceName}_http_request_size_bytes`,
      help: `HTTP request size in bytes for ${serviceName}`,
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 10000, 100000, 1000000, 10000000]
    }),
    responseSizeBytes: createHistogramMetric(register, {
      name: `${serviceName}_http_response_size_bytes`,
      help: `HTTP response size in bytes for ${serviceName}`,
      labelNames: ['method', 'route', 'status'],
      buckets: [100, 1000, 10000, 100000, 1000000, 10000000]
    })
  };
}

/**
 * Express middleware that records HTTP metrics for every request.
 */
export function httpMetricsMiddleware(metrics: HttpMetrics, options?: HttpMetricsMiddlewareOptions) {
  const ignoredPaths = options?.ignoredPaths ?? DEFAULT_IGNORED_PATHS;
  const normalizeRoutes = options?.normalizeRoutes !== false;

  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path || req.originalUrl || '';
    if (shouldIgnorePath(path, ignoredPaths)) {
      return next();
    }

    const start = process.hrtime.bigint();
    const reqSize = parseInt(req.get('content-length') || '0', 10);

    res.once('finish', () => {
      const durationNs = process.hrtime.bigint() - start;
      const durationSeconds = Number(durationNs) / 1e9;
      const status = res.statusCode.toString();
      const method = req.method;
      const rawRoute =
        req.route?.path ||
        req.baseUrl ||
        req.originalUrl?.split('?')[0] ||
        req.path ||
        'unknown';
      const route = normalizeRoutes ? normalizeRouteName(rawRoute) : rawRoute;
      const resSize = parseInt(res.get('content-length') || '0', 10);

      metrics.requestsTotal.labels(method, route, status).inc();
      metrics.requestDuration.labels(method, route, status).observe(durationSeconds);

      if (reqSize > 0) {
        metrics.requestSizeBytes.labels(method, route).observe(reqSize);
      }

      if (resSize > 0) {
        metrics.responseSizeBytes.labels(method, route, status).observe(resSize);
      }
    });

    next();
  };
}

function shouldIgnorePath(path: string, ignoredPaths: Array<RegExp | string>): boolean {
  return ignoredPaths.some((entry) => {
    if (entry instanceof RegExp) {
      return entry.test(path);
    }

    return path.startsWith(entry);
  });
}

/**
 * Queue metrics definition for worker processes.
 */
export interface QueueMetrics {
  depth: Gauge<string>;
  processingDuration: Histogram<string>;
  processingFailures: Counter<string>;
}

export function createQueueMetrics(serviceName: string, register: Registry): QueueMetrics {
  return {
    depth: new Gauge({
      name: `${serviceName}_queue_depth`,
      help: `Current depth of queue in ${serviceName}`,
      labelNames: ['queue_name'],
      registers: [register]
    }),
    processingDuration: createHistogramMetric(register, {
      name: `${serviceName}_queue_processing_duration_seconds`,
      help: `Queue processing duration in seconds for ${serviceName}`,
      labelNames: ['queue_name'],
      buckets: DEFAULT_QUEUE_BUCKETS
    }),
    processingFailures: createCounterMetric(register, {
      name: `${serviceName}_queue_processing_failures_total`,
      help: `Total queue processing failures in ${serviceName}`,
      labelNames: ['queue_name', 'reason']
    })
  };
}

/**
 * Expose an Express handler compatible with Prometheus scrapes.
 */
export function metricsEndpoint(register: Registry) {
  return async (_req: Request, res: Response) => {
    try {
      res.set('Content-Type', register.contentType);
      const metrics = await register.metrics();
      res.end(metrics);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'metrics_error';
      res.status(500).end(message);
    }
  };
}

export function registerMetricsEndpoint(
  app: MetricsEndpointTarget,
  register: Registry,
  path = '/metrics'
): void {
  app.get(path, metricsEndpoint(register));
}

export interface MetricsTimer {
  end: () => number;
}

export function createTimer(): MetricsTimer {
  const start = process.hrtime.bigint();
  return {
    end: () => {
      const diff = process.hrtime.bigint() - start;
      return Number(diff) / 1e9;
    }
  };
}

export function normalizeRouteName(path?: string | null): string {
  if (!path) {
    return 'unknown';
  }

  return path
    .split('?')[0]
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
    .replace(/\/[0-9a-f]{64}/gi, '/:hash')
    .replace(/\/[0-9a-f]{40}/gi, '/:hash40');
}

export function getStatusCategory(status: number): string {
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 300 && status < 400) return '3xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500 && status < 600) return '5xx';
  return 'unknown';
}

export default {
  initMetrics,
  createMetricsRegistry,
  createCounterMetric,
  createHistogramMetric,
  createSummaryMetric,
  createHttpMetrics,
  httpMetricsMiddleware,
  createQueueMetrics,
  metricsEndpoint,
  registerMetricsEndpoint,
  createTimer,
  normalizeRouteName,
  getStatusCategory
};

export {
  Registry,
  Counter,
  Gauge,
  Histogram,
  Summary
};


