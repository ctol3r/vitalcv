/**
 * Matcher Service Metrics
 * Tracks match latency and match score distribution
 */

import { Histogram, Counter, Gauge, Registry } from 'prom-client';
import { createMetricsRegistry, createTimer } from '@chai-vc/metrics-core';

// Create metrics registry for matcher service
export const register = createMetricsRegistry({
  serviceName: 'matcher',
  enableDefaultMetrics: true
});

/**
 * Match latency histogram
 */
export const matchLatency = new Histogram({
  name: 'matcher_match_latency_seconds',
  help: 'Time to perform a match operation in seconds',
  labelNames: ['match_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

/**
 * Match score histogram
 * Tracks the distribution of match confidence scores
 */
export const matchScore = new Histogram({
  name: 'matcher_match_score',
  help: 'Distribution of match confidence scores',
  labelNames: ['match_type'],
  buckets: [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.99, 1.0],
  registers: [register]
});

/**
 * Match attempts counter
 */
export const matchAttempts = new Counter({
  name: 'matcher_match_attempts_total',
  help: 'Total number of match attempts',
  labelNames: ['match_type', 'outcome'],
  registers: [register]
});

/**
 * High confidence matches counter
 */
export const highConfidenceMatches = new Counter({
  name: 'matcher_high_confidence_matches_total',
  help: 'Number of matches with confidence >= 0.9',
  labelNames: ['match_type'],
  registers: [register]
});

/**
 * Low confidence matches counter (need review)
 */
export const lowConfidenceMatches = new Counter({
  name: 'matcher_low_confidence_matches_total',
  help: 'Number of matches with confidence < 0.7 (need manual review)',
  labelNames: ['match_type'],
  registers: [register]
});

/**
 * Active match operations gauge
 */
export const activeMatches = new Gauge({
  name: 'matcher_active_matches',
  help: 'Number of match operations currently in progress',
  labelNames: ['match_type'],
  registers: [register]
});

/**
 * Match type enum
 */
export enum MatchType {
  JOB_APPLICATION = 'job_application',
  PROVIDER_CREDENTIAL = 'provider_credential',
  IDENTITY_VERIFICATION = 'identity_verification',
  TELEMED = 'telemed',
  COMPACT = 'compact'
}

/**
 * Match outcome enum
 */
export enum MatchOutcome {
  SUCCESS = 'success',
  NO_MATCH = 'no_match',
  MULTIPLE_MATCHES = 'multiple_matches',
  ERROR = 'error'
}

/**
 * Record match latency
 */
export function recordMatchLatency(matchType: MatchType, latencySeconds: number): void {
  matchLatency.labels(matchType).observe(latencySeconds);
}

/**
 * Record match score
 */
export function recordMatchScore(matchType: MatchType, score: number): void {
  matchScore.labels(matchType).observe(score);

  // Track high/low confidence separately
  if (score >= 0.9) {
    highConfidenceMatches.labels(matchType).inc();
  } else if (score < 0.7) {
    lowConfidenceMatches.labels(matchType).inc();
  }
}

/**
 * Record match attempt
 */
export function recordMatchAttempt(matchType: MatchType, outcome: MatchOutcome): void {
  matchAttempts.labels(matchType, outcome).inc();
}

/**
 * Increment active matches
 */
export function incrementActiveMatches(matchType: MatchType): void {
  activeMatches.labels(matchType).inc();
}

/**
 * Decrement active matches
 */
export function decrementActiveMatches(matchType: MatchType): void {
  activeMatches.labels(matchType).dec();
}

/**
 * Wrapper for match operations with automatic metrics
 */
export async function withMatchMetrics<T extends { score?: number }>(
  matchType: MatchType,
  fn: () => Promise<T>
): Promise<T> {
  const timer = createTimer();
  incrementActiveMatches(matchType);

  try {
    const result = await fn();
    const duration = timer.end();

    recordMatchLatency(matchType, duration);

    if (result.score !== undefined) {
      recordMatchScore(matchType, result.score);
    }

    const outcome = result.score !== undefined && result.score > 0
      ? MatchOutcome.SUCCESS
      : MatchOutcome.NO_MATCH;

    recordMatchAttempt(matchType, outcome);

    return result;
  } catch (error) {
    const duration = timer.end();
    recordMatchLatency(matchType, duration);
    recordMatchAttempt(matchType, MatchOutcome.ERROR);
    throw error;
  } finally {
    decrementActiveMatches(matchType);
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
  matchLatency,
  matchScore,
  matchAttempts,
  highConfidenceMatches,
  lowConfidenceMatches,
  activeMatches,
  MatchType,
  MatchOutcome,
  recordMatchLatency,
  recordMatchScore,
  recordMatchAttempt,
  incrementActiveMatches,
  decrementActiveMatches,
  withMatchMetrics,
  getMetricsAsJson
};

