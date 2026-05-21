/**
 * Demonstration fixtures for the institutional pilot story.
 *
 * Lives in-process: no DB, no fetch, no env. The fixtures translate
 * the infrastructure stack (replay receipts, audit lineage, discovery
 * surfaces) into operationally meaningful artifacts an institutional
 * reader can read in plain English.
 *
 * What we deliberately do NOT do here:
 *   - claim automatic acceptance of credentials
 *   - claim instant verification
 *   - claim AI-powered anything
 *   - claim regulatory substitution
 *   - claim federation
 */

export interface ClinicianExample {
  npi: string;
  displayName: string;
  credential: string;
  specialty: string;
  state: string;
  cohortTag: string;
}

export interface EvidenceContinuityExample {
  laneId: string;
  source: string;
  status: 'source_confirmed' | 'evidence_pending' | 'continuity_restored' | 'continuity_interrupted';
  observedAt: string;
  operatorNote: string;
}

export interface CrossCheckExample {
  laneId: string;
  source: string;
  institutionAction: 'pending_review' | 'in_review' | 'institution_confirmed' | 'not_eligible';
  humanReviewState: 'not_required' | 'pending' | 'completed';
  note: string;
}

export interface DeploymentReadinessExample {
  metric: string;
  before: string;
  after: string;
  institutionalFraming: string;
}

export interface InterruptionExample {
  laneId: string;
  cause: string;
  resolutionPath: string;
  institutionOwnedStep: string;
}

export interface DemoFixture {
  cohortLabel: string;
  pilotWindow: string;
  clinicians: readonly ClinicianExample[];
  evidenceContinuity: readonly EvidenceContinuityExample[];
  crossCheckLanes: readonly CrossCheckExample[];
  deploymentReadiness: readonly DeploymentReadinessExample[];
  interruptions: readonly InterruptionExample[];
}

export const CEDAR_PILOT_DEMO: DemoFixture = {
  cohortLabel: 'Cedar Health · Q2-2026 pilot cohort',
  pilotWindow: '2026-04-19 → 2026-05-19',
  clinicians: [
    {
      npi: '1346053246',
      displayName: 'Macie Miller, PA-C',
      credential: 'PA-C',
      specialty: 'Internal Medicine',
      state: 'CA',
      cohortTag: 'cohort-A',
    },
    {
      npi: '1356428912',
      displayName: 'Mira Chen, MD',
      credential: 'MD',
      specialty: 'Internal Medicine',
      state: 'CA',
      cohortTag: 'cohort-A',
    },
    {
      npi: '1234567893',
      displayName: 'Connor Kilch, DO',
      credential: 'DO',
      specialty: 'Orthopedic Surgery',
      state: 'SD',
      cohortTag: 'cohort-B (rural)',
    },
  ],
  evidenceContinuity: [
    {
      laneId: 'identity',
      source: 'NPPES (CMS provider registry)',
      status: 'source_confirmed',
      observedAt: '2026-05-19T13:02:14Z',
      operatorNote:
        'Identity resolved against the federal registry within the freshness budget. No operator step required.',
    },
    {
      laneId: 'exclusion-screen',
      source: 'OIG / LEIE exclusions list',
      status: 'source_confirmed',
      observedAt: '2026-05-19T13:05:01Z',
      operatorNote:
        'Federal exclusions list returned no records. Affirmative-negative finding recorded with the lane.',
    },
    {
      laneId: 'pecos-enrollment',
      source: 'CMS PECOS',
      status: 'continuity_restored',
      observedAt: '2026-05-19T13:22:09Z',
      operatorNote:
        'Upstream registry was slow at first read; refreshed and reconciled at the next window. Stale-but-signed posture maintained throughout.',
    },
    {
      laneId: 'committee-review',
      source: 'Cedar credentialing committee',
      status: 'evidence_pending',
      observedAt: '2026-05-19T14:00:00Z',
      operatorNote:
        'Committee review remains institution-owned. VitalCV recorded the committee event and is waiting for the receiving institution to disposition.',
    },
  ],
  crossCheckLanes: [
    {
      laneId: 'identity',
      source: 'NPPES',
      institutionAction: 'pending_review',
      humanReviewState: 'not_required',
      note: 'Receiving institution may confirm against their own NPPES read on intake day.',
    },
    {
      laneId: 'exclusion-screen',
      source: 'OIG / LEIE',
      institutionAction: 'in_review',
      humanReviewState: 'pending',
      note: 'Receiving institution is reviewing the affirmative-negative finding.',
    },
    {
      laneId: 'pecos-enrollment',
      source: 'CMS PECOS',
      institutionAction: 'in_review',
      humanReviewState: 'pending',
      note: 'PECOS lane carried a stale-but-signed flag at the freshness boundary; reviewer is checking the operator note before confirming.',
    },
    {
      laneId: 'state-license',
      source: 'State medical board · Cedar CVO channel',
      institutionAction: 'not_eligible',
      humanReviewState: 'not_required',
      note: 'State-board verification remains institution-owned (out of pilot scope). Cedar credentialing continues on its existing credential.',
    },
  ],
  deploymentReadiness: [
    {
      metric: 'Time to first complete federal-source resolution',
      before: '4-6 business days (Cedar CVO baseline)',
      after: 'under 1 hour (pilot target; demonstrated for this cohort)',
      institutionalFraming:
        'Federal-source resolution accelerates; state-board and committee review stay on the institution\'s own cadence.',
    },
    {
      metric: 'Operator minutes during the pilot window',
      before: '~30 minutes per clinician (Cedar CVO baseline)',
      after: 'under 90 minutes total across the cohort (pilot target)',
      institutionalFraming:
        'Receiving operator can spend their time on review and disposition, not duplicate primary-source queries.',
    },
    {
      metric: 'Replay envelope per clinician',
      before: 'phone-tag confirmation between operators',
      after: 'one signed replay envelope per clinician, portable to the receiving institution',
      institutionalFraming:
        'Envelopes capture what was checked, when, and by whom. They do not replace institutional sign-off.',
    },
  ],
  interruptions: [
    {
      laneId: 'pecos-enrollment',
      cause: 'Upstream PECOS query slow; lane returned with stale-flag.',
      resolutionPath:
        'Operator surfaced the stale-but-signed posture; upstream registry recovered at the next refresh window.',
      institutionOwnedStep:
        'Receiving institution reviews the operator note and decides whether to re-fetch on its own credentials.',
    },
    {
      laneId: 'committee-review',
      cause: 'Committee review pending on Cedar side.',
      resolutionPath:
        'VitalCV records the pending event but does not surface a credential decision.',
      institutionOwnedStep:
        'Cedar committee dispositions on their own cadence; pilot does not affect committee process.',
    },
  ],
};

export const DEMO_FIXTURES: Record<string, DemoFixture> = {
  cedar: CEDAR_PILOT_DEMO,
};

export function getDemoFixture(slug: string = 'cedar'): DemoFixture | null {
  return DEMO_FIXTURES[slug] ?? null;
}

export function listDemoFixtureSlugs(): readonly string[] {
  return Object.keys(DEMO_FIXTURES);
}
