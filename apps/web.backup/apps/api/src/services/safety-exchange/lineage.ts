import type { HarmonizedSanction } from './harmonization';

export interface AdverseActionLineage {
  rootEvent: HarmonizedSanction;
  relatedEvents: HarmonizedSanction[];
  severityTrend: 'increasing' | 'decreasing' | 'stable';
  recurrencePattern: {
    count: number;
    frequency: string; // e.g., "3 events in 2 years"
    trend: 'accelerating' | 'decelerating' | 'stable';
  };
  riskScore: number; // 0-100
}

/**
 * Track severity and recurrence patterns of adverse actions
 */
export function buildAdverseActionLineage(
  sanctions: HarmonizedSanction[],
): AdverseActionLineage[] {
  const lineages: AdverseActionLineage[] = [];

  // Group sanctions by type
  const byType = new Map<string, HarmonizedSanction[]>();
  for (const sanction of sanctions) {
    const key = sanction.harmonizedType;
    if (!byType.has(key)) {
      byType.set(key, []);
    }
    byType.get(key)!.push(sanction);
  }

  // Build lineage for each type
  for (const [type, events] of byType.entries()) {
    if (events.length === 0) continue;

    const sorted = [...events].sort(
      (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime(),
    );

    const rootEvent = sorted[0];
    const relatedEvents = sorted.slice(1);

    const severityTrend = calculateSeverityTrend(sorted);
    const recurrencePattern = calculateRecurrencePattern(sorted);
    const riskScore = calculateRiskScore(sorted, recurrencePattern);

    lineages.push({
      rootEvent,
      relatedEvents,
      severityTrend,
      recurrencePattern,
      riskScore,
    });
  }

  return lineages;
}

function calculateSeverityTrend(events: HarmonizedSanction[]): 'increasing' | 'decreasing' | 'stable' {
  if (events.length < 2) return 'stable';

  const severityValues = { low: 1, medium: 2, high: 3, critical: 4 };
  const first = severityValues[events[0].harmonizedSeverity];
  const last = severityValues[events[events.length - 1].harmonizedSeverity];

  if (last > first) return 'increasing';
  if (last < first) return 'decreasing';
  return 'stable';
}

function calculateRecurrencePattern(events: HarmonizedSanction[]): {
  count: number;
  frequency: string;
  trend: 'accelerating' | 'decelerating' | 'stable';
} {
  const count = events.length;

  if (count === 1) {
    return {
      count: 1,
      frequency: 'single event',
      trend: 'stable',
    };
  }

  const firstDate = new Date(events[0].eventDate);
  const lastDate = new Date(events[events.length - 1].eventDate);
  const totalDays = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  const years = totalDays / 365;

  const frequency = `${count} events in ${years.toFixed(1)} years`;

  // Calculate trend (are events getting closer together?)
  if (count >= 3) {
    const intervals: number[] = [];
    for (let i = 1; i < events.length; i++) {
      const prev = new Date(events[i - 1].eventDate);
      const curr = new Date(events[i].eventDate);
      intervals.push((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    }

    const firstHalf = intervals.slice(0, Math.floor(intervals.length / 2));
    const secondHalf = intervals.slice(Math.floor(intervals.length / 2));

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (avgSecond < avgFirst * 0.8) return { count, frequency, trend: 'accelerating' };
    if (avgSecond > avgFirst * 1.2) return { count, frequency, trend: 'decelerating' };
  }

  return { count, frequency, trend: 'stable' };
}

function calculateRiskScore(
  events: HarmonizedSanction[],
  recurrence: ReturnType<typeof calculateRecurrencePattern>,
): number {
  let score = 0;

  // Base score from most severe event
  const severityValues = { low: 10, medium: 30, high: 60, critical: 90 };
  const maxSeverity = Math.max(...events.map((e) => severityValues[e.harmonizedSeverity]));
  score = maxSeverity;

  // Add points for recurrence
  if (recurrence.count > 1) {
    score += Math.min(20, recurrence.count * 5);
  }

  // Add points for accelerating trend
  if (recurrence.trend === 'accelerating') {
    score += 10;
  }

  return Math.min(100, score);
}

