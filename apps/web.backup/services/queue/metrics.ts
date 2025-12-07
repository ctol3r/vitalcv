import { createMetricsRegistry, createQueueMetrics } from '@chai-vc/metrics-core';
import type { JobQueueType, QueueHealthSnapshot } from './models/JobQueue.js';

const register = createMetricsRegistry({
  serviceName: 'queue',
  enableDefaultMetrics: false,
});

const queueMetrics = createQueueMetrics('queue', register);

const CRITICAL_JOB_TYPES: JobQueueType[] = [
  'NCI_PUBLISH_PROOFS',
  'FUSION_UPDATE',
  'SAFETY_SWEEP',
  'MOBILITY_EVALUATE_ORG',
];

export function recordQueueHealth(snapshot: QueueHealthSnapshot): void {
  queueMetrics.depth.labels('running').set(snapshot.running);
  queueMetrics.depth.labels('pending').set(snapshot.waiting);
  queueMetrics.depth.labels('dead_letter').set(snapshot.deadLetter);

  if (snapshot.avgLatencyMs !== null) {
    queueMetrics.latencySeconds.set(snapshot.avgLatencyMs / 1000);
  }
}

export function recordJobDispatch(type: JobQueueType): void {
  if (!CRITICAL_JOB_TYPES.includes(type)) {
    return;
  }
  queueMetrics.jobDispatchHandles[type].inc();
}
import { Gauge } from 'prom-client';
import { createMetricsRegistry } from '@chai-vc/metrics-core';
import type { QueueHealthSnapshot } from './models/JobQueue.js';

export const queueMetricsRegistry = createMetricsRegistry({
  serviceName: 'queue-worker-health',
  enableDefaultMetrics: false,
});

export const queueStatusGauge = new Gauge({
  name: 'queue_jobs_status_total',
  help: 'Current counts of queue jobs by status',
  labelNames: ['status'],
  registers: [queueMetricsRegistry],
});

export const queueLatencyGauge = new Gauge({
  name: 'queue_job_latency_ms',
  help: 'Average latency in milliseconds for recently completed jobs',
  registers: [queueMetricsRegistry],
});

export function recordQueueHealth(snapshot: QueueHealthSnapshot): void {
  queueStatusGauge.labels('running').set(snapshot.running);
  queueStatusGauge.labels('waiting').set(snapshot.waiting);
  queueStatusGauge.labels('dlq').set(snapshot.deadLetter);
  queueLatencyGauge.set(snapshot.avgLatencyMs ?? 0);
}


