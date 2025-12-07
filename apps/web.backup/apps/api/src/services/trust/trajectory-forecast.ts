import type { TrustTrajectory } from './trajectory';

export interface ForecastPoint {
  timestamp: Date;
  predictedScore: number;
  confidenceInterval: [number, number]; // [lower, upper]
  confidence: number;
}

export interface TrustForecast {
  clinicianId: string;
  currentScore: number;
  forecast: ForecastPoint[];
  riskFactors: string[];
  reinforcementSignals: string[];
}

/**
 * Forecast trust trajectory using ARIMA-like approach
 * Simplified version using linear regression with trend
 */
export function forecastTrustTrajectory(
  trajectory: TrustTrajectory,
  daysAhead: number = 30,
): TrustForecast {
  const points = trajectory.points;
  const forecast: ForecastPoint[] = [];

  if (points.length < 3) {
    // Not enough data, return flat forecast
    const now = new Date();
    for (let i = 1; i <= daysAhead; i++) {
      const futureDate = new Date(now);
      futureDate.setDate(futureDate.getDate() + i);
      forecast.push({
        timestamp: futureDate,
        predictedScore: trajectory.currentScore,
        confidenceInterval: [
          Math.max(0, trajectory.currentScore - 0.1),
          Math.min(1, trajectory.currentScore + 0.1),
        ],
        confidence: 0.5,
      });
    }
    return {
      clinicianId: trajectory.clinicianId,
      currentScore: trajectory.currentScore,
      forecast,
      riskFactors: ['Insufficient historical data'],
      reinforcementSignals: [],
    };
  }

  // Simple linear regression on recent points
  const recent = points.slice(-10);
  const n = recent.length;
  const x = recent.map((_, i) => i);
  const y = recent.map(p => p.trustScore);

  // Compute slope and intercept
  const xMean = x.reduce((a, b) => a + b, 0) / n;
  const yMean = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (x[i] - xMean) * (y[i] - yMean);
    denominator += Math.pow(x[i] - xMean, 2);
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  // Generate forecast
  const now = new Date();
  const lastPoint = points[points.length - 1];
  const baseTime = lastPoint.timestamp.getTime();

  for (let i = 1; i <= daysAhead; i++) {
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + i);

    const daysFromLast = (futureDate.getTime() - baseTime) / (1000 * 60 * 60 * 24);
    const predictedScore = Math.max(0, Math.min(1, intercept + slope * (n + daysFromLast)));

    // Confidence decreases over time
    const confidence = Math.max(0.3, 1 - (i / daysAhead) * 0.5);
    const margin = 0.1 * (1 - confidence);

    forecast.push({
      timestamp: futureDate,
      predictedScore,
      confidenceInterval: [
        Math.max(0, predictedScore - margin),
        Math.min(1, predictedScore + margin),
      ],
      confidence,
    });
  }

  // Identify risk factors
  const riskFactors: string[] = [];
  if (trajectory.trend === 'decreasing') {
    riskFactors.push('Declining trust trend');
  }
  if (trajectory.volatility > 0.15) {
    riskFactors.push('High volatility in trust scores');
  }
  if (trajectory.currentScore < 0.4) {
    riskFactors.push('Low current trust score');
  }

  // Identify reinforcement signals
  const reinforcementSignals: string[] = [];
  if (trajectory.trend === 'increasing') {
    reinforcementSignals.push('Positive trust trend');
  }
  if (trajectory.currentScore > 0.7) {
    reinforcementSignals.push('High current trust score');
  }
  if (trajectory.volatility < 0.05) {
    reinforcementSignals.push('Stable trust pattern');
  }

  return {
    clinicianId: trajectory.clinicianId,
    currentScore: trajectory.currentScore,
    forecast,
    riskFactors,
    reinforcementSignals,
  };
}

