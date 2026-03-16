'use client';

import { useIntelligenceResource } from './useIntelligenceResource';
import type { ProvidersResponse } from '@/lib/intelligence/contracts';

export interface UseProvidersOptions {
  query?: string;
  limit?: number;
  page?: number;
  pageSize?: number;
  minTrustScore?: number;
  pollIntervalMs?: number;
  paused?: boolean;
  initialData?: ProvidersResponse | null;
}

export function useProviders(options: UseProvidersOptions = {}) {
  const params = new URLSearchParams();

  if (options.query) {
    params.set('q', options.query);
  }

  if (typeof options.limit === 'number') {
    params.set('limit', String(options.limit));
  }

  if (typeof options.page === 'number') {
    params.set('page', String(options.page));
  }

  if (typeof options.pageSize === 'number') {
    params.set('pageSize', String(options.pageSize));
  }

  if (typeof options.minTrustScore === 'number') {
    params.set('minTrustScore', String(options.minTrustScore));
  }

  const queryString = params.toString();
  const url = `/api/intelligence/providers${queryString ? `?${queryString}` : ''}`;

  return useIntelligenceResource<ProvidersResponse>(url, {
    initialData: options.initialData,
    paused: options.paused,
    pollIntervalMs: options.pollIntervalMs ?? 30_000,
  });
}
