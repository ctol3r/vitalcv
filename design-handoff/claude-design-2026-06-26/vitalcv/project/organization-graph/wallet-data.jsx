// ════════════════════════════════════════════════════════════════════════
// WAVE 250 · CAREER WALLET — data model
// The clinician (Macie Miller, PA-C). Everything here projects from her owned,
// source-bound evidence ledger. Numbers are computed, never stored as a score.
// ════════════════════════════════════════════════════════════════════════

const W = {};

// ── The clinician ────────────────────────────────────────────────────────
W.CLINICIAN = {
  fullName: 'Macie Miller',
  upper: 'MACIE MILLER',
  credential: 'PA-C',
  role: 'Physician Assistant',
  specialty: 'Orthopedic Surgery',
  npi: '1346053246',
  enumerated: 'Jan 14, 2025',
  city: 'Irvine, CA',
  initials: 'MM',
  yearsInPractice: 1,
  walletId: 'VCV-WALLET-1346053246',
  walletOpened: 'Feb 11, 2025',
};

W.NOW = '2026-04-18 14:32 UTC';
W.NOW_DATE = 'Apr 18, 2026';

// ── Career Health — the one composite read at the top of the wallet ───────
// Not a stored score: a projection of how much of her verifiable career is
// currently standing on fresh, primary-source evidence.
W.CAREER_HEALTH = {
  state: 'building',            // building | conditional | strong
  label: 'Conditional Ready',
  pct: 68,                      // share of career standing on fresh verified evidence
  trend: '+6',                 // change over last 30d
  headline: 'Identity and standing are proven. One credential is expiring and two are still missing.',
  // The five questions the wallet answers in 60 seconds.
  answers: [
    { q: 'Who am I?',                key: 'identity', a: 'Macie Miller, PA-C', sub: 'NPI 1346053246 · verified at the federal registry', tone: 'verified', icon: 'User' },
    { q: 'What evidence do I have?', key: 'have',     a: '7 verified',         sub: 'identity, sanctions-clear, certification & more', tone: 'verified', icon: 'ShieldCheck' },
    { q: 'What am I missing?',       key: 'missing',  a: '2 missing · 3 expiring', sub: 'DEA registration and education PSV not on file', tone: 'pending', icon: 'AlertTri' },
    { q: 'How trusted am I?',        key: 'trust',    a: 'High on what is checked', sub: '4 of 6 trust dimensions strong', tone: 'verified', icon: 'Gauge' },
    { q: 'What should I do next?',   key: 'next',     a: 'Renew CA license',   sub: 'expires in 30 days — keeps Authority from decaying', tone: 'pending', icon: 'ArrowRight' },
  ],
};

