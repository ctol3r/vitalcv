/**
 * Batch 400.3 — Synthesis Weighting Matrix v4
 * Weighted trust fusion logic per domain
 */

import type { NormalizedTrustSignal } from './normalize';

export interface TrustDomain {
  domain: string;
  signals: NormalizedTrustSignal[];
  domainWeight: number;
}

export interface WeightedTrustFusion {
  overallScore: number; // 0-100
  domainScores: Record<string, number>;
  confidence: number;
  contradictions: string[];
}

/**
 * Weighted trust fusion with domain-specific weighting
 */
export function fuseTrustSignals(domains: TrustDomain[]): WeightedTrustFusion {
  const domainScores: Record<string, number> = {};
  const contradictions: string[] = [];
  let totalWeightedScore = 0;
  let totalWeight = 0;
  let totalConfidence = 0;

  for (const domain of domains) {
    // Calculate domain score from signals
    let domainScore = 0;
    let signalWeight = 0;
    let domainConfidence = 0;

    for (const signal of domain.signals) {
      const signalWeighted = signal.normalizedValue * signal.weight;
      domainScore += signalWeighted;
      signalWeight += signal.weight;
      domainConfidence += signal.confidence * signal.weight;
    }

    const finalDomainScore = signalWeight > 0 ? domainScore / signalWeight : 0;
    const finalDomainConfidence = signalWeight > 0 ? domainConfidence / signalWeight : 0;

    domainScores[domain.domain] = Math.round(finalDomainScore * 100) / 100;

    // Apply domain weight to overall score
    const weightedDomainScore = finalDomainScore * domain.domainWeight;
    totalWeightedScore += weightedDomainScore;
    totalWeight += domain.domainWeight;
    totalConfidence += finalDomainConfidence * domain.domainWeight;

    // Check for contradictions (high variance in signals)
    if (domain.signals.length > 1) {
      const values = domain.signals.map((s) => s.normalizedValue);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev > 30) {
        // High variance indicates contradiction
        contradictions.push(`${domain.domain}: high signal variance (σ=${stdDev.toFixed(2)})`);
      }
    }
  }

  const overallScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  const overallConfidence = totalWeight > 0 ? totalConfidence / totalWeight : 0;

  return {
    overallScore: Math.round(overallScore * 100) / 100,
    domainScores,
    confidence: Math.round(overallConfidence * 100) / 100,
    contradictions,
  };
}

