import { createPerformanceFinding, type PerformanceWatchFinding } from '../../../../../core/qa/types';

type NumericSnapshot = {
  count: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
};

type GraphTelemetry = {
  nodeCount: number;
  edgeCount: number;
  estimatedRenderMs: number;
  density: number;
  clusteringRecommended: boolean;
  recommendedNodeBudget: number;
};

class RollingSeries {
  private readonly samples: number[] = [];

  constructor(private readonly maxSize: number) {}

  record(value: number): void {
    if (!Number.isFinite(value) || value < 0) {
      return;
    }

    this.samples.push(Number(value.toFixed(2)));
    if (this.samples.length > this.maxSize) {
      this.samples.shift();
    }
  }

  snapshot(): NumericSnapshot {
    if (this.samples.length === 0) {
      return {
        count: 0,
        avgMs: 0,
        p95Ms: 0,
        maxMs: 0,
      };
    }

    const sorted = [...this.samples].sort((left, right) => left - right);
    const total = sorted.reduce((sum, sample) => sum + sample, 0);
    const p95Index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));

    return {
      count: sorted.length,
      avgMs: Number((total / sorted.length).toFixed(2)),
      p95Ms: sorted[p95Index] ?? 0,
      maxMs: sorted[sorted.length - 1] ?? 0,
    };
  }

  reset(): void {
    this.samples.length = 0;
  }
}

const WINDOW_SIZE = 128;
const BASELINE_ALPHA = 0.2;

const apiOverallSeries = new RollingSeries(WINDOW_SIZE);
const copilotSeries = new RollingSeries(WINDOW_SIZE);
const graphSeries = new RollingSeries(WINDOW_SIZE);
const querySeries = new RollingSeries(WINDOW_SIZE);

const apiByRoute = new Map<string, RollingSeries>();
const queryByKey = new Map<string, RollingSeries>();
const queryTimestamps: number[] = [];
const baselines = new Map<string, number>();

function getOrCreateSeries(bucket: Map<string, RollingSeries>, key: string): RollingSeries {
  const existing = bucket.get(key);
  if (existing) {
    return existing;
  }

  const created = new RollingSeries(WINDOW_SIZE);
  bucket.set(key, created);
  return created;
}

function updateBaseline(key: string, value: number): number {
  const previous = baselines.get(key);
  const next = previous === undefined
    ? value
    : Number(((previous * (1 - BASELINE_ALPHA)) + (value * BASELINE_ALPHA)).toFixed(2));
  baselines.set(key, next);
  return previous ?? value;
}

export function recordApiLatencySample(input: {
  routeKey: string;
  latencyMs: number;
  statusCode: number;
}): void {
  apiOverallSeries.record(input.latencyMs);
  getOrCreateSeries(apiByRoute, input.routeKey).record(input.latencyMs);
}

export function recordDatabaseQuerySample(input: {
  model: string;
  action: string;
  durationMs: number;
}): void {
  querySeries.record(input.durationMs);
  getOrCreateSeries(queryByKey, `${input.model}.${input.action}`).record(input.durationMs);
  queryTimestamps.push(Date.now());
  while (queryTimestamps.length > 0 && (Date.now() - queryTimestamps[0]!) > 60_000) {
    queryTimestamps.shift();
  }
}

export function recordGraphRenderSample(input: {
  operation: string;
  latencyMs: number;
  nodeCount?: number;
  edgeCount?: number;
}): void {
  graphSeries.record(input.latencyMs);
}

export function recordCopilotResponseSample(input: {
  latencyMs: number;
  resultCount: number;
}): void {
  copilotSeries.record(input.latencyMs);
}

export function resetPerformanceWatchers(): void {
  apiOverallSeries.reset();
  copilotSeries.reset();
  graphSeries.reset();
  querySeries.reset();
  apiByRoute.clear();
  queryByKey.clear();
  queryTimestamps.length = 0;
  baselines.clear();
}

