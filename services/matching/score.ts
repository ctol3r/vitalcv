/**
 * B131A-MATCH-004: Similarity scoring function (cosine + feature-weighted score)
 *
 * score(clinVec, jobVec, features) returns composite score ∈ [0,1]
 * Unit tests validate monotonicity & feature weighting
 */

import { FeatureWeights, DEFAULT_FEATURE_WEIGHTS } from './models/MatchingConfig';

/**
 * Feature scores extracted from clinician and job profiles
 */
export interface FeatureScores {
  specialtyMatch: number; // 0-1, based on specialty compatibility
  locationProximity: number; // 0-1, based on distance
  experienceYears: number; // 0-1, normalized years of experience
  rating: number; // 0-1, clinician rating/quality score
  burnoutRisk: number; // 0-1, burnout risk (higher = worse, will be inverted)
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  // Cosine similarity is in [-1, 1], normalize to [0, 1]
  return (dotProduct / denominator + 1) / 2;
}

/**
 * Extract feature scores from clinician and job data
 * This is a placeholder - in production, this would extract from actual profiles
 */
export function extractFeatureScores(
  clinicianData: {
    specialty?: string;
    location?: { lat: number; lng: number };
    experienceYears?: number;
    rating?: number;
    burnoutRisk?: number;
  },
  jobData: {
    specialty?: string;
    location?: { lat: number; lng: number };
    minExperienceYears?: number;
  }
): FeatureScores {
  // Specialty match
  let specialtyMatch = 0;
  if (clinicianData.specialty && jobData.specialty) {
    if (clinicianData.specialty === jobData.specialty) {
      specialtyMatch = 1.0;
    } else if (
      clinicianData.specialty.substring(0, 4) ===
      jobData.specialty.substring(0, 4)
    ) {
      specialtyMatch = 0.8; // Same category
    } else if (
      clinicianData.specialty.substring(0, 2) ===
      jobData.specialty.substring(0, 2)
    ) {
      specialtyMatch = 0.5; // Same group
    }
  }

  // Location proximity (simplified - would use actual distance calculation)
  let locationProximity = 0.5; // Default neutral
  if (clinicianData.location && jobData.location) {
    // Use Haversine distance (simplified here)
    const distance = calculateDistance(
      clinicianData.location.lat,
      clinicianData.location.lng,
      jobData.location.lat,
      jobData.location.lng
    );
    // Normalize distance to 0-1 (closer = higher score)
    locationProximity = Math.max(0, 1 - distance / 1000); // 1000 miles = 0 score
  }

  // Experience years (normalized)
  let experienceYears = 0.5; // Default neutral
  if (clinicianData.experienceYears !== undefined) {
    const minExp = jobData.minExperienceYears || 0;
    if (clinicianData.experienceYears >= minExp) {
      // More experience is better, but with diminishing returns
      const excessYears = clinicianData.experienceYears - minExp;
      experienceYears = Math.min(1.0, 0.5 + excessYears / 10); // 10 years = max
    } else {
      experienceYears = Math.max(0, 0.5 - (minExp - clinicianData.experienceYears) / 5);
    }
  }

  // Rating (assume already normalized 0-1)
  const rating = clinicianData.rating ?? 0.5;

  // Burnout risk (invert so higher risk = lower score)
  const burnoutRisk = 1 - (clinicianData.burnoutRisk ?? 0.5);

  return {
    specialtyMatch,
    locationProximity,
    experienceYears,
    rating,
    burnoutRisk,
  };
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Compute composite match score
 * Combines cosine similarity (from embeddings) with feature-weighted scores
 *
 * @param clinVec - Clinician embedding vector
 * @param jobVec - Job embedding vector
 * @param features - Feature scores extracted from profiles
 * @param weights - Feature weights (defaults to DEFAULT_FEATURE_WEIGHTS)
 * @returns Composite score in [0, 1]
 */
export function score(
  clinVec: number[],
  jobVec: number[],
  features: FeatureScores,
  weights: FeatureWeights = DEFAULT_FEATURE_WEIGHTS
): number {
  // Cosine similarity from embeddings (weighted 50%)
  const embeddingScore = cosineSimilarity(clinVec, jobVec);

  // Feature-weighted score (weighted 50%)
  const featureScore =
    features.specialtyMatch * weights.specialtyMatch +
    features.locationProximity * weights.locationProximity +
    features.experienceYears * weights.experienceYears +
    features.rating * weights.rating +
    features.burnoutRisk * weights.burnoutRisk;

  // Combine: 50% embedding similarity, 50% feature-weighted
  const compositeScore = 0.5 * embeddingScore + 0.5 * featureScore;

  // Ensure result is in [0, 1]
  return Math.max(0, Math.min(1, compositeScore));
}

/**
 * Batch score multiple clinician-job pairs
 */
export function batchScore(
  pairs: Array<{
    clinVec: number[];
    jobVec: number[];
    features: FeatureScores;
  }>,
  weights: FeatureWeights = DEFAULT_FEATURE_WEIGHTS
): Array<{ score: number; index: number }> {
  return pairs.map((pair, index) => ({
    score: score(pair.clinVec, pair.jobVec, pair.features, weights),
    index,
  }));
}

