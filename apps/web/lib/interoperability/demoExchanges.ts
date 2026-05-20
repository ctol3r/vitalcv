/**
 * Demo fixtures for the interoperability rehearsal route.
 *
 * Lives in-process: no DB, no fetch, no env. Adding a new rehearsal
 * cohort is a single dictionary entry. Production behavior would
 * replace `getDemoExchange()` with a Prisma query reading from a
 * proper `VerificationExchange` table; the response shape is stable.
 */

import type { ExchangeReadinessState } from './exchangeReadiness';
import type { ReplayBundleEnvelope } from './replayBundleEnvelope';

export interface ExchangeTimelineEntry {
  /** ISO 8601 timestamp. */
  occurredAt: string;
  /** Canonical event kind. */
  kind:
    | 'evidence_generated'
    | 'replay_exported'
    | 'review_started'
    | 'cross_check_initiated'
    | 'continuity_interruption'
    | 'continuity_restored'
    | 'institution_confirmed'
    | 'deployment_ready'
    | 'operator_note';
  actor: string;
  summary: string;
}

export interface CrossCheckLaneRow {
  laneId: string;
  source: string;
  sourceRef: string;
  /** Replay receipt id the lane is anchored against. */
  replayRef: string;
  institutionStatus:
    | 'pending'
    | 'in_review'
    | 'confirmed'
    | 'not_eligible';
  continuityStatus: 'fresh' | 'degraded' | 'interrupted';
  humanReviewState: 'not_required' | 'pending' | 'completed';
  gapNote: string | null;
}

export interface EvidenceReuseRow {
  duplicateActivityAvoided: string;
  basisReference: string;
  institutionalNote: string;
}

export interface VerificationExchangeDemo {
  exchangeId: string;
  envelope: ReplayBundleEnvelope;
  readiness: ExchangeReadinessState;
  timeline: readonly ExchangeTimelineEntry[];
  crossCheckLanes: readonly CrossCheckLaneRow[];
  evidenceReuse: readonly EvidenceReuseRow[];
}

