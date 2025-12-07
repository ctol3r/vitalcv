import {
  SortDirection,
  TimelineEvent,
  TimelinePhase,
  TimelinePhaseGroup,
  TIMELINE_PHASE_ORDER,
} from './types';

export interface AggregateTimelineOptions {
  includeEmptyPhases?: boolean;
  sortDirection?: SortDirection;
}

function sortEvents(events: TimelineEvent[], direction: SortDirection): TimelineEvent[] {
  return [...events].sort((a, b) => {
    const delta = a.timestamp.getTime() - b.timestamp.getTime();
    return direction === 'asc' ? delta : -delta;
  });
}

export function aggregateTimelinePhases(
  events: TimelineEvent[],
  options: AggregateTimelineOptions = {}
): TimelinePhaseGroup[] {
  const { includeEmptyPhases = false, sortDirection = 'desc' } = options;
  const buckets = new Map<TimelinePhase, TimelineEvent[]>();

  for (const event of events) {
    if (!buckets.has(event.phase)) {
      buckets.set(event.phase, []);
    }
    buckets.get(event.phase)!.push(event);
  }

  const phasesToEmit = includeEmptyPhases ? TIMELINE_PHASE_ORDER : TIMELINE_PHASE_ORDER.filter((phase) =>
    (buckets.get(phase) ?? []).length > 0
  );

  return phasesToEmit.map((phase) => ({
    phase,
    events: sortEvents(buckets.get(phase) ?? [], sortDirection),
  }));
}


