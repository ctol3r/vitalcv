// Mock data for Macie Miller, PA-C
const PROVIDER = {
  fullName: 'MACIE MILLER',
  credential: 'PA-C',
  role: 'Physician Assistant',
  npi: '1346053246',
  enumeratedDate: 'Jan 14, 2025',
  enumeratedDateLong: 'January 14, 2025',
  city: 'Irvine, CA',
  taxonomy: '363A00000X — Physician Assistant',
  gender: 'Female',
  firstName: 'Macie',
  initials: 'MM',
};

// Enriched identity fields — each carries a confidence tier.
// Tiers: 'verified' | 'inferred' | 'unknown'
const IDENTITY_FIELDS = [
  {
    id: 'taxonomy',
    label: 'Primary taxonomy',
    value: 'Physician Assistant · 363A00000X',
    confidence: 'verified',
    source: 'NPPES · CMS',
  },
  {
    id: 'specialty',
    label: 'Specialty',
    value: 'Orthopedic Surgery',
    confidence: 'inferred',
    source: 'Resume · AI extraction v2.1.4',
    hint: 'Derived from resume. Not a primary-source specialty attestation.',
  },
  {
    id: 'education',
    label: 'Education / Training',
    value: 'MS, Physician Assistant Studies — Western U. of Health Sciences, 2024',
    confidence: 'inferred',
    source: 'Resume · AI extraction v2.1.4',
    hint: 'Unverified. Requires NCCPA + program PSV to upgrade to Verified.',
  },
  {
    id: 'employment',
    label: 'Most recent employment',
    value: 'See Evidence · Current Employer (contradicted)',
    confidence: 'contradicted',
    source: 'Resume vs. PECOS',
  },
  {
    id: 'dea',
    label: 'DEA registration',
    value: 'Not on file',
    confidence: 'unknown',
    source: '—',
    hint: 'Not yet collected. Request from clinician if required for role.',
  },
];

// Employer-side additionally shows board certification (NCCPA) inferred
const IDENTITY_FIELDS_EMPLOYER = IDENTITY_FIELDS;

const NOW_ISO = '2026-04-18T14:32:07Z';
const NOW_LABEL = 'Just now';

// Sources / lanes
const LANES = [
  {
    id: 'identity',
    label: 'Identity',
    source: 'NPPES',
    sourceLong: 'National Plan & Provider Enumeration System',
    authority: 'U.S. Centers for Medicare & Medicaid Services',
    state: 'verified',
    checkedAt: NOW_LABEL,
    checkedIso: NOW_ISO,
    summary: 'Identity verified via public federal registry.',
    evidence: [
      { k: 'Legal name',      v: 'MILLER, MACIE' },
      { k: 'NPI',             v: '1346053246', mono: true },
      { k: 'Enumeration',     v: '2025-01-14', mono: true },
      { k: 'Entity type',     v: 'Type 1 — Individual' },
      { k: 'Taxonomy',        v: '363A00000X — Physician Assistant', mono: true },
      { k: 'Primary address', v: 'Irvine, CA 92614' },
      { k: 'Status',          v: 'Active' },
    ],
    receipt: 'vc2:nppes:0x8a41…c7d2',
    receiptFull: 'vc2:nppes:0x8a41f0b9e2f67d4c1a3e9b0a2c7d2',
  },
  {
    id: 'sanctions',
    label: 'Sanctions',
    source: 'OIG / LEIE',
    sourceLong: 'HHS Office of Inspector General — List of Excluded Individuals/Entities',
    authority: 'U.S. Department of Health & Human Services',
    state: 'pending',
    checkedAt: 'Checking…',
    summary: 'Checking monthly exclusion dataset.',
    evidence: [
      { k: 'Dataset',    v: 'LEIE monthly (Apr 2026)', mono: true },
      { k: 'Match rule', v: 'NPI + Last name + DOB' },
      { k: 'Scan start', v: '2026-04-18 14:32:03 UTC', mono: true },
      { k: 'Expected',   v: '~30 seconds' },
    ],
  },
  {
    id: 'medicare',
    label: 'Medicare',
    source: 'PECOS',
    sourceLong: 'Provider Enrollment, Chain & Ownership System',
    authority: 'U.S. Centers for Medicare & Medicaid Services',
    state: 'pending',
    checkedAt: 'Checking…',
    summary: 'Checking Medicare enrollment status.',
    evidence: [
      { k: 'Query',      v: 'Individual enrollment by NPI', mono: true },
      { k: 'Scope',      v: 'Part B · Reassignments' },
      { k: 'Scan start', v: '2026-04-18 14:32:04 UTC', mono: true },
      { k: 'Expected',   v: '~45 seconds' },
    ],
  },
  {
    id: 'licensure',
    label: 'Licensure',
    source: 'CA State Board',
    sourceLong: 'Medical Board of California — Physician Assistant Board',
    authority: 'State of California',
    state: 'access',
    checkedAt: '—',
    summary: 'Requires institutional access to verify.',
    evidence: [
      { k: 'Board',       v: 'Physician Assistant Board of California' },
      { k: 'Endpoint',    v: 'Authenticated PSV · B2B credential feed' },
      { k: 'Access via',  v: 'Employer or credentialing VO' },
      { k: 'Typical SLA', v: '< 4 business hours once invoked' },
    ],
  },
  {
    id: 'nursys',
    label: 'Multi-State Licensure',
    source: 'Nursys',
    sourceLong: 'National Council of State Boards — Nursys eNotify / QuickConfirm',
    authority: 'NCSBN — Nurse Licensure Compact',
    state: 'access',
    checkedAt: '—',
    summary: 'Requires institutional subscriber access.',
    evidence: [
      { k: 'Product',     v: 'Nursys QuickConfirm · Institutional tier' },
      { k: 'Scope',       v: 'Multi-state compact licensure + discipline' },
      { k: 'Access via',  v: 'Subscriber query · employer credentials' },
      { k: 'Applicable?', v: 'Advisory for PA-C (NP/RN verification path)' },
    ],
  },
  {
    id: 'npdb',
    label: 'Adverse History',
    source: 'NPDB',
    sourceLong: 'National Practitioner Data Bank — Continuous Query',
    authority: 'HRSA · U.S. Dept. of Health & Human Services',
    state: 'access',
    checkedAt: '—',
    summary: 'Federal law requires authorized institutional query to resolve.',
    evidence: [
      { k: 'Query type',   v: 'Continuous Query · Standing enrollment' },
      { k: 'Eligibility',  v: 'Authorized healthcare entity only' },
      { k: 'Statute',      v: '42 U.S.C. § 11101 et seq.', mono: true },
      { k: 'Scope',        v: 'Malpractice · adverse actions · exclusions' },
    ],
  },
  {
    id: 'employer',
    label: 'Current Employer',
    source: 'Resume ⇄ PECOS',
    sourceLong: 'Cross-source comparison of self-reported employment vs. Medicare enrollment reassignments',
    authority: 'Resume extraction v2.1.4 · CMS PECOS',
    state: 'contradicted',
    checkedAt: '22s ago',
    summary: 'Resume and PECOS disagree on current employer. Human judgment required.',
    evidence: [
      { k: 'Detection',   v: 'Cross-source mismatch' },
      { k: 'First seen',  v: '2026-04-18 14:31:45 UTC', mono: true },
      { k: 'Rule',        v: 'resume.employer ≠ pecos.reassignment[0].org' },
      { k: 'Blocking?',   v: 'No · advisory only' },
    ],
    conflict: {
      a: {
        source: 'Resume · AI extraction',
        badge: 'inferred',
        org: 'Cedar Health System',
        role: 'PA-C · Orthopedic Surgery',
        dates: 'Feb 2025 — Present',
        location: 'Irvine, CA',
        confidence: 'Extracted with 0.82 confidence · v2.1.4',
      },
      b: {
        source: 'PECOS · CMS',
        badge: 'verified',
        org: 'Irvine Regional Medical Group',
        role: 'Reassignment of Medicare benefits',
        dates: 'Effective Jan 28, 2025',
        location: 'Irvine, CA',
        confidence: 'Primary-source federal record',
      },
    },
  },
];

