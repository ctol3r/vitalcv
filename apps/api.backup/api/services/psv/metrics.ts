/**
 * NCQA PSV (Provider Source Verification) Metrics
 * Tracks auto-pass ratio, stale records, and API failure rates
 */

import { Gauge, Counter, Histogram, Registry } from 'prom-client';
import { createMetricsRegistry, createTimer } from '@chai-vc/metrics-core';

// Create metrics registry for PSV service
export const register = createMetricsRegistry({
  serviceName: 'psv',
  enableDefaultMetrics: true
});

/**
 * Auto-pass ratio gauge
 * Percentage of verifications that auto-pass without manual review
 */
export const autoPassRatio = new Gauge({
  name: 'psv_auto_pass_ratio',
  help: 'Ratio of PSV verifications that auto-pass (0.0-1.0)',
  registers: [register]
});

/**
 * Stale records gauge
 * Number of provider records that need updating
 */
export const staleRecords = new Gauge({
  name: 'psv_stale_records',
  help: 'Number of provider records with stale data',
  labelNames: ['source'],
  registers: [register]
});

/**
 * Source errors counter
 * Tracks failures when accessing PSV data sources
 */
export const sourceErrors = new Counter({
  name: 'psv_source_errors_total',
  help: 'Total errors accessing PSV data sources',
  labelNames: ['source', 'error_type'],
  registers: [register]
});

/**
 * Verification attempts counter
 */
export const verificationAttempts = new Counter({
  name: 'psv_verification_attempts_total',
  help: 'Total PSV verification attempts',
  labelNames: ['outcome'],
  registers: [register]
});

/**
 * Verification duration histogram
 */
export const verificationDuration = new Histogram({
  name: 'psv_verification_duration_seconds',
  help: 'PSV verification duration in seconds',
  labelNames: ['source'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register]
});

/**
 * Source freshness histogram
 * Age of data in days
 */
export const sourceFreshness = new Histogram({
  name: 'psv_source_freshness_days',
  help: 'Age of PSV source data in days',
  labelNames: ['source'],
  buckets: [1, 7, 14, 30, 60, 90, 180, 365],
  registers: [register]
});

/**
 * NCQA compliance score gauge
 */
export const ncqaComplianceScore = new Gauge({
  name: 'psv_ncqa_compliance_score',
  help: 'NCQA compliance score (0.0-1.0)',
  registers: [register]
});

/**
 * PSV data sources enum
 */
export enum PSVSource {
  NPDB = 'npdb',
  OIG_LEIE = 'oig_leie',
  STATE_LICENSE = 'state_license',
  DEA = 'dea',
  ABMS = 'abms',
  PECOS = 'pecos',
  CAQH = 'caqh',
  NPI_REGISTRY = 'npi_registry'
}

/**
 * Verification outcomes
 */
export enum VerificationOutcome {
  AUTO_PASS = 'auto_pass',
  MANUAL_REVIEW = 'manual_review',
  FAILED = 'failed',
  ERROR = 'error'
}

/**
 * Error types
 */
export enum ErrorType {
  TIMEOUT = 'timeout',
  API_ERROR = 'api_error',
  AUTH_ERROR = 'auth_error',
  RATE_LIMIT = 'rate_limit',
  NETWORK_ERROR = 'network_error',
  DATA_FORMAT = 'data_format',
  NOT_FOUND = 'not_found'
}

/**
 * Update auto-pass ratio
 */
export function setAutoPassRatio(ratio: number): void {
  autoPassRatio.set(ratio);
}

/**
 * Update stale records count
 */
export function setStaleRecords(source: PSVSource, count: number): void {
  staleRecords.labels(source).set(count);
}

/**
 * Record source error
 */
export function recordSourceError(source: PSVSource, errorType: ErrorType): void {
  sourceErrors.labels(source, errorType).inc();
}

/**
 * Record verification attempt
 */
export function recordVerificationAttempt(outcome: VerificationOutcome): void {
  verificationAttempts.labels(outcome).inc();
}

/**
 * Record verification duration
 */
export function recordVerificationDuration(source: PSVSource, durationSeconds: number): void {
  verificationDuration.labels(source).observe(durationSeconds);
}

/**
 * Record source freshness
 */
export function recordSourceFreshness(source: PSVSource, ageDays: number): void {
  sourceFreshness.labels(source).observe(ageDays);
}

/**
 * Update NCQA compliance score
 */
export function setNcqaComplianceScore(score: number): void {
  ncqaComplianceScore.set(score);
}

/**
 * Calculate and update auto-pass ratio from counts
 */
export function updateAutoPassRatio(autoPassed: number, total: number): void {
  const ratio = total > 0 ? autoPassed / total : 0;
  setAutoPassRatio(ratio);
}

/**
 * Wrapper for PSV verification with automatic metrics
 */
export async function withPSVMetrics<T>(
  source: PSVSource,
  fn: () => Promise<T>
): Promise<T> {
  const timer = createTimer();
  try {
    const result = await fn();
    const duration = timer.end();
    recordVerificationDuration(source, duration);
    return result;
  } catch (error) {
    const duration = timer.end();
    recordVerificationDuration(source, duration);

    // Classify error type
    const errorType = classifyError(error);
    recordSourceError(source, errorType);

    throw error;
  }
}

/**
 * Classify error into error type
 */
function classifyError(error: unknown): ErrorType {
  if (!(error instanceof Error)) return ErrorType.NETWORK_ERROR;

  const message = error.message.toLowerCase();

  if (message.includes('timeout')) return ErrorType.TIMEOUT;
  if (message.includes('auth') || message.includes('unauthorized')) return ErrorType.AUTH_ERROR;
  if (message.includes('rate limit')) return ErrorType.RATE_LIMIT;
  if (message.includes('not found')) return ErrorType.NOT_FOUND;
  if (message.includes('format') || message.includes('parse')) return ErrorType.DATA_FORMAT;
  if (message.includes('network')) return ErrorType.NETWORK_ERROR;

  return ErrorType.API_ERROR;
}

/**
 * Calculate data staleness in days
 */
export function calculateStaleness(lastUpdated: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - lastUpdated.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
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
  autoPassRatio,
  staleRecords,
  sourceErrors,
  verificationAttempts,
  verificationDuration,
  sourceFreshness,
  ncqaComplianceScore,
  PSVSource,
  VerificationOutcome,
  ErrorType,
  setAutoPassRatio,
  setStaleRecords,
  recordSourceError,
  recordVerificationAttempt,
  recordVerificationDuration,
  recordSourceFreshness,
  setNcqaComplianceScore,
  updateAutoPassRatio,
  withPSVMetrics,
  calculateStaleness,
  getMetricsAsJson
};