// ── Evidence ledger ───────────────────────────────────────────────────────
// status: verified | pending | expiring | missing
// Every item is source-bound. tier is the authority ladder T1..T4.
W.EVIDENCE = [
  {
    id: 'identity', label: 'Identity', category: 'Identity',
    status: 'verified', tier: 'T4',
    source: 'NPPES', authority: 'CMS · National Plan & Provider Enumeration System',
    summary: 'Legal identity resolved to NPI at the federal registry.',
    checkedAt: 'Just now', issued: 'Jan 14, 2025', expires: null,
    cadence: 'Revalidated continuously · NPPES delta scan',
    receipt: 'vc2:nppes:0x8a41…c7d2',
    rows: [
      { k: 'Legal name', v: 'MILLER, MACIE' },
      { k: 'NPI', v: '1346053246', mono: true },
      { k: 'Entity type', v: 'Type 1 — Individual' },
      { k: 'Taxonomy', v: '363A00000X — Physician Assistant', mono: true },
      { k: 'Status', v: 'Active' },
    ],
  },
  {
    id: 'sanctions', label: 'Sanctions Clear', category: 'Standing',
    status: 'verified', tier: 'T4',
    source: 'OIG / LEIE', authority: 'HHS Office of Inspector General',
    summary: 'No exclusions found in the monthly federal dataset.',
    checkedAt: '6 days ago', issued: 'Apr 02, 2026', expires: 'May 02, 2026',
    cadence: 'Refreshed monthly · auto-rescans on dataset publish',
    receipt: 'vc2:oig:0x3f9d…b12a',
    rows: [
      { k: 'Dataset', v: 'LEIE monthly (Apr 2026)', mono: true },
      { k: 'Result', v: 'No match · cleared' },
      { k: 'Match rule', v: 'NPI + Last name + DOB' },
      { k: 'Checked', v: '2026-04-12 02:14 UTC', mono: true },
    ],
  },
  {
    id: 'boardcert', label: 'Board Certification', category: 'Certification',
    status: 'verified', tier: 'T4',
    source: 'NCCPA', authority: 'National Commission on Certification of PAs',
    summary: 'PA-C certification primary-sealed by the issuing body.',
    checkedAt: '12 days ago', issued: 'Aug 12, 2024', expires: 'Aug 12, 2034',
    cadence: 'Primary-sealed · 10-year cycle · CME tracked',
    receipt: 'vc2:nccpa:0x55a1…e0c4',
    rows: [
      { k: 'Certificate', v: 'PA-C · in good standing' },
      { k: 'Certifying body', v: 'NCCPA' },
      { k: 'Issued', v: '2024-08-12', mono: true },
      { k: 'Expires', v: '2034-08-12', mono: true },
      { k: 'Seal', v: 'T4 · primary-sealed' },
    ],
  },
  {
    id: 'taxonomy', label: 'Primary Taxonomy', category: 'Identity',
    status: 'verified', tier: 'T4',
    source: 'NPPES', authority: 'CMS · NPPES',
    summary: 'Physician Assistant taxonomy confirmed at source.',
    checkedAt: 'Just now', issued: 'Jan 14, 2025', expires: null,
    cadence: 'Bound to NPPES record',
    receipt: 'vc2:nppes:0x8a41…c7d2',
    rows: [
      { k: 'Taxonomy', v: '363A00000X — Physician Assistant', mono: true },
      { k: 'Source', v: 'NPPES · primary' },
    ],
  },
  {
    id: 'bls', label: 'BLS Certification', category: 'Life Support',
    status: 'verified', tier: 'T3',
    source: 'AHA', authority: 'American Heart Association',
    summary: 'Basic Life Support current.',
    checkedAt: '40 days ago', issued: 'Feb 28, 2025', expires: 'Feb 28, 2027',
    cadence: '2-year cycle',
    receipt: 'vc2:aha:0x71c0…44de',
    rows: [
      { k: 'Course', v: 'BLS Provider · AHA' },
      { k: 'Expires', v: '2027-02-28', mono: true },
    ],
  },
  {
    id: 'degree', label: 'Degree on Record', category: 'Education',
    status: 'verified', tier: 'T3',
    source: 'Registrar', authority: 'Western U. of Health Sciences',
    summary: 'MS, Physician Assistant Studies — registrar attestation.',
    checkedAt: '60 days ago', issued: 'May 2024', expires: null,
    cadence: 'One-time PSV · attestation in lieu of transcript',
    receipt: 'vc2:reg:0x2c91…aa30',
    rows: [
      { k: 'Degree', v: 'MS · Physician Assistant Studies' },
      { k: 'Institution', v: 'Western U. of Health Sciences' },
      { k: 'Conferred', v: '2024', mono: true },
      { k: 'Note', v: 'Final transcript supplementary — see Missing' },
    ],
  },
  {
    id: 'workhistory', label: 'Work History', category: 'History',
    status: 'verified', tier: 'T2',
    source: 'Attested ⇄ PECOS', authority: 'Self-attested · reconciled to CMS',
    summary: 'Current employment attested and reconciled.',
    checkedAt: '5 days ago', issued: 'Feb 2025', expires: null,
    cadence: 'Continuous reconciliation',
    receipt: 'vc2:hist:0x9b14…7701',
    rows: [
      { k: 'Current', v: 'Cedar Health System · Orthopedics' },
      { k: 'Since', v: 'Feb 2025', mono: true },
      { k: 'Reconciled', v: 'PECOS reassignment match' },
    ],
  },
  // ── pending ──
  {
    id: 'medicare', label: 'Medicare Enrollment', category: 'Enrollment',
    status: 'pending', tier: 'T3',
    source: 'PECOS', authority: 'CMS · Provider Enrollment, Chain & Ownership System',
    summary: 'Enrollment query in flight — will auto-update.',
    checkedAt: 'Checking…', issued: null, expires: null,
    cadence: 'Refreshed quarterly',
    receipt: null,
    rows: [
      { k: 'Query', v: 'Individual enrollment by NPI', mono: true },
      { k: 'Scope', v: 'Part B · Reassignments' },
      { k: 'Expected', v: '~45 seconds' },
    ],
  },
  {
    id: 'npdb', label: 'Adverse History (NPDB)', category: 'Standing',
    status: 'pending', tier: 'T4',
    source: 'NPDB', authority: 'HRSA · National Practitioner Data Bank',
    summary: 'Continuous query enrolled — standing monitor active.',
    checkedAt: 'Standing', issued: null, expires: null,
    cadence: 'Continuous Query · standing enrollment',
    receipt: null,
    rows: [
      { k: 'Query type', v: 'Continuous Query · standing' },
      { k: 'Scope', v: 'Malpractice · adverse actions · exclusions' },
      { k: 'Statute', v: '42 U.S.C. § 11101 et seq.', mono: true },
    ],
  },
  // ── expiring ──
  {
    id: 'licensure', label: 'CA PA License', category: 'License',
    status: 'expiring', tier: 'T3',
    source: 'CA PA Board', authority: 'Physician Assistant Board of California',
    summary: 'Active and in good standing — renews in 30 days.',
    checkedAt: '3 days ago', issued: 'Apr 14, 2023', expires: 'May 18, 2026',
    daysLeft: 30,
    cadence: 'Renew every 2 years · state board PSV',
    receipt: 'vc2:cabrd:0x4a7e…91c3',
    rows: [
      { k: 'License #', v: 'PA-052987', mono: true },
      { k: 'Status', v: 'Active · good standing' },
      { k: 'Expires', v: '2026-05-18', mono: true },
      { k: 'Disciplinary', v: 'None on file' },
    ],
  },
  {
    id: 'acls', label: 'ACLS Certification', category: 'Life Support',
    status: 'expiring', tier: 'T3',
    source: 'AHA', authority: 'American Heart Association',
    summary: 'Advanced cardiac life support — renews in 74 days.',
    checkedAt: '40 days ago', issued: 'Jun 30, 2024', expires: 'Jun 30, 2026',
    daysLeft: 74,
    cadence: '2-year cycle',
    receipt: 'vc2:aha:0x71c0…88ab',
    rows: [
      { k: 'Course', v: 'ACLS Provider · AHA' },
      { k: 'Expires', v: '2026-06-30', mono: true },
    ],
  },
  {
    id: 'coi', label: 'Malpractice Coverage', category: 'Insurance',
    status: 'expiring', tier: 'T2',
    source: 'Carrier COI', authority: 'The Doctors Company',
    summary: 'Certificate of insurance lapses in 43 days.',
    checkedAt: '20 days ago', issued: 'Jun 01, 2025', expires: 'May 31, 2026',
    daysLeft: 43,
    cadence: 'Annual renewal',
    receipt: 'vc2:coi:0x33ad…1207',
    rows: [
      { k: 'Carrier', v: 'The Doctors Company' },
      { k: 'Limits', v: '$1M / $3M · claims-made' },
      { k: 'Expires', v: '2026-05-31', mono: true },
    ],
  },
  // ── missing ──
  {
    id: 'dea', label: 'DEA Registration', category: 'License',
    status: 'missing', tier: null,
    source: '—', authority: 'U.S. Drug Enforcement Administration',
    summary: 'Not on file. Unlocks Schedule II–V authority and +32 roles.',
    checkedAt: '—', issued: null, expires: null,
    cadence: 'Provide once to add Authority evidence',
    receipt: null,
    impact: 'Unlocks 32 additional requisitions across 4 health systems.',
    rows: [
      { k: 'Needed for', v: 'Controlled-substance privileges' },
      { k: 'Provide', v: 'DEA number + schedules' },
    ],
  },
  {
    id: 'education-psv', label: 'Education PSV', category: 'Education',
    status: 'missing', tier: null,
    source: '—', authority: 'NCCPA + program registrar',
    summary: 'Final transcript not yet collected — upgrades degree to T4.',
    checkedAt: '—', issued: null, expires: null,
    cadence: 'Provide once to upgrade Education trust',
    receipt: null,
    impact: 'Raises Education dimension from partial to strong.',
    rows: [
      { k: 'Needed', v: 'Sealed final transcript' },
      { k: 'Upgrades', v: 'Degree T3 → T4' },
    ],
  },
];

