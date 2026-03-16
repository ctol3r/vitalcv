import { buildPaginationItems, formatPaginationSummary } from '@/components/intelligence-ops/pagination';

describe('pagination helpers', () => {
  it('builds leading, middle, and trailing page ranges', () => {
    expect(buildPaginationItems(1, 10)).toEqual([1, 2, 3, 4, 'ellipsis', 10]);
    expect(buildPaginationItems(5, 10)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
    expect(buildPaginationItems(10, 10)).toEqual([1, 'ellipsis', 7, 8, 9, 10]);
  });

  it('formats the visible item summary with clamped pages', () => {
    expect(formatPaginationSummary({
      page: 2,
      limit: 20,
      total: 582,
      label: 'findings',
    })).toBe('Showing 21\u201340 of 582 findings');

    expect(formatPaginationSummary({
      page: 99,
      limit: 20,
      total: 21,
      label: 'providers',
    })).toBe('Showing 21\u201321 of 21 providers');
  });
});
