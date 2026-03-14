import { log } from '../../obs/logger';

type PilotLatencyMetricName =
  | 'trust_state_latency'
  | 'resolver_runtime'
  | 'widget_pas_generation_time';

type CacheMetricSource = 'trust_state_route' | 'widget_pas';

type LatencyHistogramBucket = Readonly<{
  le_ms: number | null;
  count: number;
}>;

export type PilotLatencyMetricSnapshot = Readonly<{
  total_samples: number;
  avg_ms: number;
  min_ms: number;
  max_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  histogram: readonly LatencyHistogramBucket[];
}>;

export type PilotCacheRatioSnapshot = Readonly<{
  hits: number;
  misses: number;
  lookups: number;
  hit_ratio: number;
}>;

export type PilotTelemetryDashboard = Readonly<{
  schema_version: 'pilot-telemetry.v1';
  generated_at: string;
  dashboard: {
    p95_trust_state_latency_ms: number;
    cache_hit_ratio: number;
    p95_widget_verification_latency_ms: number;
  };
  metrics: {
    trust_state_latency: PilotLatencyMetricSnapshot;
    cache_hit_ratio: {
      overall: PilotCacheRatioSnapshot;
      by_source: Record<CacheMetricSource, PilotCacheRatioSnapshot>;
    };
    resolver_runtime: PilotLatencyMetricSnapshot;
    widget_pas_generation_time: PilotLatencyMetricSnapshot;
  };
}>;

type RecordLatencyOptions = {
  metricName: PilotLatencyMetricName;
  latencyMs: number;
  context: Record<string, unknown>;
};

type RecordCacheLookupOptions = {
  source: CacheMetricSource;
  hit: boolean;
  context?: Record<string, unknown>;
};

type RecordResolverRuntimeOptions = {
  latencyMs: number;
  band: 'GREEN' | 'YELLOW' | 'RED';
  blockingReasonCount: number;
  startReady: boolean;
};

const MAX_SAMPLES = 2048;
const LATENCY_BUCKET_BOUNDS_MS = [25, 50, 100, 250, 500, 1_000, 2_500, 5_000] as const;

function normalizeLatency(latencyMs: number): number {
  if (!Number.isFinite(latencyMs) || latencyMs < 0) {
    return 0;
  }

  return Number(latencyMs.toFixed(2));
}

function roundMetric(value: number): number {
  return Number(value.toFixed(2));
}

function percentileIndex(length: number, percentile: number): number {
  if (length <= 0) {
    return 0;
  }

  const rank = Math.ceil((percentile / 100) * length) - 1;
  return Math.min(length - 1, Math.max(0, rank));
}

class RollingLatencyHistogram {
  private readonly samples: number[] = [];

  record(latencyMs: number): PilotLatencyMetricSnapshot {
    this.samples.push(normalizeLatency(latencyMs));
    if (this.samples.length > MAX_SAMPLES) {
      this.samples.shift();
    }

    return this.snapshot();
  }

  snapshot(): PilotLatencyMetricSnapshot {
    if (this.samples.length === 0) {
      return Object.freeze({
        total_samples: 0,
        avg_ms: 0,
        min_ms: 0,
        max_ms: 0,
        p50_ms: 0,
        p95_ms: 0,
        p99_ms: 0,
        histogram: Object.freeze(
          [...LATENCY_BUCKET_BOUNDS_MS, null].map((bound) =>
            Object.freeze({ le_ms: bound, count: 0 }),
          ),
        ),
      });
    }

    const sorted = [...this.samples].sort((left, right) => left - right);
    const totalLatency = sorted.reduce((sum, sample) => sum + sample, 0);

    return Object.freeze({
      total_samples: sorted.length,
      avg_ms: roundMetric(totalLatency / sorted.length),
      min_ms: sorted[0],
      max_ms: sorted[sorted.length - 1],
      p50_ms: sorted[percentileIndex(sorted.length, 50)],
      p95_ms: sorted[percentileIndex(sorted.length, 95)],
      p99_ms: sorted[percentileIndex(sorted.length, 99)],
      histogram: Object.freeze(this.buildHistogram(sorted)),
    });
  }

  reset(): void {
    this.samples.length = 0;
  }

  private buildHistogram(sorted: readonly number[]): readonly LatencyHistogramBucket[] {
    return [...LATENCY_BUCKET_BOUNDS_MS, null].map((bound) =>
      Object.freeze({
        le_ms: bound,
        count:
          bound === null
            ? sorted.filter((sample) => sample > LATENCY_BUCKET_BOUNDS_MS[LATENCY_BUCKET_BOUNDS_MS.length - 1]).length
            : sorted.filter((sample) => sample <= bound).length,
      }),
    );
  }
}

class CacheRatioSeries {
  private hits = 0;
  private misses = 0;

