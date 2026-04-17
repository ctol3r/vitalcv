/**
 * UX event constants — single source of truth for event names.
 * Import these instead of string literals to prevent typos.
 *
 * Events mirrored into Pilot Ops must exist in PilotMetricEventType
 * (apps/web/lib/pilot-ops/client.ts). UX-only telemetry may remain local here.
 */

export const UX_EVENTS = {
  NPI_SUBMIT_ATTEMPT: 'npi_submit_attempt',
  NPI_INVALID: 'npi_invalid',
  SOURCE_CHECK_STARTED: 'source_check_started',
  READINESS_REVEALED: 'readiness_revealed',
  ACCORDION_EXPANDED: 'accordion_expanded',
  EVIDENCE_VIEWER_OPENED: 'evidence_viewer_opened',
  SHARE_CTA_CLICKED: 'share_cta_clicked',
  SHARE_INTENT: 'share_intent',
  EMPLOYER_ACTION_CLICKED: 'employer_action_clicked',
  INTERVIEW_BLOCKED_VIEW: 'interview_blocked_view',
  PAGE_LOAD_TIMING: 'page_load_timing',
  DEAD_END_REACHED: 'dead_end_reached',
  NAV_ITEM_CLICKED: 'nav_item_clicked',
  PASSPORT_VIEWED: 'passport_viewed',
  REVIEW_REQUESTED: 'review_requested',
  NPI_INPUT_FOCUS: 'npi_input_focus',
  TIME_TO_FIRST_VALUE: 'time_to_first_value',
  TIME_TO_DECISION_VIEW: 'time_to_decision_view',
  CONVERSION_TO_ACTION: 'conversion_to_action',
  USER_SCROLL_DEPTH: 'user_scroll_depth',
  DROP_OFF_POINT: 'drop_off_point',
} as const satisfies Record<string, import('@/lib/pilot-ops/client').PilotMetricEventType>;