export function evaluatePerformanceWatchers(options?: {
  graphTelemetry?: GraphTelemetry;
}): {
  findings: PerformanceWatchFinding[];
} {
  const findings: PerformanceWatchFinding[] = [];

  const apiSnapshot = apiOverallSeries.snapshot();
  if (apiSnapshot.count >= 10) {
    const baseline = updateBaseline('api.overall.avg', apiSnapshot.avgMs);
    if (apiSnapshot.p95Ms > Math.max(750, baseline * 1.5)) {
      findings.push(
        createPerformanceFinding({
          code: 'api_latency_regression',
          severity: 'warning',
          metric: 'API_LATENCY',
          summary: `API latency regressed to p95 ${apiSnapshot.p95Ms}ms (baseline ${baseline}ms).`,
          metadata: {
            snapshot: apiSnapshot,
            baseline,
          },
        }),
      );
    }
  }

  for (const [routeKey, series] of apiByRoute.entries()) {
    const snapshot = series.snapshot();
    if (snapshot.count >= 5 && snapshot.p95Ms > 1_000) {
      findings.push(
        createPerformanceFinding({
          code: 'slow_api_route',
          severity: 'warning',
          metric: 'API_LATENCY',
          summary: `Route ${routeKey} reached p95 latency ${snapshot.p95Ms}ms.`,
          metadata: {
            snapshot,
          },
        }),
      );
    }
  }

  const querySnapshot = querySeries.snapshot();
  if (querySnapshot.count >= 10) {
    const baseline = updateBaseline('db.query.avg', querySnapshot.avgMs);
    if (querySnapshot.p95Ms > Math.max(250, baseline * 1.5)) {
      findings.push(
        createPerformanceFinding({
          code: 'query_latency_regression',
          severity: 'warning',
          metric: 'QUERY_LATENCY',
          summary: `Database query latency regressed to p95 ${querySnapshot.p95Ms}ms (baseline ${baseline}ms).`,
          metadata: {
            snapshot: querySnapshot,
            baseline,
          },
        }),
      );
    }
  }

  for (const [queryKey, series] of queryByKey.entries()) {
    const snapshot = series.snapshot();
    if (snapshot.count >= 3 && snapshot.p95Ms > 400) {
      findings.push(
        createPerformanceFinding({
          code: 'slow_query_family',
          severity: 'warning',
          metric: 'QUERY_LATENCY',
          summary: `Query family ${queryKey} reached p95 latency ${snapshot.p95Ms}ms.`,
          metadata: {
            snapshot,
          },
        }),
      );
    }
  }

  if (queryTimestamps.length > 250) {
    findings.push(
      createPerformanceFinding({
        code: 'high_query_load',
        severity: 'warning',
        metric: 'QUERY_LOAD',
        summary: `Database query load reached ${queryTimestamps.length} queries in the last minute.`,
        metadata: {
          queriesLastMinute: queryTimestamps.length,
        },
      }),
    );
  }

  const graphSnapshot = graphSeries.snapshot();
  if (graphSnapshot.count >= 3 && graphSnapshot.p95Ms > 600) {
    findings.push(
      createPerformanceFinding({
        code: 'graph_render_latency',
        severity: 'warning',
        metric: 'GRAPH_RENDER',
        summary: `Graph render preparation reached p95 latency ${graphSnapshot.p95Ms}ms.`,
        metadata: {
          snapshot: graphSnapshot,
        },
      }),
    );
  }

  if (
    options?.graphTelemetry
    && options.graphTelemetry.clusteringRecommended
    && options.graphTelemetry.estimatedRenderMs > 250
  ) {
    findings.push(
      createPerformanceFinding({
        code: 'graph_traversal_inefficiency',
        severity: 'warning',
        metric: 'GRAPH_RENDER',
        summary: 'Graph render telemetry indicates inefficient traversal or excessive node fan-out.',
        metadata: options.graphTelemetry,
      }),
    );
  }

  const copilotSnapshot = copilotSeries.snapshot();
  if (copilotSnapshot.count >= 3) {
    const baseline = updateBaseline('copilot.avg', copilotSnapshot.avgMs);
    if (copilotSnapshot.p95Ms > Math.max(1_200, baseline * 1.5)) {
      findings.push(
        createPerformanceFinding({
          code: 'copilot_latency_regression',
          severity: 'warning',
          metric: 'COPILOT_RESPONSE',
          summary: `Copilot response latency regressed to p95 ${copilotSnapshot.p95Ms}ms (baseline ${baseline}ms).`,
          metadata: {
            snapshot: copilotSnapshot,
            baseline,
          },
        }),
      );
    }
  }

  return { findings };
}

