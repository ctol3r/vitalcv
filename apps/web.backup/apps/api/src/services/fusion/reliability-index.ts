import type { IdentitySource } from './ingestion-v3';
import type { IdentityLineage } from './lineage-tracker';

export interface ReliabilityMetrics {
  overallScore: number;
  sourceDiversity: number;
  validationDensity: number;
  temporalConsistency: number;
  fieldCoverage: number;
  breakdown: {
    sourceDiversity: number;
    validationDensity: number;
    temporalConsistency: number;
    fieldCoverage: number;
  };
}

/**
 * Compute identity reliability index based on validation density and source quality
 */
export function computeReliabilityIndex(
  sources: IdentitySource[],
  lineage: IdentityLineage,
): ReliabilityMetrics {
  const sourceDiversity = computeSourceDiversity(sources);
  const validationDensity = computeValidationDensity(sources);
  const temporalConsistency = computeTemporalConsistency(sources);
  const fieldCoverage = computeFieldCoverage(sources);

  // Weighted average
  const overallScore =
    sourceDiversity * 0.25 +
    validationDensity * 0.35 +
    temporalConsistency * 0.2 +
    fieldCoverage * 0.2;

  return {
    overallScore: Math.min(Math.max(overallScore, 0), 1),
    sourceDiversity,
    validationDensity,
    temporalConsistency,
    fieldCoverage,
    breakdown: {
      sourceDiversity,
      validationDensity,
      temporalConsistency,
      fieldCoverage,
    },
  };
}

function computeSourceDiversity(sources: IdentitySource[]): number {
  if (!sources.length) {
    return 0;
  }

  const uniqueTypes = new Set(sources.map((s) => s.sourceType));
  const maxTypes = 4; // NPPES, STATE_BOARD, NPDB, GLOBAL_REGULATOR

  return Math.min(uniqueTypes.size / maxTypes, 1.0);
}

function computeValidationDensity(sources: IdentitySource[]): number {
  if (!sources.length) {
    return 0;
  }

  // Higher confidence sources contribute more
  const totalConfidence = sources.reduce((sum, s) => sum + s.confidence, 0);
  const avgConfidence = totalConfidence / sources.length;

  // More sources = higher density
  const sourceCountFactor = Math.min(sources.length / 4, 1.0);

  return (avgConfidence * 0.7 + sourceCountFactor * 0.3);
}

function computeTemporalConsistency(sources: IdentitySource[]): number {
  if (sources.length < 2) {
    return 1.0; // Single source is consistent by definition
  }

  const timestamps = sources
    .map((s) => new Date(s.timestamp).getTime())
    .sort((a, b) => a - b);

  // Check if timestamps are within reasonable range (e.g., 1 year)
  const oldest = timestamps[0];
  const newest = timestamps[timestamps.length - 1];
  const rangeMs = newest - oldest;
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;

  if (rangeMs > oneYearMs) {
    // Penalize if data spans more than a year
    return Math.max(0.5, 1 - (rangeMs - oneYearMs) / oneYearMs);
  }

  return 1.0;
}

function computeFieldCoverage(sources: IdentitySource[]): number {
  if (!sources.length) {
    return 0;
  }

  const allFields = new Set<string>();
  for (const source of sources) {
    for (const field of Object.keys(source.data)) {
      if (source.data[field] !== null && source.data[field] !== undefined) {
        allFields.add(field);
      }
    }
  }

  // Expected fields for complete identity
  const expectedFields = [
    'name',
    'npi',
    'licenseNumber',
    'state',
    'specialty',
    'issueDate',
    'expiryDate',
  ];

  const coveredFields = expectedFields.filter((field) => allFields.has(field));
  return coveredFields.length / expectedFields.length;
}

