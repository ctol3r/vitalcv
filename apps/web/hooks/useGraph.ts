'use client';

import { useIntelligenceResource } from './useIntelligenceResource';
import type { IntelligenceGraphResponse } from '@/lib/intelligence/contracts';

export interface UseGraphOptions {
  npi?: string | null;
  layer?: 'knowledge' | 'trust' | 'blended';
  limit?: number;
  pollIntervalMs?: number;
  paused?: boolean;
}

export function useGraph(options: UseGraphOptions = {}) {
  const params = new URLSearchParams();

  if (options.npi) {
    params.set('npi', options.npi);
  }

  if (options.layer) {
    params.set('layer', options.layer);
  }

  if (typeof options.limit === 'number') {
    params.set('limit', String(options.limit));
  }

  const queryString = params.toString();
  const url = `/api/intelligence/graph${queryString ? `?${queryString}` : ''}`;

  return useIntelligenceResource<IntelligenceGraphResponse>(url, {
    paused: options.paused,
    pollIntervalMs: options.pollIntervalMs ?? 45_000,
  });
}
