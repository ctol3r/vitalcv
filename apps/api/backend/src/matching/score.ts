/**
 * MATCHA Lite scoring helpers (cosine + feature-weighted score)
 */

export interface FeatureWeights {
  specialtyMatch: number;
  locationProximity: number;
  experienceYears: number;
  rating: number;
  burnoutRisk: number;
}

export const DEFAULT_FEATURE_WEIGHTS: FeatureWeights = {
  specialtyMatch: 0.3,
  locationProximity: 0.2,
  experienceYears: 0.2,
  rating: 0.2,
  burnoutRisk: 0.1,
};

export interface FeatureScores {
  specialtyMatch: number;
  locationProximity: number;
  experienceYears: number;
  rating: number;
  burnoutRisk: number;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i += 1) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return (dotProduct / denominator + 1) / 2;
}

export function score(
  clinVec: number[],
  jobVec: number[],
  features: FeatureScores,
  weights: FeatureWeights = DEFAULT_FEATURE_WEIGHTS,
): number {
  const embeddingScore = cosineSimilarity(clinVec, jobVec);

  const featureScore =
    features.specialtyMatch * weights.specialtyMatch +
    features.locationProximity * weights.locationProximity +
    features.experienceYears * weights.experienceYears +
    features.rating * weights.rating +
    features.burnoutRisk * weights.burnoutRisk;

  const compositeScore = 0.5 * embeddingScore + 0.5 * featureScore;
  return Math.max(0, Math.min(1, compositeScore));
}
