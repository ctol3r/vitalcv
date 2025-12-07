/**
 * Batch 400.7 — Synthesis Forecasting Engine
 * Predict trust state 30-120 days ahead
 */

import type { NormalizedTrustSignal } from './normalize';

export interface TrustForecast {
  horizonDays: number;
  predictedScore: number;
  confidence: number;
  lowerBound: number;
  upperBound: number;
  trend: 'improving' | 'declining' | 'stable';
  factors: Array<{ factor: string; impact: number; direction: 'positive' | 'negative' | 'neutral' }>;
}

/**
 * Forecast trust state for future horizon
 */
export function forecastTrust(
  signals: NormalizedTrustSignal[],
  horizonDays: number = 90
): TrustForecast {
  if (signals.length === 0) {
    return {
      horizonDays,
      predictedScore: 50,
      confidence: 0,
      lowerBound: 0,
      upperBound: 100,
      trend: 'stable',
      factors: [],
    };
  }

  // Sort by timestamp
  const sorted = [...signals].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const values = sorted.map((s) => s.normalizedValue);
  const timestamps = sorted.map((s) => new Date(s.timestamp).getTime());

  // Simple linear regression for trend
  const n = values.length;
  const sumX = timestamps.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = timestamps.reduce((sum, x, i) => sum + x * values[i], 0);
  const sumX2 = timestamps.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Current score (most recent)
  const currentScore = values[values.length - 1];

  // Predict future score
  const now = Date.now();
  const futureTimestamp = now + horizonDays * 24 * 60 * 60 * 1000;
  const predictedScore = Math.max(0, Math.min(100, slope * futureTimestamp + intercept));

  // Calculate confidence based on data quality and recency
  const avgConfidence = sorted.reduce((sum, s) => sum + s.confidence, 0) / n;
  const mostRecentAge = (now - timestamps[timestamps.length - 1]) / (1000 * 60 * 60 * 24);
  const recencyFactor = Math.max(0, 1 - mostRecentAge / 30); // Decay over 30 days
  const confidence = avgConfidence * recencyFactor * (1 - horizonDays / 180); // Lower confidence for longer horizons

  // Calculate bounds (95% confidence interval approximation)
  const variance = values.reduce((sum, val) => {
    const mean = values.reduce((a, b) => a + b, 0) / n;
    return sum + Math.pow(val - mean, 2);
  }, 0) / n;
  const stdDev = Math.sqrt(variance);
  const margin = stdDev * 1.96; // 95% CI
  const lowerBound = Math.max(0, predictedScore - margin);
  const upperBound = Math.min(100, predictedScore + margin);

  // Determine trend
  let trend: TrustForecast['trend'];
  const scoreDelta = predictedScore - currentScore;
  if (Math.abs(scoreDelta) < 5) {
    trend = 'stable';
  } else {
    trend = scoreDelta > 0 ? 'improving' : 'declining';
  }

  // Identify factors
  const factors: TrustForecast['factors'] = [];
  if (slope > 0.0001) {
    factors.push({
      factor: 'Positive trend',
      impact: Math.abs(slope * horizonDays * 24 * 60 * 60 * 1000),
      direction: 'positive',
    });
  } else if (slope < -0.0001) {
    factors.push({
      factor: 'Negative trend',
      impact: Math.abs(slope * horizonDays * 24 * 60 * 60 * 1000),
      direction: 'negative',
    });
  }

  // Add variance as a factor
  if (stdDev > 15) {
    factors.push({
      factor: 'High volatility',
      impact: stdDev,
      direction: 'neutral',
    });
  }

  return {
    horizonDays,
    predictedScore: Math.round(predictedScore * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    lowerBound: Math.round(lowerBound * 100) / 100,
    upperBound: Math.round(upperBound * 100) / 100,
    trend,
    factors,
  };
}

