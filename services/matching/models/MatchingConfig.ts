/**
 * S72-STRETCH-D-001: MatchingConfig & FeatureWeights model
 *
 * Stores feature weights for matching algorithm:
 * - specialtyMatch: Weight for specialty compatibility
 * - locationProximity: Weight for geographic proximity
 * - experienceYears: Weight for years of experience
 * - rating: Weight for clinician rating/quality
 * - burnoutRisk: Weight for burnout risk (negative factor)
 */

import { z } from 'zod';

/**
 * Feature weights configuration for matching algorithm
 * All weights should sum to approximately 1.0 for normalized scoring
 */
export const FeatureWeightsSchema = z.object({
  specialtyMatch: z.number().min(0).max(1).default(0.35),
  locationProximity: z.number().min(0).max(1).default(0.25),
  experienceYears: z.number().min(0).max(1).default(0.20),
  rating: z.number().min(0).max(1).default(0.15),
  burnoutRisk: z.number().min(0).max(1).default(0.05), // Negative factor
});

export type FeatureWeights = z.infer<typeof FeatureWeightsSchema>;

/**
 * Matching configuration model
 * Stores organization-level or global matching preferences
 */
export interface MatchingConfig {
  id: string;
  orgId?: string; // null for global/default config
  name: string;
  description?: string;
  weights: FeatureWeights;
  isActive: boolean;
  isDefault: boolean; // Only one default config allowed
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Default feature weights
 */
export const DEFAULT_FEATURE_WEIGHTS: FeatureWeights = {
  specialtyMatch: 0.35,
  locationProximity: 0.25,
  experienceYears: 0.20,
  rating: 0.15,
  burnoutRisk: 0.05,
};

/**
 * Validate that feature weights sum to approximately 1.0
 */
export function validateWeightsSum(weights: FeatureWeights): boolean {
  const sum =
    weights.specialtyMatch +
    weights.locationProximity +
    weights.experienceYears +
    weights.rating +
    weights.burnoutRisk;
  return Math.abs(sum - 1.0) < 0.01; // Allow small floating point errors
}

/**
 * Normalize weights to sum to 1.0
 */
export function normalizeWeights(weights: FeatureWeights): FeatureWeights {
  const sum =
    weights.specialtyMatch +
    weights.locationProximity +
    weights.experienceYears +
    weights.rating +
    weights.burnoutRisk;

  if (sum === 0) {
    return DEFAULT_FEATURE_WEIGHTS;
  }

  return {
    specialtyMatch: weights.specialtyMatch / sum,
    locationProximity: weights.locationProximity / sum,
    experienceYears: weights.experienceYears / sum,
    rating: weights.rating / sum,
    burnoutRisk: weights.burnoutRisk / sum,
  };
}

