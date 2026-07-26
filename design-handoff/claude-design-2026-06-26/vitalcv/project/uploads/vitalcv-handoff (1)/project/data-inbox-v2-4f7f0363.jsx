// WAVE 20 · Inbox v2 — Knowledge Inbox Triage Workspace · Fixtures
//
// Extends data-inbox.jsx (v1). Same item shape, more variety; adds source-feed
// metadata required by the new 3-column triage layout.
//
// PII rule: subject lines never carry anything beyond { display, npi }. Document
// IDs may appear in the detail panel ONLY for items with type === 'clinician-upload'.

const INBOX_SOURCES = [
  { id: 'nppes',   name: 'NPPES (CMS)',                 lastFetched: '6m ago',  count: 4, state: 'fresh',     scope: 'NPI registry',           kind: 'registry' },
  { id: 'oig',     name: 'OIG LEIE',                    lastFetched: '14m ago', count: 1, state: 'fresh',     scope: 'Federal sanctions',      kind: 'registry' },
  { id: 'ca-bom',  name: 'CA Board of Medicine',        lastFetched: '2h ago',  count: 2, state: 'fresh',     scope: 'CA medical license',     kind: 'state-board' },
  { id: 'tx-bon',  name: 'TX Board of Nursing',         lastFetched: '38m ago', count: 1, state: 'fresh',     scope: 'TX RN license',          kind: 'state-board' },
  { id: 'dea',     name: 'DEA Registry',                lastFetched: '27m ago', count: 1, state: 'degraded', scope: 'Controlled substances',   kind: 'registry' },
  { id: 'upload',  name: 'Clinician uploads',           lastFetched: '1m ago',  count: 3, state: 'fresh',     scope: 'Documents',              kind: 'upload' },
  { id: 'partner', name: 'Partner feed (Verifiable)',   lastFetched: '5m ago',  count: 2, state: 'fresh',     scope: 'Education',              kind: 'partner' },
  { id: 'nursys',  name: 'Nursys (NCSBN)',              lastFetched: '11m ago', count: 1, state: 'fresh',     scope: 'Multistate RN compact',  kind: 'registry' },
];

