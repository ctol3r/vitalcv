/**
 * useAlertStream.ts — Wave 93
 *
 * Polls GET /api/monitoring/events every 15s.
 * Returns live monitoring alerts for AlertStream component.
 */

'use client';

import { useApi } from './useApi';
import type { MonitoringAlert } from '@/components/monitoring/AlertStream';

export function useAlertStream(intervalMs = 15_000) {
  const result = useApi<MonitoringAlert[]>('/api/monitoring/events', {
    interval: intervalMs,
  });

  return {
    ...result,
    // Guarantee array even while loading
    data: result.data ?? [],
  };
}
