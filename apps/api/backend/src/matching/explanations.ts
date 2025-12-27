import { FeatureScores } from './score';

export interface Explanation {
  tag: string;
  confidence: number;
  message: string;
}

export function generateExplanations(
  features: FeatureScores,
  embeddingSimilarity: number,
): Explanation[] {
  const explanations: Explanation[] = [];

  if (features.specialtyMatch >= 0.9) {
    explanations.push({
      tag: 'specialty_match',
      confidence: features.specialtyMatch,
      message: 'Verified license match',
    });
  } else if (features.specialtyMatch >= 0.6) {
    explanations.push({
      tag: 'specialty_category_match',
      confidence: features.specialtyMatch,
      message: 'Credential category aligns',
    });
  } else {
    explanations.push({
      tag: 'specialty_gap',
      confidence: 1 - features.specialtyMatch,
      message: 'Missing aligned credential',
    });
  }

  if (features.locationProximity >= 0.8) {
    explanations.push({
      tag: 'geographically_close',
      confidence: features.locationProximity,
      message: 'Geographically close',
    });
  }

  if (features.experienceYears >= 0.8) {
    explanations.push({
      tag: 'experienced',
      confidence: features.experienceYears,
      message: 'Strong experience match',
    });
  }

  if (features.rating >= 0.8) {
    explanations.push({
      tag: 'high_rating',
      confidence: features.rating,
      message: 'High clinician rating',
    });
  }

  if (features.burnoutRisk <= 0.3) {
    explanations.push({
      tag: 'high_burnout_risk',
      confidence: 1 - features.burnoutRisk,
      message: 'High burnout risk',
    });
  } else if (features.burnoutRisk >= 0.8) {
    explanations.push({
      tag: 'low_burnout_risk',
      confidence: features.burnoutRisk,
      message: 'Low burnout risk',
    });
  }

  if (embeddingSimilarity >= 0.8) {
    explanations.push({
      tag: 'strong_embedding_match',
      confidence: embeddingSimilarity,
      message: 'Strong profile similarity',
    });
  } else if (embeddingSimilarity <= 0.4) {
    explanations.push({
      tag: 'weak_embedding_match',
      confidence: 1 - embeddingSimilarity,
      message: 'Weak profile similarity',
    });
  }

  explanations.sort((a, b) => b.confidence - a.confidence);
  return explanations;
}

export function topExplanationMessages(explanations: Explanation[], limit = 4): string[] {
  return explanations.slice(0, limit).map((exp) => exp.message);
}
