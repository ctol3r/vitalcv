/**
 * /demo seed data — single source of truth for the demo flows.
 *
 * No backend dependency. No DB query. All values are deterministic
 * fixtures so the demo renders identically on every load, on any
 * environment, with or without env vars.
 *
 * IMPORTANT — truth contract:
 *   - The labels and tiers reflect the SAME vocabulary the live product
 *     uses (T1-T4 authority ladder, "Source-backed", "Access required",
 *     "Foundation preview"). Foundation-honest framing is preserved.
 *   - The full list of phrases this file MUST NOT emit lives in
 *     CLAUDE.md (the project truth contract). Demo content honors
 *     that contract by construction; no compliance claims, no
 *     credentialing-completion claims, no risk-transfer claims.
 *   - Demo signals are clearly marked "demo" inside the route page
 *     headers; this file just supplies the data.
 */

export type SourceTier = 'T1' | 'T2' | 'T3' | 'T4';
export type SourceStatus =
  | 'source_backed'
  | 'access_required'
  | 'pending'
  | 'not_yet';

export interface DemoSource {
  id: string;
  name: string;
  shortName: string;
  status: SourceStatus;
  tier: SourceTier;
  detail: string;
  checkedAt: string; // ISO
}

export interface DemoClinician {
  npi: string;
  displayName: string;
  specialty: string;
  state: string;
  lastCheckedAt: string;
  readinessLevel: 'High' | 'Moderate' | 'Low' | 'Unknown';
  readinessScore: number; // 0-100
  sources: ReadonlyArray<DemoSource>;
  credentials: ReadonlyArray<{
    name: string;
    issuer: string;
    issuedOn: string;
    tier: SourceTier;
  }>;
}

const NOW = '2026-05-15T15:00:00.000Z';

export const DEMO_CLINICIAN: DemoClinician = {
  npi: '1346053246',
  displayName: 'Macie Miller, PA-C',
  specialty: 'Physician Assistant',
  state: 'CA',
  lastCheckedAt: NOW,
  readinessLevel: 'High',
  readinessScore: 82,
  sources: [
    {
      id: 'nppes',
      name: 'NPPES Registry',
      shortName: 'NPPES',
      status: 'source_backed',
      tier: 'T3',
      detail: 'Active NPI; taxonomy + practice address resolved.',
      checkedAt: NOW,
    },
    {
      id: 'oig',
      name: 'OIG LEIE',
      shortName: 'OIG',
      status: 'source_backed',
      tier: 'T3',
      detail: 'No federal exclusion match.',
      checkedAt: NOW,
    },
    {
      id: 'pecos',
      name: 'CMS PECOS',
      shortName: 'PECOS',
      status: 'source_backed',
      tier: 'T3',
      detail: 'Medicare enrollment active.',
      checkedAt: NOW,
    },
    {
      id: 'state_board',
      name: 'State Board',
      shortName: 'State',
      status: 'access_required',
      tier: 'T3',
      detail:
        'State-board portal requires institutional access; not a clinician defect.',
      checkedAt: NOW,
    },
  ],
  credentials: [
    {
      name: 'PA-C — Physician Assistant Certified',
      issuer: 'NCCPA',
      issuedOn: '2021-08-12',
      tier: 'T4',
    },
    {
      name: 'BLS — Basic Life Support',
      issuer: 'American Heart Association',
      issuedOn: '2024-09-03',
      tier: 'T4',
    },
    {
      name: 'CA RN License',
      issuer: 'CA Board of Registered Nursing',
      issuedOn: '2020-04-22',
      tier: 'T3',
    },
  ],
};

export interface DemoEmployerApplication {
  applicationId: string;
  candidate: {
    npi: string;
    displayName: string;
    specialty: string;
  };
  appliedAt: string;
  role: string;
  organization: string;
  state: 'review_recommended' | 'move_forward' | 'waiting_on_sources';
  highlights: ReadonlyArray<string>;
  cautions: ReadonlyArray<string>;
}