// Event log for evidence drawer
const EVENTS = [
  { t: '14:32:07', src: 'NPPES',   msg: 'Identity record resolved · 1 exact match', state: 'verified' },
  { t: '14:32:06', src: 'NPPES',   msg: 'Query dispatched: npi=1346053246',          state: 'info' },
  { t: '14:32:04', src: 'PECOS',   msg: 'Enrollment scan queued',                    state: 'pending' },
  { t: '14:32:03', src: 'OIG/LEIE', msg: 'Exclusion scan queued',                    state: 'pending' },
  { t: '14:32:02', src: 'VitalCV', msg: 'Readiness run initiated by provider',       state: 'info' },
];

// Target employer
const EMPLOYER = {
  name: 'Cedar Health',
  legal: 'Cedar Health System, Inc.',
  role: 'Physician Assistant · Orthopedic Surgery',
  reqId: 'REQ-2026-1184',
  location: 'Irvine, CA · Orange County Medical Center',
  contact: 'Jordan Okafor · Credentialing Lead',
  submittedAt: '2026-04-18 14:22 UTC',
  viewedAt:    '2026-04-18 14:24 UTC',
  reviewAt:    '2026-04-18 14:32 UTC',
};

// Application lifecycle stages (ordered)
const LIFECYCLE_STAGES = [
  { id: 'submitted',    label: 'Submitted',    sub: 'Snapshot sealed by clinician',              at: '2026-04-18 14:22 UTC' },
  { id: 'viewed',       label: 'Viewed',       sub: 'Opened by credentialing reviewer',          at: '2026-04-18 14:24 UTC' },
  { id: 'in_review',    label: 'In Review',    sub: 'Evidence under auditor scrutiny',           at: '2026-04-18 14:32 UTC' },
  { id: 'credentialing',label: 'Credentialing',sub: 'Medical staff office · board review',      at: null },
  { id: 'approved',     label: 'Approved',     sub: 'Privileges granted · onboarding unlocked',  at: null },
  { id: 'started',      label: 'Started',      sub: 'First day on unit',                         at: null },
];

// Requestable lanes for the Missing Info modal
const REQUESTABLE_LANES = [
  { id: 'licensure_ca', label: 'State Licensure — CA',          hint: 'Authenticated primary-source verification', state: 'access',   recommended: true },
  { id: 'dea',          label: 'DEA Registration',              hint: 'Schedule II–V authority confirmation',     state: 'unknown',  recommended: true },
  { id: 'npdb',         label: 'NPDB Self-Query',               hint: 'Signed self-query · 30-day validity',       state: 'unknown',  recommended: false },
  { id: 'malpractice',  label: 'Malpractice Coverage',          hint: 'Current COI · carrier + policy #',         state: 'unknown',  recommended: false },
  { id: 'boardcert',    label: 'Board Certification (NCCPA)',   hint: 'PA-C status + expiration',                  state: 'unknown',  recommended: false },
  { id: 'education',    label: 'Education Verification',        hint: 'Terminal degree + program accreditation',   state: 'unknown',  recommended: false },
];

window.PROVIDER = PROVIDER;
window.LANES = LANES;
window.EVENTS = EVENTS;
window.NOW_LABEL = NOW_LABEL;
window.EMPLOYER = EMPLOYER;
window.LIFECYCLE_STAGES = LIFECYCLE_STAGES;
window.REQUESTABLE_LANES = REQUESTABLE_LANES;

// NCQA compliance mapping — lane id -> standard code + status tier
// status: 'satisfied' | 'pending' | 'access'
const NCQA_MAP = {
  identity:  { code: 'NCQA CR-1', desc: 'Identity · NPI enumeration',           status: 'satisfied' },
  sanctions: { code: 'NCQA CR-4', desc: 'Sanctions & exclusions (OIG/LEIE)',   status: 'pending'   },
  medicare:  { code: 'NCQA CR-6', desc: 'Medicare/Medicaid participation',      status: 'pending'   },
  licensure: { code: 'NCQA CR-2', desc: 'State licensure · PSV',                status: 'access'    },
  nursys:    { code: 'NCQA CR-2', desc: 'Multi-state licensure · PSV',          status: 'access'    },
  npdb:      { code: 'NCQA CR-5', desc: 'Adverse history · NPDB query',         status: 'access'    },
  employer:  { code: 'NCQA CR-7', desc: 'Work history reconciliation',          status: 'pending'   },
};
window.NCQA_MAP = NCQA_MAP;

