// WAVE 14 · Start-Activation Console (Credentialing Mode)
// Day-1 Readiness data — what happens AFTER acceptance.

const ACTIVATION_CASE = {
  id: 'VCV-START-2026-000841',
  clinician: 'Macie Miller, PA-C',
  npi: '1346053246',
  facility: 'Cedar Health · Surgical Pavilion',
  facilityCode: 'CED-SP',
  startDate: '2026-05-21',                  // target
  startDateLabel: 'May 21, 2026',
  acceptedAt: '2026-04-23 09:14 UTC',
  // ETAs are predictive ranges, never single point
  dtsEstimate: { p10: 17, p50: 21, p90: 28, baseline: 47 }, // baseline = facility historical median
  dtsTrend: [29, 27, 26, 24, 23, 22, 21],   // p50 estimate over last 7 days (burn-down)
  daysSinceAccept: 5,
};
window.ACTIVATION_CASE = ACTIVATION_CASE;

// Critical-path stages — parallel tracks roll up to four milestones
const CRITICAL_PATH = [
  {
    id: 'accepted',
    label: 'Accepted',
    sub: 'File approved by Credentials Committee',
    state: 'done',
    completedAt: '2026-04-23 09:14 UTC',
    owner: 'Credentials Committee',
    receiptId: 'vc2:cmt:0xb19c…7411',
  },
  {
    id: 'privileged',
    label: 'Privileged',
    sub: 'Facility-specific clinical privileges granted',
    state: 'in_progress',
    eta: 'May 06',
    owner: 'Department Chair · Surgery',
    progress: 0.72,
    parallelTracks: ['privileges', 'compliance'],
  },
  {
    id: 'enrolled',
    label: 'Enrolled',
    sub: 'Medicare/Medicaid + commercial payer enrollment',
    state: 'in_progress',
    eta: 'May 14',
    owner: 'Payer Enrollment Specialist',
    progress: 0.40,
    parallelTracks: ['payers'],
  },
  {
    id: 'cleared',
    label: 'Cleared to Schedule',
    sub: 'Onboarding complete · clinician on the schedule',
    state: 'pending',
    eta: 'May 21',
    owner: 'Medical Staff Office',
    progress: 0,
    parallelTracks: ['onboarding'],
  },
];
window.CRITICAL_PATH = CRITICAL_PATH;

// Privilege requirements — facility specific
// status: granted | proctoring | training | denied | pending_review
const PRIVILEGES = [
  {
    id: 'priv-cv1',
    name: 'Central venous catheterization',
    category: 'Core · Surgery PA',
    bylaws: 'CED Bylaws §IV.3.b',
    fppe: 'FPPE Plan §2.1',
    status: 'proctoring',
    counter: { current: 2, required: 5, unit: 'proctored procedures' },
    proctor: 'Dr. Lin · Vascular Surgery',
    nextProctored: '2026-04-29',
    note: 'On track. 3 procedures remaining within 90-day FPPE window.',
  },
  {
    id: 'priv-rsi',
    name: 'Rapid sequence intubation',
    category: 'Advanced',
    bylaws: 'CED Bylaws §IV.3.c',
    fppe: 'FPPE Plan §2.2',
    status: 'training',
    counter: { current: 0, required: 1, unit: 'completed simulation course' },
    proctor: '—',
    nextProctored: 'Course May 02',
    note: 'Simulation lab booked. Privilege deferred until course completion.',
  },
  {
    id: 'priv-firstassist',
    name: 'First-assist · open laparotomy',
    category: 'Core · Surgery PA',
    bylaws: 'CED Bylaws §IV.3.a',
    fppe: 'FPPE Plan §2.0',
    status: 'granted',
    counter: { current: 4, required: 4, unit: 'documented assists · external' },
    proctor: '—',
    note: 'Granted at committee. NPDB & external case-log review satisfied requirement.',
    grantedAt: '2026-04-23',
  },
  {
    id: 'priv-prescribing',
    name: 'Schedule II prescribing · floor',
    category: 'Restricted · DEA-bound',
    bylaws: 'CED Bylaws §IV.4',
    fppe: 'OPPE Plan §1.0',
    status: 'pending_review',
    counter: { current: 1, required: 1, unit: 'DEA registration on file' },
    proctor: 'Pharmacy & Therapeutics',
    note: 'P&T review scheduled May 06. DEA Schedule II–V active.',
  },
  {
    id: 'priv-sedation',
    name: 'Moderate sedation',
    category: 'Advanced · facility-controlled',
    bylaws: 'CED Bylaws §IV.5',
    fppe: 'Sedation Cmte §3.2',
    status: 'denied',
    counter: { current: 0, required: 1, unit: 'Sedation course (institution-specific)' },
    proctor: 'Sedation Committee',
    note: 'Not requested at this appointment. May be added in 12-month re-privileging cycle.',
  },
];
window.PRIVILEGES = PRIVILEGES;

