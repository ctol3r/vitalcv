/**
 * Batch 400.6 — Trust Stability Measure
 * Score trust stability 0-100
 */

import type { NormalizedTrustSignal } from './normalize';

export interface StabilityMetrics {
  score: number; // 0-100, higher = more stable
  variance: number;
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  volatility: number;
  confidence: number;
}

/**
 * Calculate trust stability score
 */
export function calculateStability(signals: NormalizedTrustSignal[]): StabilityMetrics {
  if (signals.length === 0) {
    return {
      score: 0,
      variance: 0,
      trend: 'stable',
      volatility: 0,
      confidence: 0,
    };
  }

  if (signals.length === 1) {
    return {
      score: 50, // Neutral for single data point
      variance: 0,
      trend: 'stable',
      volatility: 0,
      confidence: signals[0].confidence,
    };
  }

  // Sort by timestamp
  const sorted = [...signals].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const values = sorted.map((s) => s.normalizedValue);

  // Calculate variance
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Calculate trend
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const trendDelta = secondMean - firstMean;

  let trend: StabilityMetrics['trend'];
  if (Math.abs(trendDelta) < 5) {
    trend = stdDev < 10 ? 'stable' : 'volatile';
  } else {
    trend = trendDelta > 0 ? 'increasing' : 'decreasing';
  }

  // Calculate volatility (coefficient of variation)
  const volatility = mean > 0 ? (stdDev / mean) * 100 : 0;

  // Stability score: inverse of volatility, normalized to 0-100
  // Lower variance and volatility = higher stability
  const maxExpectedStdDev = 25; // Assume max reasonable std dev
  const stabilityFromVariance = Math.max(0, 100 - (stdDev / maxExpectedStdDev) * 100);
  const stabilityFromVolatility = Math.max(0, 100 - Math.min(volatility, 100));
  const score = (stabilityFromVariance + stabilityFromVolatility) / 2;

  // Average confidence
  const confidence = sorted.reduce((sum, s) => sum + s.confidence, 0) / sorted.length;

  return {
    score: Math.round(score * 100) / 100,
    variance: Math.round(variance * 100) / 100,
    trend,
    volatility: Math.round(volatility * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
  };
}

