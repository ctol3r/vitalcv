/**
 * Buyer-facing pilot copy contract.
 *
 * Every CTA on the employer/pilot shell must answer five concrete
 * questions before the click:
 *   1. What happens if I request a pilot?
 *   2. What will VitalCV measure?
 *   3. What do I (the buyer) need to provide?
 *   4. What does success look like?
 *   5. What remains outside current coverage?
 *
 * This module is the canonical source for those answers. Pilot surfaces
 * import from here rather than inlining copy. A test file locks the
 * rules:
 *   - No fake customer names or fabricated traction language.
 *   - Every answer is concrete (not "we'll be in touch").
 *   - Coverage gaps are named explicitly.
 *   - "Ready" / "fully verified" / "complete" never appear in partial-
 *     data framings.
 *
 * Builds on the proof-tier + recovery-path + application-snapshot
 * contracts established in previous waves. Does not invent new metrics
 * or rebrand existing doctrine.
 */

export interface BuyerPilotCTA {
  /** Short headline shown on the CTA card. */
  headline: string;
  /** One-line clarifier under the headline. */
  description: string;
  /** Primary button label. */
  primaryActionLabel: string;
  /** Where the primary button routes. */
  primaryActionHref: string;
  /** Answers the five buyer questions. */
  answers: {
    whatHappensOnRequest: string;
    whatWeMeasure: string;
    whatYouProvide: string;
    successCriteria: string;
    outsideCurrentCoverage: string;
  };
}

export const BUYER_PILOT_CTA: BuyerPilotCTA = {
  headline: 'Request a paid pilot',
  description:
    'A focused engagement using your NPIs, your review team, and a fixed measurement window. No demo data, no fabricated traction.',
  primaryActionLabel: 'Request pilot setup',
  primaryActionHref: '/pilot#request-form',
  answers: {
    whatHappensOnRequest:
      'We reply within two business days to confirm scope and a start date. We do not auto-provision — pilot activation requires a signed scope document naming the NPIs, lanes, and measurement window.',
    whatWeMeasure:
      'Startability timeline events (submit, first view, first action, advanced, start-ready, started), median time deltas, refresh / missing-info request counts, and proof-tier distribution across submitted applications. All metrics derive from recorded events only — no imputed rows.',
    whatYouProvide:
      'A list of real clinician NPIs, a named review operator, your employer organization ID, and access to your review decision workflow. State-board lanes that require institutional agreements (Nursys, FSMB) are your employer to activate.',
    successCriteria:
      'A measurable drop in time-from-submission to first review action, a documented proof-pack export covering every submitted application, and an honest limitation list naming every lane that remained partial. Success is not a score — it is a comparable before/after delta the buyer team signs off on.',
    outsideCurrentCoverage:
      'NPDB, DEA registration, ABMS board certification, CAQH, SAM.gov, and per-state board coverage outside configured lanes. These remain the employer credentialing office\u2019s scope. Medicare enrollment (PECOS) is quarterly-refresh, so the data can be up to 90 days old.',
  },
};

export interface BuyerPilotKpiSummaryCopy {
  sectionHeadline: string;
  sectionDescription: string;
  /** Tile labels paired with the source of truth each one reads from. */
  tileMeta: Record<
    | 'applicationsSubmitted'
    | 'reviewsOpened'
    | 'actionsTaken'
    | 'startReadyCount'
    | 'startedCount'
    | 'medianMinutesToFirstView'
    | 'medianDaysToStarted',
    { label: string; readsFrom: string }
  >;
  /** Boilerplate limitation line shown when the proof pack is empty. */
  emptyStateNote: string;
  /** Partial-data line that accompanies non-null limitation counts. */
  partialStateNote: string;
}

export const BUYER_PILOT_KPI_COPY: BuyerPilotKpiSummaryCopy = {
  sectionHeadline: 'What was measured',
  sectionDescription:
    'Every count and median is computed from recorded events in the pilot window. Metrics degrade to "\u2014" when endpoints are missing rather than imputing a value.',
  tileMeta: {
    applicationsSubmitted: {
      label: 'Applications submitted',
      readsFrom: 'ApplicationSnapshot.auditLog — submitted events',
    },
    reviewsOpened: {
      label: 'Reviews opened',
      readsFrom: 'firstViewedAt timestamps across submitted applications',
    },
    actionsTaken: {
      label: 'Actions taken',
      readsFrom: 'firstActionAt timestamps (request_refresh / request_missing_info / route_to_review / status_change)',
    },
    startReadyCount: {
      label: 'Start-ready',
      readsFrom: 'status_change → start_ready transitions',
    },
    startedCount: {
      label: 'Started',
      readsFrom: 'status_change → started transitions',
    },
    medianMinutesToFirstView: {
      label: 'Median submit \u2192 first view',
      readsFrom: 'Median across applications where both endpoints exist',
    },
    medianDaysToStarted: {
      label: 'Median submit \u2192 started',
      readsFrom: 'Median across applications where both endpoints exist',
    },
  },
  emptyStateNote:
    'No applications have moved through the pilot window yet. Metrics become available once submissions begin.',
  partialStateNote:
    'Some metrics are unavailable because the underlying events have not been recorded yet. This is not an error — it is honest-partial data. See the limitations list below.',
};

/**
 * Words and phrases that must NEVER appear in buyer-facing pilot copy.
 * The test suite uses this list to assert no fake / over-promising
 * language slipped into the shell.
 */
export const BANNED_BUYER_PHRASES: readonly string[] = [
  'fully verified',
  'complete credentialing',
  'all checks passed',
  '100% verified',
  'trusted by',
  'used by leading',
  'fortune 500',
  'industry leader',
  'market-leading',
  'revolutionize',
];

/**
 * Canonical limitation lines rendered on any buyer-facing pilot surface.
 * Mirrors the limitation lines the proof-pack builder emits at runtime
 * so static marketing and dynamic pack data stay in lockstep.
 */
export const BUYER_PILOT_LIMITATIONS: readonly string[] = [
  'VitalCV does not replace credentialing committees. The proof pack is a pre-screen, not a final privileging decision.',
  'State medical board lanes require per-state agreements. Lanes outside pilot scope render as access-required, not verified.',
  'CMS PECOS refreshes quarterly. Enrollment data can be up to 90 days stale; the pack marks these lanes explicitly.',
  'NPDB, DEA, ABMS, CAQH, and SAM.gov are not integrated. They remain the employer credentialing office\u2019s scope.',
  'Medians are computed only from applications with both endpoints recorded. When a median reads "\u2014", the underlying event set did not support the calculation.',
];

/**
 * Pilot conversion-safe verbs — the CTA must use one of these.
 * Any other verb (e.g., "Get started", "Try it now") triggers the test
 * suite as too vague for a paid-pilot commercial motion.
 */
export const ALLOWED_CTA_VERBS: readonly string[] = [
  'Request pilot setup',
  'Request a paid pilot',
  'Request pilot scope call',
  'Schedule pilot kickoff',
];

export function isAllowedCtaVerb(label: string): boolean {
  return ALLOWED_CTA_VERBS.includes(label);
}

/**
 * Whether a given string contains any banned buyer-facing phrase.
 * Case-insensitive match; used by the test suite on rendered copy.
 */
export function containsBannedBuyerPhrase(text: string): string | null {
  const normalized = text.toLowerCase();
  for (const phrase of BANNED_BUYER_PHRASES) {
    if (normalized.includes(phrase)) return phrase;
  }
  return null;
}
