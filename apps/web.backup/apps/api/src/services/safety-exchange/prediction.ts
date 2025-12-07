import type { HarmonizedSanction } from './harmonization';
import type { AdverseActionLineage } from './lineage';

export interface PredictedSanction {
  type: string;
  predictedDate: string;
  confidence: number;
  riskFactors: string[];
  recommendedActions: string[];
}

/**
 * Predict high-likelihood future sanction events
 */
export function predictFutureSanctions(
  lineages: AdverseActionLineage[],
  recentSanctions: HarmonizedSanction[],
): PredictedSanction[] {
  const predictions: PredictedSanction[] = [];

  for (const lineage of lineages) {
    // If severity is increasing and recurrence is accelerating, predict another event
    if (
      lineage.severityTrend === 'increasing' &&
      lineage.recurrencePattern.trend === 'accelerating'
    ) {
      const lastEvent = lineage.relatedEvents[lineage.relatedEvents.length - 1] ?? lineage.rootEvent;
      const lastDate = new Date(lastEvent.eventDate);

      // Predict next event based on recurrence pattern
      const avgInterval = calculateAverageInterval(lineage.relatedEvents);
      const predictedDate = new Date(lastDate);
      predictedDate.setDate(predictedDate.getDate() + avgInterval);

      predictions.push({
        type: lineage.rootEvent.harmonizedType,
        predictedDate: predictedDate.toISOString(),
        confidence: Math.min(0.9, 0.5 + lineage.riskScore / 200),
        riskFactors: [
          `Severity trend: ${lineage.severityTrend}`,
          `Recurrence pattern: ${lineage.recurrencePattern.frequency}`,
          `Risk score: ${lineage.riskScore}/100`,
        ],
        recommendedActions: [
          'Review clinician practice patterns',
          'Implement enhanced monitoring',
          'Consider practice restrictions',
        ],
      });
    }

    // High risk score (>70) suggests future events likely
    if (lineage.riskScore > 70) {
      const lastEvent = lineage.relatedEvents[lineage.relatedEvents.length - 1] ?? lineage.rootEvent;
      const lastDate = new Date(lastEvent.eventDate);
      const predictedDate = new Date(lastDate);
      predictedDate.setFullYear(predictedDate.getFullYear() + 1);

      predictions.push({
        type: lineage.rootEvent.harmonizedType,
        predictedDate: predictedDate.toISOString(),
        confidence: 0.6,
        riskFactors: [`High risk score: ${lineage.riskScore}/100`],
        recommendedActions: ['Monitor closely', 'Review compliance status'],
      });
    }
  }

  return predictions.sort((a, b) => b.confidence - a.confidence);
}

function calculateAverageInterval(events: HarmonizedSanction[]): number {
  if (events.length < 2) return 365; // Default to 1 year

  const intervals: number[] = [];
  for (let i = 1; i < events.length; i++) {
    const prev = new Date(events[i - 1].eventDate);
    const curr = new Date(events[i].eventDate);
    intervals.push((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
  }

  return Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
}

