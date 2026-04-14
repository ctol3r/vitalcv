import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from '@/lib/relative-time';

describe('formatRelativeTime', () => {
  const now = new Date('2026-04-14T12:00:00.000Z');

  it('returns "just now" within 30 seconds', () => {
    expect(formatRelativeTime('2026-04-14T11:59:45.000Z', now)).toBe('just now');
  });

  it('formats minutes with pluralization', () => {
    expect(formatRelativeTime('2026-04-14T11:58:00.000Z', now)).toBe('2 minutes ago');
    expect(formatRelativeTime('2026-04-14T11:59:00.000Z', now)).toBe('1 minute ago');
  });

  it('formats hours, days, and weeks', () => {
    expect(formatRelativeTime('2026-04-14T09:00:00.000Z', now)).toBe('3 hours ago');
    expect(formatRelativeTime('2026-04-13T12:00:00.000Z', now)).toBe('1 day ago');
    expect(formatRelativeTime('2026-04-01T12:00:00.000Z', now)).toBe('2 weeks ago');
  });

  it('returns empty string on invalid ISO input', () => {
    expect(formatRelativeTime('not-a-date', now)).toBe('');
  });

  it('handles future timestamps with "in X" phrasing', () => {
    expect(formatRelativeTime('2026-04-14T12:05:00.000Z', now)).toBe('in 5 minutes');
  });
});
