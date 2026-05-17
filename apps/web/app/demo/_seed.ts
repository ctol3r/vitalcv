/**
 * /demo seed data — single source of truth for the demo flows.
 *
 * No backend dependency. No DB query. All values are deterministic
 * fixtures so the demo renders identically on every load, on any
 * environment, with or without env vars.
 *
 * IMPORTANT — truth contract:
 *   - All NPIs in this file are SYNTHETIC. They are NOT live-source-
 *     backed; the rendered source statuses are fixture-only. Demo
 *     surfaces must label this clearly (see the eyebrow + footer
 *     copy on each /demo/* page).
 *   - The labels and tiers reflect the SAME vocabulary the live product
 *     uses (T1-T4 authority ladder, "Source-backed", "Access required",
 *     "Foundation preview"). Foundation-honest framing is preserved.
 *   - The full list of phrases this file MUST NOT emit lives in
 *     CLAUDE.md (the project truth contract). Demo content honors
 *     that contract by construction; no compliance claims, no
 *     credentialing-completion claims, no risk-transfer claims.
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

export interface DemoCredential {
  name: string;
  issuer: string;
  issuedOn: string;
  expiresOn?: string;
  freshness: 'current' | 'expiring_soon' | 'expired' | 'no_expiry';
  tier: SourceTier;
}

export interface DemoClinician {
  personaKey: string;
  npi: string;
  /** Always true on /demo/* — every NPI here is synthetic. */
  isSyntheticNpi: true;
  displayName: string;
  specialty: string;
  state: string;
  /** Role / setting context shown adjacent to the persona name. */
  setting: string;
  /** One-liner that names the operational pain VitalCV touches for this persona. */
  delayPain: string;
  /** What an employer reviewer should do next given the readiness shape. */
  employerNextAction: string;
  lastCheckedAt: string;
  readinessLevel: 'High' | 'Moderate' | 'Low' | 'Unknown';
  readinessScore: number; // 0-100
  sources: ReadonlyArray<DemoSource>;
  credentials: ReadonlyArray<DemoCredential>;
}

const NOW = '2026-05-16T15:00:00.000Z';

// ── Six demo personas. NPIs are synthetic; labeled per the truth contract. ──

