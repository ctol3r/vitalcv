import { describe, expect, it, vi } from 'vitest';

// Repo convention (see issuer-persistence-writer.test.ts): neutralise the
// `server-only` guard and the Prisma singleton so these modules can be unit
// tested. Every DB call here is dependency-injected, so the mock is never hit.
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    availabilitySample: {
      createMany: async () => {
        throw new Error('real prisma must never be reached in these tests');
      },
      findMany: async () => {
        throw new Error('real prisma must never be reached in these tests');
      },
    },
  },
}));

import {
  isAvailable,
  recordAvailabilitySamples,
} from '@/lib/source-health/recordAvailabilitySamples';
import {
  MIN_DISTINCT_DAYS,
  summarizeLaneAvailability,
  type AvailabilitySampleRow,
} from '@/lib/source-health/getLaneAvailability';
import type { SourceHealthSnapshot } from '@/lib/source-health/sourceHealthTypes';

/**
 * D4 — the availability ledger's honesty rules.
 *
 * These tests exist because this codebase has twice filled an unmeasured gap
 * with an invented number: `/metrics/public` shipped `uptime: "99.99%"` plus
 * counters that grew off a wall clock (removed in #815 after production was
 * found publicly claiming 1,083,386 verifications it never performed). The
 * rules asserted here are what stop the third occurrence.
 */

const snap = (
  sourceId: SourceHealthSnapshot['sourceId'],
  state: SourceHealthSnapshot['state'],
  extra: Partial<SourceHealthSnapshot> = {},
): SourceHealthSnapshot => ({
  sourceId,
  state,
  reason: 'test',
  lastSuccessAt: null,
  lastErrorAt: null,
  lastLatencyMs: 42,
  observedAt: '2026-07-27T00:00:00.000Z',
  ...extra,
});

/** N samples for one lane, one per day, walking backwards from a fixed date. */
function daily(
  laneId: string,
  days: number,
  ok: boolean | ((i: number) => boolean) = true,
): AvailabilitySampleRow[] {
  const base = Date.UTC(2026, 6, 27);
  return Array.from({ length: days }, (_, i) => ({
    laneId,
    ok: typeof ok === 'function' ? ok(i) : ok,
    observedAt: new Date(base - i * 24 * 60 * 60 * 1000),
  }));
}

describe('D4 write path — only LIVE counts as available', () => {
  it('treats DEGRADED, UNKNOWN and RATE_LIMITED as NOT available', () => {
    // Rounding a partial answer up to "available" would inflate every figure
    // derived from this table. UNKNOWN especially: it means we failed to
    // observe, which is the one thing an availability number must not absorb.
    expect(isAvailable('LIVE')).toBe(true);
    expect(isAvailable('DEGRADED')).toBe(false);
    expect(isAvailable('UNAVAILABLE')).toBe(false);
    expect(isAvailable('UNKNOWN')).toBe(false);
    expect(isAvailable('RATE_LIMITED')).toBe(false);
  });

  it('maps a probe tick to rows without inventing fields', async () => {
    let captured: unknown[] = [];
    const res = await recordAvailabilitySamples(
      [snap('NPPES', 'LIVE'), snap('OIG_LEIE', 'DEGRADED')],
      'cron',
      {
        createMany: async ({ data }) => {
          captured = data;
          return { count: data.length };
        },
      },
    );

    expect(res).toEqual({ written: 2, failed: false });
    expect(captured).toEqual([
      expect.objectContaining({ laneId: 'NPPES', ok: true, state: 'LIVE', probeSource: 'cron' }),
      expect.objectContaining({ laneId: 'OIG_LEIE', ok: false, state: 'DEGRADED', probeSource: 'cron' }),
    ]);
  });

  it('NEVER throws — a ledger outage must not fail the probe', async () => {
    // The probe's job is reporting source health. If storage breaks, that must
    // degrade to "no new samples", not to a red deploy gate — the exact false
    // signal #832 set out to remove.
    const res = await recordAvailabilitySamples([snap('NPPES', 'LIVE')], 'deploy', {
      createMany: async () => {
        throw new Error('connection refused');
      },
    });

    expect(res.failed).toBe(true);
    expect(res.written).toBe(0);
    expect(res.reason).toContain('connection refused');
  });

  it('substitutes now for an unparseable observedAt rather than writing Invalid Date', async () => {
    let captured: Array<{ observedAt: Date }> = [];
    await recordAvailabilitySamples([snap('NPPES', 'LIVE', { observedAt: 'not-a-date' })], 'manual', {
      createMany: async ({ data }) => {
        captured = data as Array<{ observedAt: Date }>;
        return { count: data.length };
      },
    });
    expect(Number.isNaN(captured[0].observedAt.getTime())).toBe(false);
  });

  it('writes nothing when there are no snapshots', async () => {
    const res = await recordAvailabilitySamples([], 'cron', {
      createMany: async () => {
        throw new Error('should not be called');
      },
    });
    expect(res).toEqual({ written: 0, failed: false });
  });
});

