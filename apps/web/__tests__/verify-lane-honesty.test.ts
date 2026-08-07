/**
 * /verify lane honesty — never-checked may not render as stale.
 *
 * The defect this pins: the state-board lane arrived from the passport as
 * `checked` with a `checkedAt` whenever a licence ROW existed, even though no
 * state board is ever queried (`sourceCatalog` marks STATE_BOARD
 * `liveAvailable: false` behind `STATE_BOARD_ENABLED`, unset in production,
 * and FSMB DocInfo is a paid aggregator the cost policy rules out). /verify
 * then aged that timestamp through a freshness window and displayed **Stale**.
 *
 * "Stale" tells a reader the board WAS checked and merely went out of date.
 * The truth is that nothing was ever checked, and the licence number on screen
 * is self-reported to NPPES by the provider. Those are different facts and the
 * surface must not collapse them.
 *
 * The upstream fix lives in `npiPassportContract.ts`; these guard the mapping
 * that carries it to the page. They run in the web suite, which is a CI gate —
 * the backend's own passport test sits in `testPathIgnorePatterns` and never
 * executes.
 */

import { describe, expect, it } from 'vitest';

import { checksToLaneSnapshots } from '@/lib/verify/laneSnapshots';

type Check = Parameters<typeof checksToLaneSnapshots>[0][number];

const check = (over: Partial<Check>): Check =>
  ({
    sourceId: 'STATE_BOARD',
    state: 'gated',
    checkedAt: null,
    sourceUrl: null,
    freshnessWindowHours: 168,
    ...over,
  }) as Check;

describe('a gated lane never reads as checked or stale', () => {
  it('maps gated → access_required', () => {
    const [lane] = checksToLaneSnapshots([check({})]);
    expect(lane.status).toBe('access_required');
  });

  it('carries no checkedAt for a lane that was never checked', () => {
    const [lane] = checksToLaneSnapshots([check({ checkedAt: null })]);
    expect(lane.checkedAt).toBeNull();
  });

  it('carries no freshness window for an access-required lane', () => {
    // A window on an unchecked lane is what lets a downstream age calculation
    // turn an absence into a staleness claim.
    const [lane] = checksToLaneSnapshots([check({ freshnessWindowHours: 168 })]);
    expect(lane.freshnessWindowMs).toBeUndefined();
  });

  it('never yields the stale status for a gated lane, whatever the timestamp', () => {
    const [lane] = checksToLaneSnapshots([
      check({ checkedAt: '2026-04-03T09:35:11.000Z' }),
    ]);
    expect(lane.status).not.toBe('stale');
    expect(lane.status).toBe('access_required');
  });
});

describe('genuinely checked lanes keep their freshness', () => {
  it('a checked lane maps to verified and retains its window', () => {
    const [lane] = checksToLaneSnapshots([
      check({
        sourceId: 'NPPES_API',
        state: 'checked',
        checkedAt: '2026-07-27T14:29:20.000Z',
        freshnessWindowHours: 24,
      }),
    ]);
    expect(lane.status).toBe('verified');
    expect(lane.checkedAt).toBe(new Date('2026-07-27T14:29:20.000Z').getTime());
    expect(lane.freshnessWindowMs).toBe(24 * 60 * 60 * 1000);
  });

  it('a genuinely stale lane still reports stale', () => {
    // The fix must not erase real staleness — only the fabricated kind.
    const [lane] = checksToLaneSnapshots([
      check({ sourceId: 'OIG_LEIE', state: 'stale', checkedAt: '2026-01-01T00:00:00.000Z' }),
    ]);
    expect(lane.status).toBe('stale');
  });

  it('an unparseable timestamp becomes null rather than NaN', () => {
    const [lane] = checksToLaneSnapshots([
      check({ sourceId: 'PECOS_PUBLIC', state: 'checked', checkedAt: 'not-a-date' }),
    ]);
    expect(lane.checkedAt).toBeNull();
  });
});