  record(hit: boolean): PilotCacheRatioSnapshot {
    if (hit) {
      this.hits += 1;
    } else {
      this.misses += 1;
    }

    return this.snapshot();
  }

  snapshot(): PilotCacheRatioSnapshot {
    const lookups = this.hits + this.misses;
    return Object.freeze({
      hits: this.hits,
      misses: this.misses,
      lookups,
      hit_ratio: lookups === 0 ? 0 : roundMetric(this.hits / lookups),
    });
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
  }
}

const latencyMetrics: Record<PilotLatencyMetricName, RollingLatencyHistogram> = {
  trust_state_latency: new RollingLatencyHistogram(),
  resolver_runtime: new RollingLatencyHistogram(),
  widget_pas_generation_time: new RollingLatencyHistogram(),
};

const cacheMetrics: Record<'overall' | CacheMetricSource, CacheRatioSeries> = {
  overall: new CacheRatioSeries(),
  trust_state_route: new CacheRatioSeries(),
  widget_pas: new CacheRatioSeries(),
};

function recordLatency({ metricName, latencyMs, context }: RecordLatencyOptions): void {
  const snapshot = latencyMetrics[metricName].record(latencyMs);
  log('info', 'pilot_metric_recorded', {
    event: 'pilot_metric_recorded',
    metric_name: metricName,
    metric_type: 'latency_histogram',
    unit: 'ms',
    value: normalizeLatency(latencyMs),
    p95_ms: snapshot.p95_ms,
    total_samples: snapshot.total_samples,
    ...context,
  });
}

export function recordTrustStateLatency(options: {
  latencyMs: number;
  cacheStatus: 'hit' | 'miss' | 'unknown';
  outcome: 'success' | 'error';
}): void {
  recordLatency({
    metricName: 'trust_state_latency',
    latencyMs: options.latencyMs,
    context: {
      component: 'GET /api/trust-state/:npi',
      cache_status: options.cacheStatus,
      outcome: options.outcome,
    },
  });
}

export function recordWidgetPasGenerationTime(options: {
  latencyMs: number;
  cacheStatus: 'hit' | 'miss' | 'unknown';
  outcome: 'success' | 'fallback';
}): void {
  recordLatency({
    metricName: 'widget_pas_generation_time',
    latencyMs: options.latencyMs,
    context: {
      component: 'buildLivePas',
      cache_status: options.cacheStatus,
      outcome: options.outcome,
    },
  });
}

export function recordResolverRuntime(options: RecordResolverRuntimeOptions): void {
  recordLatency({
    metricName: 'resolver_runtime',
    latencyMs: options.latencyMs,
    context: {
      component: 'TrustStateResolver.resolve',
      band: options.band,
      blocking_reason_count: options.blockingReasonCount,
      start_ready: options.startReady,
    },
  });
}

export function recordCacheLookup(options: RecordCacheLookupOptions): void {
  const sourceSnapshot = cacheMetrics[options.source].record(options.hit);
  const overallSnapshot = cacheMetrics.overall.record(options.hit);

  log('info', 'pilot_metric_recorded', {
    event: 'pilot_metric_recorded',
    metric_name: 'cache_hit_ratio',
    metric_type: 'ratio',
    source: options.source,
    cache_hit: options.hit,
    source_hit_ratio: sourceSnapshot.hit_ratio,
    overall_hit_ratio: overallSnapshot.hit_ratio,
    ...options.context,
  });
}

export function getPilotTelemetryDashboard(): PilotTelemetryDashboard {
  const trustStateLatency = latencyMetrics.trust_state_latency.snapshot();
  const widgetLatency = latencyMetrics.widget_pas_generation_time.snapshot();

  return Object.freeze({
    schema_version: 'pilot-telemetry.v1',
    generated_at: new Date().toISOString(),
    dashboard: {
      p95_trust_state_latency_ms: trustStateLatency.p95_ms,
      cache_hit_ratio: cacheMetrics.overall.snapshot().hit_ratio,
      p95_widget_verification_latency_ms: widgetLatency.p95_ms,
    },
    metrics: {
      trust_state_latency: trustStateLatency,
      cache_hit_ratio: {
        overall: cacheMetrics.overall.snapshot(),
        by_source: {
          trust_state_route: cacheMetrics.trust_state_route.snapshot(),
          widget_pas: cacheMetrics.widget_pas.snapshot(),
        },
      },
      resolver_runtime: latencyMetrics.resolver_runtime.snapshot(),
      widget_pas_generation_time: widgetLatency,
    },
  });
}

export function resetPilotTelemetry(): void {
  for (const histogram of Object.values(latencyMetrics)) {
    histogram.reset();
  }

  for (const series of Object.values(cacheMetrics)) {
    series.reset();
  }
}
