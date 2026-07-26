// AI Knowledge Inbox — data
//
// PRINCIPLE
//   Classification organizes information.
//   Source checks decide what becomes verified.
//
// Provenance vocabulary (used everywhere on extractions / suggestions):
//   verified      Promoted by an actual primary-source check during ingest.
//   inferred      AI-extracted from clinician document. NOT a verification claim.
//   user_entered  Typed by the clinician. Owned but unverified.
//   unknown       Field is empty / not present in the doc.
//   contradicted  Two AI extractions disagree (e.g. cert # on file vs. resume text).

const INBOX_PROVENANCE_META = {
  verified: {
    label: 'Verified',
    description: 'Confirmed against a primary-source authority during ingest.',
    glyph: '✔',
    cls: 'text-emerald-700 bg-emerald-50 ring-emerald-600/30',
    dotCls: 'bg-emerald-600',
    accentBorder: 'border-l-emerald-500',
  },
  inferred: {
    label: 'Inferred',
    description: 'AI-extracted from this document. Not primary-source verified.',
    glyph: '≈',
    cls: 'text-slate-700 bg-white ring-slate-400/60',
    dotCls: 'bg-slate-400',
    // Inferred MUST visually demand source confirmation:
    accentBorder: 'border-l-amber-500',
  },
  user_entered: {
    label: 'User-Entered',
    description: 'Typed by the clinician. Owned but not source-checked.',
    glyph: '✎',
    cls: 'text-slate-700 bg-white ring-slate-300',
    dotCls: 'bg-slate-500',
    accentBorder: 'border-l-slate-300',
  },
  unknown: {
    label: 'Unknown',
    description: 'Not found in this document. Not a negative signal.',
    glyph: '?',
    cls: 'text-amber-800 bg-white ring-amber-500/40',
    dotCls: 'bg-amber-500',
    accentBorder: 'border-l-amber-300',
  },
  contradicted: {
    label: 'Contradicted',
    description: 'Two extractions disagree. Requires reconciliation.',
    glyph: '⑂',
    cls: 'text-purple-700 bg-purple-50 ring-purple-600/20',
    dotCls: 'bg-purple-600',
    accentBorder: 'border-l-purple-500',
  },
};
window.INBOX_PROVENANCE_META = INBOX_PROVENANCE_META;

// Document classification taxonomy.
const DOC_CLASS_META = {
  cv:           { label: 'Curriculum Vitae',      glyph: 'CV',  ring: 'ring-slate-300' },
  state_license:{ label: 'State License',         glyph: 'SL',  ring: 'ring-slate-300' },
  board_cert:   { label: 'Board Certification',   glyph: 'BC',  ring: 'ring-slate-300' },
  dea:          { label: 'DEA Certificate',       glyph: 'DEA', ring: 'ring-slate-300' },
  malpractice:  { label: 'Malpractice COI',       glyph: 'COI', ring: 'ring-slate-300' },
  diploma:      { label: 'Diploma / Transcript',  glyph: 'EDU', ring: 'ring-slate-300' },
  attestation:  { label: 'Self-Attestation',      glyph: 'ATT', ring: 'ring-slate-300' },
  unknown:      { label: 'Unclassified',          glyph: '?',   ring: 'ring-amber-300' },
};
window.DOC_CLASS_META = DOC_CLASS_META;

