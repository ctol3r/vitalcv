/**
 * funnelCoverage.ts — which declared funnel events are actually measured.
 *
 * Split out of app/api/internal/funnel-metrics/route.ts so the lists can be
 * asserted directly. A route file cannot export arbitrary constants without
 * upsetting Next's route-export checking, so while these lived there the only
 * available test was a source grep of the route.
 *
 * The failure this exists to prevent is specific and has happened twice:
 * an event is declared in FUNNEL_EVENTS, nothing ever emits it, and the metrics
 * endpoint reports a permanent 0 that reads exactly like a measured zero.
 * `signup_completed` carried the note "Never had a producer" for months, and
 * `npi_bound` — the most important conversion in the product — was not declared
 * at all, so the funnel simply ended before its own conversion.
 *
 * Two rules, both enforced by __tests__/funnel-coverage.test.ts:
 *   1. every declared event is either LIVE or explicitly RETIRED — no event may
 *      be silently unaccounted for;
 *   2. every LIVE event has a producer in the app source.
 */

/**
 * Counted by the metrics endpoint.
 *
 * The search-arrival lane (record_viewed → claim_clicked → npi_bound) is the
 * only path that starts with a clinician who never came to VitalCV; it shares
 * npi_bound as its terminal step with the homepage lane.
 */
export const LIVE_FUNNEL_EVENTS = [
  'homepage_viewed',
  'npi_input_started',
  'npi_submitted',
  'results_displayed',
  'dropoff_detected',
  'record_viewed',
  'claim_clicked',
  'npi_bound',
] as const;

/**
 * Declared but unproduced, each with the reason. Labelled by the endpoint
 * rather than counted, because this endpoint reports today only and a
 * producer-less event would render a permanent 0 as if it were a measurement.
 * Pre-retirement rows stay queryable in PostHog directly.
 */
export const RETIRED_FUNNEL_EVENTS = {
  npi_input_focused:
    'Producer (hero LiveTrustConsole) deleted 2026-08-07 with the /passport retirement (#1099); npi_input_started marks the equivalent moment.',
  signup_prompt_shown: 'Producer CreateAccountModal is no longer mounted anywhere.',
  signup_prompt_dismissed: 'Producer CreateAccountModal is no longer mounted anywhere.',
  signup_clicked: 'Producer CreateAccountModal is no longer mounted anywhere.',
  signup_completed:
    'Never had a producer, and deliberately still does not: Clerk drives sign-up redirects from its own dashboard, so no in-app moment distinguishes a completed sign-up from a sign-in, and anything fired here would be an inference dressed as a measurement. npi_bound is the real account-level conversion and is counted.',
  packet_downloaded:
    'Server producer exists on /api/passport/analytics/[npi]/download but nothing in the product calls that route since /passport retired.',

  // The career-loop and share lanes. Real producers exist for these in
  // components/apply and lib/career-loop, but the metrics endpoint reports the
  // acquisition funnel only and does not step through them.
  decision_viewed: 'Career-loop era; not part of the acquisition funnel this endpoint reports.',
  action_taken: 'Career-loop era; not part of the acquisition funnel this endpoint reports.',
  time_to_start_clicked: 'Retired with the /passport hero.',
  employer_entry_clicked: 'Employer side; reported separately, not a step in the clinician funnel.',
  npi_resolved: 'Career-loop lane on `/`; not a step in the acquisition funnel.',
  npi_resolution_failed: 'Career-loop lane on `/`; not a step in the acquisition funnel.',
  match_feed_viewed: 'Career-loop lane; downstream of the acquisition funnel.',
  match_defaulted: 'Career-loop lane; downstream of the acquisition funnel.',
  opportunity_selected: 'Career-loop lane; downstream of the acquisition funnel.',
  apply_opened: 'Apply lane; downstream of the acquisition funnel.',
  authentication_started: 'Apply lane; downstream of the acquisition funnel.',
  ownership_verification_started: 'Apply lane; downstream of the acquisition funnel.',
  share_previewed: 'Share lane; downstream of the acquisition funnel.',
  share_completed: 'Share lane; downstream of the acquisition funnel.',
  share_revoked: 'Share lane; downstream of the acquisition funnel.',
} as const;
