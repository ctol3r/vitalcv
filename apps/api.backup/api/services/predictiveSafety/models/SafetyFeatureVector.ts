/**
 * B203A-ML-001: SafetyFeatureVector model
 *
 * Stores feature vectors for predictive safety analysis.
 * Each vector represents a snapshot of a clinician's safety-related features at a specific timestamp.
 */

import { z } from 'zod';

/**
 * Feature vector schema
 * Normalized values between 0-1 where applicable
 */
export const SafetyFeaturesSchema = z.object({
  // OPPE (Ongoing Professional Practice Evaluation) trend
  oppe_trend: z.number().min(-1).max(1), // -1 = declining, 0 = stable, 1 = improving

  // FPPE (Focused Professional Practice Evaluation) outcomes
  fppe_outcomes: z.number().min(0).max(1), // 0 = poor, 1 = excellent

  // Complication rate (normalized)
  complication_rate: z.number().min(0).max(1), // 0 = no complications, 1 = high rate

  // Drift events count (normalized)
  drift_events: z.number().min(0).max(1), // 0 = no drift, 1 = many drift events

  // License freshness (days until expiry, normalized)
  license_freshness: z.number().min(0).max(1), // 0 = expired, 1 = fresh (years remaining)

  // Board certification freshness
  board_freshness: z.number().min(0).max(1), // 0 = expired, 1 = fresh

  // DEA expiry status
  dea_expiry: z.number().min(0).max(1), // 0 = expired, 1 = valid (years remaining)

  // PECOS enrollment status
  pecos_status: z.number().min(0).max(1), // 0 = not enrolled/expired, 1 = active

  // Payer denials (normalized rate)
  payer_denials: z.number().min(0).max(1), // 0 = no denials, 1 = high denial rate

  // EHR mismatches count (normalized)
  ehr_mismatches: z.number().min(0).max(1), // 0 = no mismatches, 1 = many mismatches
});

export type SafetyFeatures = z.infer<typeof SafetyFeaturesSchema>;

/**
 * SafetyFeatureVector schema
 */
export const SafetyFeatureVectorSchema = z.object({
  clinicianId: z.string().min(1, 'clinicianId is required'),
  timestamp: z.coerce.date(),
  features: SafetyFeaturesSchema,
});

export type SafetyFeatureVector = z.infer<typeof SafetyFeatureVectorSchema>;

export type CreateSafetyFeatureVectorInput = z.input<typeof SafetyFeatureVectorSchema>;

/**
 * Create a safety feature vector
 */
export function createSafetyFeatureVector(
  input: CreateSafetyFeatureVectorInput
): SafetyFeatureVector {
  return SafetyFeatureVectorSchema.parse(input);
}

/**
 * Validate feature vector
 */
export function validateFeatureVector(vector: unknown): SafetyFeatureVector {
  return SafetyFeatureVectorSchema.parse(vector);
}

/**
 * Get feature vector as array (for ML models)
 */
export function featureVectorToArray(features: SafetyFeatures): number[] {
  return [
    features.oppe_trend,
    features.fppe_outcomes,
    features.complication_rate,
    features.drift_events,
    features.license_freshness,
    features.board_freshness,
    features.dea_expiry,
    features.pecos_status,
    features.payer_denials,
    features.ehr_mismatches,
  ];
}

/**
 * Get feature names in order
 */
export const FEATURE_NAMES = [
  'oppe_trend',
  'fppe_outcomes',
  'complication_rate',
  'drift_events',
  'license_freshness',
  'board_freshness',
  'dea_expiry',
  'pecos_status',
  'payer_denials',
  'ehr_mismatches',
] as const;

