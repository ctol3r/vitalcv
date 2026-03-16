'use client';

import { useIntelligenceResource } from './useIntelligenceResource';
import type {
  ActionDetailResponse,
  InvestigatorFindingDetailResponse,
  ProviderDetailResponse,
  StorylineDetailResponse,
} from '@/lib/intelligence/detail-types';

interface DetailHookOptions<T> {
  initialData?: T | null;
  paused?: boolean;
  pollIntervalMs?: number;
}

export function useFinding(
  findingId: string | null,
  options: DetailHookOptions<InvestigatorFindingDetailResponse> = {},
) {
  const url = findingId ? `/api/intelligence/findings/${encodeURIComponent(findingId)}` : null;
  return useIntelligenceResource<InvestigatorFindingDetailResponse>(url, {
    initialData: options.initialData,
    paused: options.paused,
    pollIntervalMs: options.pollIntervalMs ?? 20_000,
  });
}

export function useStoryline(
  storylineId: string | null,
  options: DetailHookOptions<StorylineDetailResponse> = {},
) {
  const url = storylineId ? `/api/storylines/${encodeURIComponent(storylineId)}` : null;
  return useIntelligenceResource<StorylineDetailResponse>(url, {
    initialData: options.initialData,
    paused: options.paused,
    pollIntervalMs: options.pollIntervalMs ?? 25_000,
  });
}

export function useAction(
  actionId: string | null,
  options: DetailHookOptions<ActionDetailResponse> = {},
) {
  const url = actionId ? `/api/actions/${encodeURIComponent(actionId)}` : null;
  return useIntelligenceResource<ActionDetailResponse>(url, {
    initialData: options.initialData,
    paused: options.paused,
    pollIntervalMs: options.pollIntervalMs ?? 25_000,
  });
}

export function useProvider(
  npi: string | null,
  options: DetailHookOptions<ProviderDetailResponse> = {},
) {
  const url = npi ? `/api/intelligence/providers/${encodeURIComponent(npi)}` : null;
  return useIntelligenceResource<ProviderDetailResponse>(url, {
    initialData: options.initialData,
    paused: options.paused,
    pollIntervalMs: options.pollIntervalMs ?? 30_000,
  });
}

export const useFindingDetail = useFinding;
export const useStorylineDetail = useStoryline;
export const useActionDetail = useAction;
export const useProviderDetail = useProvider;
