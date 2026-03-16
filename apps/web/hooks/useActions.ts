'use client';

import { useIntelligenceResource } from './useIntelligenceResource';
import type { ActionsResponse } from '@/lib/intelligence/contracts';

export interface UseActionsOptions {
  entity?: string | null;
  priority?: string | null;
  actionType?: string | null;
  status?: string | null;
  page?: number;
  limit?: number;
  offset?: number;
  pollIntervalMs?: number;
  paused?: boolean;
  initialData?: ActionsResponse | null;
}

export function useActions(options: UseActionsOptions = {}) {
  const params = new URLSearchParams();

  if (options.entity) {
    params.set('entity', options.entity);
  }

  if (options.priority) {
    params.set('priority', options.priority);
  }

  if (options.actionType) {
    params.set('actionType', options.actionType);
  }

  if (options.status) {
    params.set('status', options.status);
  }

  if (typeof options.limit === 'number') {
    params.set('limit', String(options.limit));
  }

  if (typeof options.page === 'number') {
    params.set('page', String(options.page));
  }

  if (typeof options.offset === 'number') {
    params.set('offset', String(options.offset));
  }

  const queryString = params.toString();
  const url = `/api/intelligence/actions${queryString ? `?${queryString}` : ''}`;

  return useIntelligenceResource<ActionsResponse>(url, {
    initialData: options.initialData,
    paused: options.paused,
    pollIntervalMs: options.pollIntervalMs ?? 25_000,
  });
}
