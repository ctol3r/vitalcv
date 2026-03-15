'use client';

import { useIntelligenceResource } from './useIntelligenceResource';
import type { FindingsResponse } from '@/lib/intelligence/contracts';

export interface UseFindingsOptions {
  provider?: string | null;
  severity?: string | null;
  status?: string | null;
  limit?: number;
  pollIntervalMs?: number;
  paused?: boolean;
}

export function useFindings(options: UseFindingsOptions = {}) {
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
  const url = `/api/intelligence/findings${queryString ? `?${queryString}` : ''}`;

  return useIntelligenceResource<FindingsResponse>(url, {
    paused: options.paused,
    pollIntervalMs: options.pollIntervalMs ?? 20_000,
  });
}
