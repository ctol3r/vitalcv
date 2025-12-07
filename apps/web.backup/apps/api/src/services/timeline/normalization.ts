import type { TimelineEvent } from './ingestion';

export interface NormalizedTimelineEvent extends TimelineEvent {
  normalizedType: string;
  normalizedTitle: string;
  normalizedDates: {
    start: string;
    end?: string;
    durationDays?: number;
  };
  confidence: number;
}

/**
 * Normalize timeline events across different sources
 */
export function normalizeTimelineEvents(
  events: TimelineEvent[],
): NormalizedTimelineEvent[] {
  return events.map((event) => {
    const normalized = {
      ...event,
      normalizedType: normalizeEventType(event.type),
      normalizedTitle: normalizeTitle(event.title, event.type),
      normalizedDates: normalizeDates(event.startDate, event.endDate),
      confidence: calculateConfidence(event),
    };

    return normalized;
  });
}

function normalizeEventType(type: string): string {
  const typeMap: Record<string, string> = {
    job: 'employment',
    privilege: 'privilege_grant',
    board_cert: 'certification',
    cme: 'education',
    safety_event: 'safety_incident',
  };

  return typeMap[type] ?? type;
}

function normalizeTitle(title: string, type: string): string {
  // Standardize title format based on type
  if (type === 'job') {
    return title.replace(/^Employment at /, '');
  }
  if (type === 'privilege') {
    return title.replace(/^Privilege: /, '');
  }
  return title;
}

function normalizeDates(startDate: string, endDate?: string): {
  start: string;
  end?: string;
  durationDays?: number;
} {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : undefined;

  let durationDays: number | undefined;
  if (end) {
    durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    start: start.toISOString(),
    end: end?.toISOString(),
    durationDays,
  };
}

function calculateConfidence(event: TimelineEvent): number {
  // Confidence based on data completeness
  let confidence = 0.5;

  if (event.startDate) confidence += 0.2;
  if (event.endDate) confidence += 0.1;
  if (event.organization) confidence += 0.1;
  if (event.metadata && Object.keys(event.metadata).length > 0) confidence += 0.1;

  return Math.min(1.0, confidence);
}

