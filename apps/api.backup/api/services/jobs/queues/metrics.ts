/**
 * Job Queue Metrics (Kafka/Redis)
 * Tracks queue depth and processing duration for applications, payer, and compacts
 */

import { Registry } from 'prom-client';
import {
  createMetricsRegistry,
  createQueueMetrics,
  createTimer,
  QueueMetrics
} from '@chai-vc/metrics-core';

// Create metrics registry for job queues
export const register = createMetricsRegistry({
  serviceName: 'jobs',
  enableDefaultMetrics: true
});

// Create queue metrics
export const queueMetrics = createQueueMetrics('jobs', register);

/**
 * Queue names enum for type safety
 */
export enum QueueName {
  APPLICATIONS = 'applications',
  PAYER_ENROLLMENT = 'payer_enrollment',
  COMPACTS_VERIFICATION = 'compacts_verification',
  CREDENTIAL_ISSUANCE = 'credential_issuance',
  BACKGROUND_CHECK = 'background_check'
}

/**
 * Update queue depth metric
 */
export function setQueueDepth(queueName: QueueName, depth: number): void {
  queueMetrics.depth.labels(queueName).set(depth);
}

/**
 * Record processing duration for a queue job
 */
export function recordProcessingDuration(queueName: QueueName, durationSeconds: number): void {
  queueMetrics.processingDuration.labels(queueName).observe(durationSeconds);
}

/**
 * Record processing failure
 */
export function recordProcessingFailure(queueName: QueueName, reason: string): void {
  queueMetrics.processingFailures.labels(queueName, reason).inc();
}

/**
 * Helper to wrap job processing with automatic metrics recording
 */
export async function withQueueMetrics<T>(
  queueName: QueueName,
  fn: () => Promise<T>
): Promise<T> {
  const timer = createTimer();
  try {
    const result = await fn();
    recordProcessingDuration(queueName, timer.end());
    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown_error';
    recordProcessingFailure(queueName, reason);
    recordProcessingDuration(queueName, timer.end());
    throw error;
  }
}

/**
 * Kafka consumer metrics decorator
 */
export function instrumentKafkaConsumer(
  queueName: QueueName,
  handler: (message: any) => Promise<void>
): (message: any) => Promise<void> {
  return async (message: any) => {
    await withQueueMetrics(queueName, () => handler(message));
  };
}

/**
 * Redis queue metrics decorator
 */
export function instrumentRedisQueue(
  queueName: QueueName,
  processor: (job: any) => Promise<any>
): (job: any) => Promise<any> {
  return async (job: any) => {
    return withQueueMetrics(queueName, () => processor(job));
  };
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
  queueMetrics,
  QueueName,
  setQueueDepth,
  recordProcessingDuration,
  recordProcessingFailure,
  withQueueMetrics,
  instrumentKafkaConsumer,
  instrumentRedisQueue,
  getMetricsAsJson
};

