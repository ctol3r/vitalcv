export interface ZkMetricSample {
  circuitType: string;
  mode: 'snark' | 'mock';
  provingTimeMs: number;
  circuitSize: number;
  constraintCount: number;
  depth: number;
  recordedAt: string;
}

export interface ZkMetricSummary {
  count: number;
  avgProvingTimeMs: number;
  avgConstraintCount: number;
  avgCircuitSize: number;
  snarkRatio: number;
  lastUpdated: string | null;
}

const MAX_SAMPLES = Number(process.env.ZK_METRIC_WINDOW ?? 200);
const samples: ZkMetricSample[] = [];

export function recordZkMetric(sample: ZkMetricSample) {
  samples.push(sample);
  if (samples.length > MAX_SAMPLES) {
    samples.shift();
  }
}

export function getZkMetricSummary(): ZkMetricSummary {
  if (!samples.length) {
    return {
      count: 0,
      avgProvingTimeMs: 0,
      avgConstraintCount: 0,
      avgCircuitSize: 0,
      snarkRatio: 0,
      lastUpdated: null,
    };
  }

  const totals = samples.reduce(
    (acc, sample) => {
      acc.provingTimeMs += sample.provingTimeMs;
      acc.constraintCount += sample.constraintCount;
      acc.circuitSize += sample.circuitSize;
      acc.snark += sample.mode === 'snark' ? 1 : 0;
      return acc;
    },
    { provingTimeMs: 0, constraintCount: 0, circuitSize: 0, snark: 0 },
  );

  return {
    count: samples.length,
    avgProvingTimeMs: Number((totals.provingTimeMs / samples.length).toFixed(1)),
    avgConstraintCount: Math.round(totals.constraintCount / samples.length),
    avgCircuitSize: Math.round(totals.circuitSize / samples.length),
    snarkRatio: Number((totals.snark / samples.length).toFixed(3)),
    lastUpdated: samples[samples.length - 1]?.recordedAt ?? null,
  };
}


