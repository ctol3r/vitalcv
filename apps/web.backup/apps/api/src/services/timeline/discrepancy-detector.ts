import type { NormalizedTimelineEvent } from './normalization';

export interface Discrepancy {
  type: 'date_mismatch' | 'missing_event' | 'duplicate_event' | 'conflicting_data';
  severity: 'low' | 'medium' | 'high';
  description: string;
  event1?: string;
  event2?: string;
  detectedAt: string;
}

/**
 * Detect contradictions between documents and timeline history
 */
export function detectDiscrepancies(
  timelineEvents: NormalizedTimelineEvent[],
  documentData?: Record<string, unknown>,
): Discrepancy[] {
  const discrepancies: Discrepancy[] = [];

  // Check for duplicate events
  const eventMap = new Map<string, NormalizedTimelineEvent[]>();
  for (const event of timelineEvents) {
    const key = `${event.normalizedType}:${event.normalizedTitle}`;
    if (!eventMap.has(key)) {
      eventMap.set(key, []);
    }
    eventMap.get(key)!.push(event);
  }

  for (const [key, events] of eventMap.entries()) {
    if (events.length > 1) {
      // Check if dates are very close (might be duplicates)
      const dates = events.map((e) => new Date(e.normalizedDates.start).getTime()).sort();
      for (let i = 0; i < dates.length - 1; i++) {
        const diff = dates[i + 1] - dates[i];
        const diffDays = diff / (1000 * 60 * 60 * 24);

        if (diffDays < 30) {
          discrepancies.push({
            type: 'duplicate_event',
            severity: 'medium',
            description: `Possible duplicate event: ${key}`,
            event1: events[i].normalizedTitle,
            event2: events[i + 1].normalizedTitle,
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  // Check for date mismatches with document data
  if (documentData) {
    const docStartDate = documentData.startDate as string | undefined;
    const docEndDate = documentData.endDate as string | undefined;

    if (docStartDate) {
      const docDate = new Date(docStartDate);
      const matchingEvents = timelineEvents.filter((e) => {
        const eventDate = new Date(e.normalizedDates.start);
        const diffDays = Math.abs((eventDate.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays < 90; // Within 3 months
      });

      if (matchingEvents.length === 0) {
        discrepancies.push({
          type: 'date_mismatch',
          severity: 'high',
          description: 'Document date does not match any timeline event',
          detectedAt: new Date().toISOString(),
        });
      } else {
        // Check if dates are significantly different
        for (const event of matchingEvents) {
          const eventDate = new Date(event.normalizedDates.start);
          const diffDays = Math.abs((eventDate.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays > 30) {
            discrepancies.push({
              type: 'date_mismatch',
              severity: 'medium',
              description: `Document date differs from timeline by ${Math.round(diffDays)} days`,
              event1: event.normalizedTitle,
              detectedAt: new Date().toISOString(),
            });
          }
        }
      }
    }
  }

  // Check for overlapping employment periods
  const employmentEvents = timelineEvents.filter((e) => e.normalizedType === 'employment');
  for (let i = 0; i < employmentEvents.length; i++) {
    for (let j = i + 1; j < employmentEvents.length; j++) {
      const event1 = employmentEvents[i];
      const event2 = employmentEvents[j];

      const start1 = new Date(event1.normalizedDates.start);
      const end1 = event1.normalizedDates.end ? new Date(event1.normalizedDates.end) : new Date();
      const start2 = new Date(event2.normalizedDates.start);
      const end2 = event2.normalizedDates.end ? new Date(event2.normalizedDates.end) : new Date();

      // Check for overlap
      if (start1 < end2 && start2 < end1) {
        discrepancies.push({
          type: 'conflicting_data',
          severity: 'high',
          description: 'Overlapping employment periods detected',
          event1: event1.normalizedTitle,
          event2: event2.normalizedTitle,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return discrepancies;
}

