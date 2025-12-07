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
    expect(result[0].events).toHaveLength(1);
    expect(result[0].events[0].id).toBe('evt-2');
    expect(result[2].events[0].id).toBe('evt-1');
  });

  it('groups mixed phase events covering the full lifecycle', () => {
    const mixedEvents: TimelineEvent[] = [
      buildEvent({
        id: 'evt-board',
        phase: 'board',
        type: 'BOARD_CERT_GRANTED',
        title: 'ABIM certification',
        timestamp: new Date(baseTime.getTime() + 3000),
      }),
      buildEvent({
        id: 'evt-dea',
        phase: 'dea',
        type: 'DEA_ISSUED',
        title: 'DEA registration issued',
        timestamp: new Date(baseTime.getTime() + 4000),
      }),
      buildEvent({
        id: 'evt-enroll',
        phase: 'enrollment',
        type: 'PAYER_ENROLLMENT_APPROVED',
        title: 'Anthem enrollment approved',
        timestamp: new Date(baseTime.getTime() + 5000),
      }),
      buildEvent({
        id: 'evt-quality',
        phase: 'quality',
        type: 'FPPE_CASE',
        title: 'FPPE started',
        timestamp: new Date(baseTime.getTime() + 6000),
      }),
    ];

    const grouped = aggregateTimelinePhases(mixedEvents);

    expect(grouped.map((group) => group.phase)).toEqual(['board', 'dea', 'enrollment', 'quality']);
    expect(grouped.find((g) => g.phase === 'board')?.events.map((e) => e.id)).toEqual(['evt-board']);
    expect(grouped.find((g) => g.phase === 'quality')?.events.map((e) => e.id)).toEqual(['evt-quality']);
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
    expect(result[0].events).toHaveLength(1);
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


