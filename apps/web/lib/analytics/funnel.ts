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
  // SHD-2.2: the quiet employer entry beside the clinician NPI action, so the
  // two sides of the hero conversion are distinguishable in the funnel.
  EMPLOYER_ENTRY_CLICKED: 'employer_entry_clicked',

  /*
   * Wave 1075 — the one real loop on `/`. Stage metadata only: no NPI, no
   * clinician name, no credential detail, no blocker text. See the payload
   * allowlist pinned in __tests__/funnel-instrumentation.test.ts.
   */
  NPI_INPUT_STARTED: 'npi_input_started',
  NPI_RESOLVED: 'npi_resolved',
  NPI_RESOLUTION_FAILED: 'npi_resolution_failed',
  MATCH_FEED_VIEWED: 'match_feed_viewed',
  /** The system picking the first match — NOT a user choice. Counted apart
   *  so selection rate never inherits the default. */
  MATCH_DEFAULTED: 'match_defaulted',
  OPPORTUNITY_SELECTED: 'opportunity_selected',
  APPLY_OPENED: 'apply_opened',
  AUTHENTICATION_STARTED: 'authentication_started',
  /** Signed in, NPI claimed, ownership unproven — the clinician went to
   *  verification rather than being told to sign in again. */
  OWNERSHIP_VERIFICATION_STARTED: 'ownership_verification_started',
  SHARE_PREVIEWED: 'share_previewed',
  /** Fires ONLY after the backend share succeeded. */
  SHARE_COMPLETED: 'share_completed',
  SHARE_REVOKED: 'share_revoked',

  /*
   * The search-arrival lane — /directory/[npi].
   *
   * Every event above starts from someone who already came to VitalCV. These
   * start from someone who did not: a clinician who searched for themselves
   * and found their own registry record. Without them, the acquisition path
   * the directory sitemap opens is unmeasurable, and "does a stranger who
   * finds their own record claim it?" has no answer.
   *
   * Same payload discipline as the loop events: stage metadata only, and no
   * NPI in any form. A SHA-256 of a ten-digit number is brute-forceable in
   * seconds, so hashing it would not make it anonymous.
   */
  RECORD_VIEWED: 'record_viewed',
  CLAIM_CLICKED: 'claim_clicked',
  /**
   * The bind succeeded — POST /api/profile/npi/bootstrap returned 201.
   *
   * The most important conversion in the product, and it emitted nothing: the
   * backend wrote its audit rows while the funnel saw a clinician reach the
   * form and then vanish.
   */
  NPI_BOUND: 'npi_bound',
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
