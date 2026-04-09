/**
 * Server-side funnel event tracking via PostHog's HTTP capture API.
 * Used in API routes where the client-side posthog-js SDK is unavailable.
 *
 * Fire-and-forget — never blocks the response.
 */

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

export function trackServerFunnelEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (!POSTHOG_KEY) return;

  const body = JSON.stringify({
    api_key: POSTHOG_KEY,
    event,
    properties: {
      distinct_id: 'server',
      $lib: 'vitalcv-server',
      funnel_timestamp: Date.now(),
      ...properties,
    },
    timestamp: new Date().toISOString(),
  });

  fetch(`${POSTHOG_HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(3000),
  }).catch(() => {
    // Analytics must never interrupt the response.
  });
}
