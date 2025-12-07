/**
 * Batch 400.8 — Cross-Jurisdiction Trust Synthesis
 * Combine trust signals across countries
 */

import type { NormalizedTrustSignal } from './normalize';

export interface JurisdictionTrust {
  jurisdiction: string;
  countryCode: string;
  signals: NormalizedTrustSignal[];
  score: number;
  weight: number;
}

export interface CrossJurisdictionSynthesis {
  globalScore: number;
  jurisdictionScores: Record<string, number>;
  harmonized: boolean;
  conflicts: Array<{ jurisdiction1: string; jurisdiction2: string; delta: number; reason: string }>;
  recommendations: string[];
}

/**
 * Synthesize trust across multiple jurisdictions
 */
export function synthesizeCrossJurisdiction(jurisdictions: JurisdictionTrust[]): CrossJurisdictionSynthesis {
  if (jurisdictions.length === 0) {
    return {
      globalScore: 0,
      jurisdictionScores: {},
      harmonized: true,
      conflicts: [],
      recommendations: [],
    };
  }

  const jurisdictionScores: Record<string, number> = {};
  let totalWeightedScore = 0;
  let totalWeight = 0;

  // Calculate scores per jurisdiction
  for (const jur of jurisdictions) {
    if (jur.signals.length === 0) {
      jurisdictionScores[jur.jurisdiction] = 0;
      continue;
    }

    const weightedSum = jur.signals.reduce((sum, s) => sum + s.normalizedValue * s.weight, 0);
    const totalSignalWeight = jur.signals.reduce((sum, s) => sum + s.weight, 0);
    const jurScore = totalSignalWeight > 0 ? weightedSum / totalSignalWeight : 0;

    jurisdictionScores[jur.jurisdiction] = Math.round(jurScore * 100) / 100;

    // Add to global weighted average
    totalWeightedScore += jurScore * jur.weight;
    totalWeight += jur.weight;
  }

  const globalScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

  // Detect conflicts (large differences between jurisdictions)
  const conflicts: CrossJurisdictionSynthesis['conflicts'] = [];
  for (let i = 0; i < jurisdictions.length; i++) {
    for (let j = i + 1; j < jurisdictions.length; j++) {
      const jur1 = jurisdictions[i];
      const jur2 = jurisdictions[j];
      const score1 = jurisdictionScores[jur1.jurisdiction];
      const score2 = jurisdictionScores[jur2.jurisdiction];
      const delta = Math.abs(score1 - score2);

      if (delta > 30) {
        conflicts.push({
          jurisdiction1: jur1.jurisdiction,
          jurisdiction2: jur2.jurisdiction,
          delta: Math.round(delta * 100) / 100,
          reason: `Significant score difference: ${score1.toFixed(1)} vs ${score2.toFixed(1)}`,
        });
      }
    }
  }

  const harmonized = conflicts.length === 0;

  // Generate recommendations
  const recommendations: string[] = [];
  if (!harmonized) {
    recommendations.push('Review regulatory differences between conflicting jurisdictions');
    recommendations.push('Consider jurisdiction-specific trust weighting');
  }

  const scoreVariance = Object.values(jurisdictionScores).reduce((sum, score) => {
    const mean = Object.values(jurisdictionScores).reduce((a, b) => a + b, 0) / Object.keys(jurisdictionScores).length;
    return sum + Math.pow(score - mean, 2);
  }, 0) / Object.keys(jurisdictionScores).length;

  if (scoreVariance > 400) {
    recommendations.push('High variance across jurisdictions - consider normalization');
  }

  return {
    globalScore: Math.round(globalScore * 100) / 100,
    jurisdictionScores,
    harmonized,
    conflicts,
    recommendations,
  };
}

