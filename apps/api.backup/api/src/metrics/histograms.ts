/**
 * Prometheus Histogram Metrics
 * Tagged: cursor-batch-1105 (Task 0011)
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Histograms for verify/issue operations with outcome labels
 */

import { Registry, Histogram, Counter, Gauge } from 'prom-client';

// Global registry
const registry = new Registry();

/**
 * Credential Verification Histogram
 * Tracks p50, p95, p99 latencies with outcome labels
 */
export const verificationHistogram = new Histogram({
  name: 'credential_verification_duration_seconds',
  help: 'Duration of credential verification operations',
  labelNames: ['outcome', 'error_code', 'credential_type'],
  buckets: [0.01, 0.05, 0.1, 0.15, 0.25, 0.5, 1, 2.5, 5], // Buckets in seconds
  registers: [registry],
});

/**
 * Credential Issuance Histogram
 * Tracks p50, p95, p99 latencies with outcome labels
 */
export const issuanceHistogram = new Histogram({
  name: 'credential_issuance_duration_seconds',
  help: 'Duration of credential issuance operations',
  labelNames: ['outcome', 'error_code', 'credential_type'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

/**
 * DID Resolution Histogram
 */
export const didResolutionHistogram = new Histogram({
  name: 'did_resolution_duration_seconds',
  help: 'Duration of DID resolution operations',
  labelNames: ['outcome', 'cache_hit', 'did_method'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [registry],
});

/**
 * SD-JWT Verification Histogram
 */
export const sdjwtVerificationHistogram = new Histogram({
  name: 'sdjwt_verification_duration_seconds',
  help: 'Duration of SD-JWT verification operations',
  labelNames: ['outcome', 'disclosure_count'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.15, 0.25, 0.5],
  registers: [registry],
});

/**
 * DID Cache Metrics
 */
export const didCacheHitsCounter = new Counter({
  name: 'did_cache_hits_total',
  help: 'Total number of DID cache hits',
  labelNames: ['cache_type'], // positive or negative
  registers: [registry],
});

export const didCacheMissesCounter = new Counter({
  name: 'did_cache_misses_total',
  help: 'Total number of DID cache misses',
  registers: [registry],
});

export const didCacheSizeGauge = new Gauge({
  name: 'did_cache_size',
  help: 'Current size of DID caches',
  labelNames: ['cache_type'],
  registers: [registry],
});

/**
 * Status List Metrics
 */
export const statusListSizeGauge = new Gauge({
  name: 'status_list_size',
  help: 'Current size of status lists',
  labelNames: ['list_id', 'purpose', 'active'],
  registers: [registry],
});

export const statusListUtilizationGauge = new Gauge({
  name: 'status_list_utilization_percent',
  help: 'Utilization percentage of status lists',
  labelNames: ['list_id', 'purpose'],
  registers: [registry],
});

/**
 * Trust Registry Metrics
 */
export const trustRegistryCheckCounter = new Counter({
  name: 'trust_registry_checks_total',
  help: 'Total number of trust registry checks',
  labelNames: ['outcome', 'schema_type'],
  registers: [registry],
});

/**
 * Webhook Metrics
 */
export const webhookVerificationCounter = new Counter({
  name: 'webhook_verification_total',
  help: 'Total number of webhook verifications',
  labelNames: ['outcome', 'error_code'],
  registers: [registry],
});

/**
 * Helper: Record verification outcome
 */
export function recordVerification(
  durationSeconds: number,
  outcome: 'success' | 'failure',
  errorCode?: string,
  credentialType?: string,
): void {
  verificationHistogram.observe(
    {
      outcome,
      error_code: errorCode || 'none',
      credential_type: credentialType || 'unknown',
    },
    durationSeconds,
  );
}

/**
 * Helper: Record issuance outcome
 */
export function recordIssuance(
  durationSeconds: number,
  outcome: 'success' | 'failure',
  errorCode?: string,
  credentialType?: string,
): void {
  issuanceHistogram.observe(
    {
      outcome,
      error_code: errorCode || 'none',
      credential_type: credentialType || 'unknown',
    },
    durationSeconds,
  );
}

/**
 * Helper: Record DID resolution
 */
export function recordDIDResolution(
  durationSeconds: number,
  outcome: 'success' | 'failure',
  cacheHit: boolean,
  didMethod?: string,
): void {
  didResolutionHistogram.observe(
    {
      outcome,
      cache_hit: cacheHit ? 'true' : 'false',
      did_method: didMethod || 'unknown',
    },
    durationSeconds,
  );
}

/**
 * Helper: Record SD-JWT verification
 */
export function recordSdJwtVerification(
  durationSeconds: number,
  outcome: 'success' | 'failure',
  disclosureCount: number,
): void {
  sdjwtVerificationHistogram.observe(
    {
      outcome,
      disclosure_count: disclosureCount.toString(),
    },
    durationSeconds,
  );
}

/**
 * Update DID cache metrics
 */
export function updateDIDCacheMetrics(
  positiveHits: number,
  positiveMisses: number,
  positiveSize: number,
  negativeHits: number,
  negativeMisses: number,
  negativeSize: number,
): void {
  didCacheHitsCounter.inc({ cache_type: 'positive' }, positiveHits);
  didCacheHitsCounter.inc({ cache_type: 'negative' }, negativeHits);
  didCacheMissesCounter.inc({}, positiveMisses + negativeMisses);
  didCacheSizeGauge.set({ cache_type: 'positive' }, positiveSize);
  didCacheSizeGauge.set({ cache_type: 'negative' }, negativeSize);
}

/**
 * Get the metrics registry
 */
export function getMetricsRegistry(): Registry {
  return registry;
}

/**
 * Get metrics as Prometheus text format
 */
export async function getMetricsText(): Promise<string> {
  return registry.metrics();
}