// Inbox documents — three states are interesting:
//   processed   classification done, extractions ready for review
//   classifying loading state — animated
//   queued      sitting in dropzone, not yet processed
//   unclassified document we couldn't classify, asks user
const INBOX_DOCUMENTS = [
  {
    id: 'doc-001',
    name: 'macie-miller-cv-2026-04.pdf',
    bytes: 184_392,
    pages: 3,
    receivedAt: '2026-04-18 14:18 UTC',
    receivedRel: '14 min ago',
    state: 'processed',
    classification: 'cv',
    classificationConfidence: 0.94,
    classificationReason: 'Header parsed as "Macie Miller, PA-C". Section structure matches CV pattern (Education → Experience → Certifications). 7 employment entries detected.',
    extractedCount: 11,
    pageThumb: { tone: 'cv' },
    sourceUri: 'inbox://uploads/macie-miller-cv-2026-04.pdf',
  },
  {
    id: 'doc-002',
    name: 'CA_PA_License_pa-58129_renewal.pdf',
    bytes: 612_104,
    pages: 1,
    receivedAt: '2026-04-18 14:09 UTC',
    receivedRel: '23 min ago',
    state: 'processed',
    classification: 'state_license',
    classificationConfidence: 0.99,
    classificationReason: 'CA Physician Assistant Board letterhead detected. Wallet card layout. License # PA-58129 matched on document and filename.',
    extractedCount: 7,
    pageThumb: { tone: 'license' },
    sourceUri: 'inbox://uploads/CA_PA_License_pa-58129_renewal.pdf',
  },
  {
    id: 'doc-003',
    name: 'NCCPA_certification_2025.pdf',
    bytes: 248_712,
    pages: 2,
    receivedAt: '2026-04-18 14:02 UTC',
    receivedRel: '30 min ago',
    state: 'processed',
    classification: 'board_cert',
    classificationConfidence: 0.97,
    classificationReason: 'NCCPA seal recognized. Certification ID format matches pattern.',
    extractedCount: 6,
    pageThumb: { tone: 'cert' },
    sourceUri: 'inbox://uploads/NCCPA_certification_2025.pdf',
  },
  {
    id: 'doc-004',
    name: 'IMG_4831.HEIC',
    bytes: 2_840_122,
    pages: 1,
    receivedAt: '2026-04-18 14:31 UTC',
    receivedRel: '1 min ago',
    state: 'classifying',
    classification: null,
    classificationConfidence: null,
    extractedCount: 0,
    pageThumb: { tone: 'photo' },
    sourceUri: 'inbox://uploads/IMG_4831.HEIC',
  },
  {
    id: 'doc-005',
    name: 'scan_unknown_form_2026-04-18.pdf',
    bytes: 96_433,
    pages: 1,
    receivedAt: '2026-04-17 22:51 UTC',
    receivedRel: 'yesterday',
    state: 'unclassified',
    classification: 'unknown',
    classificationConfidence: 0.31,
    classificationReason: 'No recognized issuer letterhead. Text density low. Best three guesses: continuing-education certificate (0.31), insurance card (0.18), training receipt (0.11).',
    extractedCount: 0,
    pageThumb: { tone: 'unknown' },
    sourceUri: 'inbox://uploads/scan_unknown_form_2026-04-18.pdf',
  },
];
window.INBOX_DOCUMENTS = INBOX_DOCUMENTS;

