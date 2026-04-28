import { describe, expect, it } from 'vitest';

import { aggregateLaneHealth } from '@/lib/source-health/aggregateLaneHealth';
import type {
  SourceHealthSnapshot,
  SourceId,
} from '@/lib/source-health/sourceHealthTypes';

function snap(
  sourceId: SourceId,
  state: SourceHealthSnapshot['state'],
  overrides: Partial<SourceHealthSnapshot> = {},
): SourceHealthSnapshot {
  return {
    sourceId,
    state,
    reason: 'test',
    lastSuccessAt: state === 'LIVE' ? '2024-01-01T00:00:00.000Z' : null,
    lastErrorAt: state === 'LIVE' ? null : '2024-01-01T00:00:00.000Z',
    lastLatencyMs: 10,
    observedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('aggregateLaneHealth', () => {
  it('marks allHealthy when every snapshot is LIVE', () => {
    const result = aggregateLaneHealth([
      snap('NPPES', 'LIVE'),
      snap('OIG_LEIE', 'LIVE'),
      snap('PECOS', 'LIVE'),
      snap('STATE_BOARD', 'LIVE'),
    ]);
    expect(result.allHealthy).toBe(true);
    expect(result.unavailableLanes).toEqual([]);
  });

  it('reports unavailable lanes for every non-LIVE snapshot in input order', () => {
    const result = aggregateLaneHealth([
      snap('NPPES', 'LIVE'),
      snap('OIG_LEIE', 'DEGRADED'),
      snap('PECOS', 'UNAVAILABLE'),
      snap('STATE_BOARD', 'UNKNOWN'),
    ]);
    expect(result.allHealthy).toBe(false);
    expect(result.unavailableLanes.map((l) => l.sourceId)).toEqual([
      'OIG_LEIE',
      'PECOS',
      'STATE_BOARD',
    ]);
    expect(result.unavailableLanes.map((l) => l.state)).toEqual([
      'DEGRADED',
      'UNAVAILABLE',
      'UNKNOWN',
    ]);
  });

  it('treats RATE_LIMITED as not healthy', () => {
    const result = aggregateLaneHealth([snap('NPPES', 'RATE_LIMITED')]);
    expect(result.allHealthy).toBe(false);
    expect(result.unavailableLanes).toHaveLength(1);
    expect(result.unavailableLanes[0]!.state).toBe('RATE_LIMITED');
    expect(result.unavailableLanes[0]!.retryPolicy.canRetryNow).toBe(false);
  });

  it('returns allHealthy=false on empty input (nothing observed)', () => {
    const result = aggregateLaneHealth([]);
    expect(result.allHealthy).toBe(false);
    expect(result.unavailableLanes).toEqual([]);
    expect(result.snapshots).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = [snap('NPPES', 'DEGRADED')];
    const result = aggregateLaneHealth(input);
    expect(result.snapshots).not.toBe(input);
    expect(result.snapshots).toEqual(input);
  });
});