// ── Trust dimensions ──────────────────────────────────────────────────────
// Reputation is a profile, never one number (W228/W235 canon). Each dimension
// projects from its own verified evidence. median = anonymous field median —
// the only comparison the engine ever draws.
W.TRUST_DIMENSIONS = [
  { id: 'identity',  label: 'Identity',   note: 'Legal standing resolved at the federal registry', score: 96, median: 80, state: 'strong',   fed: ['NPPES', 'taxonomy'] },
  { id: 'authority', label: 'Authority',  note: 'Licensure & certification — standing to practice', score: 82, median: 72, state: 'strong',   fed: ['CA PA Board', 'NCCPA'], flag: 'license expiring' },
  { id: 'standing',  label: 'Standing',   note: 'Clean sanctions & adverse-history record',          score: 90, median: 76, state: 'strong',   fed: ['OIG/LEIE', 'NPDB'] },
  { id: 'practice',  label: 'Practice',   note: 'Verified work history & privileges held',           score: 64, median: 66, state: 'building', fed: ['Cedar Health', 'PECOS'] },
  { id: 'enrollment',label: 'Enrollment', note: 'Federal & payer enrollment current',                score: 48, median: 70, state: 'thin',     fed: ['PECOS'], flag: 'query in flight' },
  { id: 'education',  label: 'Education',  note: 'Training verified to primary source',               score: 58, median: 64, state: 'building', fed: ['Registrar'], flag: 'transcript missing' },
];