export const DEMO_PERSONAS: ReadonlyArray<DemoClinician> = [
  // 1. Rural / FQHC family medicine
  {
    personaKey: 'rural-fqhc-family-medicine',
    npi: '1700100001',
    isSyntheticNpi: true,
    displayName: 'Dr. Eleanor Reyes, MD — DEMO',
    specialty: 'Family Medicine',
    state: 'NM',
    setting: 'Rural FQHC, Northern New Mexico',
    delayPain:
      'Rural FQHCs lose recruiting bandwidth when credentialing each clinician takes ~100 days. Source-backed readiness shortens the loop.',
    employerNextAction:
      'Move forward with conditional offer; flag state-board lane for institutional follow-up.',
    lastCheckedAt: NOW,
    readinessLevel: 'High',
    readinessScore: 78,
    sources: [
      { id: 'nppes', name: 'NPPES Registry', shortName: 'NPPES', status: 'source_backed', tier: 'T3', detail: 'Active NPI; family medicine taxonomy resolved.', checkedAt: NOW },
      { id: 'oig', name: 'OIG LEIE', shortName: 'OIG', status: 'source_backed', tier: 'T3', detail: 'No federal exclusion match.', checkedAt: NOW },
      { id: 'pecos', name: 'CMS PECOS', shortName: 'PECOS', status: 'source_backed', tier: 'T3', detail: 'Medicare enrollment active.', checkedAt: NOW },
      { id: 'state_board', name: 'State Board', shortName: 'State', status: 'access_required', tier: 'T3', detail: 'NM state-board portal requires institutional access; not a clinician defect.', checkedAt: NOW },
    ],
    credentials: [
      { name: 'MD — University of New Mexico', issuer: 'UNM Registrar', issuedOn: '2015-05-20', tier: 'T4', freshness: 'no_expiry' },
      { name: 'ABFM Family Medicine', issuer: 'American Board of Family Medicine', issuedOn: '2018-11-12', expiresOn: '2028-11-12', freshness: 'current', tier: 'T4' },
    ],
  },

  // 2. Locum tenens hospitalist
  {
    personaKey: 'locum-tenens-hospitalist',
    npi: '1700100002',
    isSyntheticNpi: true,
    displayName: 'Dr. Marcus Han, MD — DEMO',
    specialty: 'Internal Medicine (Hospitalist)',
    state: 'multi-state (CA, OR, NV)',
    setting: 'Locum tenens — short-term coverage across 3 states',
    delayPain:
      'Each new contract restarts credentialing from zero. A reusable readiness preview cuts the per-engagement onboarding tail.',
    employerNextAction:
      'Confirm readiness for next engagement; reuse prior issuer confirmations rather than re-requesting.',
    lastCheckedAt: NOW,
    readinessLevel: 'High',
    readinessScore: 82,
    sources: [
      { id: 'nppes', name: 'NPPES Registry', shortName: 'NPPES', status: 'source_backed', tier: 'T3', detail: 'Active NPI; internal medicine taxonomy.', checkedAt: NOW },
      { id: 'oig', name: 'OIG LEIE', shortName: 'OIG', status: 'source_backed', tier: 'T3', detail: 'No federal exclusion.', checkedAt: NOW },
      { id: 'pecos', name: 'CMS PECOS', shortName: 'PECOS', status: 'source_backed', tier: 'T3', detail: 'Active in PECOS.', checkedAt: NOW },
      { id: 'state_board', name: 'State Board (CA)', shortName: 'CA', status: 'source_backed', tier: 'T3', detail: 'CA license active.', checkedAt: NOW },
    ],
    credentials: [
      { name: 'MD — Johns Hopkins', issuer: 'JHU Registrar', issuedOn: '2012-05-18', tier: 'T4', freshness: 'no_expiry' },
      { name: 'ABIM Internal Medicine', issuer: 'American Board of Internal Medicine', issuedOn: '2015-09-30', expiresOn: '2025-09-30', freshness: 'expiring_soon', tier: 'T4' },
    ],
  },

  // 3. Procedural specialist / cardiothoracic surgeon
  {
    personaKey: 'cardiothoracic-surgeon',
    npi: '1700100003',
    isSyntheticNpi: true,
    displayName: 'Dr. Priya Bhatt, MD — DEMO',
    specialty: 'Cardiothoracic Surgery',
    state: 'MA',
    setting: 'Academic medical center, Boston',
    delayPain:
      'Procedural specialists carry deep credential portfolios; verification queues run weeks. Reusable confirmation collapses the lookup time per role.',
    employerNextAction:
      'Move forward on identity + safety lanes; request issuer confirmation for board-cert recertification before privileging decision.',
    lastCheckedAt: NOW,
    readinessLevel: 'High',
    readinessScore: 85,
    sources: [
      { id: 'nppes', name: 'NPPES Registry', shortName: 'NPPES', status: 'source_backed', tier: 'T3', detail: 'Active NPI; cardiothoracic surgery taxonomy.', checkedAt: NOW },
      { id: 'oig', name: 'OIG LEIE', shortName: 'OIG', status: 'source_backed', tier: 'T3', detail: 'No federal exclusion.', checkedAt: NOW },
      { id: 'pecos', name: 'CMS PECOS', shortName: 'PECOS', status: 'source_backed', tier: 'T3', detail: 'Active in PECOS.', checkedAt: NOW },
      { id: 'state_board', name: 'State Board (MA)', shortName: 'MA', status: 'access_required', tier: 'T3', detail: 'MA portal requires institutional access.', checkedAt: NOW },
    ],
    credentials: [
      { name: 'MD — Harvard Medical School', issuer: 'HMS Registrar', issuedOn: '2008-05-29', tier: 'T4', freshness: 'no_expiry' },
      { name: 'ABTS Thoracic Surgery', issuer: 'American Board of Thoracic Surgery', issuedOn: '2015-12-04', expiresOn: '2025-12-04', freshness: 'expiring_soon', tier: 'T4' },
      { name: 'BLS / ACLS', issuer: 'AHA', issuedOn: '2024-09-15', expiresOn: '2026-09-15', freshness: 'expiring_soon', tier: 'T4' },
    ],
  },

  // 4. International Medical Graduate (IMG)
  {
    personaKey: 'img-internal-medicine',
    npi: '1700100004',
    isSyntheticNpi: true,
    displayName: 'Dr. Adaobi Nwosu, MBBS — DEMO',
    specialty: 'Internal Medicine (IMG)',
    state: 'TX',
    setting: 'County hospital, El Paso — recent residency completion',
    delayPain:
      'IMGs face longer verification cycles due to international credentials; clinicians spend months re-explaining the same artifacts to each reviewer.',
    employerNextAction:
      'Request issuer confirmation for primary degree (foreign registrar); review ECFMG attestation; continue source-backed onboarding.',
    lastCheckedAt: NOW,
    readinessLevel: 'Moderate',
    readinessScore: 62,
    sources: [
      { id: 'nppes', name: 'NPPES Registry', shortName: 'NPPES', status: 'source_backed', tier: 'T3', detail: 'Active NPI; internal medicine taxonomy.', checkedAt: NOW },
      { id: 'oig', name: 'OIG LEIE', shortName: 'OIG', status: 'source_backed', tier: 'T3', detail: 'No federal exclusion.', checkedAt: NOW },
      { id: 'pecos', name: 'CMS PECOS', shortName: 'PECOS', status: 'pending', tier: 'T3', detail: 'Initial PECOS enrollment in progress.', checkedAt: NOW },
      { id: 'state_board', name: 'State Board (TX)', shortName: 'TX', status: 'source_backed', tier: 'T3', detail: 'TX physician license active.', checkedAt: NOW },
    ],
    credentials: [
      { name: 'MBBS — University of Lagos', issuer: 'University of Lagos Registrar', issuedOn: '2013-07-22', tier: 'T3', freshness: 'no_expiry' },
      { name: 'ECFMG Certification', issuer: 'ECFMG', issuedOn: '2019-04-30', tier: 'T4', freshness: 'no_expiry' },
      { name: 'BLS', issuer: 'AHA', issuedOn: '2024-10-01', expiresOn: '2026-10-01', freshness: 'expiring_soon', tier: 'T4' },
    ],
  },

  // 5. Nurse Practitioner in a restricted-practice state
  {
    personaKey: 'np-restricted-practice',
    npi: '1700100005',
    isSyntheticNpi: true,
    displayName: 'Sarah Chen, FNP-C — DEMO',
    specialty: 'Family Nurse Practitioner',
    state: 'FL (restricted practice)',
    setting: 'Independent primary care clinic, Tampa',
    delayPain:
      'Restricted-practice states require collaborative-agreement verification on top of standard credentialing; readiness preview surfaces what is missing before the contract starts.',
    employerNextAction:
      'Verify collaborative agreement; confirm board certification; move forward on identity + safety lanes.',
    lastCheckedAt: NOW,
    readinessLevel: 'Moderate',
    readinessScore: 65,
    sources: [
      { id: 'nppes', name: 'NPPES Registry', shortName: 'NPPES', status: 'source_backed', tier: 'T3', detail: 'Active NPI; FNP taxonomy.', checkedAt: NOW },
      { id: 'oig', name: 'OIG LEIE', shortName: 'OIG', status: 'source_backed', tier: 'T3', detail: 'No federal exclusion.', checkedAt: NOW },
      { id: 'pecos', name: 'CMS PECOS', shortName: 'PECOS', status: 'source_backed', tier: 'T3', detail: 'Active in PECOS.', checkedAt: NOW },
      { id: 'state_board', name: 'State Board (FL)', shortName: 'FL', status: 'access_required', tier: 'T3', detail: 'FL FNP portal requires institutional access; collaborative-agreement check is separate.', checkedAt: NOW },
    ],
    credentials: [
      { name: 'MSN — University of Florida', issuer: 'UF Registrar', issuedOn: '2017-08-04', tier: 'T4', freshness: 'no_expiry' },
      { name: 'AANP FNP-C Certification', issuer: 'AANP', issuedOn: '2018-01-15', expiresOn: '2028-01-15', freshness: 'current', tier: 'T4' },
    ],
  },

  // 6. Psychiatry / Primary Care Retention
  //    Maps to the research-signal pair: psychiatry 20.3% admin burden +
  //    primary care 4.41% annual exit rate. The VitalCV value here is
  //    reducing repeat administrative drag around credentialing
  //    evidence — NOT solving burnout or workforce attrition outright.
  {
    personaKey: 'psychiatry-primary-care-retention',
    npi: '1700100007',
    isSyntheticNpi: true,
    displayName: 'Dr. Naomi Park, MD — DEMO',
    specialty: 'Psychiatry (outpatient)',
    state: 'OH',
    setting: 'Outpatient mental health clinic, suburban Ohio',
    delayPain:
      'High administrative burden + access shortage means every repeated credentialing cycle is a force-multiplier for burnout. Reducing repeat evidence gathering is one structural drag VitalCV can address.',
    employerNextAction:
      'Move forward on identity + safety lanes; minimize re-submission asks to preserve clinical hours.',
    lastCheckedAt: NOW,
    readinessLevel: 'High',
    readinessScore: 80,
    sources: [
      { id: 'nppes', name: 'NPPES Registry', shortName: 'NPPES', status: 'source_backed', tier: 'T3', detail: 'Active NPI; psychiatry taxonomy.', checkedAt: NOW },
      { id: 'oig', name: 'OIG LEIE', shortName: 'OIG', status: 'source_backed', tier: 'T3', detail: 'No federal exclusion.', checkedAt: NOW },
      { id: 'pecos', name: 'CMS PECOS', shortName: 'PECOS', status: 'source_backed', tier: 'T3', detail: 'Active in PECOS.', checkedAt: NOW },
      { id: 'state_board', name: 'State Board (OH)', shortName: 'OH', status: 'source_backed', tier: 'T3', detail: 'OH physician license active.', checkedAt: NOW },
    ],
    credentials: [
      { name: 'MD — Case Western Reserve University', issuer: 'CWRU Registrar', issuedOn: '2010-05-22', tier: 'T4', freshness: 'no_expiry' },
      { name: 'ABPN Psychiatry', issuer: 'American Board of Psychiatry and Neurology', issuedOn: '2016-11-12', expiresOn: '2026-11-12', freshness: 'expiring_soon', tier: 'T4' },
    ],
  },

  // 7. Telehealth clinician crossing multiple states
  {
    personaKey: 'telehealth-multi-state',
    npi: '1700100006',
    isSyntheticNpi: true,
    displayName: 'Dr. Liam O’Sullivan, DO — DEMO',
    specialty: 'Internal Medicine (Telehealth)',
    state: 'multi-state (NY, NJ, PA, CT)',
    setting: 'Telehealth network, virtual-first practice',
    delayPain:
      'Telehealth clinicians need parallel state-board verification across multiple jurisdictions. A reusable readiness preview shows which states are covered before patient routing.',
    employerNextAction:
      'Confirm state-board licensure across the 4 jurisdictions; move forward where state lane is source-backed; defer routing in states where lane is access-required.',
    lastCheckedAt: NOW,
    readinessLevel: 'High',
    readinessScore: 75,
    sources: [
      { id: 'nppes', name: 'NPPES Registry', shortName: 'NPPES', status: 'source_backed', tier: 'T3', detail: 'Active NPI; internal medicine taxonomy.', checkedAt: NOW },
      { id: 'oig', name: 'OIG LEIE', shortName: 'OIG', status: 'source_backed', tier: 'T3', detail: 'No federal exclusion.', checkedAt: NOW },
      { id: 'pecos', name: 'CMS PECOS', shortName: 'PECOS', status: 'source_backed', tier: 'T3', detail: 'Active in PECOS.', checkedAt: NOW },
      { id: 'state_board', name: 'State Board (NY)', shortName: 'NY', status: 'source_backed', tier: 'T3', detail: 'NY DO license active.', checkedAt: NOW },
    ],
    credentials: [
      { name: 'DO — Philadelphia College of Osteopathic Medicine', issuer: 'PCOM Registrar', issuedOn: '2014-05-25', tier: 'T4', freshness: 'no_expiry' },
      { name: 'ABIM Internal Medicine', issuer: 'American Board of Internal Medicine', issuedOn: '2017-10-12', expiresOn: '2027-10-12', freshness: 'current', tier: 'T4' },
    ],
  },
] as const;

