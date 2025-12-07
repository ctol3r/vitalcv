import type { TrustTrajectory } from './trajectory';
import type { Anomaly } from './trajectory-anomalies';

export interface TrustNarrative {
  summary: string;
  timeline: string[];
  keyEvents: string[];
  currentStatus: string;
  recommendations: string[];
}

/**
 * Generate plain-language summary of trust history
 */
export function generateTrustNarrative(
  trajectory: TrustTrajectory,
  anomalies: Anomaly[],
): TrustNarrative {
  const summary = generateSummary(trajectory);
  const timeline = generateTimeline(trajectory);
  const keyEvents = identifyKeyEvents(trajectory);
  const currentStatus = generateCurrentStatus(trajectory);
  const recommendations = generateRecommendations(trajectory, anomalies);

  return {
    summary,
    timeline,
    keyEvents,
    currentStatus,
    recommendations,
  };
}

function generateSummary(trajectory: TrustTrajectory): string {
  const scorePercent = Math.round(trajectory.currentScore * 100);
  const trendDesc = trajectory.trend === 'increasing'
    ? 'improving'
    : trajectory.trend === 'decreasing'
    ? 'declining'
    : 'stable';

  return `Trust trajectory shows a ${trendDesc} pattern with a current score of ${scorePercent}%. ` +
    `The trajectory has ${trajectory.points.length} recorded events over the monitoring period. ` +
    `Volatility is ${trajectory.volatility < 0.1 ? 'low' : trajectory.volatility < 0.2 ? 'moderate' : 'high'}.`;
}

function generateTimeline(trajectory: TrustTrajectory): string[] {
  const timeline: string[] = [];
  const points = trajectory.points;

  if (points.length === 0) {
    return ['No trust events recorded yet.'];
  }

  // Group by month for readability
  const monthlyGroups = new Map<string, TrustTrajectory['points']>();

  for (const point of points) {
    const monthKey = point.timestamp.toISOString().substring(0, 7); // YYYY-MM
    if (!monthlyGroups.has(monthKey)) {
      monthlyGroups.set(monthKey, []);
    }
    monthlyGroups.get(monthKey)!.push(point);
  }

  for (const [month, monthPoints] of monthlyGroups.entries()) {
    const avgScore = monthPoints.reduce((sum, p) => sum + p.trustScore, 0) / monthPoints.length;
    const scorePercent = Math.round(avgScore * 100);
    timeline.push(`${month}: Average trust score ${scorePercent}% (${monthPoints.length} events)`);
  }

  return timeline;
}

function identifyKeyEvents(trajectory: TrustTrajectory): string[] {
  const events: string[] = [];
  const points = trajectory.points;

  if (points.length === 0) {
    return ['No key events identified.'];
  }

  // Find highest and lowest points
  const scores = points.map(p => p.trustScore);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const maxIndex = scores.indexOf(maxScore);
  const minIndex = scores.indexOf(minScore);

  if (maxIndex >= 0) {
    const maxPoint = points[maxIndex];
    events.push(`Peak trust: ${Math.round(maxScore * 100)}% on ${maxPoint.timestamp.toLocaleDateString()}`);
  }

  if (minIndex >= 0 && minIndex !== maxIndex) {
    const minPoint = points[minIndex];
    events.push(`Lowest trust: ${Math.round(minScore * 100)}% on ${minPoint.timestamp.toLocaleDateString()}`);
  }

  // Find significant changes
  for (let i = 1; i < points.length; i++) {
    const change = points[i].trustScore - points[i - 1].trustScore;
    if (Math.abs(change) > 0.1) {
      const direction = change > 0 ? 'increase' : 'decrease';
      events.push(`Significant ${direction}: ${Math.abs(change * 100).toFixed(1)}% on ${points[i].timestamp.toLocaleDateString()}`);
    }
  }

  return events.length > 0 ? events : ['No significant events identified.'];
}

function generateCurrentStatus(trajectory: TrustTrajectory): string {
  const scorePercent = Math.round(trajectory.currentScore * 100);
  let status = `Current trust score: ${scorePercent}%`;

  if (trajectory.currentScore >= 0.7) {
    status += ' (High trust)';
  } else if (trajectory.currentScore >= 0.4) {
    status += ' (Moderate trust)';
  } else {
    status += ' (Low trust)';
  }

  status += `. Trend: ${trajectory.trend}`;
  status += `. Volatility: ${trajectory.volatility < 0.1 ? 'Low' : trajectory.volatility < 0.2 ? 'Moderate' : 'High'}`;

  return status;
}

function generateRecommendations(trajectory: TrustTrajectory, anomalies: Anomaly[]): string[] {
  const recommendations: string[] = [];

  if (trajectory.currentScore < 0.4) {
    recommendations.push('Trust score is below threshold. Review recent events and consider intervention.');
  }

  if (trajectory.trend === 'decreasing') {
    recommendations.push('Trust is declining. Investigate root causes and implement corrective measures.');
  }

  if (trajectory.volatility > 0.15) {
    recommendations.push('High volatility detected. Review event patterns for consistency issues.');
  }

  const highSeverityAnomalies = anomalies.filter(a => a.severity === 'high');
  if (highSeverityAnomalies.length > 0) {
    recommendations.push(`${highSeverityAnomalies.length} high-severity anomalies detected. Immediate review recommended.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Trust trajectory appears healthy. Continue monitoring.');
  }

  return recommendations;
}