const INBOX_ITEM_TYPES = {
  'license-renewal':    { label: 'License renewal',     glyph: '↻', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  'sanction-update':    { label: 'Sanction update',     glyph: '!', cls: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
  'address-change':     { label: 'Address change',      glyph: '⌂', cls: 'bg-slate-100 text-slate-700 ring-slate-300' },
  'new-attestation':    { label: 'New attestation',     glyph: '✎', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20' },
  'contradiction-flag': { label: 'Contradiction flag',  glyph: '⑂', cls: 'bg-purple-50 text-purple-700 ring-purple-600/20' },
  'clinician-upload':   { label: 'Clinician upload',    glyph: '↑', cls: 'bg-amber-50 text-amber-800 ring-amber-600/20' },
  'taxonomy-update':    { label: 'Taxonomy update',     glyph: '#', cls: 'bg-sky-50 text-sky-700 ring-sky-600/20' },
  'expiry-warning':     { label: 'Expiry warning',      glyph: '⏳', cls: 'bg-amber-50 text-amber-800 ring-amber-600/20' },
};

// Subject refs — never include PII beyond name + NPI.
const SUBJ = {
  macie:    { display: 'MACIE MILLER, PA-C',     npi: '1346053246' },
  jordan:   { display: 'JORDAN PARK, MD',         npi: '1184729302' },
  rosa:     { display: 'ROSA LIN, RN',            npi: '1639220571' },
  carter:   { display: 'CARTER OBI, NP',          npi: '1295836174' },
  npiOnly1: { display: '[ref-NPI-only]',          npi: '1063924711' },
  npiOnly2: { display: '[ref-NPI-only]',          npi: '1820471639' },
};

const INBOX_ITEMS = [
  {
    id:    'inbox-001',
    type:  'license-renewal',
    sourceId: 'ca-bom',
    subjectRef: SUBJ.macie,
    summary: 'PA license PA-29384 renewed for 2026 cycle (active through 2028-02-28).',
    tier:  'verified',
    stage: 'incoming',
    age:   '7m ago',
    suggestedDisposition: 'accept',
    evidence: [
      { k: 'License number',  v: 'PA-29384',           mono: true },
      { k: 'Status',          v: 'Active' },
      { k: 'Cycle',           v: '2026 → 2028' },
      { k: 'Source',          v: 'CA Board of Medicine' },
      { k: 'Fetched',         v: '2h ago' },
    ],
  },
  {
    id:    'inbox-002',
    type:  'sanction-update',
    sourceId: 'oig',
    subjectRef: SUBJ.npiOnly1,
    summary: 'No exclusion record found · OIG LEIE re-check confirmed clear.',
    tier:  'verified',
    stage: 'incoming',
    age:   '14m ago',
    suggestedDisposition: 'accept',
    evidence: [
      { k: 'Result',          v: 'Not on LEIE' },
      { k: 'Source',          v: 'OIG LEIE' },
      { k: 'Fetched',         v: '14m ago' },
    ],
  },
  {
    id:    'inbox-003',
    type:  'address-change',
    sourceId: 'nppes',
    subjectRef: SUBJ.jordan,
    summary: 'Practice address updated in NPPES — needs reconciliation against staged profile.',
    tier:  'inferred',
    stage: 'incoming',
    age:   '38m ago',
    suggestedDisposition: 'snooze',
    evidence: [
      { k: 'Field',          v: 'Practice address' },
      { k: 'Old (staged)',   v: 'on record · masked in inbox' },
      { k: 'New (NPPES)',    v: 'on record · masked in inbox' },
      { k: 'Source',         v: 'NPPES' },
    ],
  },
  {
    id:    'inbox-004',
    type:  'contradiction-flag',
    sourceId: 'partner',
    subjectRef: SUBJ.macie,
    summary: 'Education record disagrees with self-attestation: institution name varies.',
    tier:  'contradicted',
    stage: 'triaged',
    age:   '1h ago',
    suggestedDisposition: 'escalate',
    evidence: [
      { k: 'Field',          v: 'Graduate institution' },
      { k: 'Source A',       v: 'Verifiable partner feed' },
      { k: 'Source B',       v: 'Self-attestation (Application Packet §6)' },
      { k: 'Disposition',    v: 'Both kept; resolution requires reviewer' },
    ],
  },
  {
    id:    'inbox-005',
    type:  'new-attestation',
    sourceId: 'upload',
    subjectRef: SUBJ.macie,
    summary: 'Self-attestation submitted: malpractice claim history (none in 5 years).',
    tier:  'inferred',
    stage: 'triaged',
    age:   '3h ago',
    suggestedDisposition: 'accept',
    evidence: [
      { k: 'Question',       v: 'Malpractice claims, last 5 yrs' },
      { k: 'Answer',         v: 'None reported' },
      { k: 'Document ID',    v: 'doc-attest-mm-0007', mono: true },
      { k: 'Submitted',      v: '3h ago' },
    ],
  },
  {
    id:    'inbox-006',
    type:  'clinician-upload',
    sourceId: 'upload',
    subjectRef: SUBJ.rosa,
    summary: 'BLS certification card uploaded (PDF · 412 KB).',
    tier:  'inferred',
    stage: 'incoming',
    age:   '1m ago',
    suggestedDisposition: 'accept',
    evidence: [
      { k: 'Filename',       v: 'BLS-RosaLin-2026.pdf', mono: true },
      { k: 'Document ID',    v: 'doc-upload-rl-0014', mono: true },
      { k: 'Size',           v: '412 KB' },
      { k: 'Parsed fields',  v: 'Issuer · Expiry · Cardholder name' },
    ],
  },
  {
    id:    'inbox-007',
    type:  'expiry-warning',
    sourceId: 'dea',
    subjectRef: SUBJ.carter,
    summary: 'DEA registration expires in 41 days — renewal window opens in 11 days.',
    tier:  'verified',
    stage: 'incoming',
    age:   '27m ago',
    suggestedDisposition: 'snooze',
    sourceDegraded: true,
    evidence: [
      { k: 'Registration',   v: 'BC1234567', mono: true },
      { k: 'Expires',        v: '2026-06-19' },
      { k: 'Source',         v: 'DEA Registry' },
      { k: 'Notes',          v: 'Source last fetched 27m ago — feed degraded' },
    ],
  },
  {
    id:    'inbox-008',
    type:  'license-renewal',
    sourceId: 'tx-bon',
    subjectRef: SUBJ.rosa,
    summary: 'TX RN license renewed (active through 2027-09-30).',
    tier:  'verified',
    stage: 'resolved',
    age:   '2d ago',
    suggestedDisposition: 'accept',
    resolvedAt: '2d ago',
    resolvedBy: 'demo',
    disposition: 'accept',
    evidence: [
      { k: 'License number', v: 'RN-TX-998132', mono: true },
      { k: 'Status',         v: 'Active' },
      { k: 'Source',         v: 'TX Board of Nursing' },
    ],
  },
  {
    id:    'inbox-009',
    type:  'taxonomy-update',
    sourceId: 'nppes',
    subjectRef: SUBJ.jordan,
    summary: 'Primary taxonomy code updated to 207RC0000X · Cardiovascular Disease.',
    tier:  'verified',
    stage: 'triaged',
    age:   '6h ago',
    suggestedDisposition: 'accept',
    evidence: [
      { k: 'Field',          v: 'Primary taxonomy' },
      { k: 'New value',      v: '207RC0000X · Cardiovascular Disease' },
      { k: 'Source',         v: 'NPPES' },
      { k: 'Fetched',        v: '6h ago' },
    ],
  },
  {
    id:    'inbox-010',
    type:  'sanction-update',
    sourceId: 'oig',
    subjectRef: SUBJ.npiOnly2,
    summary: 'No exclusion record found · monthly LEIE sweep complete.',
    tier:  'verified',
    stage: 'resolved',
    age:   '4d ago',
    suggestedDisposition: 'accept',
    resolvedAt: '4d ago',
    resolvedBy: 'demo',
    disposition: 'accept',
    evidence: [
      { k: 'Result',         v: 'Not on LEIE' },
      { k: 'Source',         v: 'OIG LEIE' },
    ],
  },
  {
    id:    'inbox-011',
    type:  'new-attestation',
    sourceId: 'upload',
    subjectRef: SUBJ.carter,
    summary: 'Hospital privileges history submitted: 3 facilities, no adverse actions.',
    tier:  'inferred',
    stage: 'incoming',
    age:   '17m ago',
    suggestedDisposition: 'accept',
    evidence: [
      { k: 'Document ID',    v: 'doc-attest-co-0011', mono: true },
      { k: 'Facilities',     v: '3 listed' },
      { k: 'Adverse actions', v: 'None reported' },
    ],
  },
  {
    id:    'inbox-012',
    type:  'license-renewal',
    sourceId: 'nursys',
    subjectRef: SUBJ.rosa,
    summary: 'Multistate RN compact privilege re-verified · active in 39 states.',
    tier:  'verified',
    stage: 'incoming',
    age:   '11m ago',
    suggestedDisposition: 'accept',
    evidence: [
      { k: 'Compact',        v: 'NLC' },
      { k: 'Active states',  v: '39' },
      { k: 'Source',         v: 'Nursys (NCSBN)' },
    ],
  },
  {
    id:    'inbox-013',
    type:  'contradiction-flag',
    sourceId: 'partner',
    subjectRef: SUBJ.jordan,
    summary: 'Board certification expiry date mismatch (ABIM vs partner feed).',
    tier:  'contradicted',
    stage: 'triaged',
    age:   '8h ago',
    suggestedDisposition: 'escalate',
    evidence: [
      { k: 'Field',          v: 'Board cert expiry' },
      { k: 'Source A',       v: 'ABIM (primary source)' },
      { k: 'Source B',       v: 'Verifiable partner feed' },
      { k: 'Disposition',    v: 'Primary source preferred; reviewer to confirm' },
    ],
  },
  {
    id:    'inbox-014',
    type:  'address-change',
    sourceId: 'nppes',
    subjectRef: SUBJ.macie,
    summary: 'Mailing address change confirmed — already reflected on staged profile.',
    tier:  'verified',
    stage: 'resolved',
    age:   '1d ago',
    suggestedDisposition: 'accept',
    resolvedAt: '1d ago',
    resolvedBy: 'demo',
    disposition: 'accept',
    evidence: [
      { k: 'Field',          v: 'Mailing address' },
      { k: 'Source',         v: 'NPPES' },
    ],
  },
];

const INBOX_FILTERS_AGE_WINDOWS = [
  { id: '1h',  label: 'Last hour' },
  { id: '24h', label: 'Last 24h' },
  { id: '7d',  label: 'Last 7 days' },
  { id: 'older', label: 'Older' },
];

const INBOX_DISPOSITIONS = [
  { id: 'accept',   label: 'Accept',     hint: 'Mark as accepted; flow into staged profile.' },
  { id: 'dispute',  label: 'Dispute',    hint: 'Open a dispute thread; item stays unresolved.' },
  { id: 'snooze',   label: 'Snooze 24h', hint: 'Hide for 24 hours, then resurface.' },
  { id: 'escalate', label: 'Escalate',   hint: 'Forward to a senior reviewer.' },
];

window.INBOX_SOURCES = INBOX_SOURCES;
window.INBOX_ITEM_TYPES = INBOX_ITEM_TYPES;
window.INBOX_ITEMS = INBOX_ITEMS;
window.INBOX_FILTERS_AGE_WINDOWS = INBOX_FILTERS_AGE_WINDOWS;
window.INBOX_DISPOSITIONS = INBOX_DISPOSITIONS;
