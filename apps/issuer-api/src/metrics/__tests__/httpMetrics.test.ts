/**
 * Tests for Issuer HTTP Metrics
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { register, httpMetrics, getMetricsAsJson } from '../httpMetrics.js';

describe('Issuer HTTP Metrics', () => {
  beforeEach(() => {
    // Clear metrics between tests
    register.clear();
  });

  it('should record HTTP request metrics', async () => {
    // Simulate request
    httpMetrics.requestsTotal.labels('POST', '/credentials/issue', '200').inc();
    httpMetrics.requestDuration.labels('POST', '/credentials/issue', '200').observe(0.234);

    const metrics = await getMetricsAsJson();

    // Find the request counter metric
    const requestMetric = metrics.find((m: any) => m.name === 'issuer_http_requests_total');
    expect(requestMetric).toBeDefined();
    expect(requestMetric?.values[0].value).toBe(1);

    // Find the duration histogram metric
    const durationMetric = metrics.find((m: any) => m.name === 'issuer_http_request_duration_seconds');
    expect(durationMetric).toBeDefined();
  });

  it('should track different routes separately', async () => {
    httpMetrics.requestsTotal.labels('POST', '/credentials/issue', '200').inc();
    httpMetrics.requestsTotal.labels('GET', '/credentials/:id', '200').inc();
    httpMetrics.requestsTotal.labels('POST', '/credentials/issue', '500').inc();

    const metrics = await getMetricsAsJson();
    const requestMetric = metrics.find((m: any) => m.name === 'issuer_http_requests_total');

    expect(requestMetric?.values.length).toBe(3);
  });

  it('should track different status codes', async () => {
    httpMetrics.requestsTotal.labels('POST', '/credentials/issue', '200').inc();
    httpMetrics.requestsTotal.labels('POST', '/credentials/issue', '400').inc();
    httpMetrics.requestsTotal.labels('POST', '/credentials/issue', '500').inc();

    const metrics = await getMetricsAsJson();
    const requestMetric = metrics.find((m: any) => m.name === 'issuer_http_requests_total');

    // Should have 3 different label combinations
    expect(requestMetric?.values.length).toBe(3);
  });

  it('should record request size metrics', async () => {
    httpMetrics.requestSizeBytes.labels('POST', '/credentials/issue').observe(1024);

    const metrics = await getMetricsAsJson();
    const sizeMetric = metrics.find((m: any) => m.name === 'issuer_http_request_size_bytes');

    expect(sizeMetric).toBeDefined();
  });

  it('should record response size metrics', async () => {
    httpMetrics.responseSizeBytes.labels('POST', '/credentials/issue', '200').observe(2048);

    const metrics = await getMetricsAsJson();
    const sizeMetric = metrics.find((m: any) => m.name === 'issuer_http_response_size_bytes');

    expect(sizeMetric).toBeDefined();
  });

  it('should expose metrics in Prometheus format', async () => {
    httpMetrics.requestsTotal.labels('POST', '/credentials/issue', '200').inc();

    const metricsText = await register.metrics();

    expect(metricsText).toContain('issuer_http_requests_total');
    expect(metricsText).toContain('method="POST"');
    expect(metricsText).toContain('route="/credentials/issue"');
    expect(metricsText).toContain('status="200"');
  });
});

