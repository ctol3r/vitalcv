import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearAllSnapshots,
  getAllSnapshots,
  getSnapshot,
  recordSnapshot,
} from '@/lib/source-health/store/snapshotStore';
import type { SourceHealthSnapshot } from '@/lib/source-health/sourceHealthTypes';

function snap(
  partial: Partial<SourceHealthSnapshot> &
    Pick<SourceHealthSnapshot, 'sourceId' | 'state' | 'observedAt'>,
): SourceHealthSnapshot {
  return {
    reason: 'test',
    lastSuccessAt: null,
    lastErrorAt: null,
    lastLatencyMs: null,
    ...partial,
  } as SourceHealthSnapshot;
}

describe('snapshotStore', () => {
  beforeEach(() => {
    clearAllSnapshots();
  });

  it('records and reads back a single snapshot', () => {
    recordSnapshot(
      snap({
        sourceId: 'NPPES',
        state: 'LIVE',
        observedAt: '2024-06-01T12:00:00.000Z',
      }),
    );

    const got = getSnapshot('NPPES');
    expect(got?.state).toBe('LIVE');
    expect(getAllSnapshots()).toHaveLength(1);
  });

  it('clearAllSnapshots empties the store', () => {
    recordSnapshot(
      snap({
        sourceId: 'NPPES',
        state: 'LIVE',
        observedAt: '2024-06-01T12:00:00.000Z',
      }),
    );
    clearAllSnapshots();
    expect(getAllSnapshots()).toHaveLength(0);
    expect(getSnapshot('NPPES')).toBeUndefined();
  });

  it('LIVE snapshot sets lastSuccessAt to observedAt', () => {
    recordSnapshot(
      snap({
        sourceId: 'OIG_LEIE',
        state: 'LIVE',
        observedAt: '2024-06-01T12:00:00.000Z',
      }),
    );
    expect(getSnapshot('OIG_LEIE')?.lastSuccessAt).toBe(
      '2024-06-01T12:00:00.000Z',
    );
  });

  it('carries forward lastSuccessAt when next snapshot is non-LIVE with null', () => {
    recordSnapshot(
      snap({
        sourceId: 'NPPES',
        state: 'LIVE',
        observedAt: '2024-06-01T12:00:00.000Z',
      }),
    );
    recordSnapshot(
      snap({
        sourceId: 'NPPES',
        state: 'UNAVAILABLE',
        observedAt: '2024-06-01T13:00:00.000Z',
        lastSuccessAt: null,
      }),
    );
    const got = getSnapshot('NPPES');
    expect(got?.state).toBe('UNAVAILABLE');
    expect(got?.lastSuccessAt).toBe('2024-06-01T12:00:00.000Z');
  });

  it('updates lastErrorAt on DEGRADED / UNAVAILABLE / RATE_LIMITED', () => {
    recordSnapshot(
      snap({
        sourceId: 'PECOS',
        state: 'DEGRADED',
        observedAt: '2024-06-01T14:00:00.000Z',
        lastErrorAt: null,
      }),
    );
    expect(getSnapshot('PECOS')?.lastErrorAt).toBe(
      '2024-06-01T14:00:00.000Z',
    );

    recordSnapshot(
      snap({
        sourceId: 'OIG_LEIE',
        state: 'RATE_LIMITED',
        observedAt: '2024-06-01T15:00:00.000Z',
        lastErrorAt: null,
      }),
    );
    expect(getSnapshot('OIG_LEIE')?.lastErrorAt).toBe(
      '2024-06-01T15:00:00.000Z',
    );
  });

  it('does not set lastErrorAt for UNKNOWN', () => {
    recordSnapshot(
      snap({
        sourceId: 'STATE_BOARD',
        state: 'UNKNOWN',
        observedAt: '2024-06-01T16:00:00.000Z',
        lastErrorAt: null,
      }),
    );
    expect(getSnapshot('STATE_BOARD')?.lastErrorAt).toBeNull();
  });

  it('returns snapshots in canonical SourceId order', () => {
    // Insert in scrambled order
    recordSnapshot(
      snap({
        sourceId: 'STATE_BOARD',
        state: 'UNKNOWN',
        observedAt: '2024-06-01T10:00:00.000Z',
      }),
    );
    recordSnapshot(
      snap({
        sourceId: 'NPPES',
        state: 'LIVE',
        observedAt: '2024-06-01T10:01:00.000Z',
      }),
    );
    recordSnapshot(
      snap({
        sourceId: 'PECOS',
        state: 'DEGRADED',
        observedAt: '2024-06-01T10:02:00.000Z',
      }),
    );
    recordSnapshot(
      snap({
        sourceId: 'OIG_LEIE',
        state: 'LIVE',
        observedAt: '2024-06-01T10:03:00.000Z',
      }),
    );

    const ids = getAllSnapshots().map((s) => s.sourceId);
    expect(ids).toEqual(['NPPES', 'OIG_LEIE', 'PECOS', 'STATE_BOARD']);
  });

  it('LIVE after UNAVAILABLE advances lastSuccessAt and keeps prior lastErrorAt available via store update', () => {
    recordSnapshot(
      snap({
        sourceId: 'NPPES',
        state: 'UNAVAILABLE',
        observedAt: '2024-06-01T17:00:00.000Z',
      }),
    );
    expect(getSnapshot('NPPES')?.lastErrorAt).toBe(
      '2024-06-01T17:00:00.000Z',
    );

    recordSnapshot(
      snap({
        sourceId: 'NPPES',
        state: 'LIVE',
        observedAt: '2024-06-01T18:00:00.000Z',
        lastErrorAt: null,
      }),
    );
    const got = getSnapshot('NPPES');
    expect(got?.state).toBe('LIVE');
    expect(got?.lastSuccessAt).toBe('2024-06-01T18:00:00.000Z');
    // New LIVE snapshot's own lastErrorAt (null) wins.
    expect(got?.lastErrorAt).toBeNull();
  });
});
