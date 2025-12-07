import type { TrustTrajectory } from './trajectory';

export interface Anomaly {
  type: 'sudden_drop' | 'sudden_spike' | 'unexpected_pattern';
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
  description: string;
  confidence: number;
}

const DROP_THRESHOLD = 0.15; // 15% drop
const SPIKE_THRESHOLD = 0.2; // 20% spike
const MIN_EVIDENCE_POINTS = 3;

/**
 * Detect anomalies in trust trajectory
 */
export function detectTrajectoryAnomalies(trajectory: TrustTrajectory): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const points = trajectory.points;

  if (points.length < 2) {
    return anomalies;
  }

  // Check for sudden drops
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const drop = prev.trustScore - curr.trustScore;

    if (drop > DROP_THRESHOLD) {
      // Check if there's evidence for the drop
      const recentEvents = points.slice(Math.max(0, i - MIN_EVIDENCE_POINTS), i);
      const hasEvidence = recentEvents.length >= MIN_EVIDENCE_POINTS;

      anomalies.push({
        type: 'sudden_drop',
        severity: drop > 0.3 ? 'high' : drop > 0.2 ? 'medium' : 'low',
        timestamp: curr.timestamp,
        description: `Trust score dropped by ${(drop * 100).toFixed(1)}% from ${prev.trustScore.toFixed(2)} to ${curr.trustScore.toFixed(2)}`,
        confidence: hasEvidence ? 0.7 : 0.9, // Higher confidence if no evidence (suspicious)
      });
    }
  }

  // Check for sudden spikes without evidence
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const spike = curr.trustScore - prev.trustScore;

    if (spike > SPIKE_THRESHOLD) {
      // Check if there's evidence for the spike
      const recentEvents = points.slice(Math.max(0, i - MIN_EVIDENCE_POINTS), i);
      const hasEvidence = recentEvents.length >= MIN_EVIDENCE_POINTS &&
        recentEvents.some(p => p.factors.some(f => f.impact > 0));

      if (!hasEvidence) {
        anomalies.push({
          type: 'sudden_spike',
          severity: spike > 0.4 ? 'high' : spike > 0.3 ? 'medium' : 'low',
          timestamp: curr.timestamp,
          description: `Trust score spiked by ${(spike * 100).toFixed(1)}% from ${prev.trustScore.toFixed(2)} to ${curr.trustScore.toFixed(2)} without clear evidence`,
          confidence: 0.85,
        });
      }
    }
  }

  // Check for unexpected patterns (high volatility)
  if (trajectory.volatility > 0.1 && points.length >= 10) {
    const recentVolatility = computeRecentVolatility(points.slice(-10));
    if (recentVolatility > 0.15) {
      anomalies.push({
        type: 'unexpected_pattern',
        severity: recentVolatility > 0.25 ? 'high' : 'medium',
        timestamp: points[points.length - 1].timestamp,
        description: `High volatility detected: ${(recentVolatility * 100).toFixed(1)}% standard deviation in recent scores`,
        confidence: 0.75,
      });
    }
  }

  return anomalies;
}

function computeRecentVolatility(points: TrustTrajectoryPoint[]): number {
  if (points.length < 2) return 0;
  const scores = points.map(p => p.trustScore);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / scores.length;
  return Math.sqrt(variance);
}