// Freshness decay per lane
// window = total authoritative freshness window in days
// ageDays = days since last verified observation
// cadence = human-readable cadence string
const FRESHNESS = {
  identity:  { window: 365, ageDays: 0,   cadence: 'NPPES enumeration · revalidate every 5 years' },
  sanctions: { window: 30,  ageDays: 18,   cadence: 'OIG/LEIE refreshed monthly' },
  medicare:  { window: 90,  ageDays: 42,   cadence: 'PECOS refreshed quarterly' },
  licensure: { window: 30,  ageDays: null, cadence: 'State board · queried on demand' },
  nursys:    { window: 30,  ageDays: null, cadence: 'Nursys eNotify · continuous' },
  npdb:      { window: 365, ageDays: null, cadence: 'NPDB Continuous Query · standing' },
  employer:  { window: 90,  ageDays: 0,    cadence: 'Resume ⇄ PECOS reconciliation' },
};
window.FRESHNESS = FRESHNESS;

// Proactive monitoring feed — last 30d of background events
const MONITORING_FEED = [
  { t: '2026-04-18 02:14 UTC', kind: 'SYSTEM', msg: 'OIG Monthly Dataset Ingested. MACIE MILLER: CLEAR.',                             tone: 'ok' },
  { t: '2026-04-15 09:00 UTC', kind: 'ALERT',  msg: 'CA State Board PA License expires in 30 days. Auto-routed renewal request to clinician.', tone: 'warn' },
  { t: '2026-04-12 00:03 UTC', kind: 'SYSTEM', msg: 'NPPES Delta scan: no change to identity record.',                               tone: 'muted' },
  { t: '2026-04-08 18:41 UTC', kind: 'SYSTEM', msg: 'Cross-network observation: Passport re-used at OR Medical Group (Irvine).',      tone: 'info' },
  { t: '2026-04-02 02:11 UTC' ,kind: 'SYSTEM', msg: 'OIG LEIE April dataset published. Scan scheduled.',                              tone: 'muted' },
  { t: '2026-03-28 14:05 UTC', kind: 'SYSTEM', msg: 'PECOS reassignment delta: no change since 2025-01-28.',                         tone: 'muted' },
  { t: '2026-03-15 09:02 UTC', kind: 'SYSTEM', msg: 'OIG Monthly Dataset Ingested. MACIE MILLER: CLEAR.',                             tone: 'ok' },
];
window.MONITORING_FEED = MONITORING_FEED;

// Career autopilot mobility map (clinician view)
const MOBILITY = {
  qualifiedReqs: 14,
  deaBoost: 32,
  nccpaBoost: 9,
  networkReqs: 147,
  actions: [
    { id: 'dea',    label: 'Verify DEA Registration',       sub: 'Unlocks +32 requisitions · 4 health systems',   cta: 'Verify DEA' },
    { id: 'nccpa',  label: 'Attach NCCPA Board Certification', sub: 'Unlocks +9 specialty-gated requisitions',    cta: 'Attach NCCPA' },
    { id: 'license', label: 'Add NV + AZ Licensure',           sub: 'Expands radius by ~380 miles · 11 systems',  cta: 'Add states' },
  ],
};
window.MOBILITY = MOBILITY;

// ========= WAVE 7 · AUTHORITY SYSTEM =========
// Trust tiers — a published, auditable ladder of how authoritative each observation is.
// T1 Public (self/third-party) · T2 Federated (network cross-observation)
// · T3 Authoritative (registry of record) · T4 Primary-Sealed (cryptographically signed by issuing authority)
const TRUST_TIERS = {
  T1: { code: 'T1', label: 'Public',        description: 'Self-attested or scraped from public sources.',           tone: 'slate'   },
  T2: { code: 'T2', label: 'Federated',     description: 'Corroborated across the VitalCV partner network.',         tone: 'sky'     },
  T3: { code: 'T3', label: 'Authoritative', description: 'Returned by the registry of record (federal or state).',   tone: 'indigo'  },
  T4: { code: 'T4', label: 'Primary-Sealed',description: 'Cryptographically signed by the issuing authority itself.',tone: 'emerald' },
};
window.TRUST_TIERS = TRUST_TIERS;

// Lane id → trust tier + delegation chain (chain-of-custody)
const LANE_AUTHORITY = {
  identity:  { tier: 'T4', delegate: { org: 'CMS · NPPES',                       role: 'Issuer',      sig: 'ed25519:0x8a41…c7d2' } },
  sanctions: { tier: 'T4', delegate: { org: 'HHS · Office of Inspector General', role: 'Issuer',      sig: 'ed25519:0x3f9d…b12a' } },
  medicare:  { tier: 'T3', delegate: { org: 'CMS · PECOS',                       role: 'Registry',    sig: 'hmac:pecos.prod/042'  } },
  licensure: { tier: 'T3', delegate: { org: 'Medical Board of California',       role: 'Issuer',      sig: '— awaiting invocation' } },
  nursys:    { tier: 'T3', delegate: { org: 'NCSBN · Nursys',                    role: 'Registry',    sig: '— awaiting invocation' } },
  npdb:      { tier: 'T4', delegate: { org: 'HRSA · NPDB',                       role: 'Issuer',      sig: '— awaiting invocation' } },
  employer:  { tier: 'T2', delegate: { org: 'Resume (self) ⇄ PECOS',             role: 'Federated',   sig: '— advisory only'        } },
};
window.LANE_AUTHORITY = LANE_AUTHORITY;

// Final acceptance receipt — signed by the employer
const ACCEPTANCE_RECEIPT = {
  issuer: 'Cedar Health System, Inc.',
  signer: 'Jordan Okafor · Credentialing Lead',
  signerTitle: 'Designated Credentialing Officer · NCQA Delegation Agreement §4.2',
  signedAt: '2026-04-23 09:14 UTC',
  registryId: 'VCV-SOR-2026-00841',
  merkleRoot: '0x9f2bd7c4a10e5…8e7',
  seal: 'ed25519:cedar-health/cred/2026/0x4a7e…91c3',
  counterSeal: 'ed25519:vitalcv/sor/prod/202 · 0x01b4…fe29',
  standard: 'NCQA CR · §3 Credentialing + §4.2 Delegation',
  notarized: true,
};
window.ACCEPTANCE_RECEIPT = ACCEPTANCE_RECEIPT;

