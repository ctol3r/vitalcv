/**
 * Operator workspace fixtures.
 *
 * In-process fixtures only. No DB, no fetch, no env. The shape
 * reflects what a calm pilot-operator workspace shows:
 *
 *   - attention queue (what needs operator attention now)
 *   - continuity progression (lanes moving through their states)
 *   - review progress (institution-owned reviews in flight)
 *   - next steps (who owns the next action)
 *   - institutional ownership (what the institution still owns)
 *   - readiness progression (cohort-wide visibility)
 *
 * Five normalized visible states:
 *   Ready · Pending review · Attention needed · Interrupted ·
 *   Continuing · Complete
 *
 * Technical semantics (replay survivability, dedupe keys, run-ids,
 * etc.) are deliberately absent from this fixture. They live in
 * the operator's progressive-disclosure section, sourced from the
 * existing /ops snapshot when the operator opens it.
 */

export type OperatorVisibleState =
  | 'ready'
  | 'pending_review'
  | 'attention_needed'
  | 'interrupted'
  | 'continuing'
  | 'complete';

export const OPERATOR_VISIBLE_STATE_LABEL: Record<OperatorVisibleState, string> = {
  ready: 'Ready',
  pending_review: 'Pending review',
  attention_needed: 'Attention needed',
  interrupted: 'Interrupted',
  continuing: 'Continuing',
  complete: 'Complete',
};

export type NextStepOwner =
  | 'operator'
  | 'receiving_institution'
  | 'sending_institution'
  | 'vitalcv';

export const NEXT_STEP_OWNER_LABEL: Record<NextStepOwner, string> = {
  operator: 'Operator',
  receiving_institution: 'Receiving institution',
  sending_institution: 'Sending institution',
  vitalcv: 'VitalCV',
};

export interface OperatorAttentionItem {
  id: string;
  what: string;
  why: string;
  nextStepLabel: string;
  nextStepOwner: NextStepOwner;
}

export interface OperatorContinuityItem {
  id: string;
  laneLabel: string;
  state: OperatorVisibleState;
  operatorNote: string;
}

export interface OperatorReviewItem {
  id: string;
  clinicianDisplayName: string;
  reviewStage: 'queued' | 'in_review' | 'returned_to_operator' | 'institution_owned';
  reviewStageLabel: string;
  visibleState: OperatorVisibleState;
  reviewOwner: NextStepOwner;
}

export interface OperatorReadinessItem {
  id: string;
  cohortTag: string;
  totalCandidates: number;
  ready: number;
  pendingReview: number;
  interrupted: number;
}

export interface OperatorInstitutionalOwnershipItem {
  id: string;
  what: string;
  whyStaysInstitutionOwned: string;
}

export interface OperatorWorkspaceFixture {
  cohortLabel: string;
  pilotWindow: string;
  attentionQueue: readonly OperatorAttentionItem[];
  continuity: readonly OperatorContinuityItem[];
  reviews: readonly OperatorReviewItem[];
  readiness: readonly OperatorReadinessItem[];
  institutionalOwnership: readonly OperatorInstitutionalOwnershipItem[];
}