// Extracted fields per document. Provenance is per-field.
//   requiresPSV  the source check that would PROMOTE this to verified
//   bbox         page bounding box reference (label only — visual cue)
//   originalText raw extracted string (for transparency)
const INBOX_EXTRACTIONS = {
  'doc-001': {
    docName: 'macie-miller-cv-2026-04.pdf',
    fields: [
      { id: 'name',        label: 'Legal name',          value: 'Macie E. Miller',
        provenance: 'inferred', bbox: 'p1 · h1', originalText: 'Macie E. Miller, PA-C',
        requiresPSV: 'NPPES match', psvSource: 'NPPES' },
      { id: 'cred',        label: 'Credential',          value: 'PA-C',
        provenance: 'inferred', bbox: 'p1 · h1', originalText: 'PA-C',
        requiresPSV: 'NCCPA · ID 9923-1118', psvSource: 'NCCPA' },
      { id: 'specialty',   label: 'Specialty',           value: 'Orthopedic Surgery',
        provenance: 'inferred', bbox: 'p1 · §Summary', originalText: '5+ years orthopedic surgery',
        requiresPSV: 'No primary source for specialty', psvSource: null,
        note: 'Specialty is self-asserted. There is no primary source. It will remain Inferred.' },
      { id: 'school',      label: 'PA program',          value: 'Western U. of Health Sciences',
        provenance: 'inferred', bbox: 'p1 · §Education', originalText: 'M.S. Physician Assistant Studies, Western University of Health Sciences, 2024',
        requiresPSV: 'Program registrar PSV', psvSource: 'Registrar' },
      { id: 'grad_year',   label: 'Graduation year',     value: '2024',
        provenance: 'inferred', bbox: 'p1 · §Education', originalText: '2024',
        requiresPSV: 'Program registrar PSV', psvSource: 'Registrar' },
      { id: 'employer',    label: 'Most recent employer',value: 'OrthoOne Surgical Group',
        provenance: 'contradicted', bbox: 'p2 · §Experience',
        originalText: 'OrthoOne Surgical Group · Senior PA · 2024–present',
        requiresPSV: 'PECOS · NPPES practice location',
        note: 'Conflicts with PECOS Type 2 enrollment record (Coastline Ortho Partners).',
        psvSource: 'PECOS' },
      { id: 'years_exp',   label: 'Years of experience', value: '5',
        provenance: 'inferred', bbox: 'p1 · §Summary', originalText: '5+ years orthopedic surgery',
        requiresPSV: 'NPPES enumeration date · 2025-01-14',
        note: 'Conflicts with NPPES enumeration date — clinician may be counting pre-licensure clinical hours.',
        psvSource: 'NPPES' },
      { id: 'languages',   label: 'Languages',           value: 'English, Spanish',
        provenance: 'inferred', bbox: 'p1 · §Skills', originalText: 'Bilingual (English, Spanish)',
        requiresPSV: null, psvSource: null,
        note: 'Self-attested. Unverifiable by primary source.' },
      { id: 'email',       label: 'Email',               value: 'macie.miller@example.com',
        provenance: 'inferred', bbox: 'p1 · header', originalText: 'macie.miller@example.com',
        requiresPSV: 'Verification email', psvSource: 'VitalCV email loop' },
      { id: 'phone',       label: 'Phone',               value: '(949) 555-0144',
        provenance: 'inferred', bbox: 'p1 · header', originalText: '(949) 555-0144',
        requiresPSV: 'OTP', psvSource: 'VitalCV SMS loop' },
      { id: 'awards',      label: 'Honors / awards',     value: 'Dean\u2019s List 2023',
        provenance: 'unknown', bbox: null, originalText: null,
        requiresPSV: null, psvSource: null,
        note: 'Mentioned in resume body but no structured field. Left as Unknown.' },
    ],
  },
  'doc-002': {
    docName: 'CA_PA_License_pa-58129_renewal.pdf',
    fields: [
      { id: 'license_no',  label: 'License number',      value: 'PA-58129',
        provenance: 'verified', bbox: 'p1 · top-right', originalText: 'License No. PA-58129',
        psvSource: 'CA PA Board · checked at ingest 2026-04-18 14:09 UTC',
        receipt: 'vc2:ca-pa:0xa8f3…3211' },
      { id: 'license_state',label: 'State',              value: 'California',
        provenance: 'verified', bbox: 'p1 · letterhead', originalText: 'State of California',
        psvSource: 'CA PA Board' },
      { id: 'license_status',label: 'Status',            value: 'Active · Good standing',
        provenance: 'verified', bbox: 'p1 · body', originalText: 'ACTIVE',
        psvSource: 'CA PA Board · live query', receipt: 'vc2:ca-pa:0xa8f3…3211' },
      { id: 'issue_date',  label: 'Issue date',          value: '2025-01-22',
        provenance: 'inferred', bbox: 'p1 · body', originalText: 'Issued 01/22/2025',
        requiresPSV: 'CA PA Board record', psvSource: 'CA PA Board' },
      { id: 'expiry',      label: 'Expiration',          value: '2027-01-31',
        provenance: 'verified', bbox: 'p1 · body', originalText: 'Expires 01/31/2027',
        psvSource: 'CA PA Board · live query' },
      { id: 'holder_name', label: 'License holder',      value: 'MILLER, MACIE E',
        provenance: 'verified', bbox: 'p1 · holder block', originalText: 'MILLER, MACIE E',
        psvSource: 'CA PA Board · matched NPPES' },
      { id: 'discipline',  label: 'Disciplinary actions',value: 'None on file',
        provenance: 'verified', bbox: null, originalText: null,
        psvSource: 'CA PA Board · disciplinary index' },
    ],
  },
  'doc-003': {
    docName: 'NCCPA_certification_2025.pdf',
    fields: [
      { id: 'cert_id',     label: 'Certification ID',    value: '9923-1118',
        provenance: 'inferred', bbox: 'p1 · footer', originalText: 'Cert ID: 9923-1118',
        requiresPSV: 'NCCPA Verify · live query', psvSource: 'NCCPA' },
      { id: 'cert_status', label: 'Status',              value: 'Certified',
        provenance: 'inferred', bbox: 'p1 · body', originalText: 'Certified',
        requiresPSV: 'NCCPA Verify · live query', psvSource: 'NCCPA' },
      { id: 'cert_caq',    label: 'Specialty CAQ',       value: 'Cardiovascular Surgery',
        provenance: 'contradicted', bbox: 'p1 · CAQ block', originalText: 'CAQ: Cardiovascular Surgery',
        note: 'CV (doc-001) lists Orthopedic Surgery as practice specialty. Cert CAQ is Cardiovascular. Resolve.',
        psvSource: 'NCCPA' },
      { id: 'cert_issue',  label: 'Issued',              value: '2025-02-04',
        provenance: 'inferred', bbox: 'p1 · body', originalText: '02/04/2025',
        requiresPSV: 'NCCPA Verify', psvSource: 'NCCPA' },
      { id: 'cert_expiry', label: 'Expires',             value: '2031-12-31',
        provenance: 'inferred', bbox: 'p1 · body', originalText: '12/31/2031',
        requiresPSV: 'NCCPA Verify', psvSource: 'NCCPA' },
      { id: 'cert_holder', label: 'Certified person',    value: 'Macie Miller, PA-C',
        provenance: 'inferred', bbox: 'p1 · seal', originalText: 'This certifies that Macie Miller',
        requiresPSV: 'NCCPA Verify', psvSource: 'NCCPA' },
    ],
  },
};
window.INBOX_EXTRACTIONS = INBOX_EXTRACTIONS;