// ========= WAVE 8 · STRICT ACCEPTANCE RULESET =========
// Published, versioned rulebook. Each rule is scoped to a lane, requires a min trust tier,
// specifies who can satisfy it (clinician vs employer), and cites the governing standard.
const ACCEPTANCE_RULESET = {
  id: 'VCV-PSV-2026.04',
  version: '2026.04.1',
  effective: '2026-04-01',
  standard: 'NCQA CR §3 (Credentialing) · The Joint Commission MS.06.01.03',
  rules: [
    { id: 'R1', laneId: 'identity',  label: 'Identity resolved to NPI',           minTier: 'T3', required: true,  actor: 'auto',      standard: 'NCQA CR 3 §B.1' },
    { id: 'R2', laneId: 'sanctions', label: 'OIG/LEIE exclusion check · current', minTier: 'T4', required: true,  actor: 'auto',      standard: '42 CFR §1001' },
    { id: 'R3', laneId: 'medicare',  label: 'PECOS enrollment · current',         minTier: 'T3', required: true,  actor: 'auto',      standard: 'NCQA CR 3 §B.4' },
    { id: 'R4', laneId: 'licensure', label: 'State license · primary-source',     minTier: 'T3', required: true,  actor: 'employer',  standard: 'NCQA CR 3 §B.2' },
    { id: 'R5', laneId: 'npdb',      label: 'NPDB query · within 180 days',       minTier: 'T4', required: true,  actor: 'employer',  standard: 'NCQA CR 3 §B.8' },
    { id: 'R6', laneId: 'dea',       label: 'DEA registration · Schedule II–V',   minTier: 'T3', required: false, actor: 'clinician', standard: 'Role-gated' },
    { id: 'R7', laneId: 'employer',  label: 'Work history · 5-year reconciled',   minTier: 'T2', required: true,  actor: 'clinician', standard: 'NCQA CR 3 §B.5' },
  ],
};
window.ACCEPTANCE_RULESET = ACCEPTANCE_RULESET;

// Pure evaluator — returns gate state, blockers, and rule-by-rule status.
// A rule is MET when:
//   - its lane exists AND state === 'verified'
//   - AND the lane's trust tier meets minTier
// A rule is PENDING when its lane state is 'pending' (query in flight).
// A rule is UNMET when lane is access/unknown/blocked OR tier is too low.
function evaluateAcceptance(lanes) {
  const tierRank = { T1: 1, T2: 2, T3: 3, T4: 4 };
  const laneById = Object.fromEntries((lanes || []).map(l => [l.id, l]));

  const checks = ACCEPTANCE_RULESET.rules.map(r => {
    const lane = laneById[r.laneId];
    const tier = (LANE_AUTHORITY[r.laneId] && LANE_AUTHORITY[r.laneId].tier) || 'T1';
    const tierOK = tierRank[tier] >= tierRank[r.minTier];

    let status = 'unmet';
    let reason = '';
    if (!lane) {
      status = r.required ? 'unmet' : 'not_applicable';
      reason = r.required ? 'Lane not in packet' : 'Not applicable for this role';
    } else if (lane.state === 'verified' && tierOK) {
      status = 'met';
    } else if (lane.state === 'verified' && !tierOK) {
      status = 'unmet';
      reason = `Returned tier ${tier} — below required ${r.minTier}`;
    } else if (lane.state === 'pending') {
      status = 'pending';
      reason = 'Query in flight';
    } else if (lane.state === 'access') {
      status = 'unmet';
      reason = 'Employer must invoke gated source';
    } else if (lane.state === 'blocked') {
      status = 'blocking';
      reason = 'Adverse finding — requires manual review';
    } else {
      status = r.required ? 'unmet' : 'not_applicable';
      reason = r.required ? 'No source data yet' : 'Not required for this role';
    }

    return { rule: r, status, reason, tier, lane };
  });

  const required = checks.filter(c => c.rule.required);
  const metReq   = required.filter(c => c.status === 'met').length;
  const pendingReq = required.filter(c => c.status === 'pending').length;
  const unmetReq   = required.filter(c => c.status === 'unmet').length;
  const blockingReq = required.filter(c => c.status === 'blocking').length;

  const ready = unmetReq === 0 && pendingReq === 0 && blockingReq === 0;
  const progressPct = required.length === 0 ? 0 : Math.round((metReq / required.length) * 100);

  return {
    ready,
    progressPct,
    counts: {
      required: required.length,
      met: metReq,
      pending: pendingReq,
      unmet: unmetReq,
      blocking: blockingReq,
    },
    checks,
    ruleset: ACCEPTANCE_RULESET,
  };
}
window.evaluateAcceptance = evaluateAcceptance;

// ========= WAVE 9 · CREDENTIALING FILE =========
// Official file identity (foliated cover sheet metadata)
const FILE_META = {
  id: 'VCV-CF-2026-000841',
  version: 3,
  opened: '2026-02-11',
  lastRevised: '2026-04-23 09:14 UTC',
  custodian: 'VitalCV Trust Registry · Node 202',
  privileged: true,
  custodianOrg: 'Cedar Health System · Medical Staff Office',
  recordType: 'Initial Appointment · Allied Health Professional',
  reviewCycle: '24 months · NCQA CR §3 re-credentialing',
  classification: 'CONFIDENTIAL · PEER-REVIEW PRIVILEGED',
};
window.FILE_META = FILE_META;

// Attestation questionnaire — mirrors NCQA CR 3 §B.6 + TJC MS.06.01.03
const ATTESTATION_QUESTIONS = [
  { id: 'Q1', q: 'I am mentally and physically able to perform the essential functions of the privileges requested, with or without reasonable accommodation.', answer: 'yes', material: false },
  { id: 'Q2', q: 'I do not have any current impairment (chemical, physical, or mental) that could affect my ability to practice with reasonable skill and safety.', answer: 'yes', material: false },
  { id: 'Q3', q: 'My professional license, DEA registration, or any other practice credential has never been denied, suspended, revoked, limited, restricted, or voluntarily relinquished.', answer: 'yes', material: true },
  { id: 'Q4', q: 'I have never been denied membership, privileges, or reappointment at any hospital, health plan, or professional organization.', answer: 'yes', material: true },
  { id: 'Q5', q: 'I have never been the subject of a malpractice claim, settlement, judgment, or pending action.',                                                 answer: 'no',  material: true, explanation: 'One closed claim: settled without admission of liability · 2023 · $18,000 indemnity · carrier notified. Details in attachment A-3.' },
  { id: 'Q6', q: 'I have never been convicted of, pleaded guilty to, or received deferred adjudication for any felony, misdemeanor (other than minor traffic), or Medicare/Medicaid-related offense.', answer: 'yes', material: true },
  { id: 'Q7', q: 'I authorize Cedar Health System and its designated credentialing verification organization (VitalCV, Inc.) to obtain any information — from any source — bearing upon my qualifications.', answer: 'authorized', material: false },
  { id: 'Q8', q: 'I certify that all information submitted in this application is true, complete, and current as of the date signed. I understand that misrepresentation or omission constitutes cause for denial or termination.', answer: 'certified', material: false },
];
window.ATTESTATION_QUESTIONS = ATTESTATION_QUESTIONS;

