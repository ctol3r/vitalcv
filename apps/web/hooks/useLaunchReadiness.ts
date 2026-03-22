'use client';

import { useIntelligenceResource } from './useIntelligenceResource';
import type { LaunchReadinessPayload } from '@/lib/launch/readiness';

export function useLaunchReadiness(pollIntervalMs = 60_000, paused = false) {
  return useIntelligenceResource<LaunchReadinessPayload>('/api/intelligence/launch-readiness', {
    paused,
    pollIntervalMs,
  });
}
