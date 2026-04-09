import { describe, expect, it, vi } from 'vitest';
import { buildMobileFreshnessState } from '../lib/mobile/freshness';

describe('mobile freshness continuity', () => {
  it('treats recent syncs as current utility state', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));

    const freshness = buildMobileFreshnessState('2026-04-08T11:50:00.000Z');

    expect(freshness.isAging).toBe(false);
    expect(freshness.isStale).toBe(false);
    expect(freshness.label).toBe('Synced 10 min ago');

    vi.useRealTimers();
  });

  it('marks stale sync windows so utility surfaces can keep continuity explicit', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));

    const freshness = buildMobileFreshnessState('2026-04-08T08:15:00.000Z');

    expect(freshness.isAging).toBe(true);
    expect(freshness.isStale).toBe(true);
    expect(freshness.label).toBe('Refresh recommended · 3h old');
    expect(freshness.detail).toContain('Pull a fresh state before relying on updates, matches, or readiness.');

    vi.useRealTimers();
  });
});