// Missing / incomplete fields — ledger-style, with owner + due date
const MISSING_FIELDS = [
  { id: 'MF-01', section: 'Licensure',     field: 'CA PA License · Primary-Source Verification',  owner: 'Employer',  due: '2026-04-28', priority: 'required', note: 'Authenticated PSV not yet invoked from CA Medical Board feed.' },
  { id: 'MF-02', section: 'Adverse',       field: 'NPDB Self-Query · current (≤180d)',            owner: 'Employer',  due: '2026-04-28', priority: 'required', note: 'Employer must request NPDB query with signed data-use authorization.' },
  { id: 'MF-03', section: 'Identity',      field: 'Government photo ID · back image',             owner: 'Clinician', due: '2026-04-25', priority: 'required', note: 'Front uploaded 2026-02-14. Back image missing.' },
  { id: 'MF-04', section: 'Insurance',     field: 'Current Certificate of Insurance (COI)',       owner: 'Clinician', due: '2026-04-26', priority: 'required', note: 'Last COI on file expires 2026-05-31. Need renewal.' },
  { id: 'MF-05', section: 'Education',     field: 'Medical school final transcript',              owner: 'Clinician', due: '2026-04-30', priority: 'optional', note: 'Degree verified via registrar attestation; transcript supplementary.' },
  { id: 'MF-06', section: 'Work History',  field: 'Employment gap · Jun 2023 – Sep 2023',         owner: 'Clinician', due: '2026-04-25', priority: 'required', note: 'Any gap > 30 days requires written explanation per NCQA CR 3 §B.5.' },
  { id: 'MF-07', section: 'References',    field: 'Peer reference · third clinical attester',     owner: 'Clinician', due: '2026-05-02', priority: 'required', note: 'Two of three references received. Third reminder sent 2026-04-20.' },
];
window.MISSING_FIELDS = MISSING_FIELDS;

// Table of contents — section index for the file view
const FILE_TOC = [
  { id: 'cover',        n: '§1', label: 'Cover Sheet',                  pages: '1'     },
  { id: 'applicant',    n: '§2', label: 'Applicant Identification',     pages: '2–3'   },
  { id: 'readiness',    n: '§3', label: 'Readiness & Trust Summary',    pages: '4–5'   },
  { id: 'psv',          n: '§4', label: 'Primary-Source Verifications', pages: '6–11'  },
  { id: 'attestation',  n: '§5', label: 'Attestation & Authorization',  pages: '12–13' },
  { id: 'missing',      n: '§6', label: 'Outstanding Items',            pages: '14'    },
  { id: 'chain',        n: '§7', label: 'Chain of Custody · Audit Log', pages: '15–16' },
  { id: 'seal',         n: '§8', label: 'Signatures & Seals',           pages: '17'    },
];
window.FILE_TOC = FILE_TOC;

// Audit log entries — chain of custody
const AUDIT_LOG = [
  { t: '2026-02-11 16:02 UTC', actor: 'Miller, Macie',    role: 'Clinician',   event: 'File opened · identity verified vs NPPES' },
  { t: '2026-02-11 16:03 UTC', actor: 'VitalCV Registry', role: 'System',      event: 'File ID issued · VCV-CF-2026-000841 · v1' },
  { t: '2026-02-14 09:31 UTC', actor: 'Miller, Macie',    role: 'Clinician',   event: 'Government ID (front) uploaded' },
  { t: '2026-03-02 14:07 UTC', actor: 'VitalCV Registry', role: 'System',      event: 'OIG/LEIE monthly ingest · no match · CLEAR' },
  { t: '2026-04-18 14:22 UTC', actor: 'Miller, Macie',    role: 'Clinician',   event: 'Application snapshot sealed · forwarded to Cedar Health' },
  { t: '2026-04-18 14:24 UTC', actor: 'Okafor, Jordan',   role: 'Credentialer',event: 'Packet opened · review commenced' },
  { t: '2026-04-20 11:15 UTC', actor: 'Okafor, Jordan',   role: 'Credentialer',event: 'Reference reminder dispatched · outstanding peer attester' },
  { t: '2026-04-23 09:10 UTC', actor: 'Okafor, Jordan',   role: 'Credentialer',event: 'MSO board review scheduled · May 2026 meeting' },
];
window.AUDIT_LOG = AUDIT_LOG;

// ========= WAVE 10 · THE APPLICATION (intake packet) =========
// Modeled on CAQH ProView / ECFMG / TJC intake. A packet of numbered sections,
// each with field groups, required markers, and per-section attestation.

const APPLICATION_META = {
  id: 'VCV-APP-2026-000841',
  opened: '2026-02-11',
  lastSaved: '2026-04-18 14:18 UTC',
  submittedAt: '2026-04-18 14:22 UTC',
  submittedBy: 'Miller, Macie · PA-C',
  status: 'submitted', // 'draft' | 'submitted' | 'under_review'
  lockAt: '2026-04-18 14:22 UTC',
  applicationType: 'Initial Appointment · Allied Health Professional',
  organization: 'Cedar Health System · Medical Staff Office',
  packetVersion: 'CAQH-aligned · v2026.Q1',
};
window.APPLICATION_META = APPLICATION_META;

// Helper — field tuple: { id, label, value, required, note, redline }
const F = (id, label, value, opts = {}) => ({ id, label, value, required: !!opts.required, note: opts.note, redline: opts.redline, status: opts.status || (value == null || value === '' ? 'empty' : 'attested') });

