/**
 * TRUTH INVARIANT: LIVE is emitted ONLY by a confirmed 2xx probe response.
 *
 * Specifically:
 *   - With an empty store, getLaneSnapshots() returns ZERO LIVE snapshots.
 *   - With runAllProbes mocked so every source fails (5xx, timeout, 429,
 *     network), the result and the store contain ZERO LIVE snapshots.
 *   - With ONE source returning 2xx and the others failing, only that one
 *     source is LIVE; the others are NOT.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { getLaneSnapshots } from '@/lib/source-health/getLaneSnapshots';
import { runAllProbes } from '@/lib/source-health/runner/runAllProbes';
import {
  clearAllSnapshots,
  getAllSnapshots,
} from '@/lib/source-health/store/snapshotStore';
import { runProbe } from '@/lib/source-health/probes/runProbe';
import type { SourceId } from '@/lib/source-health/sourceHealthTypes';

type Outcome = '2xx' | '5xx' | '429' | 'timeout' | 'network';

function makeProbe(sourceId: SourceId, outcome: Outcome) {
  return async () =>
    runProbe(
      sourceId,
      async ({ signal }) => {
        switch (outcome) {
          case '2xx':
            return { status: 200, ok: true };
          case '5xx':
            return { status: 503, ok: false };
          case '429':
            return { status: 429, ok: false };
          case 'timeout':
            return new Promise((_resolve, reject) => {
              signal.addEventListener('abort', () => reject(new Error('aborted')));
            });
          case 'network':
            return { error: new TypeError('network failure') };
        }
      },
      { timeoutMs: 5 },
    );
}

describe('TRUTH INVARIANT: no fake LIVE', () => {
  beforeEach(() => {
    clearAllSnapshots();
  });

  it('cold store: getLaneSnapshots returns zero LIVE (4 UNKNOWN)', () => {
    const lanes = getLaneSnapshots();
    expect(lanes).toHaveLength(4);
    const liveCount = lanes.filter((s) => s.state === 'LIVE').length;
    expect(liveCount).toBe(0);
    const unknownCount = lanes.filter((s) => s.state === 'UNKNOWN').length;
    expect(unknownCount).toBe(4);
  });

  it('all probes fail (5xx, timeout, 429, network): zero LIVE in result and store', async () => {
    const probes = [
      { sourceId: 'NPPES' as const, probe: makeProbe('NPPES', '5xx') },
      { sourceId: 'OIG_LEIE' as const, probe: makeProbe('OIG_LEIE', 'timeout') },
      { sourceId: 'PECOS' as const, probe: makeProbe('PECOS', '429') },
      { sourceId: 'STATE_BOARD' as const, probe: makeProbe('STATE_BOARD', 'network') },
    ];
    const res = await runAllProbes({ probes, timeoutMs: 5 });
    const liveInResult = res.snapshots.filter((s) => s.state === 'LIVE').length;
    expect(liveInResult).toBe(0);

    const stored = getAllSnapshots();
    const liveInStore = stored.filter((s) => s.state === 'LIVE').length;
    expect(liveInStore).toBe(0);

    // And the surface fallback also returns zero LIVE.
    const lanes = getLaneSnapshots();
    const liveInSurface = lanes.filter((s) => s.state === 'LIVE').length;
    expect(liveInSurface).toBe(0);
  });

  it('only the 2xx source is LIVE; the others are NOT', async () => {
    const probes = [
      { sourceId: 'NPPES' as const, probe: makeProbe('NPPES', '2xx') },
      { sourceId: 'OIG_LEIE' as const, probe: makeProbe('OIG_LEIE', '5xx') },
      { sourceId: 'PECOS' as const, probe: makeProbe('PECOS', '429') },
      { sourceId: 'STATE_BOARD' as const, probe: makeProbe('STATE_BOARD', 'network') },
    ];
    const res = await runAllProbes({ probes });
    const live = res.snapshots.filter((s) => s.state === 'LIVE');
    expect(live).toHaveLength(1);
    expect(live[0].sourceId).toBe('NPPES');

    const others = res.snapshots.filter((s) => s.sourceId !== 'NPPES');
    for (const o of others) {
      expect(o.state).not.toBe('LIVE');
    }
  });

  it('placeholder seed never returns LIVE (cold store includes STATE_BOARD UNKNOWN reason)', () => {
    const lanes = getLaneSnapshots();
    const stateBoard = lanes.find((s) => s.sourceId === 'STATE_BOARD');
    expect(stateBoard?.state).toBe('UNKNOWN');
    expect(stateBoard?.reason).toBe('no_generic_state_board_probe_wired');

    // None of the placeholder seeds may be LIVE
    for (const s of lanes) {
      expect(s.state).not.toBe('LIVE');
    }
  });
});
