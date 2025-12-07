import type { NormalizedTimelineEvent } from './normalization';

export interface InferredMilestone {
  type: 'residency' | 'fellowship' | 'training' | 'gap';
  startDate: string;
  endDate?: string;
  title: string;
  confidence: number;
  reasoning: string[];
}

/**
 * Infer unsupplied career milestones (residency, fellowship)
 */
export function inferMilestones(
  events: NormalizedTimelineEvent[],
): InferredMilestone[] {
  const milestones: InferredMilestone[] = [];

  // Sort events by date
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.normalizedDates.start).getTime() - new Date(b.normalizedDates.start).getTime(),
  );

  // Look for gaps that might indicate training periods
  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const current = sortedEvents[i];
    const next = sortedEvents[i + 1];

    const currentEnd = current.normalizedDates.end
      ? new Date(current.normalizedDates.end)
      : new Date(current.normalizedDates.start);
    const nextStart = new Date(next.normalizedDates.start);

    const gapDays = Math.ceil((nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60 * 24));

    // If gap is 1-5 years, might be residency/fellowship
    if (gapDays > 365 && gapDays < 1825) {
      const milestone = inferTrainingPeriod(current, next, gapDays);
      if (milestone) {
        milestones.push(milestone);
      }
    }
  }

  // Check for early career patterns that suggest residency
  const earlyEvents = sortedEvents.filter(
    (e) => new Date(e.normalizedDates.start).getFullYear() - new Date().getFullYear() < -10,
  );

  if (earlyEvents.length > 0 && sortedEvents.length > 0) {
    const firstEvent = sortedEvents[0];
    const firstEventYear = new Date(firstEvent.normalizedDates.start).getFullYear();
    const currentYear = new Date().getFullYear();

    // If first job is 3-7 years after medical school age (typically 26-30), might be residency
    if (firstEventYear >= currentYear - 40 && firstEventYear <= currentYear - 25) {
      const residencyStart = new Date(firstEvent.normalizedDates.start);
      residencyStart.setFullYear(residencyStart.getFullYear() - 3);

      milestones.push({
        type: 'residency',
        startDate: residencyStart.toISOString(),
        endDate: firstEvent.normalizedDates.start,
        title: 'Residency Training (Inferred)',
        confidence: 0.6,
        reasoning: [
          'Gap between medical school completion and first employment',
          'Typical residency duration (3-5 years)',
        ],
      });
    }
  }

  return milestones;
}

function inferTrainingPeriod(
  before: NormalizedTimelineEvent,
  after: NormalizedTimelineEvent,
  gapDays: number,
): InferredMilestone | null {
  const beforeEnd = before.normalizedDates.end
    ? new Date(before.normalizedDates.end)
    : new Date(before.normalizedDates.start);
  const afterStart = new Date(after.normalizedDates.start);

  // Residency typically 3-5 years
  if (gapDays >= 1095 && gapDays <= 1825) {
    return {
      type: 'residency',
      startDate: beforeEnd.toISOString(),
      endDate: afterStart.toISOString(),
      title: 'Residency Training (Inferred)',
      confidence: 0.7,
      reasoning: [
        `Gap of ${Math.round(gapDays / 365)} years between positions`,
        'Typical residency duration',
      ],
    };
  }

  // Fellowship typically 1-3 years
  if (gapDays >= 365 && gapDays < 1095) {
    return {
      type: 'fellowship',
      startDate: beforeEnd.toISOString(),
      endDate: afterStart.toISOString(),
      title: 'Fellowship Training (Inferred)',
      confidence: 0.65,
      reasoning: [
        `Gap of ${Math.round(gapDays / 365)} years between positions`,
        'Typical fellowship duration',
      ],
    };
  }

  return null;
}