const APPLICATION_SECTIONS = [
  {
    id: 'A', n: '§A', label: 'Identification',
    subtitle: 'Legal identity, federal enumeration, and government-issued references.',
    groups: [
      { id: 'A.1', label: 'Legal Name', fields: [
        F('A.1.a', 'Last name',  'Miller',    { required: true }),
        F('A.1.b', 'First name', 'Macie',     { required: true }),
        F('A.1.c', 'Middle name', 'Elizabeth'),
        F('A.1.d', 'Suffix',     ''),
        F('A.1.e', 'Credentials', 'PA-C',     { required: true }),
      ]},
      { id: 'A.2', label: 'Aliases / Maiden / Prior', fields: [
        F('A.2.a', 'Prior or maiden name', '— none declared —'),
      ]},
      { id: 'A.3', label: 'Federal & Government References', fields: [
        F('A.3.a', 'NPI (Type 1)',       '1346053246',        { required: true, note: 'Verified · NPPES' }),
        F('A.3.b', 'DEA number',         'BM0349127',         { required: true, note: 'Active · Schedules II–V · exp 2027-03-31' }),
        F('A.3.c', 'Medicare PTAN',      'CA-PA-88491',       { required: true }),
        F('A.3.d', 'Medicaid ID (CA)',   'CA-MED-22104551',   { required: true }),
      ]},
      { id: 'A.4', label: 'Personal', fields: [
        F('A.4.a', 'Date of birth',      '—— · ——— · ——  (on file · redacted)', { required: true, note: 'Stored encrypted · not printed' }),
        F('A.4.b', 'SSN · last 4',       '•••• 4127',          { required: true, note: 'Hash-matched to NPDB query' }),
        F('A.4.c', 'Place of birth',     'Sacramento, CA · USA'),
        F('A.4.d', 'Gender',             'Female'),
        F('A.4.e', 'Citizenship',        'United States · native-born',   { required: true }),
      ]},
    ],
  },
  {
    id: 'B', n: '§B', label: 'Contact & Practice Addresses',
    subtitle: 'Primary practice, mailing, and correspondence addresses.',
    groups: [
      { id: 'B.1', label: 'Primary Practice Address', fields: [
        F('B.1.a', 'Organization', 'Cedar Health System · Cardiology Clinic 4',  { required: true }),
        F('B.1.b', 'Street',       '2400 N. Elm Avenue, Suite 310',               { required: true }),
        F('B.1.c', 'City · State · ZIP', 'Los Angeles, CA  90033',                { required: true }),
        F('B.1.d', 'Phone',        '(213) 555-0142',                              { required: true }),
        F('B.1.e', 'Office fax',   '(213) 555-0188'),
      ]},
      { id: 'B.2', label: 'Correspondence / Mailing', fields: [
        F('B.2.a', 'Mailing address', 'Same as practice'),
        F('B.2.b', 'Email',          'macie.miller@cedarhs.org',                  { required: true }),
        F('B.2.c', 'Mobile',         '(213) 555-0199'),
      ]},
    ],
  },
  {
    id: 'C', n: '§C', label: 'Education & Training',
    subtitle: 'Professional school and postgraduate training. PSV source: Registrar direct.',
    groups: [
      { id: 'C.1', label: 'Undergraduate', fields: [
        F('C.1.a', 'Institution',   'University of California, Davis',          { required: true }),
        F('C.1.b', 'Degree',        'B.S. Biological Sciences',                 { required: true }),
        F('C.1.c', 'Dates',         'Aug 2013 – May 2017',                      { required: true }),
      ]},
      { id: 'C.2', label: 'Professional School', fields: [
        F('C.2.a', 'Institution',   'Stanford University · School of Medicine', { required: true, note: 'PSV via Registrar · attested 2026-02-22' }),
        F('C.2.b', 'Program',       'Master of Science · Physician Assistant Studies', { required: true }),
        F('C.2.c', 'Dates',         'Aug 2019 – Jun 2022',                      { required: true }),
        F('C.2.d', 'Final transcript', 'Pending — registrar responded with attestation in lieu', { note: 'Supplementary only. Does not block acceptance.', status: 'pending' }),
      ]},
      { id: 'C.3', label: 'Postgraduate Training', fields: [
        F('C.3.a', 'Program',       'UCLA Medical Center · Postgraduate PA Fellowship (Cardiology)', { required: true }),
        F('C.3.b', 'Dates',         'Jul 2022 – Jun 2023',                      { required: true }),
        F('C.3.c', 'Program director', 'Aditi Rao, MD',                         { required: true }),
      ]},
    ],
  },
  {
    id: 'D', n: '§D', label: 'Licensure & Certifications',
    subtitle: 'Active, pending, and historical credentials. PSV source: Primary issuing authority.',
    groups: [
      { id: 'D.1', label: 'State Professional Licenses', fields: [
        F('D.1.a', 'State',          'California',                                       { required: true }),
        F('D.1.b', 'License number', 'PA-052987',                                        { required: true, note: 'Active · in good standing · PSV pending re-query' }),
        F('D.1.c', 'Issued / expires', '2023-04-14 · 2027-04-30',                        { required: true }),
        F('D.1.d', 'Disciplinary actions', 'None on file (verified CA Medical Board)', { required: true }),
      ]},
      { id: 'D.2', label: 'DEA Registration', fields: [
        F('D.2.a', 'DEA number',     'BM0349127',                                        { required: true }),
        F('D.2.b', 'Schedules',      'II · III · IV · V',                                { required: true }),
        F('D.2.c', 'Expires',        '2027-03-31',                                       { required: true }),
      ]},
      { id: 'D.3', label: 'Board Certifications', fields: [
        F('D.3.a', 'Certifying body', 'NCCPA',                                          { required: true }),
        F('D.3.b', 'Specialty',       'Physician Assistant · CAQ Cardiovascular',       { required: true, note: 'Primary-sealed T4 via NCCPA feed' }),
        F('D.3.c', 'Issued / expires', '2022-08-12 · 2032-08-12',                        { required: true }),
      ]},
      { id: 'D.4', label: 'Life Support', fields: [
        F('D.4.a', 'BLS',            'AHA · exp 2027-02-28',                             { required: true }),
        F('D.4.b', 'ACLS',           'AHA · exp 2027-02-28',                             { required: true }),
      ]},
    ],
  },
  {
    id: 'E', n: '§E', label: 'Work History',
    subtitle: 'Chronological, back 10 years. Gaps longer than 30 days require written explanation (NCQA CR 3 §B.5).',
    groups: [
      { id: 'E.1', label: '2023-09 – Present · Cedar Health System', fields: [
        F('E.1.a', 'Role',          'Physician Assistant · Cardiology',                  { required: true }),
        F('E.1.b', 'Supervisor',    'Daniel Chen, MD · Chief of Cardiology',             { required: true }),
        F('E.1.c', 'Reason for seeking appointment', 'Privileges refresh per 24-month cycle'),
      ]},
      { id: 'E.2', label: '2022-07 – 2023-06 · UCLA Medical Center (Fellow)', fields: [
        F('E.2.a', 'Role',          'PA Fellow · Cardiology',                            { required: true }),
        F('E.2.b', 'Supervisor',    'Aditi Rao, MD',                                     { required: true }),
      ]},
      { id: 'E.3', label: 'Gap · 2023-06 – 2023-09 (3 months)', fields: [
        F('E.3.a', 'Explanation',   'Relocation from Westwood to Echo Park; family medical leave (parent). No clinical practice during this interval.', { required: true, note: 'Attested 2026-02-14 · accepted per NCQA CR 3 §B.5', status: 'attested' }),
      ]},
    ],
  },
  {
    id: 'F', n: '§F', label: 'Hospital Affiliations',
    subtitle: 'Current and past 10 years. Include any denied, suspended, or non-renewed appointments.',
    groups: [
      { id: 'F.1', label: 'Current', fields: [
        F('F.1.a', 'Facility',      'Cedar Health System',                                { required: true }),
        F('F.1.b', 'Department',    'Cardiology',                                         { required: true }),
        F('F.1.c', 'Status',        'Active · Allied Health Professional',                { required: true }),
        F('F.1.d', 'Appointment',   '2023-09-12 – present',                               { required: true }),
      ]},
      { id: 'F.2', label: 'Past (10 years)', fields: [
        F('F.2.a', 'UCLA Medical Center', 'Fellow · 2022-07 – 2023-06 · in good standing at exit'),
      ]},
      { id: 'F.3', label: 'Denials / Suspensions / Non-renewals', fields: [
        F('F.3.a', 'Any such event?', 'No',                                               { required: true }),
      ]},
    ],
  },
  {
    id: 'G', n: '§G', label: 'Malpractice Insurance & Claims',
    subtitle: 'Current professional liability coverage and historical claims, settlements, and judgments.',
    groups: [
      { id: 'G.1', label: 'Current Coverage', fields: [
        F('G.1.a', 'Carrier',       'The Doctors Company',                                { required: true }),
        F('G.1.b', 'Policy number', 'TDC-PA-558827',                                      { required: true }),
        F('G.1.c', 'Limits',        '$1M / $3M · claims-made',                            { required: true }),
        F('G.1.d', 'Effective / expires', '2025-06-01 · 2026-05-31',                      { required: true, note: 'Renewal COI outstanding — see §6 Outstanding Items', status: 'pending' }),
      ]},
      { id: 'G.2', label: 'Claims · Settlements · Judgments', fields: [
        F('G.2.a', 'Any history?',  'Yes · 1 closed claim',                               { required: true }),
        F('G.2.b', 'Closed claim · 2023',
           'Allegation: delayed diagnosis. Settled 2023-11 · $18,000 indemnity · no admission of liability. Attachment A-3.',
           { required: true, note: 'Material disclosure · linked to Q5 attestation' }),
      ]},
    ],
  },
  {
    id: 'H', n: '§H', label: 'Disclosure Questions',
    subtitle: 'Material disclosures under penalty of perjury. Yes/No with required explanation on material items. Mirrors §5 Attestation of the credentialing file.',
    disclosureSection: true, // render Q1-Q8 from ATTESTATION_QUESTIONS
  },
  {
    id: 'I', n: '§I', label: 'Peer References',
    subtitle: 'Three clinical attesters, independent of applicant’s direct supervisory chain.',
    groups: [
      { id: 'I.1', label: 'Reference 1', fields: [
        F('I.1.a', 'Name',      'Priya Nair, MD',               { required: true, note: 'Received 2026-03-04' }),
        F('I.1.b', 'Relation',  'Colleague · 3 yrs',            { required: true }),
        F('I.1.c', 'Contact',   'priya.nair@ucla.edu',          { required: true }),
      ]},
      { id: 'I.2', label: 'Reference 2', fields: [
        F('I.2.a', 'Name',      'Samuel Greene, PA-C',          { required: true, note: 'Received 2026-03-11' }),
        F('I.2.b', 'Relation',  'Fellow peer · 2 yrs',          { required: true }),
        F('I.2.c', 'Contact',   's.greene@cedarhs.org',         { required: true }),
      ]},
      { id: 'I.3', label: 'Reference 3', fields: [
        F('I.3.a', 'Name',      'Rafael Ortega, MD',            { required: true, note: 'Outstanding · 3rd reminder 2026-04-20', status: 'pending' }),
        F('I.3.b', 'Relation',  'Attending · rotation',         { required: true }),
        F('I.3.c', 'Contact',   'r.ortega@cedarhs.org',         { required: true }),
      ]},
    ],
  },
  {
    id: 'J', n: '§J', label: 'Release & Signature',
    subtitle: 'Final release authorizing primary-source verification, consent to peer review, and certification of accuracy.',
    releaseSection: true,
  },
];
window.APPLICATION_SECTIONS = APPLICATION_SECTIONS;

