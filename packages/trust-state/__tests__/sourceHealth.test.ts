import { describe, expect, it } from 'vitest';
import {
  buildSourceHealthFreshness,
  isSourceHealthFresh,
} from '../sourceHealth';

describe('Source Health Contracts', () => {
  it('keeps a source current through the exact freshness boundary and turns stale immediately after', () => {
    const observedAt = '2026-03-20T12:00:00.000Z';

    expect(isSourceHealthFresh({
      lastSuccessAt: observedAt,
      freshnessWindowHours: 168,
      now: new Date('2026-03-27T12:00:00.000Z'),
    })).toBe(true);

    expect(isSourceHealthFresh({
      lastSuccessAt: observedAt,
      freshnessWindowHours: 168,
      now: new Date('2026-03-27T12:00:01.000Z'),
    })).toBe(false);
  });

  it('captures age and expiry on stale freshness snapshots for operator surfaces', () => {
    const freshness = buildSourceHealthFreshness({
      coverageState: 'stale',
      lastSuccessAt: '2026-03-20T12:00:00.000Z',
      freshnessWindowHours: 24,
      now: new Date('2026-03-22T12:00:00.000Z'),
    });

    expect(freshness).toEqual({
      status: 'stale',
      checkedAt: '2026-03-20T12:00:00.000Z',
      observedAt: '2026-03-20T12:00:00.000Z',
      expiresAt: '2026-03-21T12:00:00.000Z',
      freshnessWindowHours: 24,
      ageHours: 48,
    });
  });
});
