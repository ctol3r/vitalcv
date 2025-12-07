/**
 * Audit Anchor Latency Metrics
 * Tracks the time from hash generation to block inclusion for audit events
 */

import { Histogram, Counter, Registry } from 'prom-client';
import {
  createMetricsRegistry,
  createTimer
} from '@chai-vc/metrics-core';

// Create metrics registry for audit service
export const register = createMetricsRegistry({
  serviceName: 'audit',
  enableDefaultMetrics: true
});

/**
 * Anchor latency histogram
 * Measures time from hash generation to block inclusion
 */
export const anchorLatency = new Histogram({
  name: 'audit_anchor_latency_seconds',
  help: 'Time in seconds from hash generation to block inclusion',
  buckets: [1, 5, 10, 30, 60, 120, 300, 600], // 1s, 5s, 10s, 30s, 1min, 2min, 5min, 10min
  registers: [register]
});

/**
 * Anchor failures counter
 */
export const anchorFailures = new Counter({
  name: 'audit_anchor_failures_total',
  help: 'Total number of anchor failures',
  labelNames: ['reason'],
  registers: [register]
});

/**
 * Events recorded counter
 */
export const eventsRecorded = new Counter({
  name: 'audit_events_total',
  help: 'Total number of audit events recorded',
  labelNames: ['event_type'],
  registers: [register]
});

/**
 * Anchor attempts counter
 */
export const anchorAttempts = new Counter({
  name: 'audit_anchor_attempts_total',
  help: 'Total number of anchor attempts',
  labelNames: ['status'],
  registers: [register]
});

/**
 * Record anchor latency
 */
export function recordAnchorLatency(latencySeconds: number): void {
  anchorLatency.observe(latencySeconds);
}

/**
 * Record anchor failure
 */
export function recordAnchorFailure(reason: string): void {
  anchorFailures.labels(reason).inc();
}

/**
 * Record audit event
 */
export function recordAuditEvent(eventType: string): void {
  eventsRecorded.labels(eventType).inc();
}

/**
 * Record anchor attempt
 */
export function recordAnchorAttempt(status: 'success' | 'failure'): void {
  anchorAttempts.labels(status).inc();
}

/**
 * Calculate and record anchor latency from timestamp
 */
export function recordAnchorLatencyFromTimestamp(hashTimestamp: Date, blockTimestamp: Date): void {
  const latencyMs = blockTimestamp.getTime() - hashTimestamp.getTime();
  const latencySeconds = latencyMs / 1000;
  recordAnchorLatency(latencySeconds);
}

/**
 * Wrapper for anchor operations with automatic metrics
 */
export async function withAnchorMetrics<T>(
  fn: () => Promise<T>,
  onFailure?: (error: Error) => string
): Promise<T> {
  const timer = createTimer();
  try {
    const result = await fn();
    const duration = timer.end();
    recordAnchorLatency(duration);
    recordAnchorAttempt('success');
    return result;
  } catch (error) {
    const reason = onFailure && error instanceof Error
      ? onFailure(error)
      : (error instanceof Error ? error.message : 'unknown_error');
    recordAnchorFailure(reason);
    recordAnchorAttempt('failure');
    throw error;
  }
}

/**
 * Get current metrics as JSON (for testing)
 */
export async function getMetricsAsJson() {
  const metrics = await register.getMetricsAsJSON();
  return metrics;
}

export default {
  register,
  anchorLatency,
  anchorFailures,
  eventsRecorded,
  anchorAttempts,
  recordAnchorLatency,
  recordAnchorFailure,
  recordAuditEvent,
  recordAnchorAttempt,
  recordAnchorLatencyFromTimestamp,
  withAnchorMetrics,
  getMetricsAsJson
};

