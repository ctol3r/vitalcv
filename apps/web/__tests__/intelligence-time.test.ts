import { formatRelativeTime, safeLocalHref } from '@/lib/intelligence/time';

describe('intelligence time helpers', () => {
  it('formats relative timestamps deterministically', () => {
    const now = Date.parse('2026-03-15T12:00:00.000Z');
    expect(formatRelativeTime('2026-03-15T11:58:00.000Z', now)).toBe('2 min ago');
    expect(formatRelativeTime('2026-03-15T14:00:00.000Z', now)).toBe('in 2 hours');
    expect(formatRelativeTime('2026-03-14T10:00:00.000Z', now)).toBe('Yesterday');
    expect(formatRelativeTime('2026-03-12T12:00:00.000Z', now)).toBe('3 days ago');
  });

  it('accepts only local hrefs for back-navigation', () => {
    expect(safeLocalHref('/findings?page=2', '/findings')).toBe('/findings?page=2');
    expect(safeLocalHref('https://example.com', '/findings')).toBe('/findings');
    expect(safeLocalHref(undefined, '/findings')).toBe('/findings');
  });
});
