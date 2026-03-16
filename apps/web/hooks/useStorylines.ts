'use client';

import { useIntelligenceResource } from './useIntelligenceResource';
import type { StorylinesResponse } from '@/lib/intelligence/contracts';

export interface UseStorylinesOptions {
  provider?: string | null;
  severity?: string | null;
  status?: string | null;
  storylineType?: string | null;
  perspective?: string | null;
  limit?: number;
  page?: number;
  pageSize?: number;
  pollIntervalMs?: number;
  paused?: boolean;
  initialData?: StorylinesResponse | null;
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

  if (options.storylineType) {
    params.set('storylineType', options.storylineType);
  }

  if (options.perspective) {
    params.set('perspective', options.perspective);
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

  const queryString = params.toString();
  const url = `/api/intelligence/storylines${queryString ? `?${queryString}` : ''}`;

  return useIntelligenceResource<StorylinesResponse>(url, {
    initialData: options.initialData,
    paused: options.paused,
    pollIntervalMs: options.pollIntervalMs ?? 25_000,
  });
}
