/**
 * Main API HTTP Metrics (Payer/EHR endpoints)
 * Tracks API latency, error rates, and throughput for payer and EHR services
 */

import { Router } from 'express';
import {
  createMetricsRegistry,
  createHttpMetrics,
  httpMetricsMiddleware,
  metricsEndpoint,
  HttpMetrics
} from '@chai-vc/metrics-core';

// Create metrics registry for main API service
export const register = createMetricsRegistry({
  serviceName: 'api',
  enableDefaultMetrics: true
});

// Create HTTP metrics for payer endpoints
export const payerHttpMetrics = createHttpMetrics('payer', register);

// Create HTTP metrics for EHR endpoints
export const ehrHttpMetrics = createHttpMetrics('ehr', register);

/**
 * Express router with metrics middleware for payer routes
 */
export function createPayerMetricsRouter(): Router {
  const router = Router();
  router.use(httpMetricsMiddleware(payerHttpMetrics));
  return router;
}

/**
 * Express router with metrics middleware for EHR routes
 */
export function createEhrMetricsRouter(): Router {
  const router = Router();
  router.use(httpMetricsMiddleware(ehrHttpMetrics));
  return router;
}

/**
 * Main metrics endpoint
 */
export function createMetricsRouter(): Router {
  const router = Router();
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
  payerHttpMetrics,
  ehrHttpMetrics,
  createPayerMetricsRouter,
  createEhrMetricsRouter,
  createMetricsRouter,
  getMetricsAsJson
};

