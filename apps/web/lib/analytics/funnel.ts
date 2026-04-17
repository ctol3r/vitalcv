'use client';

/**
 * Conversion funnel tracking — PostHog-backed analytics for the clinician
 * acquisition funnel. All events flow through posthog.capture() so they're
 * queryable from the PostHog Funnels UI and the /internal/funnel-debug page.
 *
 * UTM parameters are captured on first page load and attached to every
 * funnel event automatically.
 */

import posthog from 'posthog-js';

// ── Funnel event names ──────────────────────────────────────────────
export const FUNNEL_EVENTS = {
  HOMEPAGE_VIEWED: 'homepage_viewed',
  NPI_INPUT_FOCUSED: 'npi_input_focused',
  NPI_SUBMITTED: 'npi_submitted',
  RESULTS_DISPLAYED: 'results_displayed', // Passport Rendered
  DECISION_VIEWED: 'decision_viewed',
  ACTION_TAKEN: 'action_taken',
  SIGNUP_PROMPT_SHOWN: 'signup_prompt_shown',
  SIGNUP_PROMPT_DISMISSED: 'signup_prompt_dismissed',
  SIGNUP_CLICKED: 'signup_clicked',
  SIGNUP_COMPLETED: 'signup_completed',
  PACKET_DOWNLOADED: 'packet_downloaded',
  TIME_TO_START_CLICKED: 'time_to_start_clicked',
  DROPOFF_DETECTED: 'dropoff_detected',
} as const;

export type FunnelEventName = (typeof FUNNEL_EVENTS)[keyof typeof FUNNEL_EVENTS];

// ── UTM capture ─────────────────────────────────────────────────────
const UTM_STORAGE_KEY = 'vitalcv:utm';
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign'] as const;

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

/** Read UTM params from the current URL and persist to localStorage. */
export function captureUtmParams(): void {
  if (typeof window === 'undefined') return;

  try {
    const url = new URL(window.location.href);
    const captured: UtmParams = {};
    let hasAny = false;

    for (const key of UTM_PARAMS) {
      const val = url.searchParams.get(key);
      if (val) {
        captured[key] = val;
        hasAny = true;
      }
    }

    if (hasAny) {
      localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(captured));
    }
  } catch {
    // localStorage or URL parsing failure — never break the app.
  }
}

/** Retrieve persisted UTM params (empty object if none stored). */
export function getStoredUtmParams(): UtmParams {
  if (typeof window === 'undefined') return {};

  try {
    const raw = localStorage.getItem(UTM_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UtmParams) : {};
  } catch {
    return {};
  }
}

// ── NPI hashing ─────────────────────────────────────────────────────
/** SHA-256 hash of the NPI — never send raw NPIs to analytics. */
export async function hashNpi(npi: string): Promise<string> {
  const data = new TextEncoder().encode(npi);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Core tracker ────────────────────────────────────────────────────
/**
 * Track a funnel event through PostHog. UTM properties and a timestamp
 * are attached automatically.
 */
export function trackFunnelEvent(
  event: FunnelEventName,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;

  try {
    const utm = getStoredUtmParams();

    // Contextual drop-off / hesitation analysis
    const trackingProps = {
      ...utm,
      funnel_timestamp: Date.now(),
      ...properties,
    };

    posthog.capture(event, trackingProps);
  } catch {
    // Analytics must never interrupt the UI.
  }
}

/**
 * Convenience method for tracking structured drop-offs and hesitation points.
 */
export function trackDropoff(
  lastStep: FunnelEventName,
  timeSpentMs: number,
  reason: 'exit' | 'hesitation' | 'error'
) {
  trackFunnelEvent(FUNNEL_EVENTS.DROPOFF_DETECTED, {
    last_step: lastStep,
    time_spent_ms: timeSpentMs,
    dropoff_reason: reason
  });
}
