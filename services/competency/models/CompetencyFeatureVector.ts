/**
 * B205A-CCI-001: CompetencyFeatureVector model
 *
 * Stores feature vectors for competency analysis.
 * Each vector represents a snapshot of a clinician's competency-related features at a specific timestamp.
 */

import { z } from 'zod';

/**
 * Feature vector schema
 * Normalized values between 0-1 where applicable
 */
export const CompetencyFeaturesSchema = z.object({
  // Case volume (normalized)
  caseVolume: z.number().min(0).max(1), // 0 = low volume, 1 = high volume

  // Case complexity index (weighted by privilege risk/complexity)
  caseComplexityIndex: z.number().min(0).max(1), // 0 = simple cases, 1 = highly complex

  // Complication rate (normalized)
  complicationRate: z.number().min(0).max(1), // 0 = no complications, 1 = high rate

  // FPPE (Focused Professional Practice Evaluation) score
  FPPE_score: z.number().min(0).max(1), // 0 = poor, 1 = excellent

  // OPPE (Ongoing Professional Practice Evaluation) trend
  OPPE_trend: z.number().min(-1).max(1), // -1 = declining, 0 = stable, 1 = improving

  // Credential freshness (normalized days until expiry)
  credentialFreshness: z.number().min(0).max(1), // 0 = expired, 1 = fresh

  // Privilege depth (sub-privilege chain depth)
  privilegeDepth: z.number().min(0).max(1), // 0 = shallow, 1 = deep dependency chain

  // Privilege breadth (distinct privilege domains)
  privilegeBreadth: z.number().min(0).max(1), // 0 = narrow, 1 = broad across domains

  // Enrollment completeness (PECOS+Medicaid+payer readiness)
  enrollmentCompleteness: z.number().min(0).max(1), // 0 = incomplete, 1 = fully enrolled

  // Mobility readiness (compact eligibility, multi-state)
  mobilityReadiness: z.number().min(0).max(1), // 0 = not ready, 1 = highly mobile

  // Safety history (normalized safety events)
  safetyHistory: z.number().min(0).max(1), // 0 = poor safety record, 1 = excellent

  // Drift history (normalized drift events)
  driftHistory: z.number().min(0).max(1), // 0 = no drift, 1 = many drift events

  // Forecast risk (predicted risk score)
  forecastRisk: z.number().min(0).max(1), // 0 = low risk, 1 = high risk

  // Training years (normalized)
  trainingYears: z.number().min(0).max(1), // 0 = new, 1 = experienced (normalized)

  // Board recency (days since last board certification, normalized)
  boardRecency: z.number().min(0).max(1), // 0 = old/expired, 1 = recent
});

export type CompetencyFeatures = z.infer<typeof CompetencyFeaturesSchema>;

/**
 * CompetencyFeatureVector schema
 */
export const CompetencyFeatureVectorSchema = z.object({
  clinicianId: z.string().min(1, 'clinicianId is required'),
  timestamp: z.coerce.date(),
  features: CompetencyFeaturesSchema,
});

export type CompetencyFeatureVector = z.infer<typeof CompetencyFeatureVectorSchema>;

export type CreateCompetencyFeatureVectorInput = z.input<typeof CompetencyFeatureVectorSchema>;

/**
 * Create a competency feature vector
 */
export function createCompetencyFeatureVector(
  input: CreateCompetencyFeatureVectorInput
): CompetencyFeatureVector {
  return CompetencyFeatureVectorSchema.parse(input);
}

/**
 * Validate feature vector
 */
export function validateCompetencyFeatureVector(vector: unknown): CompetencyFeatureVector {
  return CompetencyFeatureVectorSchema.parse(vector);
}

/**
 * Get feature vector as array (for ML models)
 */
export function competencyFeatureVectorToArray(features: CompetencyFeatures): number[] {
  return [
    features.caseVolume,
    features.caseComplexityIndex,
    features.complicationRate,
    features.FPPE_score,
    features.OPPE_trend,
    features.credentialFreshness,
    features.privilegeDepth,
    features.privilegeBreadth,
    features.enrollmentCompleteness,
    features.mobilityReadiness,
    features.safetyHistory,
    features.driftHistory,
    features.forecastRisk,
    features.trainingYears,
    features.boardRecency,
  ];
}

/**
 * Get feature names in order
 */
export const COMPETENCY_FEATURE_NAMES = [
  'caseVolume',
  'caseComplexityIndex',
  'complicationRate',
  'FPPE_score',
  'OPPE_trend',
  'credentialFreshness',
  'privilegeDepth',
  'privilegeBreadth',
  'enrollmentCompleteness',
  'mobilityReadiness',
  'safetyHistory',
  'driftHistory',
  'forecastRisk',
  'trainingYears',
  'boardRecency',
] as const;