describe('D4 read path — the 30-day gate', () => {
  it('renders NOTHING until 30 distinct days carry a sample', () => {
    const [lane] = summarizeLaneAvailability(daily('NPPES', MIN_DISTINCT_DAYS - 1), ['NPPES']);
    expect(lane.distinctDays).toBe(29);
    expect(lane.gateOpen).toBe(false);
    // null is "not enough observation to say" — NOT zero. A surface must render
    // the absence, never a 0%.
    expect(lane.availabilityPct).toBeNull();
  });

  it('opens exactly at the boundary, not before', () => {
    const [lane] = summarizeLaneAvailability(daily('NPPES', MIN_DISTINCT_DAYS), ['NPPES']);
    expect(lane.distinctDays).toBe(30);
    expect(lane.gateOpen).toBe(true);
    expect(lane.availabilityPct).toBe(100);
  });

  it('counts DISTINCT DAYS, not sample volume — a heavy burst cannot open the gate', () => {
    // 500 samples inside a single day is not 500 days of observation. This is
    // the rule that stops a night of deploy probes from manufacturing a figure.
    const burst: AvailabilitySampleRow[] = Array.from({ length: 500 }, () => ({
      laneId: 'NPPES',
      ok: true,
      observedAt: new Date(Date.UTC(2026, 6, 27, 3, 0, 0)),
    }));
    const [lane] = summarizeLaneAvailability(burst, ['NPPES']);
    expect(lane.sampleCount).toBe(500);
    expect(lane.distinctDays).toBe(1);
    expect(lane.gateOpen).toBe(false);
    expect(lane.availabilityPct).toBeNull();
  });

  it('divides by samples taken, never by elapsed time', () => {
    // 30 days of history, every third sample failing. Wall-clock has no say:
    // the answer is ok/total, and gaps between ticks are unmeasured time.
    const rows = daily('NPPES', 30, (i) => i % 3 !== 0);
    const [lane] = summarizeLaneAvailability(rows, ['NPPES']);
    expect(lane.sampleCount).toBe(30);
    expect(lane.okCount).toBe(20);
    expect(lane.availabilityPct).toBe(66.7);
  });

  it('reports every known lane, so an unprobed lane is visibly unmeasured', () => {
    const lanes = summarizeLaneAvailability(daily('NPPES', 30));
    expect(lanes.map((l) => l.laneId)).toEqual(['NPPES', 'OIG_LEIE', 'PECOS', 'STATE_BOARD']);
    const pecos = lanes.find((l) => l.laneId === 'PECOS')!;
    expect(pecos.sampleCount).toBe(0);
    expect(pecos.availabilityPct).toBeNull();
    expect(pecos.gateOpen).toBe(false);
  });

  it('never emits NaN for a lane with zero samples', () => {
    // 0/0 is NaN, and a NaN reaching a surface renders as garbage rather than
    // as "unmeasured".
    const [lane] = summarizeLaneAvailability([], ['NPPES']);
    expect(lane.availabilityPct).toBeNull();
    expect(Number.isNaN(lane.availabilityPct as unknown as number)).toBe(false);
  });

  it('ignores unparseable rows instead of poisoning the window', () => {
    const rows = [...daily('NPPES', 30), { laneId: 'NPPES', ok: true, observedAt: new Date('nope') }];
    const [lane] = summarizeLaneAvailability(rows, ['NPPES']);
    expect(lane.sampleCount).toBe(30);
    expect(lane.distinctDays).toBe(30);
  });

  it('exposes first/last observation so copy can name the real span', () => {
    const [lane] = summarizeLaneAvailability(daily('NPPES', 30), ['NPPES']);
    expect(lane.firstObservedAt?.toISOString().slice(0, 10)).toBe('2026-06-28');
    expect(lane.lastObservedAt?.toISOString().slice(0, 10)).toBe('2026-07-27');
  });
});
