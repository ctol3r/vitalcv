/** YC MVP — behavior frozen. Do not modify without scope approval. */
export type LatencyPercentile = 'p50' | 'p90' | 'p99';

export type LatencyHistogramSnapshot = Readonly<{
  total_samples: number;
  p50_ms: number;
  p90_ms: number;
  p99_ms: number;
  bucket_counts: Readonly<Record<LatencyPercentile, number>>;
}>;

const DEFAULT_MAX_SAMPLES = 4096;

function normalizeLatency(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function percentileIndex(length: number, percentile: number): number {
  if (length <= 0) return 0;
  const rank = Math.ceil((percentile / 100) * length) - 1;
  return Math.min(length - 1, Math.max(0, rank));
}

function countAtMost(sorted: readonly number[], value: number): number {
  let low = 0;
  let high = sorted.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (sorted[middle] <= value) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

export class InMemoryLatencyHistogram {
  private readonly maxSamples: number;
  private readonly samples: number[] = [];

  constructor(maxSamples = DEFAULT_MAX_SAMPLES) {
    this.maxSamples = Number.isInteger(maxSamples) && maxSamples > 0 ? maxSamples : DEFAULT_MAX_SAMPLES;
  }

  record(latencyMs: number): LatencyHistogramSnapshot {
    const latency = normalizeLatency(latencyMs);
    this.samples.push(latency);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    return this.snapshot();
  }

  snapshot(): LatencyHistogramSnapshot {
    if (this.samples.length === 0) {
      return Object.freeze({
        total_samples: 0,
        p50_ms: 0,
        p90_ms: 0,
        p99_ms: 0,
        bucket_counts: Object.freeze({
          p50: 0,
          p90: 0,
          p99: 0,
        }),
      });
    }

    const sorted = [...this.samples].sort((left, right) => left - right);
    const p50_ms = sorted[percentileIndex(sorted.length, 50)];
    const p90_ms = sorted[percentileIndex(sorted.length, 90)];
    const p99_ms = sorted[percentileIndex(sorted.length, 99)];

    return Object.freeze({
      total_samples: sorted.length,
      p50_ms,
      p90_ms,
      p99_ms,
      bucket_counts: Object.freeze({
        p50: countAtMost(sorted, p50_ms),
        p90: countAtMost(sorted, p90_ms),
        p99: countAtMost(sorted, p99_ms),
      }),
    });
  }
}

export const trustStateLatencyHistogram = new InMemoryLatencyHistogram();
