export type RequestLatencySnapshot = Readonly<{
  total_requests: number;
  error_requests: number;
  avg_latency_ms: number;
  p90_latency_ms: number;
  max_latency_ms: number;
}>;

const MAX_SAMPLES = 2048;

function percentile(values: readonly number[], pct: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

export class RequestLatencyMetrics {
  private totalRequests = 0;
  private errorRequests = 0;
  private maxLatencyMs = 0;
  private readonly samples: number[] = [];

  record(latencyMs: number, statusCode: number): void {
    const normalizedLatency = Number.isFinite(latencyMs) && latencyMs >= 0 ? latencyMs : 0;

    this.totalRequests += 1;
    if (statusCode >= 500) {
      this.errorRequests += 1;
    }

    if (normalizedLatency > this.maxLatencyMs) {
      this.maxLatencyMs = normalizedLatency;
    }

    this.samples.push(normalizedLatency);
    if (this.samples.length > MAX_SAMPLES) {
      this.samples.shift();
    }
  }

  snapshot(): RequestLatencySnapshot {
    const sampleCount = this.samples.length;
    const totalLatency = this.samples.reduce((sum, value) => sum + value, 0);
    const avgLatencyMs = sampleCount > 0 ? totalLatency / sampleCount : 0;

    return Object.freeze({
      total_requests: this.totalRequests,
      error_requests: this.errorRequests,
      avg_latency_ms: Number(avgLatencyMs.toFixed(2)),
      p90_latency_ms: Number(percentile(this.samples, 90).toFixed(2)),
      max_latency_ms: Number(this.maxLatencyMs.toFixed(2)),
    });
  }
}

export const requestLatencyMetrics = new RequestLatencyMetrics();
