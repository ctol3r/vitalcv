'use client';

import { useIntelligenceResource } from './useIntelligenceResource';
import type { ProvidersResponse } from '@/lib/intelligence/contracts';

export interface UseProvidersOptions {
  query?: string;
  limit?: number;
  minTrustScore?: number;
  pollIntervalMs?: number;
  paused?: boolean;
}

export function useProviders(options: UseProvidersOptions = {}) {
  const params = new URLSearchParams();

  if (options.query) {
    params.set('q', options.query);
  }

  if (typeof options.limit === 'number') {
    params.set('limit', String(options.limit));
  }

  if (typeof options.minTrustScore === 'number') {
    params.set('minTrustScore', String(options.minTrustScore));
  }

  const queryString = params.toString();
  const url = `/api/intelligence/providers${queryString ? `?${queryString}` : ''}`;

  return useIntelligenceResource<ProvidersResponse>(url, {
    paused: options.paused,
    pollIntervalMs: options.pollIntervalMs ?? 30_000,
  });
}
