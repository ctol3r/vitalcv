'use client';

import { useIntelligenceResource } from './useIntelligenceResource';
import type { StorylinesResponse } from '@/lib/intelligence/contracts';

export interface UseStorylinesOptions {
  provider?: string | null;
  severity?: string | null;
  status?: string | null;
  limit?: number;
  pollIntervalMs?: number;
  paused?: boolean;
}

export function useStorylines(options: UseStorylinesOptions = {}) {
  const params = new URLSearchParams();

  if (options.provider) {
    params.set('provider', options.provider);
  }

  if (options.severity) {
    params.set('severity', options.severity);
  }

  if (options.status) {
    params.set('status', options.status);
  }

  if (typeof options.limit === 'number') {
    params.set('limit', String(options.limit));
  }

  const queryString = params.toString();
  const url = `/api/intelligence/storylines${queryString ? `?${queryString}` : ''}`;

  return useIntelligenceResource<StorylinesResponse>(url, {
    paused: options.paused,
    pollIntervalMs: options.pollIntervalMs ?? 25_000,
  });
}
