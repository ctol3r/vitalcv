'use client';

import { useIntelligenceResource } from './useIntelligenceResource';
import type { FindingsResponse } from '@/lib/intelligence/contracts';
import {
  normalizeFindingFilters,
  parseFindingFilterList,
  parseMinConfidenceNumber,
} from '@/lib/intelligence/finding-filters';

export interface UseFindingsOptions {
  provider?: string | null;
  severity?: string[] | string | null;
  status?: string[] | string | null;
  type?: string[] | string | null;
  findingType?: string[] | string | null;
  investigatorId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  minConfidence?: number | string | null;
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
  pollIntervalMs?: number;
  paused?: boolean;
  initialData?: FindingsResponse | null;
}

export function useFindings(options: UseFindingsOptions = {}) {
  const typeFilterInput = options.type ?? options.findingType;

  const filters = normalizeFindingFilters({
    severity: Array.isArray(options.severity)
      ? options.severity
      : parseFindingFilterList(options.severity),
    type: Array.isArray(typeFilterInput)
      ? [...typeFilterInput]
      : parseFindingFilterList(typeFilterInput),
    status: Array.isArray(options.status)
      ? options.status
      : parseFindingFilterList(options.status),
    dateFrom: options.dateFrom ?? '',
    dateTo: options.dateTo ?? '',
    minConfidence: typeof options.minConfidence === 'number'
      ? options.minConfidence.toString()
      : options.minConfidence ?? '',
  });
  const params = new URLSearchParams();

  if (options.provider) {
    params.set('provider', options.provider);
  }

  if (filters.severity.length > 0) {
    params.set('severity', filters.severity.join(','));
  }

  if (filters.status.length > 0) {
    params.set('status', filters.status.join(','));
  }

  if (filters.type.length > 0) {
    params.set('type', filters.type.join(','));
  }

  if (options.investigatorId) {
    params.set('investigatorId', options.investigatorId);
  }

  if (filters.dateFrom) {
    params.set('dateFrom', filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set('dateTo', filters.dateTo);
  }

  const minConfidence = parseMinConfidenceNumber(filters.minConfidence);
  if (minConfidence !== null) {
    params.set('minConfidence', minConfidence.toString());
  }

  if (typeof options.page === 'number') {
    params.set('page', String(options.page));
  }

  if (typeof options.pageSize === 'number') {
    params.set('pageSize', String(options.pageSize));
  } else if (typeof options.limit === 'number') {
    params.set('limit', String(options.limit));
  }

  if (typeof options.offset === 'number') {
    params.set('offset', String(options.offset));
  }

  const queryString = params.toString();
  const url = `/api/intelligence/findings${queryString ? `?${queryString}` : ''}`;

  return useIntelligenceResource<FindingsResponse>(url, {
    initialData: options.initialData,
    paused: options.paused,
    pollIntervalMs: options.pollIntervalMs ?? 20_000,
  });
}