// ── Trust sources — the authority ladder ──────────────────────────────────
W.TRUST_TIERS = {
  T1: { code: 'T1', label: 'Public',         desc: 'Self-attested or public source' },
  T2: { code: 'T2', label: 'Federated',      desc: 'Corroborated across the network' },
  T3: { code: 'T3', label: 'Authoritative',  desc: 'Returned by the registry of record' },
  T4: { code: 'T4', label: 'Primary-Sealed', desc: 'Cryptographically signed by the issuer' },
};

W.TRUST_SOURCES = [
  { id: 'nppes', name: 'NPPES', org: 'CMS', tier: 'T4', confirms: 'Identity & taxonomy', last: 'Just now', fresh: 100, state: 'verified' },
  { id: 'oig',   name: 'OIG / LEIE', org: 'HHS Office of Inspector General', tier: 'T4', confirms: 'Sanctions & exclusions', last: '6 days ago', fresh: 80, state: 'verified' },
  { id: 'nccpa', name: 'NCCPA', org: 'Nat\u2019l Commission on Certification of PAs', tier: 'T4', confirms: 'Board certification', last: '12 days ago', fresh: 96, state: 'verified' },
  { id: 'caboard', name: 'CA PA Board', org: 'Medical Board of California', tier: 'T3', confirms: 'State licensure', last: '3 days ago', fresh: 35, state: 'expiring' },
  { id: 'pecos', name: 'PECOS', org: 'CMS', tier: 'T3', confirms: 'Medicare enrollment', last: 'Checking…', fresh: 0, state: 'pending' },
  { id: 'npdb',  name: 'NPDB', org: 'HRSA', tier: 'T4', confirms: 'Adverse history', last: 'Standing', fresh: 90, state: 'pending' },
];

// ── Trust history — verification events over time ─────────────────────────
W.TRUST_HISTORY = [
  { t: 'Apr 18, 2026 · 14:32', tone: 'ok',    src: 'NPPES',  msg: 'Identity delta scan — no change. Record stands verified.' },
  { t: 'Apr 15, 2026 · 09:00', tone: 'warn',  src: 'CA PA Board', msg: 'License expires in 30 days. Renewal routed to wallet.' },
  { t: 'Apr 12, 2026 · 02:14', tone: 'ok',    src: 'OIG/LEIE', msg: 'April monthly dataset ingested — MACIE MILLER: CLEAR.' },
  { t: 'Apr 06, 2026 · 18:41', tone: 'info',  src: 'Network', msg: 'Passport re-used at OR Medical Group (Irvine) — cross-observation.' },
  { t: 'Mar 28, 2026 · 14:05', tone: 'muted', src: 'PECOS',  msg: 'Reassignment delta — no change since enrollment.' },
  { t: 'Feb 28, 2026 · 11:02', tone: 'ok',    src: 'NCCPA',  msg: 'Certification re-sealed (T4). CME on track.' },
  { t: 'Feb 11, 2025 · 16:02', tone: 'ok',    src: 'NPPES',  msg: 'Wallet opened · identity verified at enumeration.' },
];

