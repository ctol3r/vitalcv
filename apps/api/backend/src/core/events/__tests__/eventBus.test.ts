import {
  EVENT_BUS_MAX_BUFFER,
  getEventBusHealthSnapshot,
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

  it('detects projection drift attempts by freezing and isolating published payloads', async () => {
    const payload = {
      storylineId: 'storyline-1',
      storylineType: 'trust decline',
      status: 'active',
      severity: 'high',
      entityIds: ['provider:1234567890'],
      findingIds: ['finding-1'],
      operation: 'created' as const,
    };

    const event = await publish({
      type: 'STORYLINE_UPDATED',
      id: 'evt-immutable',
      timestamp: '2026-03-17T10:00:00.000Z',
      payload,
    });

    payload.status = 'mutated';
    payload.entityIds.push('provider:9999999999');

    const stored = listRecentEvents({ limit: 1 })[0];
    expect(stored?.type).toBe('STORYLINE_UPDATED');
    if (!stored || stored.type !== 'STORYLINE_UPDATED') {
      throw new Error('Expected a storyline update event');
    }

    expect(stored.payload.status).toBe('active');
    expect(stored.payload.entityIds).toEqual(['provider:1234567890']);
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.payload)).toBe(true);
  });

  it('rejects invalid events before they reach the replay buffer', async () => {
    await expect(publish({
      type: 'FINDING_CREATED',
      timestamp: 'not-a-timestamp',
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
    })).rejects.toThrow();

    await expect(publish({
      type: 'PROVIDER_UPDATED',
      payload: {
        providerId: '',
        npi: '1234567890',
        providerLabel: 'Ada Lovelace',
        operation: 'updated',
      },
    })).rejects.toThrow();

    expect(listRecentEvents({ limit: 10 })).toHaveLength(0);
  });

  it('recovers cleanly after a rejected event and remains observable', async () => {
    await expect(publish({
      type: 'PROVIDER_UPDATED',
      payload: {
        providerId: 'provider-1',
        npi: '1234567890',
        providerLabel: 'Ada Lovelace',
        operation: 'invalid' as 'updated',
      },
    })).rejects.toThrow();

    const event = await publish({
      type: 'PROVIDER_UPDATED',
      id: 'evt-recovery',
      timestamp: '2026-03-17T10:00:00.000Z',
      payload: {
        providerId: 'provider-1',
        npi: '1234567890',
        providerLabel: 'Ada Lovelace',
        operation: 'updated',
      },
    });

    expect(event.id).toBe('evt-recovery');
    expect(getEventBusHealthSnapshot()).toEqual({
      bufferDepth: 1,
      latestEventTimestamp: '2026-03-17T10:00:00.000Z',
      latestEventId: 'evt-recovery',
    });
  });

  it('rejects duplicate event ids', async () => {
    await publish({
      type: 'PROVIDER_UPDATED',
      id: 'evt-duplicate',
      timestamp: '2026-03-17T10:00:00.000Z',
      payload: {
        providerId: 'provider-1',
        npi: '1234567890',
        providerLabel: 'Ada Lovelace',
        operation: 'updated',
      },
    });

    await expect(publish({
      type: 'PROVIDER_UPDATED',
      id: 'evt-duplicate',
      timestamp: '2026-03-17T10:01:00.000Z',
      payload: {
        providerId: 'provider-2',
        npi: '2222222222',
        providerLabel: 'Grace Hopper',
        operation: 'updated',
      },
    })).rejects.toThrow('Event already exists: evt-duplicate');
  });

  it('leaves the replay buffer unchanged after a duplicate delivery attempt', async () => {
    await publish({
      type: 'PROVIDER_UPDATED',
      id: 'evt-duplicate-stable',
      timestamp: '2026-03-17T10:00:00.000Z',
      payload: {
        providerId: 'provider-1',
        npi: '1234567890',
        providerLabel: 'Ada Lovelace',
        operation: 'updated',
      },
    });

    const before = listRecentEvents({ limit: 10 });
    const beforeHealth = getEventBusHealthSnapshot();

    await expect(publish({
      type: 'PROVIDER_UPDATED',
      id: 'evt-duplicate-stable',
      timestamp: '2026-03-17T10:05:00.000Z',
      payload: {
        providerId: 'provider-2',
        npi: '2222222222',
        providerLabel: 'Grace Hopper',
        operation: 'updated',
      },
    })).rejects.toThrow('Event already exists: evt-duplicate-stable');

    expect(listRecentEvents({ limit: 10 })).toEqual(before);
    expect(getEventBusHealthSnapshot()).toEqual(beforeHealth);
  });

  it('does not let a delayed older event overwrite the latest event view', async () => {
    await publish({
      type: 'PROVIDER_UPDATED',
      id: 'evt-newest',
      timestamp: '2026-03-17T10:10:00.000Z',
      payload: {
        providerId: 'provider-newest',
        npi: '9999999999',
        providerLabel: 'Newest Provider',
        operation: 'updated',
      },
    });

    await publish({
      type: 'PROVIDER_UPDATED',
      id: 'evt-delayed-older',
      timestamp: '2026-03-17T10:00:00.000Z',
      payload: {
        providerId: 'provider-older',
        npi: '1111111111',
        providerLabel: 'Older Provider',
        operation: 'updated',
      },
    });

    const events = listRecentEvents({ limit: 2 });
    expect(events.map((event) => event.id)).toEqual([
      'evt-newest',
      'evt-delayed-older',
    ]);
    expect(getLatestEventTimestamp()).toBe('2026-03-17T10:10:00.000Z');
    expect(getEventBusHealthSnapshot()).toEqual({
      bufferDepth: 2,
      latestEventTimestamp: '2026-03-17T10:10:00.000Z',
      latestEventId: 'evt-newest',
    });
  });

  it('orders same-timestamp events deterministically by id', async () => {
    await publish({
      type: 'PROVIDER_UPDATED',
      id: 'evt-a',
      timestamp: '2026-03-17T10:00:00.000Z',
      payload: {
        providerId: 'provider-a',
        npi: '1111111111',
        providerLabel: 'Provider A',
        operation: 'updated',
      },
    });
    await publish({
      type: 'PROVIDER_UPDATED',
      id: 'evt-c',
      timestamp: '2026-03-17T10:00:00.000Z',
      payload: {
        providerId: 'provider-c',
        npi: '3333333333',
        providerLabel: 'Provider C',
        operation: 'updated',
      },
    });
    await publish({
      type: 'PROVIDER_UPDATED',
      id: 'evt-b',
      timestamp: '2026-03-17T10:00:00.000Z',
      payload: {
        providerId: 'provider-b',
        npi: '2222222222',
        providerLabel: 'Provider B',
        operation: 'updated',
      },
    });

    expect(listRecentEvents({ limit: 3 }).map((event) => event.id)).toEqual([
      'evt-c',
      'evt-b',
      'evt-a',
    ]);
  });
});
