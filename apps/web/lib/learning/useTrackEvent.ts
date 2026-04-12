'use client';

import { useCallback } from 'react';

type TrackEventType =
  | 'NPI_CHECKED'
  | 'PROFILE_VIEWED'
  | 'JOB_CLICKED'
  | 'JOB_VIEWED'
  | 'APPLY_CLICKED'
  | 'EMPLOYER_VIEWED';

interface TrackEventPayload {
  providerId: string;
  jobId?: string;
  employerId?: string;
  metadata?: Record<string, unknown>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

/**
 * Fire-and-forget event tracking hook.
 * Uses navigator.sendBeacon when available (page-exit safe),
 * falls back to fetch for in-page events.
 */
export function useTrackEvent() {
  return useCallback((type: TrackEventType, payload: TrackEventPayload) => {
    const body = JSON.stringify({ type, ...payload });
    const url = `${API_BASE}/api/learning/track`;

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    } else {
      void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  }, []);
}