// Profile-update suggestions — these are proposals to update the
// PROFILE CONTEXT (not the verified credentialing record).
// Acceptance writes to context. Promotion to verified still requires PSV.
const INBOX_SUGGESTIONS = [
  {
    id: 'sug-1',
    docId: 'doc-002',
    docName: 'CA_PA_License_pa-58129_renewal.pdf',
    target: 'CA PA License',
    fields: [
      { label: 'Status',         current: 'Active · auto-renewed', proposed: 'Active · Good standing', kind: 'replace' },
      { label: 'Expiration',     current: '2026-12-31',            proposed: '2027-01-31',             kind: 'replace' },
      { label: 'License number', current: 'PA-58129',              proposed: 'PA-58129',               kind: 'unchanged' },
    ],
    provenance: 'verified',
    note: 'Already cross-checked with CA PA Board live query. Accepting promotes the record on your passport.',
    primaryAction: 'Apply to passport',
  },
  {
    id: 'sug-2',
    docId: 'doc-003',
    docName: 'NCCPA_certification_2025.pdf',
    target: 'Board Certification',
    fields: [
      { label: 'Certifying body', current: '— not on file',        proposed: 'NCCPA',                    kind: 'add' },
      { label: 'Certification ID',current: '— not on file',        proposed: '9923-1118',                kind: 'add' },
      { label: 'Specialty CAQ',   current: '— not on file',        proposed: 'Cardiovascular Surgery',   kind: 'add' },
      { label: 'Expires',         current: '— not on file',        proposed: '2031-12-31',               kind: 'add' },
    ],
    provenance: 'inferred',
    note: 'No NCCPA primary-source check yet. If you accept, this enters your profile context as Inferred and a verification request will be queued against NCCPA Verify.',
    psvNeeded: 'NCCPA Verify',
    primaryAction: 'Accept to profile context',
  },
  {
    id: 'sug-3',
    docId: 'doc-001',
    docName: 'macie-miller-cv-2026-04.pdf',
    target: 'Profile · Specialty',
    fields: [
      { label: 'Specialty (self-stated)', current: 'Orthopedic Surgery (existing)', proposed: 'Orthopedic Surgery', kind: 'unchanged' },
    ],
    conflict: {
      with: 'NCCPA CAQ (doc-003) → Cardiovascular Surgery',
    },
    provenance: 'contradicted',
    note: 'Resume specialty conflicts with NCCPA CAQ. We will not auto-resolve.',
    primaryAction: 'Reconcile manually',
  },
  {
    id: 'sug-4',
    docId: 'doc-001',
    docName: 'macie-miller-cv-2026-04.pdf',
    target: 'Profile · Contact',
    fields: [
      { label: 'Email', current: '— not on file',  proposed: 'macie.miller@example.com', kind: 'add' },
      { label: 'Phone', current: '(949) 555-0107 (existing)', proposed: '(949) 555-0144', kind: 'replace' },
    ],
    provenance: 'user_entered',
    note: 'Contact details from the CV header. Saved as user-entered until confirmed via OTP / email loop.',
    psvNeeded: 'OTP / email loop',
    primaryAction: 'Accept to profile context',
  },
];
window.INBOX_SUGGESTIONS = INBOX_SUGGESTIONS;

// Friendly file-size helper
window.formatBytes = function(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
  return (b / 1024 / 1024).toFixed(1) + ' MB';
};