// ── Timeline ───────────────────────────────────────────────────────────────
// kind: career | recognition | trust
W.TIMELINE = [
  { id: 't1', date: 'Apr 12, 2026', year: '2026', kind: 'trust',       title: 'Sanctions re-cleared',           detail: 'OIG/LEIE April dataset — no exclusions. Standing held.', source: 'OIG/LEIE', tier: 'T4' },
  { id: 't2', date: 'Feb 28, 2026', year: '2026', kind: 'recognition', title: 'NCCPA certification re-sealed',  detail: 'PA-C certification primary-sealed for the 10-year cycle.', source: 'NCCPA', tier: 'T4' },
  { id: 't3', date: 'Jan 28, 2025', year: '2025', kind: 'career',      title: 'Medicare reassignment effective', detail: 'Benefits reassigned to Irvine Regional Medical Group.', source: 'PECOS', tier: 'T3' },
  { id: 't4', date: 'Feb 11, 2025', year: '2025', kind: 'trust',       title: 'Career wallet opened',           detail: 'Identity verified at enumeration. Owned ledger established.', source: 'NPPES', tier: 'T4' },
  { id: 't5', date: 'Feb 03, 2025', year: '2025', kind: 'career',      title: 'Joined Cedar Health System',     detail: 'PA-C, Orthopedic Surgery · Irvine, CA.', source: 'Attested', tier: 'T2' },
  { id: 't6', date: 'Jan 14, 2025', year: '2025', kind: 'career',      title: 'NPI enumerated',                 detail: 'Type 1 individual NPI issued · 1346053246.', source: 'NPPES', tier: 'T4' },
  { id: 't7', date: 'Aug 12, 2024', year: '2024', kind: 'recognition', title: 'PA-C board certification earned', detail: 'Passed PANCE · certified by NCCPA.', source: 'NCCPA', tier: 'T4' },
  { id: 't8', date: 'May 2024',     year: '2024', kind: 'career',      title: 'MS, Physician Assistant Studies', detail: 'Western U. of Health Sciences. Degree on record.', source: 'Registrar', tier: 'T3' },
];

// ── Share — packets & links ────────────────────────────────────────────────
W.PACKETS = [
  {
    id: 'career', name: 'Career Packet', icon: 'CreditCard',
    tagline: 'Your whole verified career, portable.',
    desc: 'A signed, source-bound bundle of identity, licensure, certification, history and standing — the CV-of-record an employer can replay without trusting VitalCV.',
    includes: ['Identity & taxonomy', 'Licensure & certification', 'Work history', 'Sanctions & adverse standing', 'Timeline of record'],
    items: 9, verified: 7, format: 'VC 2.0 · OpenID4VCI',
  },
  {
    id: 'evidence', name: 'Evidence Packet', icon: 'ShieldCheck',
    tagline: 'Only what is verified, nothing more.',
    desc: 'A minimal disclosure bundle of just your primary-source verified evidence with cryptographic receipts. Choose exactly which lanes to include.',
    includes: ['7 verified evidence objects', 'Cryptographic receipts', 'Trust-tier provenance', 'Selective disclosure'],
    items: 7, verified: 7, format: 'Selective disclosure · per-lane receipts',
  },
];

W.SHARE_LINKS = [
  { id: 'l1', label: 'Cedar Health · Credentialing', scope: 'Career Packet', created: 'Apr 18, 2026', expires: 'in 27 days', views: 3, state: 'active', token: 'vcv.health/s/8a41c7d2' },
  { id: 'l2', label: 'OR Medical Group · Recruiter', scope: 'Evidence Packet', created: 'Apr 06, 2026', expires: 'in 15 days', views: 1, state: 'active', token: 'vcv.health/s/3f9db12a' },
  { id: 'l3', label: 'Personal résumé site', scope: 'Identity only', created: 'Mar 02, 2026', expires: 'expired', views: 12, state: 'expired', token: 'vcv.health/s/55a1e0c4' },
];

// ── Derived counts ─────────────────────────────────────────────────────────
W.count = (status) => W.EVIDENCE.filter(e => e.status === status).length;

window.W = W;
