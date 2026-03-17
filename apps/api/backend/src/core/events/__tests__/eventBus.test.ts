import {
  EVENT_BUS_MAX_BUFFER,
  getLatestEventTimestamp,
  listRecentEvents,
  publish,
  resetEventBusForTests,
  subscribe,
} from '../eventBus';

describe('event bus', () => {
  beforeEach(() => {
    resetEventBusForTests();
  });

  it('publishes events and returns them in descending timestamp order', async () => {
    await publish({
      type: 'FINDING_CREATED',
      timestamp: '2026-03-17T10:00:00.000Z',
      payload: {
        runId: 'run-1',
        findingId: 'finding-1',
        investigatorId: 'trust_decline',
        severity: 'high',
        status: 'new',
        entityIds: ['1234567890'],
        storylineKey: 'storyline-1',
        operation: 'created',
      },
    });
    await publish({
      type: 'STORYLINE_UPDATED',
      timestamp: '2026-03-17T10:02:00.000Z',
      payload: {
        storylineId: 'storyline-1',
        storylineType: 'trust decline',
        status: 'active',
        severity: 'high',
        entityIds: ['provider:1234567890'],
        findingIds: ['finding-1'],
        operation: 'updated',
      },
    });

    const events = listRecentEvents({ limit: 2 });

    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe('STORYLINE_UPDATED');
    expect(events[1]?.type).toBe('FINDING_CREATED');
    expect(getLatestEventTimestamp()).toBe('2026-03-17T10:02:00.000Z');
  });

  it('trims the replay buffer to the configured maximum', async () => {
    for (let index = 0; index < EVENT_BUS_MAX_BUFFER + 5; index += 1) {
      await publish({
        type: 'FINDING_CREATED',
        timestamp: `2026-03-17T10:${String(index % 60).padStart(2, '0')}:00.000Z`,
        payload: {
          runId: `run-${index}`,
          findingId: `finding-${index}`,
          investigatorId: 'trust_decline',
          severity: 'medium',
          status: 'new',
          entityIds: [`entity-${index}`],
          storylineKey: `storyline-${index}`,
          operation: 'created',
        },
      });
    }

    const events = listRecentEvents({ limit: EVENT_BUS_MAX_BUFFER + 20 });

    expect(events).toHaveLength(EVENT_BUS_MAX_BUFFER);
    expect(events.some((event) => event.type === 'FINDING_CREATED' && event.payload.findingId === 'finding-0')).toBe(false);
    expect(events.some((event) => event.type === 'FINDING_CREATED' && event.payload.findingId === `finding-${EVENT_BUS_MAX_BUFFER + 4}`)).toBe(true);
  });

  it('supports unsubscribe without leaking handlers', async () => {
    const received: string[] = [];
    const unsubscribe = subscribe('STORYLINE_UPDATED', (event) => {
      received.push(event.payload.storylineId);
    });

    await publish({
      type: 'STORYLINE_UPDATED',
      payload: {
        storylineId: 'storyline-1',
        storylineType: 'trust decline',
        status: 'active',
        severity: 'high',
        entityIds: ['provider:1234567890'],
        findingIds: ['finding-1'],
        operation: 'created',
      },
    });

    unsubscribe();

    await publish({
      type: 'STORYLINE_UPDATED',
      payload: {
        storylineId: 'storyline-2',
        storylineType: 'trust decline',
        status: 'quiet',
        severity: 'medium',
        entityIds: ['provider:1234567890'],
        findingIds: ['finding-2'],
        operation: 'updated',
      },
    });

    expect(received).toEqual(['storyline-1']);
  });

  it('isolates subscriber failures from other subscribers', async () => {
    const successfulHandler = jest.fn();

    subscribe('INVESTIGATOR_RUN_COMPLETE', () => {
      throw new Error('boom');
    });
    subscribe('INVESTIGATOR_RUN_COMPLETE', successfulHandler);

    await expect(publish({
      type: 'INVESTIGATOR_RUN_COMPLETE',
      payload: {
        runId: 'run-1',
        investigatorId: 'trust_decline',
        trigger: 'manual',
        status: 'succeeded',
        entityType: 'provider',
        targetEntityIds: ['1234567890'],
        startedAt: '2026-03-17T10:00:00.000Z',
        completedAt: '2026-03-17T10:01:00.000Z',
        durationMs: 60_000,
        entitiesScanned: 1,
        findingsGenerated: 1,
        findingsCreated: 1,
        findingsUpdated: 0,
        findingsResolved: 0,
        findingsSuppressed: 0,
        storylinesMerged: 0,
        errorMessage: null,
      },
    })).resolves.toBeDefined();

    expect(successfulHandler).toHaveBeenCalledTimes(1);
  });
});