export const DEMO_EMPLOYER_APPLICATIONS: ReadonlyArray<DemoEmployerApplication> = [
  {
    applicationId: 'app-1346053246-001',
    candidate: {
      npi: '1346053246',
      displayName: 'Macie Miller, PA-C',
      specialty: 'Physician Assistant',
    },
    appliedAt: '2026-05-13T19:00:00.000Z',
    role: 'PA-C — Urgent Care',
    organization: 'Bay Area Health Network',
    state: 'move_forward',
    highlights: [
      'NPPES, OIG LEIE, and PECOS all source-backed.',
      'NCCPA PA-C certification active; expires 2027.',
      'No federal exclusion on file.',
    ],
    cautions: [
      'State-board portal requires institutional access — not a clinician defect.',
    ],
  },
  {
    applicationId: 'app-1003000126-002',
    candidate: {
      npi: '1003000126',
      displayName: 'Ardalan Enkeshafi, M.D.',
      specialty: 'Internal Medicine',
    },
    appliedAt: '2026-05-14T11:30:00.000Z',
    role: 'Hospitalist — IM',
    organization: 'Bay Area Health Network',
    state: 'review_recommended',
    highlights: [
      'NPPES identity resolved.',
      'PECOS enrollment active.',
    ],
    cautions: [
      'Active OIG check returned a possible-match alert — manual reviewer attention recommended before move-forward.',
    ],
  },
  {
    applicationId: 'app-1700000003-003',
    candidate: {
      npi: '1700000003',
      displayName: 'Sarah Chen, NP',
      specialty: 'Family Nurse Practitioner',
    },
    appliedAt: '2026-05-14T16:45:00.000Z',
    role: 'NP — Family Med',
    organization: 'Bay Area Health Network',
    state: 'waiting_on_sources',
    highlights: ['NPPES identity resolved.'],
    cautions: [
      'PECOS enrollment check still pending upstream — readiness preview will refresh when source responds.',
    ],
  },
];

export interface DemoIssuerRequest {
  requestId: string;
  claimType: 'education_degree' | 'board_certification' | 'employment_history';
  claimSummary: string;
  candidateName: string;
  candidateNpi: string;
  issuerOrg: string;
  status: 'received' | 'in_review' | 'confirmed' | 'unable_to_verify';
  receivedAt: string;
  notes?: string;
}

export const DEMO_ISSUER_REQUESTS: ReadonlyArray<DemoIssuerRequest> = [
  {
    requestId: 'req-001',
    claimType: 'education_degree',
    claimSummary: 'MD — Stanford University School of Medicine, 2018',
    candidateName: 'Ardalan Enkeshafi, M.D.',
    candidateNpi: '1003000126',
    issuerOrg: 'Stanford University Registrar',
    status: 'confirmed',
    receivedAt: '2026-05-12T10:15:00.000Z',
    notes: 'Confirmed via registrar portal; degree on file 2018-05-30.',
  },
  {
    requestId: 'req-002',
    claimType: 'board_certification',
    claimSummary: 'ABIM — Internal Medicine, recertified 2024',
    candidateName: 'Ardalan Enkeshafi, M.D.',
    candidateNpi: '1003000126',
    issuerOrg: 'American Board of Internal Medicine',
    status: 'in_review',
    receivedAt: '2026-05-14T14:00:00.000Z',
  },
  {
    requestId: 'req-003',
    claimType: 'employment_history',
    claimSummary: 'Bay Area Health Network — Hospitalist, 2022-2024',
    candidateName: 'Sarah Chen, NP',
    candidateNpi: '1700000003',
    issuerOrg: 'Bay Area Health Network HR',
    status: 'unable_to_verify',
    receivedAt: '2026-05-13T09:00:00.000Z',
    notes:
      'HR was unable to confirm dates; clinician asked to provide pay stubs or W-2 to resolve.',
  },
];

export const STATE_LABEL: Record<DemoEmployerApplication['state'], string> = {
  review_recommended: 'Review recommended',
  move_forward: 'Move forward',
  waiting_on_sources: 'Waiting on sources',
};

export const STATUS_LABEL: Record<DemoSource['status'], string> = {
  source_backed: 'Source-backed',
  access_required: 'Access required',
  pending: 'Pending',
  not_yet: 'Not yet',
};

export const ISSUER_STATUS_LABEL: Record<DemoIssuerRequest['status'], string> = {
  received: 'Received',
  in_review: 'In review',
  confirmed: 'Confirmed',
  unable_to_verify: 'Unable to verify',
};