// Compute completion stats per section
function computeSectionCompletion(section) {
  if (section.disclosureSection) {
    return { total: ATTESTATION_QUESTIONS.length, complete: ATTESTATION_QUESTIONS.length, pct: 100 };
  }
  if (section.releaseSection) {
    return { total: 1, complete: 1, pct: 100 };
  }
  const fields = (section.groups || []).flatMap(g => g.fields);
  const required = fields.filter(f => f.required);
  const complete = required.filter(f => f.status === 'attested').length;
  const total = required.length || fields.length || 1;
  const actualComplete = required.length ? complete : fields.filter(f => f.value).length;
  return { total, complete: actualComplete, pct: Math.round((actualComplete / total) * 100) };
}
window.computeSectionCompletion = computeSectionCompletion;

// ========= WAVE 11 · COMMITTEE REVIEW =========
// The ceremonial artifact: packet bundled, sealed, presented to the MSO
// Credentials Committee. This is what the committee chair reads from.

const COMMITTEE_MEETING = {
  body: 'Credentials Committee of the Medical Staff',
  organization: 'Cedar Health System',
  chapter: 'Medical Staff Bylaws · Article VI §3',
  meetingDate: '2026-05-14',
  meetingTime: '07:00 PT',
  location: 'MSO Conference Room 4A · teleconference dial-in',
  docket: 'DKT-2026-05-014',
  itemNo: '3',
  itemTotal: '11',
  quorumRequired: 5,
  quorumType: 'majority of voting members',
  chair: 'Helene Trang, MD · Chief of Medical Staff',
  secretary: 'Jordan Okafor · Credentialing Specialist',
};
window.COMMITTEE_MEETING = COMMITTEE_MEETING;