// Payer enrollment matrix
// status: enrolled | submitted | preparing | not_started | waiting_carrier | rejected
const PAYERS = [
  { id: 'medicare',  name: 'Medicare · PECOS reassignment', kind: 'Federal', status: 'enrolled',     submittedAt: '2026-04-24', effectiveAt: '2026-04-24', sor: true,  ptan: 'CA-IND-PA-58129', note: 'Reassigned to Cedar Health TIN 47-2913004. Real-time PECOS confirmation.' },
  { id: 'medicaid',  name: 'Medi-Cal',                       kind: 'State',   status: 'submitted',    submittedAt: '2026-04-25', effectiveAt: null,         sor: true,  ptan: 'pending',         note: 'Submitted via PAVE 3.0. Carrier ETA 8–14 business days.' },
  { id: 'tricare',   name: 'TRICARE West (HNFS)',            kind: 'Federal', status: 'submitted',    submittedAt: '2026-04-25', effectiveAt: null,         sor: false, ptan: '—',                note: 'Roster submission · awaiting carrier acknowledgment.' },
  { id: 'aetna',     name: 'Aetna',                           kind: 'Commercial', status: 'preparing', submittedAt: null,         effectiveAt: null,         sor: false, ptan: '—',                note: 'Form J-1 pre-populated from passport. 2 docs awaiting clinician signature.' },
  { id: 'uhc',       name: 'UnitedHealthcare',                kind: 'Commercial', status: 'waiting_carrier', submittedAt: '2026-04-23', effectiveAt: null,    sor: false, ptan: '—',                note: 'CAQH attestation refreshed. Carrier in 21-day review window.' },
  { id: 'bcbs',      name: 'Anthem Blue Cross',               kind: 'Commercial', status: 'submitted', submittedAt: '2026-04-24', effectiveAt: null,         sor: false, ptan: '—',                note: 'Delegated roster · monthly cycle close May 03.' },
  { id: 'kaiser',    name: 'Kaiser Permanente',               kind: 'Commercial', status: 'rejected',  submittedAt: '2026-04-22', effectiveAt: null,         sor: false, ptan: '—',                note: 'Rejected · Tax ID mismatch on W-9. Re-submitted 2026-04-25 09:18.', actionable: true },
  { id: 'cigna',     name: 'Cigna',                           kind: 'Commercial', status: 'not_started', submittedAt: null,        effectiveAt: null,         sor: false, ptan: '—',                note: 'Out-of-network for facility. No enrollment required.' },
];
window.PAYERS = PAYERS;

// Onboarding tasks (the "Cleared to Schedule" track)
const ONBOARDING_TASKS = [
  { id: 'tb',           label: 'TB · 2-step PPD',                 owner: 'Employee Health',      state: 'done',        dueAt: 'Apr 24', completedAt: 'Apr 24', standard: 'CDC · TJC IC.02.04.01' },
  { id: 'imm',          label: 'Immunization compliance',         owner: 'Employee Health',      state: 'done',        dueAt: 'Apr 25', completedAt: 'Apr 25', standard: 'TJC IC.02.04.01' },
  { id: 'drug',         label: 'Pre-employment drug screen',      owner: 'HR · Compliance',      state: 'in_progress', dueAt: 'Apr 28', standard: '49 CFR Part 40 (analogue)' },
  { id: 'fingerprint',  label: 'Live Scan · DOJ/FBI',             owner: 'HR · Compliance',      state: 'in_progress', dueAt: 'Apr 30', standard: 'CA Penal Code §11105' },
  { id: 'bls',          label: 'BLS / ACLS card on file',         owner: 'Education · Onboarding', state: 'in_progress', dueAt: 'May 01', standard: 'AHA · facility policy' },
  { id: 'epic',         label: 'Epic OpTime training · 4 hrs',    owner: 'IT · Training',        state: 'in_progress', dueAt: 'May 03', standard: 'Facility EMR policy' },
  { id: 'badging',      label: 'Badge & access provisioning',     owner: 'Security',             state: 'pending',     dueAt: 'May 05', standard: 'TJC EC.02.01.01' },
  { id: 'osha',         label: 'OSHA bloodborne pathogens',       owner: 'Education · Onboarding', state: 'pending',   dueAt: 'May 05', standard: '29 CFR 1910.1030' },
  { id: 'peer',         label: 'Peer references (3)',             owner: 'MSO',                  state: 'in_progress', dueAt: 'May 08', standard: 'NCQA CR §3.4', subprogress: { collected: 2, required: 3 } },
  { id: 'fppe',         label: 'FPPE plan execution starts',      owner: 'Department Chair',     state: 'pending',     dueAt: 'May 21', standard: 'TJC MS.08.01.01' },
];
window.ONBOARDING_TASKS = ONBOARDING_TASKS;

