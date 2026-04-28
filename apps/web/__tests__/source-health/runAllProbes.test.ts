import { beforeEach, describe, expect, it } from 'vitest';

import { runAllProbes } from '@/lib/source-health/runner/runAllProbes';
import {
  clearAllSnapshots,
  getAllSnapshots,
} from '@/lib/source-health/store/snapshotStore';
import { runProbe } from '@/lib/source-health/probes/runProbe';
import type {
  ProbeDeps,
} from '@/lib/source-health/probes/runProbe';
import type {
  SourceHealthSnapshot,
  SourceId,
} from '@/lib/source-health/sourceHealthTypes';

type FetchOutcome =
  | { kind: '2xx' }
  | { kind: '5xx' }
  | { kind: '429' }
  | { kind: 'timeout' }
  | { kind: 'network' };

function makeProbeFor(
  sourceId: SourceId,
  outcome: FetchOutcome,
): (deps?: ProbeDeps) => Promise<SourceHealthSnapshot> {
  return async (deps?: ProbeDeps) =>
    runProbe(
      sourceId,
      async ({ signal }) => {
        switch (outcome.kind) {
          case '2xx':
            return { status: 200, ok: true };
          case '5xx':
            return { status: 503, ok: false };
          case '429':
            return { status: 429, ok: false };
          case 'timeout':
            // Wait for abort. runProbe's setTimeout will trigger.
            return new Promise((_resolve, reject) => {
              signal.addEventListener('abort', () => {
                reject(new Error('aborted'));
              });
            });
          case 'network':
            return { error: new TypeError('network failure') };
        }
      },
      deps,
    );
}

const fixedNow = () => new Date('2024-06-01T12:00:00.000Z');

