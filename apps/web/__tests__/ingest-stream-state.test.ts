import { describe, expect, it } from 'vitest';
import {
  applyIngestDisconnect,
  applyIngestEvent,
  createInitialIngestStreamState,
  normalizeIngestEvent,
  parseIngestStartResponse,
  type IngestEvent,
} from '../hooks/ingestStreamState';

function makeEvent(input: {
  type: IngestEvent['type'];
  sourceId?: string;
  timestamp?: string;
  payload?: Record<string, unknown>;
}): IngestEvent {
  const event = normalizeIngestEvent({
    type: input.type,
    sourceId: input.sourceId,
    timestamp: input.timestamp ?? '2026-03-25T22:00:00.000Z',
    payload: input.payload ?? {},
  });

  if (!event) {
    throw new Error('Failed to build ingest event');
  }

  return event;
}

describe('ingestStreamState', () => {
  it('normalizes legacy source fields into canonical sourceId', () => {
    const event = normalizeIngestEvent({
      type: 'source_start',
      source: 'OIG',
      timestamp: '2026-03-25T22:00:00.000Z',
      payload: {},
    });

    expect(event?.sourceId).toBe('oig');
  });

  it('records untracked source events without changing Passport source rows', () => {
    const initial = {
      ...createInitialIngestStreamState(),
      phase: 'starting' as const,
    };

    const next = applyIngestEvent(initial, makeEvent({
      type: 'source_start',
      sourceId: 'nursys',
      payload: { sourceId: 'nursys' },
    }));

    expect(next.phase).toBe('starting');
    expect(next.sources).toEqual(initial.sources);
    expect(next.events).toHaveLength(1);
    expect(next.events[0]?.sourceId).toBe('nursys');
  });

  it('marks the passport usable on passport_ready and keeps it usable on done', () => {
    let state = createInitialIngestStreamState();

    state = applyIngestEvent(state, makeEvent({
      type: 'source_complete',
      sourceId: 'nppes',
      payload: {
        sourceId: 'nppes',
        resultStatus: 'SUCCESS',
        entityId: 'entity-1',
        displayName: 'Ada Lovelace',
        identityStatus: 'ACTIVE',
      },
    }));

    state = applyIngestEvent(state, makeEvent({
      type: 'passport_ready',
      payload: {
        entityId: 'entity-1',
        displayName: 'Ada Lovelace',
        identityStatus: 'ACTIVE',
        readinessScore: 91,
        readinessLevel: 'L3',
        readinessStatus: 'READY',
        exclusionChecked: true,
        exclusionClear: true,
        exclusionStatus: 'CLEAR',
        enrollmentChecked: true,
        enrollmentStatus: 'ENROLLED',
        checkedAt: '2026-03-25T22:05:00.000Z',
      },
    }));

    expect(state.isUsable).toBe(true);
    expect(state.anchorEntityId).toBe('entity-1');
    expect(state.readiness.score).toBe(91);
    expect(state.standing.exclusionStatus).toBe('CLEAR');

    state = applyIngestEvent(state, makeEvent({
      type: 'done',
      payload: {
        entityId: 'entity-1',
        checkedAt: '2026-03-25T22:05:00.000Z',
      },
    }));

    expect(state.isUsable).toBe(true);
    expect(state.phase).toBe('done');
  });

  it('does not treat passport_ready as usable when NPPES returned no authoritative profile', () => {
    let state = createInitialIngestStreamState();

    state = applyIngestEvent(state, makeEvent({
      type: 'source_complete',
      sourceId: 'nppes',
      payload: {
        sourceId: 'nppes',
        resultStatus: 'SKIPPED',
        entityId: 'entity-placeholder',
        displayName: 'Provider not found in NPPES',
        identityStatus: 'UNKNOWN',
      },
    }));

    state = applyIngestEvent(state, makeEvent({
      type: 'passport_ready',
      payload: {
        entityId: 'entity-placeholder',
        displayName: 'Provider not found in NPPES',
        identityStatus: 'UNKNOWN',
        readinessStatus: 'PARTIAL',
      },
    }));

    expect(state.identity.authoritative).toBe(false);
    expect(state.isUsable).toBe(false);
    expect(state.anchorEntityId).toBeUndefined();
  });

  it('marks disconnects as errors before the passport is usable', () => {
    const next = applyIngestDisconnect({
      ...createInitialIngestStreamState(),
      phase: 'sanctions',
      sources: {
        nppes: 'done',
        oig: 'checking',
        pecos: 'pending',
      },
    }, '2026-03-25T22:10:00.000Z');

    expect(next.phase).toBe('error');
    expect(next.disconnected).toBe(true);
    expect(next.sources.oig).toBe('error');
    expect(next.error).toBe('Stream disconnected.');
  });

  it('ignores disconnect fallbacks after the passport is already usable', () => {
    const next = applyIngestDisconnect({
      ...createInitialIngestStreamState(),
      isUsable: true,
      anchorEntityId: 'entity-1',
      identity: {
        authoritative: true,
        entityId: 'entity-1',
        displayName: 'Ada Lovelace',
      },
    });

    expect(next.isUsable).toBe(true);
    expect(next.disconnected).toBe(false);
    expect(next.error).toBeUndefined();
  });

  it('rejects successful ingest starts that do not return a runId', () => {
    expect(() => parseIngestStartResponse({
      ok: true,
      status: 200,
      body: {},
    })).toThrow('Ingest run did not return a runId.');
  });
});
