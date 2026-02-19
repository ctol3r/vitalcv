/**
 * Performance Metrics — Wave M
 *
 * Rolling average tracker for key operation latencies.
 * Keeps the last 100 measurements per operation type.
 * No external dependency — pure in-memory ring buffer.
 */

const WINDOW_SIZE = 100;

type OperationType = 'proof' | 'vc_issuance' | 'status_check';

const buffers: Record<OperationType, number[]> = {
  proof: [],
  vc_issuance: [],
  status_check: [],
};

const cursors: Record<OperationType, number> = {
  proof: 0,
  vc_issuance: 0,
  status_check: 0,
};

const counts: Record<OperationType, number> = {
  proof: 0,
  vc_issuance: 0,
  status_check: 0,
};

/**
 * Record a latency measurement for an operation type.
 * @param operation - The operation category
 * @param durationMs - The measured latency in milliseconds
 */
export function recordLatency(operation: OperationType, durationMs: number): void {
  const buffer = buffers[operation];
  const cursor = cursors[operation];

  if (buffer.length < WINDOW_SIZE) {
    buffer.push(durationMs);
  } else {
    buffer[cursor % WINDOW_SIZE] = durationMs;
  }

  cursors[operation] = cursor + 1;
  counts[operation] = counts[operation] + 1;
}

function computeAverage(operation: OperationType): number {
  const buffer = buffers[operation];
  if (buffer.length === 0) return 0;

  const sum = buffer.reduce((acc, val) => acc + val, 0);
  return Number((sum / buffer.length).toFixed(2));
}

export type PerformanceSnapshot = {
  avgProofTimeMs: number;
  avgVCIssuanceTimeMs: number;
  avgStatusCheckTimeMs: number;
  sampleCounts: {
    proof: number;
    vc_issuance: number;
    status_check: number;
  };
};

/**
 * Get a snapshot of rolling average latencies across all operation types.
 */
export function getPerformanceSnapshot(): PerformanceSnapshot {
  return {
    avgProofTimeMs: computeAverage('proof'),
    avgVCIssuanceTimeMs: computeAverage('vc_issuance'),
    avgStatusCheckTimeMs: computeAverage('status_check'),
    sampleCounts: {
      proof: Math.min(buffers.proof.length, WINDOW_SIZE),
      vc_issuance: Math.min(buffers.vc_issuance.length, WINDOW_SIZE),
      status_check: Math.min(buffers.status_check.length, WINDOW_SIZE),
    },
  };
}