describe('runAllProbes', () => {
  beforeEach(() => {
    clearAllSnapshots();
  });

  it('runs all four lanes in canonical order', async () => {
    const probes = [
      { sourceId: 'NPPES' as const, probe: makeProbeFor('NPPES', { kind: '2xx' }) },
      { sourceId: 'OIG_LEIE' as const, probe: makeProbeFor('OIG_LEIE', { kind: '2xx' }) },
      { sourceId: 'PECOS' as const, probe: makeProbeFor('PECOS', { kind: '2xx' }) },
      { sourceId: 'STATE_BOARD' as const, probe: makeProbeFor('STATE_BOARD', { kind: '2xx' }) },
    ];
    const res = await runAllProbes({ probes, now: fixedNow });
    expect(res.snapshots.map((s) => s.sourceId)).toEqual([
      'NPPES',
      'OIG_LEIE',
      'PECOS',
      'STATE_BOARD',
    ]);
    expect(res.errors).toEqual([]);
  });

  it('maps 2xx → LIVE', async () => {
    const probes = [
      { sourceId: 'NPPES' as const, probe: makeProbeFor('NPPES', { kind: '2xx' }) },
    ];
    const res = await runAllProbes({ probes, now: fixedNow });
    expect(res.snapshots[0].state).toBe('LIVE');
  });

  it('maps 5xx → DEGRADED', async () => {
    const probes = [
      { sourceId: 'PECOS' as const, probe: makeProbeFor('PECOS', { kind: '5xx' }) },
    ];
    const res = await runAllProbes({ probes, now: fixedNow });
    expect(res.snapshots[0].state).toBe('DEGRADED');
  });

  it('maps 429 → RATE_LIMITED', async () => {
    const probes = [
      { sourceId: 'OIG_LEIE' as const, probe: makeProbeFor('OIG_LEIE', { kind: '429' }) },
    ];
    const res = await runAllProbes({ probes, now: fixedNow });
    expect(res.snapshots[0].state).toBe('RATE_LIMITED');
  });

  it('maps timeout → UNAVAILABLE', async () => {
    const probes = [
      { sourceId: 'NPPES' as const, probe: makeProbeFor('NPPES', { kind: 'timeout' }) },
    ];
    const res = await runAllProbes({ probes, timeoutMs: 5 });
    expect(res.snapshots[0].state).toBe('UNAVAILABLE');
    expect(res.snapshots[0].reason).toBe('probe_timeout');
  });

  it('maps network error → UNAVAILABLE', async () => {
    const probes = [
      { sourceId: 'NPPES' as const, probe: makeProbeFor('NPPES', { kind: 'network' }) },
    ];
    const res = await runAllProbes({ probes, now: fixedNow });
    expect(res.snapshots[0].state).toBe('UNAVAILABLE');
    expect(res.snapshots[0].reason).toBe('network_error');
  });

  it('does not throw when an underlying probe rejects synchronously', async () => {
    const throwingProbe = async () => {
      throw new Error('boom');
    };
    const probes = [
      { sourceId: 'NPPES' as const, probe: throwingProbe },
    ];
    await expect(runAllProbes({ probes, now: fixedNow })).resolves.toBeDefined();
    const res = await runAllProbes({ probes, now: fixedNow });
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].sourceId).toBe('NPPES');
    // UNKNOWN state recorded for the failed source
    const found = res.snapshots.find((s) => s.sourceId === 'NPPES');
    expect(found?.state).toBe('UNKNOWN');
  });

  it('measures durationMs via injected now()', async () => {
    let tick = 0;
    const ticks = [
      new Date('2024-06-01T12:00:00.000Z'),
      new Date('2024-06-01T12:00:00.100Z'), // probe start
      new Date('2024-06-01T12:00:00.200Z'), // probe finish
      new Date('2024-06-01T12:00:00.300Z'), // batch finish
    ];
    const now = () => ticks[Math.min(tick++, ticks.length - 1)];
    const probes = [
      { sourceId: 'NPPES' as const, probe: makeProbeFor('NPPES', { kind: '2xx' }) },
    ];
    const res = await runAllProbes({ probes, now });
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records every snapshot in the store', async () => {
    const probes = [
      { sourceId: 'NPPES' as const, probe: makeProbeFor('NPPES', { kind: '2xx' }) },
      { sourceId: 'PECOS' as const, probe: makeProbeFor('PECOS', { kind: '5xx' }) },
    ];
    await runAllProbes({ probes, now: fixedNow });
    const stored = getAllSnapshots();
    expect(stored.find((s) => s.sourceId === 'NPPES')?.state).toBe('LIVE');
    expect(stored.find((s) => s.sourceId === 'PECOS')?.state).toBe(
      'DEGRADED',
    );
  });

  it('respects an injected store override', async () => {
    const recorded: SourceHealthSnapshot[] = [];
    const store = {
      recordSnapshot: (s: SourceHealthSnapshot) => {
        recorded.push(s);
      },
      getAllSnapshots: () => recorded,
    };
    const probes = [
      { sourceId: 'NPPES' as const, probe: makeProbeFor('NPPES', { kind: '2xx' }) },
    ];
    const res = await runAllProbes({ probes, store, now: fixedNow });
    expect(recorded).toHaveLength(1);
    expect(res.snapshots).toHaveLength(1);
  });

  it('never produces LIVE when every probe fails', async () => {
    const probes = [
      { sourceId: 'NPPES' as const, probe: makeProbeFor('NPPES', { kind: '5xx' }) },
      { sourceId: 'OIG_LEIE' as const, probe: makeProbeFor('OIG_LEIE', { kind: '429' }) },
      { sourceId: 'PECOS' as const, probe: makeProbeFor('PECOS', { kind: 'network' }) },
      { sourceId: 'STATE_BOARD' as const, probe: makeProbeFor('STATE_BOARD', { kind: 'timeout' }) },
    ];
    const res = await runAllProbes({ probes, timeoutMs: 5 });
    const liveCount = res.snapshots.filter((s) => s.state === 'LIVE').length;
    expect(liveCount).toBe(0);
  });
});