// Owner handoff timeline
const HANDOFFS = [
  {
    from: { name: 'VitalCV CVO',           role: 'Verification Engine',        kind: 'system' },
    to:   { name: 'Vivian Chen, MD',       role: 'Credentials Reviewer · Cedar', kind: 'human' },
    at: '2026-04-18 14:32 UTC',
    artifact: 'Credentialing File · VCV-CF-2026-000841',
    receipt: 'vc2:handoff:0xa11c…3398',
  },
  {
    from: { name: 'Vivian Chen, MD',       role: 'Credentials Reviewer · Cedar', kind: 'human' },
    to:   { name: 'Credentials Committee', role: 'CED Surgical Pavilion',         kind: 'committee' },
    at: '2026-04-22 16:00 UTC',
    artifact: 'Board Memorandum · MEMO-2026-0488',
    receipt: 'vc2:handoff:0xc742…11a2',
  },
  {
    from: { name: 'Credentials Committee', role: 'CED Surgical Pavilion',         kind: 'committee' },
    to:   { name: 'Karen Patel',           role: 'Onboarding/MSO Coordinator',    kind: 'human' },
    at: '2026-04-23 09:14 UTC',
    artifact: 'Privilege Letter · PRIV-2026-0488',
    receipt: 'vc2:handoff:0xd09f…0044',
    isCurrent: true,
  },
];
window.HANDOFFS = HANDOFFS;

// Status meta — privilege colors live in this surface only
const PRIV_STATUS_META = {
  granted:        { label: 'Granted',        cls: 'text-emerald-700 bg-emerald-50 ring-emerald-600/20', dot: 'bg-emerald-600' },
  proctoring:     { label: 'Proctoring',     cls: 'text-amber-800 bg-amber-50 ring-amber-600/20',     dot: 'bg-amber-500' },
  training:       { label: 'Training',       cls: 'text-indigo-700 bg-indigo-50 ring-indigo-600/20',  dot: 'bg-indigo-500' },
  pending_review: { label: 'Pending Review', cls: 'text-slate-700 bg-slate-100 ring-slate-300',       dot: 'bg-slate-400' },
  denied:         { label: 'Not Requested',  cls: 'text-slate-500 bg-white ring-slate-300',           dot: 'bg-slate-300' },
};
window.PRIV_STATUS_META = PRIV_STATUS_META;

const PAYER_STATUS_META = {
  enrolled:        { label: 'Enrolled',        cls: 'text-emerald-700 bg-emerald-50 ring-emerald-600/20', dot: 'bg-emerald-600' },
  submitted:       { label: 'Submitted',       cls: 'text-slate-700 bg-slate-100 ring-slate-300',       dot: 'bg-slate-500' },
  waiting_carrier: { label: 'In Carrier Review', cls: 'text-indigo-700 bg-indigo-50 ring-indigo-600/20', dot: 'bg-indigo-500' },
  preparing:       { label: 'Preparing',       cls: 'text-slate-600 bg-white ring-slate-300',           dot: 'bg-slate-400' },
  rejected:        { label: 'Rejected · Action', cls: 'text-rose-700 bg-rose-50 ring-rose-600/20',      dot: 'bg-rose-500' },
  not_started:     { label: 'Not in scope',     cls: 'text-slate-500 bg-white ring-slate-200',          dot: 'bg-slate-300' },
};
window.PAYER_STATUS_META = PAYER_STATUS_META;

const ONBOARD_STATUS_META = {
  done:        { label: 'Complete',    cls: 'text-emerald-700 bg-emerald-50 ring-emerald-600/20', dot: 'bg-emerald-600' },
  in_progress: { label: 'In Progress', cls: 'text-amber-800 bg-amber-50 ring-amber-600/20',     dot: 'bg-amber-500' },
  pending:     { label: 'Pending',     cls: 'text-slate-600 bg-slate-100 ring-slate-300',       dot: 'bg-slate-400' },
};
window.ONBOARD_STATUS_META = ONBOARD_STATUS_META;
