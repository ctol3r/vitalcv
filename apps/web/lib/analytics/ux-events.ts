/**
 * UX event constants — single source of truth for event names.
 * Import these instead of string literals to prevent typos.
 *
 * ALL events are listed in PilotMetricEventType (apps/web/lib/pilot-ops/client.ts).
 * Add new events there first, then add the constant here.
 */

export const UX_EVENTS = {
  NPI_SUBMITTED: 'npi_submit_attempt',
  NPI_SUBMIT_ATTEMPT: 'npi_submit_attempt',
  NPI_INVALID: 'npi_invalid',
  SOURCE_CHECK_STARTED: 'source_check_started',
  READINESS_REVEALED: 'readiness_revealed',
  ACCORDION_EXPANDED: 'accordion_expanded',
  EVIDENCE_VIEWER_OPENED: 'evidence_viewer_opened',
  SHARE_CTA_CLICKED: 'share_intent',
  SHARE_INTENT: 'share_intent',
  EMPLOYER_ACTION_CLICKED: 'employer_action_clicked',
  INTERVIEW_BLOCKED_VIEW: 'interview_blocked_view',
  PAGE_LOAD_TIMING: 'page_load_timing',
  DEAD_END_REACHED: 'dead_end_reached',
  NAV_ITEM_CLICKED: 'nav_item_clicked',
} as const satisfies Record<string, import('@/lib/pilot-ops/client').PilotMetricEventType>;
