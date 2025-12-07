/**
 * S72-STRETCH-D-006: Explainability service: reason codes per match
 *
 * Given candidate & job features + score, returns explanation tags:
 * - 'specialty match'
 * - 'geographically close'
 * - 'high burnout risk'
 * - 'experienced'
 * - 'high rating'
 * - etc.
 */

import { FeatureScores } from './score';

/**
 * Explanation tag types
 */
export type ExplanationTag =
  | 'specialty_match'
  | 'specialty_category_match'
  | 'geographically_close'
  | 'geographically_distant'
  | 'experienced'
  | 'inexperienced'
  | 'high_rating'
  | 'low_rating'
  | 'high_burnout_risk'
  | 'low_burnout_risk'
  | 'strong_embedding_match'
  | 'weak_embedding_match';

/**
 * Explanation with tag and confidence
 */
export interface Explanation {
  tag: ExplanationTag;
  confidence: number; // 0-1
  message: string;
}

/**
 * Generate explanations for a match
 */
export function generateExplanations(
  features: FeatureScores,
  embeddingSimilarity: number,
  score: number
): Explanation[] {
  const explanations: Explanation[] = [];

  // Specialty match explanations
  if (features.specialtyMatch >= 0.9) {
    explanations.push({
      tag: 'specialty_match',
      confidence: features.specialtyMatch,
      message: 'Exact specialty match',
    });
  } else if (features.specialtyMatch >= 0.7) {
    explanations.push({
      tag: 'specialty_category_match',
      confidence: features.specialtyMatch,
      message: 'Specialty category match',
    });
  }

  // Location explanations
  if (features.locationProximity >= 0.8) {
    explanations.push({
      tag: 'geographically_close',
      confidence: features.locationProximity,
      message: 'Geographically close to job location',
    });
  } else if (features.locationProximity <= 0.3) {
    explanations.push({
      tag: 'geographically_distant',
      confidence: 1 - features.locationProximity,
      message: 'Geographically distant from job location',
    });
  }

  // Experience explanations
  if (features.experienceYears >= 0.8) {
    explanations.push({
      tag: 'experienced',
      confidence: features.experienceYears,
      message: 'Highly experienced candidate',
    });
  } else if (features.experienceYears <= 0.3) {
    explanations.push({
      tag: 'inexperienced',
      confidence: 1 - features.experienceYears,
      message: 'Limited experience',
    });
  }

  // Rating explanations
  if (features.rating >= 0.8) {
    explanations.push({
      tag: 'high_rating',
      confidence: features.rating,
      message: 'High quality rating',
    });
  } else if (features.rating <= 0.3) {
    explanations.push({
      tag: 'low_rating',
      confidence: 1 - features.rating,
      message: 'Lower quality rating',
    });
  }

  // Burnout risk explanations
  if (features.burnoutRisk <= 0.3) {
    explanations.push({
      tag: 'high_burnout_risk',
      confidence: 1 - features.burnoutRisk,
      message: 'High burnout risk detected',
    });
  } else if (features.burnoutRisk >= 0.8) {
    explanations.push({
      tag: 'low_burnout_risk',
      confidence: features.burnoutRisk,
      message: 'Low burnout risk',
    });
  }

  // Embedding similarity explanations
  if (embeddingSimilarity >= 0.8) {
    explanations.push({
      tag: 'strong_embedding_match',
      confidence: embeddingSimilarity,
      message: 'Strong semantic match based on profile',
    });
  } else if (embeddingSimilarity <= 0.4) {
    explanations.push({
      tag: 'weak_embedding_match',
      confidence: 1 - embeddingSimilarity,
      message: 'Weak semantic match',
    });
  }

  // Sort by confidence (highest first)
  explanations.sort((a, b) => b.confidence - a.confidence);

  return explanations;
}

/**
 * Get top N explanations (most relevant)
 */
export function getTopExplanations(
  explanations: Explanation[],
  limit: number = 5
): Explanation[] {
  return explanations.slice(0, limit);
}

/**
 * Format explanations as human-readable text
 */
export function formatExplanations(explanations: Explanation[]): string {
  if (explanations.length === 0) {
    return 'No specific match factors identified';
  }

  return explanations
    .map((exp) => `${exp.message} (${Math.round(exp.confidence * 100)}%)`)
    .join('; ');
}

/**
 * Get explanation summary (positive and negative factors)
 */
export interface ExplanationSummary {
  positive: Explanation[];
  negative: Explanation[];
  neutral: Explanation[];
}

export function categorizeExplanations(
  explanations: Explanation[]
): ExplanationSummary {
  const positive: Explanation[] = [];
  const negative: Explanation[] = [];
  const neutral: Explanation[] = [];

  const positiveTags: ExplanationTag[] = [
    'specialty_match',
    'specialty_category_match',
    'geographically_close',
    'experienced',
    'high_rating',
    'low_burnout_risk',
    'strong_embedding_match',
  ];

  const negativeTags: ExplanationTag[] = [
    'geographically_distant',
    'inexperienced',
    'low_rating',
    'high_burnout_risk',
    'weak_embedding_match',
  ];

  for (const exp of explanations) {
    if (positiveTags.includes(exp.tag)) {
      positive.push(exp);
    } else if (negativeTags.includes(exp.tag)) {
      negative.push(exp);
    } else {
      neutral.push(exp);
    }
  }

  return { positive, negative, neutral };
}