const COMMITTEE_ROSTER = [
  { name: 'Helene Trang, MD',    role: 'Chair · Chief of Medical Staff',       voting: true,  present: true,  recused: false },
  { name: 'Daniel Chen, MD',     role: 'Cardiology (recused · supervises)',    voting: true,  present: true,  recused: true  },
  { name: 'Priya Nair, MD',      role: 'Internal Medicine',                    voting: true,  present: true,  recused: false },
  { name: 'Oluwaseun Bello, MD', role: 'Emergency Medicine',                   voting: true,  present: true,  recused: false },
  { name: 'Rafael Ortega, MD',   role: 'Anesthesiology',                       voting: true,  present: false, recused: false },
  { name: 'Mei-Lin Chen, PA-C',  role: 'Allied Health representative',         voting: true,  present: true,  recused: false },
  { name: 'Jordan Okafor',       role: 'Secretary · Credentialing Specialist', voting: false, present: true,  recused: false },
];
window.COMMITTEE_ROSTER = COMMITTEE_ROSTER;

// The CVO's recommendation — what VitalCV, as delegated CVO, recommends to the committee
const CVO_RECOMMENDATION = {
  status: 'approve_with_conditions', // 'approve' | 'approve_with_conditions' | 'defer' | 'deny'
  headline: 'Recommend: APPROVE WITH CONDITIONS',
  conditions: [
    { id: 'C1', text: 'Outstanding COI renewal shall be received within 30 days of appointment. Failure to file by 2026-06-13 triggers automatic administrative suspension under Bylaws Article VIII §2.' },
    { id: 'C2', text: 'Third peer reference (Ortega) to be received within 14 days. Committee may ratify appointment conditional on receipt; MSO Secretary authorized to accept.' },
    { id: 'C3', text: 'Material disclosure in §H Q5 (closed malpractice claim, 2023) is deemed disclosed, investigated, and resolved. No further action required.' },
  ],
  findingOfFact: [
    'Applicant is a physician assistant, NCCPA-certified with CAQ in Cardiovascular medicine, actively licensed in California (PA-052987, exp 2027-04-30), in good standing.',
    'Primary-source verification was completed against NPPES (identity), OIG/LEIE (sanctions, 2026-03-02 clear), PECOS (Medicare enrollment, active), NPDB (self-query requested, response pending ≤7 days), and NCCPA (certification, primary-sealed T4).',
    'Employment history attested complete; 3-month gap in 2023 (relocation, family medical leave) explained in writing and accepted under NCQA CR 3 §B.5.',
    'One closed malpractice claim (2023, settled $18,000, no admission of liability) fully disclosed in §H Q5. No open claims. Current professional liability coverage $1M/$3M through The Doctors Company, in force through 2026-05-31 (renewal pending).',
    'Two of three peer attestations received (Nair, MD; Greene, PA-C), both unreservedly positive. Third reference (Ortega, MD) outstanding as of memorandum date.',
  ],
  basis: 'NCQA CR §3 (Credentialing and Recredentialing) · NCQA CR §4.2 (Delegated Credentialing) · TJC MS.06.01.03 · Cedar Health Medical Staff Bylaws Article VI',
};
window.CVO_RECOMMENDATION = CVO_RECOMMENDATION;

// Exhibits — every artifact cross-linked by letter/number, with fingerprint
const COMMITTEE_EXHIBITS = [
  { id: 'A-1', label: 'Application Packet',            ref: 'VCV-APP-2026-000841', pages: 13, fingerprint: '0x6a12…d74c' },
  { id: 'A-2', label: 'Primary-Source Verification Report', ref: 'VCV-PSV-2026.04', pages: 6,  fingerprint: '0x01b4…fe29' },
  { id: 'A-3', label: 'Malpractice Claim Disclosure (2023)', ref: 'ATT-A3-2023-11', pages: 4,  fingerprint: '0xc731…88aa' },
  { id: 'A-4', label: 'Attestation & Authorization',   ref: 'VCV-ATT-2026-000841', pages: 2,  fingerprint: '0xb9c4…fa17' },
  { id: 'A-5', label: 'Peer References · 2 of 3 received', ref: 'REF-NAIR · REF-GREENE', pages: 3, fingerprint: '0x4fe2…0091' },
  { id: 'A-6', label: 'Chain of Custody · Audit Log',  ref: 'VCV-CF-2026-000841 §7', pages: 2, fingerprint: ACCEPTANCE_RECEIPT.merkleRoot || '0xa1…merkle' },
  { id: 'A-7', label: 'Privileges Requested · PA Cardiology track', ref: 'PRIV-PA-CARD-2026', pages: 2, fingerprint: '0x88fe…1dc4' },
];
window.COMMITTEE_EXHIBITS = COMMITTEE_EXHIBITS;

function committeeReadiness(gate) {
  // Ready when: acceptance gate is ready (or ready-with-conditions is acceptable)
  // and the required exhibits are assembled.
  const unmet = gate ? Math.max(0, gate.counts.required - gate.counts.met - gate.counts.pending) : 0;
  if (gate && gate.counts.blocking > 0) return { status: 'blocked', label: 'Blocked · adverse finding' };
  if (unmet === 0) return { status: 'ready', label: 'Ready for committee review' };
  if (unmet <= 2)  return { status: 'ready_conditional', label: 'Ready with conditions' };
  return { status: 'pending', label: 'Assembling packet' };
}
window.committeeReadiness = committeeReadiness;
