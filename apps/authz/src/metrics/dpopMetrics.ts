/**
 * DPoP Verification Error Metrics
 * Tracks DPoP verification failures per service and reason
 */

import { Counter } from 'prom-client';
import { createMetricsRegistry } from '@chai-vc/metrics-core';

// Create metrics registry for authz service
export const register = createMetricsRegistry({
  serviceName: 'authz',
  enableDefaultMetrics: true
});

/**
 * DPoP verification failure reasons enum
 * Documents all possible failure reasons for monitoring
 */
export enum DPoPFailureReason {
  // Token validation failures
  INVALID_TOKEN = 'invalid_token',
  EXPIRED_TOKEN = 'expired_token',
  MISSING_TOKEN = 'missing_token',

  // Proof validation failures
  INVALID_PROOF = 'invalid_proof',
  PROOF_MISMATCH = 'proof_mismatch',
  INVALID_SIGNATURE = 'invalid_signature',

  // JWK validation failures
  INVALID_JWK = 'invalid_jwk',
  JWK_MISMATCH = 'jwk_mismatch',
  UNSUPPORTED_ALGORITHM = 'unsupported_algorithm',

  // Replay protection failures
  NONCE_REUSED = 'nonce_reused',
  JTI_REUSED = 'jti_reused',

  // HTTP method binding failures
  METHOD_MISMATCH = 'method_mismatch',
  URL_MISMATCH = 'url_mismatch',

  // Timing failures
  HTM_HTU_MISMATCH = 'htm_htu_mismatch',
  IAT_TOO_OLD = 'iat_too_old',
  IAT_IN_FUTURE = 'iat_in_future',

  // Other
  NETWORK_ERROR = 'network_error',
  UNKNOWN = 'unknown'
}

/**
 * DPoP verification failures counter
 * Increments on each DPoP verification failure with reason label
 */
export const dpopVerificationFailures = new Counter({
  name: 'authz_dpop_verification_failures_total',
  help: 'Total number of DPoP verification failures',
  labelNames: ['reason', 'service'],
  registers: [register]
});

/**
 * DPoP verification attempts counter
 */
export const dpopVerificationAttempts = new Counter({
  name: 'authz_dpop_verification_attempts_total',
  help: 'Total number of DPoP verification attempts',
  labelNames: ['status', 'service'],
  registers: [register]
});

/**
 * DPoP tokens issued counter
 */
export const dpopTokensIssued = new Counter({
  name: 'authz_dpop_tokens_issued_total',
  help: 'Total number of DPoP-bound tokens issued',
  labelNames: ['service'],
  registers: [register]
});

/**
 * Record DPoP verification failure
 */
export function recordDPoPFailure(reason: DPoPFailureReason, service: string = 'unknown'): void {
  dpopVerificationFailures.labels(reason, service).inc();
  dpopVerificationAttempts.labels('failure', service).inc();
}

/**
 * Record successful DPoP verification
 */
export function recordDPoPSuccess(service: string = 'unknown'): void {
  dpopVerificationAttempts.labels('success', service).inc();
}

/**
 * Record DPoP token issuance
 */
export function recordDPoPTokenIssued(service: string = 'unknown'): void {
  dpopTokensIssued.labels(service).inc();
}

/**
 * Helper to map error to failure reason
 */
export function errorToDPoPFailureReason(error: Error): DPoPFailureReason {
  const message = error.message.toLowerCase();

  if (message.includes('expired')) return DPoPFailureReason.EXPIRED_TOKEN;
  if (message.includes('invalid token')) return DPoPFailureReason.INVALID_TOKEN;
  if (message.includes('missing token')) return DPoPFailureReason.MISSING_TOKEN;
  if (message.includes('invalid proof')) return DPoPFailureReason.INVALID_PROOF;
  if (message.includes('invalid signature')) return DPoPFailureReason.INVALID_SIGNATURE;
  if (message.includes('nonce')) return DPoPFailureReason.NONCE_REUSED;
  if (message.includes('jti')) return DPoPFailureReason.JTI_REUSED;
  if (message.includes('method')) return DPoPFailureReason.METHOD_MISMATCH;
  if (message.includes('url')) return DPoPFailureReason.URL_MISMATCH;
  if (message.includes('jwk')) return DPoPFailureReason.INVALID_JWK;
  if (message.includes('algorithm')) return DPoPFailureReason.UNSUPPORTED_ALGORITHM;
  if (message.includes('network')) return DPoPFailureReason.NETWORK_ERROR;

  return DPoPFailureReason.UNKNOWN;
}

/**
 * Wrapper for DPoP verification with automatic metrics
 */
export async function withDPoPMetrics<T>(
  service: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const result = await fn();
    recordDPoPSuccess(service);
    return result;
  } catch (error) {
    const reason = error instanceof Error
      ? errorToDPoPFailureReason(error)
      : DPoPFailureReason.UNKNOWN;
    recordDPoPFailure(reason, service);
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
  DPoPFailureReason,
  dpopVerificationFailures,
  dpopVerificationAttempts,
  dpopTokensIssued,
  recordDPoPFailure,
  recordDPoPSuccess,
  recordDPoPTokenIssued,
  errorToDPoPFailureReason,
  withDPoPMetrics,
  getMetricsAsJson
};

