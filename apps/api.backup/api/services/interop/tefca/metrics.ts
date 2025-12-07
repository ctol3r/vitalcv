/**
 * TEFCA Facade Metrics
 * Tracks latency, error rate, and Purpose of Use (PoU) for TEFCA FHIR requests
 */

import { Counter, Histogram, Registry } from 'prom-client';
import { createMetricsRegistry, createTimer } from '@chai-vc/metrics-core';

// Create metrics registry for TEFCA service
export const register = createMetricsRegistry({
  serviceName: 'tefca',
  enableDefaultMetrics: true
});

/**
 * TEFCA FHIR request counter
 */
export const fhirRequestsTotal = new Counter({
  name: 'tefca_fhir_requests_total',
  help: 'Total number of TEFCA FHIR requests',
  labelNames: ['pou', 'resource_type', 'status'],
  registers: [register]
});

/**
 * TEFCA FHIR request duration histogram
 */
export const fhirDuration = new Histogram({
  name: 'tefca_fhir_duration_seconds',
  help: 'TEFCA FHIR request duration in seconds',
  labelNames: ['pou', 'resource_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register]
});

/**
 * TEFCA FHIR errors counter
 */
export const fhirErrors = new Counter({
  name: 'tefca_fhir_errors_total',
  help: 'Total number of TEFCA FHIR errors',
  labelNames: ['pou', 'resource_type', 'error_code'],
  registers: [register]
});

/**
 * TEFCA query complexity histogram
 */
export const queryComplexity = new Histogram({
  name: 'tefca_query_complexity',
  help: 'TEFCA query complexity score',
  labelNames: ['pou', 'resource_type'],
  buckets: [1, 2, 3, 5, 10, 20, 50],
  registers: [register]
});

/**
 * TEFCA response size histogram
 */
export const responseSize = new Histogram({
  name: 'tefca_response_size_bytes',
  help: 'TEFCA response size in bytes',
  labelNames: ['pou', 'resource_type'],
  buckets: [1000, 10000, 100000, 1000000, 10000000],
  registers: [register]
});

/**
 * Purpose of Use (PoU) enum
 * Standard TEFCA PoU values
 */
export enum PurposeOfUse {
  TREATMENT = 'TREATMENT',
  PAYMENT = 'PAYMENT',
  OPERATIONS = 'OPERATIONS',
  RESEARCH = 'RESEARCH',
  PUBLIC_HEALTH = 'PUBLIC_HEALTH',
  JUDICIAL = 'JUDICIAL',
  LAW_ENFORCEMENT = 'LAW_ENFORCEMENT',
  COVERAGE = 'COVERAGE',
  REQUEST = 'REQUEST'
}

/**
 * FHIR Resource Types
 */
export enum FhirResourceType {
  PATIENT = 'Patient',
  PRACTITIONER = 'Practitioner',
  OBSERVATION = 'Observation',
  CONDITION = 'Condition',
  MEDICATION_REQUEST = 'MedicationRequest',
  IMMUNIZATION = 'Immunization',
  ALLERGY_INTOLERANCE = 'AllergyIntolerance',
  DIAGNOSTIC_REPORT = 'DiagnosticReport',
  BUNDLE = 'Bundle'
}

/**
 * Record TEFCA FHIR request
 */
export function recordFhirRequest(
  pou: PurposeOfUse,
  resourceType: FhirResourceType,
  status: 'success' | 'error',
  durationSeconds?: number
): void {
  fhirRequestsTotal.labels(pou, resourceType, status).inc();

  if (durationSeconds !== undefined) {
    fhirDuration.labels(pou, resourceType).observe(durationSeconds);
  }
}

/**
 * Record TEFCA FHIR error
 */
export function recordFhirError(
  pou: PurposeOfUse,
  resourceType: FhirResourceType,
  errorCode: string
): void {
  fhirErrors.labels(pou, resourceType, errorCode).inc();
}

/**
 * Record query complexity
 */
export function recordQueryComplexity(
  pou: PurposeOfUse,
  resourceType: FhirResourceType,
  complexity: number
): void {
  queryComplexity.labels(pou, resourceType).observe(complexity);
}

/**
 * Record response size
 */
export function recordResponseSize(
  pou: PurposeOfUse,
  resourceType: FhirResourceType,
  sizeBytes: number
): void {
  responseSize.labels(pou, resourceType).observe(sizeBytes);
}

/**
 * Wrapper for TEFCA FHIR requests with automatic metrics
 */
export async function withTefcaMetrics<T>(
  pou: PurposeOfUse,
  resourceType: FhirResourceType,
  fn: () => Promise<T>
): Promise<T> {
  const timer = createTimer();
  try {
    const result = await fn();
    const duration = timer.end();
    recordFhirRequest(pou, resourceType, 'success', duration);
    return result;
  } catch (error) {
    const duration = timer.end();
    const errorCode = error instanceof Error ? error.message.substring(0, 50) : 'unknown';
    recordFhirRequest(pou, resourceType, 'error', duration);
    recordFhirError(pou, resourceType, errorCode);
    throw error;
  }
}

/**
 * Calculate query complexity from FHIR search parameters
 */
export function calculateQueryComplexity(searchParams: Record<string, any>): number {
  let complexity = 1;

  // Base complexity
  const paramCount = Object.keys(searchParams).length;
  complexity += paramCount;

  // Add complexity for modifiers
  for (const value of Object.values(searchParams)) {
    if (typeof value === 'string') {
      if (value.includes(',')) complexity += 1; // OR conditions
      if (value.includes('$')) complexity += 2; // Advanced operators
    }
  }

  return complexity;
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
  fhirRequestsTotal,
  fhirDuration,
  fhirErrors,
  queryComplexity,
  responseSize,
  PurposeOfUse,
  FhirResourceType,
  recordFhirRequest,
  recordFhirError,
  recordQueryComplexity,
  recordResponseSize,
  withTefcaMetrics,
  calculateQueryComplexity,
  getMetricsAsJson
};

