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

/**
 * Events that produce durable writes and require actor attribution.
 * These are routed through auth-injecting Next.js proxy routes instead of
 * directly to the backend.
 */
const AUTH_REQUIRED_EVENTS: ReadonlySet<TrackEventType> = new Set([
  'APPLY_CLICKED',
]);

/**
 * Route map for auth-required events.
 * Each entry routes to a Next.js API proxy that enforces Clerk auth
 * before forwarding to the backend with x-clerk-user-id injected.
 */
const AUTH_EVENT_ROUTES: Record<string, string> = {
  APPLY_CLICKED: '/api/track/apply',
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

/**
 * Fire-and-forget event tracking hook.
 *
 * Auth-required events (APPLY_CLICKED) are routed through Next.js auth-proxy
 * routes using fetch() with credentials included — ensuring Clerk session cookies
 * are sent and actor_id is injected server-side.
 *
 * Non-auth events use navigator.sendBeacon when available (page-exit safe),
 * falling back to fetch for in-page events.
 */
export function useTrackEvent() {
  return useCallback((type: TrackEventType, payload: TrackEventPayload) => {
    const body = JSON.stringify({ type, ...payload });

    if (AUTH_REQUIRED_EVENTS.has(type)) {
      // Auth-required durable writes: route through Next.js proxy.
      // credentials:'include' sends Clerk session cookie so the proxy can
      // read the authenticated session and inject x-clerk-user-id.
      const proxyRoute = AUTH_EVENT_ROUTES[type];
      void fetch(proxyRoute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        credentials: 'include',
        keepalive: true,
      }).catch(() => {});
      return;
    }

    // Non-auth events: use sendBeacon when available (page-exit safe).
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