export const PILOT_OPERATOR_FIXTURE: OperatorWorkspaceFixture = {
  cohortLabel: 'Cedar Health · Q2-2026 pilot cohort',
  pilotWindow: '2026-04-19 → 2026-05-19',

  attentionQueue: [
    {
      id: 'attn-pecos-stale',
      what: 'PECOS enrollment lane returned with a stale-but-signed posture for one clinician.',
      why: 'Upstream registry was slow at the first read; the operator note travels with the lane.',
      nextStepLabel: 'Review the operator note on the lane and decide whether to re-fetch on operator credentials.',
      nextStepOwner: 'operator',
    },
    {
      id: 'attn-committee-pending',
      what: 'One clinician is waiting on Cedar credentialing committee disposition.',
      why: 'Committee meets on its fixed cadence; readiness does not change committee scheduling.',
      nextStepLabel: 'No operator action; the receiving institution dispositions on its own cadence.',
      nextStepOwner: 'receiving_institution',
    },
  ],

  continuity: [
    {
      id: 'cont-identity',
      laneLabel: 'Identity (NPPES)',
      state: 'complete',
      operatorNote: 'Identity resolved against the federal registry within the freshness budget.',
    },
    {
      id: 'cont-exclusions',
      laneLabel: 'Exclusions (OIG/LEIE)',
      state: 'complete',
      operatorNote: 'Affirmative-negative finding recorded; the receiving institution may review.',
    },
    {
      id: 'cont-pecos',
      laneLabel: 'Enrollment (PECOS)',
      state: 'continuing',
      operatorNote: 'Stale-but-signed posture preserved on the lane; reconciled at the next window.',
    },
    {
      id: 'cont-committee',
      laneLabel: 'Committee review',
      state: 'pending_review',
      operatorNote: 'Receiving committee meets on its own cadence; no operator step.',
    },
    {
      id: 'cont-state-board',
      laneLabel: 'State medical board PSV',
      state: 'pending_review',
      operatorNote: 'State-board verification remains institution-owned; out of pilot scope.',
    },
  ],

  reviews: [
    {
      id: 'rev-1346053246',
      clinicianDisplayName: 'Macie Miller, PA-C',
      reviewStage: 'in_review',
      reviewStageLabel: 'In receiving-institution review',
      visibleState: 'pending_review',
      reviewOwner: 'receiving_institution',
    },
    {
      id: 'rev-1356428912',
      clinicianDisplayName: 'Mira Chen, MD',
      reviewStage: 'queued',
      reviewStageLabel: 'Queued for receiving-institution review',
      visibleState: 'ready',
      reviewOwner: 'receiving_institution',
    },
    {
      id: 'rev-1234567893',
      clinicianDisplayName: 'Connor Kilch, DO',
      reviewStage: 'returned_to_operator',
      reviewStageLabel: 'Returned to operator for operator note follow-up',
      visibleState: 'attention_needed',
      reviewOwner: 'operator',
    },
  ],

  readiness: [
    {
      id: 'cohort-A',
      cohortTag: 'cohort-A',
      totalCandidates: 2,
      ready: 1,
      pendingReview: 1,
      interrupted: 0,
    },
    {
      id: 'cohort-B-rural',
      cohortTag: 'cohort-B (rural)',
      totalCandidates: 1,
      ready: 0,
      pendingReview: 0,
      interrupted: 1,
    },
  ],

  institutionalOwnership: [
    {
      id: 'own-psv',
      what: 'State medical board PSV (Cedar CVO channel).',
      whyStaysInstitutionOwned: 'Out of pilot scope; receiving institution continues on its existing credential.',
    },
    {
      id: 'own-committee',
      what: 'Credentialing committee scheduling and review.',
      whyStaysInstitutionOwned: 'Committee cadence is institution-owned; readiness does not change scheduling.',
    },
    {
      id: 'own-privileging',
      what: 'Privileging decisions.',
      whyStaysInstitutionOwned: 'Chief-of-staff signoff happens on the institution\'s own cadence.',
    },
    {
      id: 'own-final-acceptance',
      what: 'Final acceptance of any clinician for deployment.',
      whyStaysInstitutionOwned: 'Receiving institution accepts on its own credential.',
    },
    {
      id: 'own-freshness',
      what: 'Re-fetching upstream registries on the institution\'s own freshness budget.',
      whyStaysInstitutionOwned: 'Receiving CVO may re-fetch when its own freshness policy requires.',
    },
  ],
};

export const OPERATOR_FIXTURES: Record<string, OperatorWorkspaceFixture> = {
  cedar: PILOT_OPERATOR_FIXTURE,
};

export function getOperatorFixture(slug: string = 'cedar'): OperatorWorkspaceFixture | null {
  return OPERATOR_FIXTURES[slug] ?? null;
}