// Convenience export so existing /demo/clinician code can pick a primary
// persona without changes if it already imports a single DEMO_CLINICIAN
// constant.
export const DEMO_CLINICIAN: DemoClinician = DEMO_PERSONAS[0];

// ── Employer queue (uses persona NPIs above) ──────────────────────────────

export interface DemoEmployerApplication {
  applicationId: string;
  candidate: {
    npi: string;
    displayName: string;
    specialty: string;
    setting?: string;
  };
  appliedAt: string;
  /** When the source-backed readiness was last refreshed for this candidate. */
  sourceCheckedAt: string;
  sourcesCompleted: number;
  sourcesTotal: number;
  role: string;
  organization: string;
  state: 'review_recommended' | 'move_forward' | 'waiting_on_sources';
  highlights: ReadonlyArray<string>;
  cautions: ReadonlyArray<string>;
}

export const DEMO_EMPLOYER_APPLICATIONS: ReadonlyArray<DemoEmployerApplication> = [
  {
    applicationId: 'app-' + DEMO_PERSONAS[1].npi + '-locum',
    candidate: { npi: DEMO_PERSONAS[1].npi, displayName: DEMO_PERSONAS[1].displayName, specialty: DEMO_PERSONAS[1].specialty, setting: DEMO_PERSONAS[1].setting },
    appliedAt: '2026-05-13T19:00:00.000Z',
    sourceCheckedAt: '2026-05-16T14:42:00.000Z',
    sourcesCompleted: 4,
    sourcesTotal: 4,
    role: 'Hospitalist — IM',
    organization: 'Bay Area Health Network — DEMO',
    state: 'move_forward',
    highlights: ['NPPES, OIG LEIE, PECOS, and CA state board all source-backed.', 'ABIM recertification due 2025-09; on track.'],
    cautions: ['ABIM expires within ~12 months — note for privileging cycle.'],
  },
  {
    applicationId: 'app-' + DEMO_PERSONAS[3].npi + '-img',
    candidate: { npi: DEMO_PERSONAS[3].npi, displayName: DEMO_PERSONAS[3].displayName, specialty: DEMO_PERSONAS[3].specialty, setting: DEMO_PERSONAS[3].setting },
    appliedAt: '2026-05-14T11:30:00.000Z',
    sourceCheckedAt: '2026-05-16T14:15:00.000Z',
    sourcesCompleted: 3,
    sourcesTotal: 4,
    role: 'Hospitalist — IM',
    organization: 'County Hospital, El Paso — DEMO',
    state: 'review_recommended',
    highlights: ['NPPES identity resolved.', 'TX state license active.', 'ECFMG certification on file.'],
    cautions: ['Initial PECOS enrollment still in progress — readiness preview will refresh when source responds.'],
  },
  {
    applicationId: 'app-' + DEMO_PERSONAS[4].npi + '-np',
    candidate: { npi: DEMO_PERSONAS[4].npi, displayName: DEMO_PERSONAS[4].displayName, specialty: DEMO_PERSONAS[4].specialty, setting: DEMO_PERSONAS[4].setting },
    appliedAt: '2026-05-14T16:45:00.000Z',
    sourceCheckedAt: '2026-05-16T13:58:00.000Z',
    sourcesCompleted: 3,
    sourcesTotal: 4,
    role: 'FNP — Primary Care',
    organization: 'Independent clinic, Tampa — DEMO',
    state: 'waiting_on_sources',
    highlights: ['NPPES identity resolved.', 'AANP FNP-C certification active.'],
    cautions: ['FL state-board portal requires institutional access — collaborative-agreement check is separate; not a clinician defect.'],
  },
];

