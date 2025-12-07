/**
 * Verifier API HTTP Metrics
 * Tracks API latency, error rates, and throughput for the verifier service
 */

import { Router } from 'express';
import {
  createMetricsRegistry,
  createHttpMetrics,
  httpMetricsMiddleware,
  metricsEndpoint,
  HttpMetrics
} from '@chai-vc/metrics-core';

// Create metrics registry for verifier service
export const register = createMetricsRegistry({
  serviceName: 'verifier',
  enableDefaultMetrics: true
});

// Create HTTP metrics
export const httpMetrics = createHttpMetrics('verifier', register);

/**
 * Express router with metrics middleware
 */
export function createMetricsRouter(): Router {
  const router = Router();

  // Add metrics middleware to all routes
  router.use(httpMetricsMiddleware(httpMetrics));

  // Expose /metrics endpoint
  router.get('/metrics', metricsEndpoint(register));

  return router;
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
  httpMetrics,
  createMetricsRouter,
  getMetricsAsJson
};

