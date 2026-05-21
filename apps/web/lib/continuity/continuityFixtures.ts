/**
 * Continuity-state fixtures for the path-completion wave.
 *
 * In-process fixtures only. No DB, no fetch, no env. Surfaces use
 * these as deterministic examples of:
 *   - a successful continuity handoff (/holder -> /verify)
 *   - an interrupted continuity (/verify -> stale-but-signed lane)
 *   - a review acknowledgment recorded locally
 *   - a verification-preparation state shown on /holder
 *   - a pilot submission completion confirmation
 *
 * Fixtures NEVER carry real identities. Synthetic clinician + NPI
 * (Luhn-valid) drawn from the Cedar Q2-2026 demo set so the
 * institutional voice is consistent across waves.
 */

export interface ContinuityHandoffFixture {
  fixtureId: string;
  fromLabel: string;
  toLabel: string;
  toHref: string;
  state: 'ready' | 'preparing' | 'interrupted';
  whatTravels: string;
  whatStaysBehind: string;
}

export interface ReviewAcknowledgementFixture {
  fixtureId: string;
  applicationId: string;
  posture: 'accept_as_head_start' | 'request_more_info' | 'reject';
  postureLabel: string;
  recordedAt: string;
  institutionOwnedDisposition: string;
}

export interface VerificationPreparationFixture {
  fixtureId: string;
  clinicianDisplayName: string;
  npi: string;
  whatTravels: readonly string[];
  whatStaysInstitutionOwned: readonly string[];
}

export interface PilotCompletionFixture {
  fixtureId: string;
  referenceId: string;
  recordedAt: string;
  whatHappensNext: readonly string[];
  whatRemainsInstitutionOwned: readonly string[];
}

// ── Handoff fixtures ──────────────────────────────────────────────────────

export const CONTINUITY_HANDOFFS: readonly ContinuityHandoffFixture[] = [
  {
    fixtureId: 'holder-to-verify-ready',
    fromLabel: '/holder · clinician readiness',
    toLabel: '/verify · verifier surface',
    toHref: '/verify',
    state: 'ready',
    whatTravels:
      'A portable replay envelope per federal-source lane, the operator note attached to each lane, and a reference identifier.',
    whatStaysBehind:
      'Institution records, committee minutes, state-board PSV, and privileging cadence remain on the institution\'s own systems.',
  },
  {
    fixtureId: 'holder-to-verify-preparing',
    fromLabel: '/holder · clinician readiness',
    toLabel: '/verify · verifier surface',
    toHref: '/verify',
    state: 'preparing',
    whatTravels:
      'A portable replay envelope is being assembled; lanes are not all source-confirmed yet.',
    whatStaysBehind:
      'Re-fetching upstream registries on the institution\'s own credential remains institution-owned.',
  },
  {
    fixtureId: 'holder-to-verify-interrupted',
    fromLabel: '/holder · clinician readiness',
    toLabel: '/verify · verifier surface',
    toHref: '/verify',
    state: 'interrupted',
    whatTravels:
      'One lane is in a stale-but-signed posture; the operator note travels but the lane is flagged for disposition.',
    whatStaysBehind:
      'Stale-but-signed disposition is institution-owned; the receiving institution dispositions on its own credential.',
  },
] as const;

// ── Review acknowledgment fixtures ────────────────────────────────────────

export const REVIEW_ACKNOWLEDGEMENTS: readonly ReviewAcknowledgementFixture[] = [
  {
    fixtureId: 'review-acknowledgement-head-start',
    applicationId: 'app_cedar_001',
    posture: 'accept_as_head_start',
    postureLabel: 'Acknowledge as head-start',
    recordedAt: '2026-05-19T16:11:02Z',
    institutionOwnedDisposition:
      'Cedar credentialing committee will disposition on its own cadence; this acknowledgment does not change committee scheduling.',
  },
  {
    fixtureId: 'review-acknowledgement-more-info',
    applicationId: 'app_cedar_002',
    posture: 'request_more_info',
    postureLabel: 'Acknowledge as request-more-info',
    recordedAt: '2026-05-19T16:12:18Z',
    institutionOwnedDisposition:
      'Receiving institution will request additional evidence through its existing channel. VitalCV does not contact the clinician on the institution\'s behalf.',
  },
] as const;

// ── Verification preparation fixture ──────────────────────────────────────

export const VERIFICATION_PREPARATION: VerificationPreparationFixture = {
  fixtureId: 'verification-preparation-cedar-cohort',
  clinicianDisplayName: 'Macie Miller, PA-C',
  npi: '1346053246',
  whatTravels: [
    'A portable replay envelope per lane (federal-source resolution).',
    'An operator note that travels with each lane.',
    'A reference identifier the receiving institution can verify.',
  ],
  whatStaysInstitutionOwned: [
    'State medical board PSV (Cedar CVO channel)',
    'Credentialing committee review',
    'Privileging decisions',
    'Final acceptance for deployment',
  ],
} as const;

// ── Pilot completion fixture ──────────────────────────────────────────────

export const PILOT_COMPLETION_FIXTURE: PilotCompletionFixture = {
  fixtureId: 'pilot-completion-default',
  referenceId: 'pilot_cedar_2026Q2_000',
  recordedAt: '2026-05-19T15:42:08Z',
  whatHappensNext: [
    'The VitalCV operator reviews the submission within two business days.',
    'If the submission is in scope, the operator schedules a 30-minute working session to walk through the pilot demonstration kit.',
    'Receiving institution retains its existing intake checklist; the pilot does not replace it.',
  ],
  whatRemainsInstitutionOwned: [
    'State medical board PSV',
    'Credentialing committee review',
    'Privileging decisions',
    'Final acceptance of any clinician for deployment',
    'Re-fetching upstream registries on the institution\'s own credential and freshness budget',
  ],
} as const;

// ── Lookups ───────────────────────────────────────────────────────────────

export function getContinuityHandoff(
  fixtureId: string,
): ContinuityHandoffFixture | null {
  return CONTINUITY_HANDOFFS.find((h) => h.fixtureId === fixtureId) ?? null;
}

export function listContinuityHandoffStates(): readonly ContinuityHandoffFixture['state'][] {
  return CONTINUITY_HANDOFFS.map((h) => h.state);
}