// ── Issuer requests with audit trails ─────────────────────────────────────

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
  /** Audit trail entries — who/what/when, in chronological order. */
  audit: ReadonlyArray<{ at: string; actor: string; action: string }>;
}

export const DEMO_ISSUER_REQUESTS: ReadonlyArray<DemoIssuerRequest> = [
  {
    requestId: 'req-001',
    claimType: 'education_degree',
    claimSummary: 'MD — University of New Mexico, 2015 (DEMO)',
    candidateName: DEMO_PERSONAS[0].displayName,
    candidateNpi: DEMO_PERSONAS[0].npi,
    issuerOrg: 'UNM Registrar — DEMO',
    status: 'confirmed',
    receivedAt: '2026-05-12T10:15:00.000Z',
    notes: 'Confirmed via registrar portal; degree on file 2015-05-20.',
    audit: [
      { at: '2026-05-12T10:15:00.000Z', actor: 'system', action: 'Request received' },
      { at: '2026-05-12T11:02:00.000Z', actor: 'registrar.demo', action: 'Opened for review' },
      { at: '2026-05-13T09:24:00.000Z', actor: 'registrar.demo', action: 'Confirmed — degree on file' },
    ],
  },
  {
    requestId: 'req-002',
    claimType: 'board_certification',
    claimSummary: 'ABIM Internal Medicine, due for recertification 2025 (DEMO)',
    candidateName: DEMO_PERSONAS[1].displayName,
    candidateNpi: DEMO_PERSONAS[1].npi,
    issuerOrg: 'American Board of Internal Medicine — DEMO',
    status: 'in_review',
    receivedAt: '2026-05-14T14:00:00.000Z',
    audit: [
      { at: '2026-05-14T14:00:00.000Z', actor: 'system', action: 'Request received' },
      { at: '2026-05-15T08:30:00.000Z', actor: 'abim.demo', action: 'Opened for review' },
    ],
  },
  {
    requestId: 'req-003',
    claimType: 'employment_history',
    claimSummary: 'Bay Area Health Network — Hospitalist, 2022-2024 (DEMO)',
    candidateName: DEMO_PERSONAS[4].displayName,
    candidateNpi: DEMO_PERSONAS[4].npi,
    issuerOrg: 'Bay Area Health Network HR — DEMO',
    status: 'unable_to_verify',
    receivedAt: '2026-05-13T09:00:00.000Z',
    notes: 'HR unable to confirm dates; clinician asked to provide pay stubs or W-2.',
    audit: [
      { at: '2026-05-13T09:00:00.000Z', actor: 'system', action: 'Request received' },
      { at: '2026-05-13T15:18:00.000Z', actor: 'hr.demo', action: 'Opened for review' },
      { at: '2026-05-14T10:42:00.000Z', actor: 'hr.demo', action: 'Marked unable to verify (records unavailable)' },
      { at: '2026-05-14T11:00:00.000Z', actor: 'system', action: 'Notified clinician — additional artifacts requested' },
    ],
  },
];

// ── Display label constants ───────────────────────────────────────────────

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
