import { aggregateTimelinePhases } from '../aggregatePhases';
import { TimelineEvent } from '../types';

function buildEvent(partial: Partial<TimelineEvent>): TimelineEvent {
  if (!partial.id || !partial.phase || !partial.type || !partial.title || !partial.timestamp) {
    throw new Error('Missing required fields in test event');
  }
  return partial as TimelineEvent;
}

describe('aggregateTimelinePhases', () => {
  const baseTime = new Date('2025-01-01T00:00:00.000Z');

  it('groups events by phase preserving canonical ordering', () => {
    const events: TimelineEvent[] = [
      buildEvent({
        id: 'evt-1',
        phase: 'privileging',
        type: 'PRIVILEGE_GRANTED',
        title: 'Privileges granted',
        timestamp: new Date(baseTime.getTime() + 1000),
      }),
      buildEvent({
        id: 'evt-2',
        phase: 'identity',
        type: 'CLAIM_L2_OK',
        title: 'Identity level 2',
        timestamp: baseTime,
      }),
      buildEvent({
        id: 'evt-3',
        phase: 'licensure',
        type: 'LICENSE_VERIFIED',
        title: 'CA license verified',
        timestamp: new Date(baseTime.getTime() + 2000),
      }),
    ];

    const result = aggregateTimelinePhases(events);

    expect(result.map((group) => group.phase)).toEqual(['identity', 'licensure', 'privileging']);
    expect(result[0].events[0].id).toBe('evt-2');
    expect(result[2].events[0].id).toBe('evt-1');
  });

  it('sorts events within each phase according to direction', () => {
    const events: TimelineEvent[] = [
      buildEvent({
        id: 'evt-1',
        phase: 'identity',
        type: 'CLAIM_L1_OK',
        title: 'L1',
        timestamp: new Date(baseTime.getTime() + 2000),
      }),
      buildEvent({
        id: 'evt-2',
        phase: 'identity',
        type: 'CLAIM_L2_OK',
        title: 'L2',
        timestamp: new Date(baseTime.getTime() + 1000),
      }),
    ];

    const asc = aggregateTimelinePhases(events, { sortDirection: 'asc' });
    const desc = aggregateTimelinePhases(events, { sortDirection: 'desc' });

    expect(asc[0].events.map((e) => e.id)).toEqual(['evt-2', 'evt-1']);
    expect(desc[0].events.map((e) => e.id)).toEqual(['evt-1', 'evt-2']);
  });

  it('optionally emits empty phases with no events', () => {
    const result = aggregateTimelinePhases([], { includeEmptyPhases: true });
    expect(result).toHaveLength(7);
    expect(result.every((group) => group.events.length === 0)).toBe(true);
  });
});


