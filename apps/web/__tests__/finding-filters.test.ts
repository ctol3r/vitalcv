import { describe, expect, it } from 'vitest';
import {
  normalizeFindingFilters,
  parseFindingFilters,
  serializeFindingFilters,
} from '@/lib/intelligence/finding-filters';

describe('finding filter helpers', () => {
  it('parses and canonicalizes findings filters from URL params', () => {
    const filters = parseFindingFilters(new URLSearchParams(
      'severity=high,critical&type=grant,publication&status=new&minConfidence=0.60&dateFrom=2026-03-15&dateTo=2026-03-01',
    ));

    expect(filters).toEqual({
      severity: ['critical', 'high'],
      type: ['grant', 'publication'],
      status: ['new'],
      dateFrom: '2026-03-01',
      dateTo: '2026-03-15',
      minConfidence: '0.6',
    });
  });

  it('serializes only active filters into stable URL params', () => {
    const params = serializeFindingFilters(normalizeFindingFilters({
      severity: ['high', 'critical'],
      type: ['publication', 'grant'],
      status: ['new'],
      minConfidence: '0.60',
      dateFrom: '',
      dateTo: '',
    }), { page: 2 });

    expect(params.toString()).toBe(
      'severity=critical%2Chigh&type=grant%2Cpublication&status=new&minConfidence=0.6&page=2',
    );
  });
});
