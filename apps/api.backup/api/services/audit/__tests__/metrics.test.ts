/**
 * Tests for Audit Anchor Latency Metrics
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  register,
  recordAnchorLatency,
  recordAnchorFailure,
  recordAuditEvent,
  recordAnchorLatencyFromTimestamp,
  withAnchorMetrics,
  getMetricsAsJson
} from '../metrics.js';

describe('Audit Anchor Metrics', () => {
  beforeEach(() => {
    register.clear();
  });

  it('should record anchor latency', async () => {
    recordAnchorLatency(1.5);
    recordAnchorLatency(2.3);
    recordAnchorLatency(0.8);

    const metrics = await getMetricsAsJson();
    const latencyMetric = metrics.find((m: any) => m.name === 'audit_anchor_latency_seconds');

    expect(latencyMetric).toBeDefined();
    expect(latencyMetric?.type).toBe('histogram');
  });

  it('should record anchor failures with reasons', async () => {
    recordAnchorFailure('network_timeout');
    recordAnchorFailure('invalid_block');
    recordAnchorFailure('network_timeout');

    const metrics = await getMetricsAsJson();
    const failureMetric = metrics.find((m: any) => m.name === 'audit_anchor_failures_total');

    expect(failureMetric).toBeDefined();
    expect(failureMetric?.values.length).toBe(2); // Two distinct reasons
  });

  it('should record audit events by type', async () => {
    recordAuditEvent('credential_issued');
    recordAuditEvent('credential_revoked');
    recordAuditEvent('credential_issued');

    const metrics = await getMetricsAsJson();
    const eventsMetric = metrics.find((m: any) => m.name === 'audit_events_total');

    expect(eventsMetric).toBeDefined();
  });

  it('should calculate latency from timestamps', async () => {
    const hashTime = new Date('2025-11-09T10:00:00Z');
    const blockTime = new Date('2025-11-09T10:00:05Z'); // 5 seconds later

    recordAnchorLatencyFromTimestamp(hashTime, blockTime);

    const metrics = await getMetricsAsJson();
    const latencyMetric = metrics.find((m: any) => m.name === 'audit_anchor_latency_seconds');

    expect(latencyMetric).toBeDefined();
  });

  it('should wrap anchor operations with metrics', async () => {
    const mockAnchorFn = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { hash: 'abc123', block: 42 };
    };

    const result = await withAnchorMetrics(mockAnchorFn);

    expect(result).toEqual({ hash: 'abc123', block: 42 });

    const metrics = await getMetricsAsJson();
    const latencyMetric = metrics.find((m: any) => m.name === 'audit_anchor_latency_seconds');
    const attemptsMetric = metrics.find((m: any) => m.name === 'audit_anchor_attempts_total');

    expect(latencyMetric).toBeDefined();
    expect(attemptsMetric).toBeDefined();
  });

  it('should record failures in wrapped operations', async () => {
    const mockFailingFn = async () => {
      throw new Error('Anchor timeout');
    };

    await expect(withAnchorMetrics(mockFailingFn)).rejects.toThrow('Anchor timeout');

    const metrics = await getMetricsAsJson();
    const failuresMetric = metrics.find((m: any) => m.name === 'audit_anchor_failures_total');
    const attemptsMetric = metrics.find((m: any) => m.name === 'audit_anchor_attempts_total');

    expect(failuresMetric).toBeDefined();
    expect(attemptsMetric).toBeDefined();
  });

  it('should use custom failure reason mapper', async () => {
    const mockFailingFn = async () => {
      throw new Error('Connection refused');
    };

    const customMapper = (error: Error) => {
      if (error.message.includes('refused')) return 'network_error';
      return 'unknown';
    };

    await expect(withAnchorMetrics(mockFailingFn, customMapper)).rejects.toThrow();

    const metrics = await getMetricsAsJson();
    const failuresMetric = metrics.find((m: any) => m.name === 'audit_anchor_failures_total');

    expect(failuresMetric).toBeDefined();
    // Should have recorded with reason 'network_error'
    const networkError = failuresMetric?.values.find((v: any) => v.labels.reason === 'network_error');
    expect(networkError).toBeDefined();
  });
});

