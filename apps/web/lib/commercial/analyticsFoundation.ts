/**
 * FOUNDATION-SWEEP-6 Lane B — analytics foundation.
 *
 * Truth invariants:
 *   1. This is a privacy-safe event VOCABULARY, not a live analytics
 *      pipeline. Typed `dispatchedToThirdParty: false` and
 *      `productionPipelineLive: false` invariants enforce that no
 *      event leaves the client today.
 *   2. NO PHI capture. NO raw credential payload capture. The event
 *      shape carries only `kind`, `privacyLevel`, and a small
 *      `nonSensitiveContext` map of stringly-typed safe values.
 *   3. Privacy levels: `safe_session_only`, `safe_aggregate`,
 *      `requires_consent` — every event in the catalog is one of
 *      the two `safe_*` levels.
 *   4. No third-party vendor (PostHog / Segment / Mixpanel / GA4) is
 *      selected by this module. Vendor selection is a separate human
 *      decision and is documented as a requirement, not asserted as
 *      done.
 */

export type AnalyticsEventKind =
  | 'npi_lookup_started'
  | 'profile_section_viewed'
  | 'import_entry_clicked'
  | 'proof_pack_previewed'
  | 'signup_step_viewed'
  | 'verifier_cta_clicked';

export type AnalyticsPrivacyLevel =
  | 'safe_session_only'
  | 'safe_aggregate'
  | 'requires_consent';

export interface AnalyticsFoundationEvent {
  kind: AnalyticsEventKind;
  label: string;
  description: string;
  privacyLevel: AnalyticsPrivacyLevel;
  /**
   * Whitelist of safe context keys this event may carry. Free-text
   * values, NPI digits, names, emails, and credential payloads are
   * EXCLUDED by construction.
   */
  allowedContextKeys: string[];
}

export interface AnalyticsFoundationPlan {
  /** Is any analytics event dispatched to a third party today? Always false. */
  dispatchedToThirdParty: false;
  /** Is the production analytics pipeline live? Always false. */
  productionPipelineLive: false;
  /** Does any event collect PHI? Always false. */
  collectsPhi: false;
  /** Does any event collect raw credential payloads? Always false. */
  collectsCredentialPayload: false;
  events: AnalyticsFoundationEvent[];
  /** UI disclaimers rendered verbatim on the route. */
  disclaimers: string[];
}

const NO_PHI_DISCLAIMER =
  'Analytics events are a privacy-safe foundation vocabulary. No PHI or credential payloads are collected here.';
const NO_THIRD_PARTY_DISCLAIMER =
  'No third-party analytics vendor is wired. Events are not dispatched off the device today.';
const NO_RAW_NPI_DISCLAIMER =
  'Event context values exclude NPI digits, names, emails, and credential payloads by construction.';

const EVENT_DEFS: AnalyticsFoundationEvent[] = [
  {
    kind: 'npi_lookup_started',
    label: 'NPI lookup started',
    description:
      'Records that an NPI lookup attempt began. Does NOT include the NPI itself or any returned identity payload.',
    privacyLevel: 'safe_session_only',
    allowedContextKeys: ['route', 'sessionStartedAt'],
  },
  {
    kind: 'profile_section_viewed',
    label: 'Profile section viewed',
    description:
      'Records which profile section the holder is currently viewing. Section keys are a small fixed enum (e.g. "identity", "residency"); no field values are captured.',
    privacyLevel: 'safe_aggregate',
    allowedContextKeys: ['sectionKey', 'route'],
  },
  {
    kind: 'import_entry_clicked',
    label: 'Import entry clicked',
    description:
      'Records that an import card was activated. Captures the import kind only; no source data leaves the device.',
    privacyLevel: 'safe_aggregate',
    allowedContextKeys: ['importKind', 'route'],
  },
  {
    kind: 'proof_pack_previewed',
    label: 'Proof pack previewed',
    description:
      'Records that the proof-pack preview was shown. Does NOT include the bundle contents or any clinician identifiers.',
    privacyLevel: 'safe_aggregate',
    allowedContextKeys: ['route'],
  },
  {
    kind: 'signup_step_viewed',
    label: 'Signup step viewed',
    description:
      'Records which signup step is currently visible. Captures the step key only; no entered values are recorded.',
    privacyLevel: 'safe_aggregate',
    allowedContextKeys: ['stepKey', 'route'],
  },
  {
    kind: 'verifier_cta_clicked',
    label: 'Verifier CTA clicked',
    description:
      'Records that a verifier-facing CTA was activated. Captures the CTA key only.',
    privacyLevel: 'safe_aggregate',
    allowedContextKeys: ['ctaKey', 'route'],
  },
];

export function buildAnalyticsFoundationPlan(): AnalyticsFoundationPlan {
  return {
    dispatchedToThirdParty: false,
    productionPipelineLive: false,
    collectsPhi: false,
    collectsCredentialPayload: false,
    events: EVENT_DEFS.map((e) => ({ ...e, allowedContextKeys: [...e.allowedContextKeys] })),
    disclaimers: [NO_PHI_DISCLAIMER, NO_THIRD_PARTY_DISCLAIMER, NO_RAW_NPI_DISCLAIMER],
  };
}

export function explainAnalyticsPrivacyLevel(level: AnalyticsPrivacyLevel): string {
  switch (level) {
    case 'safe_session_only':
      return 'Safe within the current session only. Not aggregated, not exported.';
    case 'safe_aggregate':
      return 'Safe to aggregate across sessions. Carries no per-clinician identifier.';
    case 'requires_consent':
      return 'Requires explicit consent before any capture. No event in this foundation uses this level.';
  }
}
