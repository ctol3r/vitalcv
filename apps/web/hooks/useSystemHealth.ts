'use client';

import { useIntelligenceResource } from './useIntelligenceResource';
import type { IntelligenceSystemHealth } from '@/lib/intelligence/contracts';

export function useSystemHealth(pollIntervalMs = 60_000, paused = false) {
  return useIntelligenceResource<IntelligenceSystemHealth>('/api/intelligence/system-health', {
    paused,
    pollIntervalMs,
  });
}