const CEDAR_DEMO: VerificationExchangeDemo = {
  exchangeId: 'exch_cedar_q2_26_01',
  envelope: {
    envelopeId: 'env_replay_7a2cb8d3_cedar',
    originatingInstitution: {
      id: 'vitalcv-pilot-q2-26',
      displayName: 'VitalCV (originating CVO)',
      role: 'cvo',
      discoveryUrl: 'https://vitalcv.com/.well-known/did.json',
    },
    receivingInstitution: {
      id: 'cedar-health',
      displayName: 'Cedar Health Credentialing',
      role: 'verifier',
    },
    replayId: 'run_7a2cb8d3',
    evidenceReferences: [
      {
        kind: 'receipt',
        id: 'rcpt_7a2cb8d3_9d11_3e4a',
        label: 'Credentialing bundle · 4 claims',
      },
      {
        kind: 'lineage',
        id: 'nppes_identity:1346053246',
        label: 'NPPES identity lineage',
      },
      {
        kind: 'lineage',
        id: 'oig_exclusions:1346053246',
        label: 'OIG/LEIE exclusion screen',
      },
      {
        kind: 'audit',
        id: 'evt_committee_review_2026_05_18',
        label: 'Committee review event',
        continuityStatus: 'pending_human_review',
      },
      {
        kind: 'claim',
        id: 'claim_pecos_active',
        label: 'PECOS enrollment · active',
        continuityStatus: 'stale',
      },
    ],
    continuityStatus: 'degraded',
    checkedAt: '2026-05-19T14:31:58Z',
    scope: {
      laneIds: ['nppes_identity', 'oig_exclusions', 'pecos_enrollment'],
      subjectNpi: '1346053246',
      window: {
        startIso: '2026-04-19T00:00:00Z',
        endIso: '2026-05-19T14:31:58Z',
      },
    },
    operatorNotes:
      'PECOS lane returned stale-but-signed at the freshness boundary. Source-confirmed; receiving institution should review the operator-attached note before initiating cross-check.',
    crossCheckEligibility: 'eligible',
  },
  readiness: 'cross_check_available',
  timeline: [
    {
      occurredAt: '2026-05-19T13:02:14Z',
      kind: 'evidence_generated',
      actor: 'VitalCV federal resolver',
      summary: 'Source-confirmed federal-registry resolution completed.',
    },
    {
      occurredAt: '2026-05-19T13:05:01Z',
      kind: 'replay_exported',
      actor: 'VitalCV ops',
      summary:
        'Replay bundle exported for Cedar Health review. Bundle anchored at run head 7a2c...b8d3.',
    },
    {
      occurredAt: '2026-05-19T13:18:42Z',
      kind: 'continuity_interruption',
      actor: 'Upstream: CMS PECOS',
      summary:
        'PECOS lane returned with stale freshness flag. Lane recorded as σ defer; receipt continues with stale-but-signed posture.',
    },
    {
      occurredAt: '2026-05-19T13:22:09Z',
      kind: 'continuity_restored',
      actor: 'Upstream: CMS PECOS',
      summary:
        'Upstream recovery anchored at next refresh window. Run replays cleanly against TSA anchor.',
    },
    {
      occurredAt: '2026-05-19T14:31:58Z',
      kind: 'operator_note',
      actor: 'VitalCV CVO desk',
      summary:
        'Operator-attached note: receiving institution should review PECOS stale-but-signed posture before independent cross-check.',
    },
  ],
  crossCheckLanes: [
    {
      laneId: 'nppes_identity',
      source: 'CMS NPPES Registry',
      sourceRef: 'cms.gov/nppes',
      replayRef: 'rcpt_7a2cb8d3_nppes',
      institutionStatus: 'pending',
      continuityStatus: 'fresh',
      humanReviewState: 'not_required',
      gapNote: null,
    },
    {
      laneId: 'oig_exclusions',
      source: 'OIG LEIE',
      sourceRef: 'oig.hhs.gov',
      replayRef: 'rcpt_7a2cb8d3_oig',
      institutionStatus: 'in_review',
      continuityStatus: 'fresh',
      humanReviewState: 'pending',
      gapNote: null,
    },
    {
      laneId: 'pecos_enrollment',
      source: 'CMS PECOS',
      sourceRef: 'cms.gov/pecos',
      replayRef: 'rcpt_7a2cb8d3_pecos',
      institutionStatus: 'in_review',
      continuityStatus: 'degraded',
      humanReviewState: 'pending',
      gapNote: 'Stale-but-signed at freshness boundary; receiving institution may re-fetch on its own credential.',
    },
    {
      laneId: 'state_medical_license',
      source: 'State medical board (Cedar CVO channel)',
      sourceRef: 'institution-owned',
      replayRef: '',
      institutionStatus: 'not_eligible',
      continuityStatus: 'fresh',
      humanReviewState: 'not_required',
      gapNote: 'Out of pilot scope -- institution-owned PSV continues on Cedar credentials.',
    },
  ],
  evidenceReuse: [
    {
      duplicateActivityAvoided: 'Repeat NPPES enumeration query',
      basisReference: 'rcpt_7a2cb8d3_nppes (4 lanes anchored)',
      institutionalNote:
        'Source-confirmed within the freshness budget. Receiving institution may rely on this for primary identity binding pending its own confirmation step.',
    },
    {
      duplicateActivityAvoided: 'Repeat OIG/LEIE sanction screen for the pilot window',
      basisReference: 'rcpt_7a2cb8d3_oig (0 records returned)',
      institutionalNote:
        'Affirmative-negative recorded; not a regulatory substitute. Receiving institution retains its own cadence for re-screening.',
    },
    {
      duplicateActivityAvoided: 'Operator-to-operator phone-tag for replay confirmation',
      basisReference: 'Replay envelope env_replay_7a2cb8d3_cedar',
      institutionalNote:
        'Envelope replaces ad-hoc phone confirmations with a portable, replayable record. No automation claim is made.',
    },
  ],
};

const DEMO_EXCHANGES: Record<string, VerificationExchangeDemo> = {
  [CEDAR_DEMO.exchangeId]: CEDAR_DEMO,
};

export function getDemoExchange(
  exchangeId: string,
): VerificationExchangeDemo | null {
  return DEMO_EXCHANGES[exchangeId] ?? null;
}

export function listDemoExchangeIds(): readonly string[] {
  return Object.keys(DEMO_EXCHANGES);
}
