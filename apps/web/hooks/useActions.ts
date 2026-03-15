'use client';

import { useIntelligenceResource } from './useIntelligenceResource';
import type { ActionsResponse } from '@/lib/intelligence/contracts';

export interface UseActionsOptions {
  entity?: string | null;
  priority?: string | null;
  actionType?: string | null;
  limit?: number;
  pollIntervalMs?: number;
  paused?: boolean;
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

  if (typeof options.limit === 'number') {
    params.set('limit', String(options.limit));
  }

  const queryString = params.toString();
  const url = `/api/intelligence/actions${queryString ? `?${queryString}` : ''}`;

  return useIntelligenceResource<ActionsResponse>(url, {
    paused: options.paused,
    pollIntervalMs: options.pollIntervalMs ?? 25_000,
  });
}
