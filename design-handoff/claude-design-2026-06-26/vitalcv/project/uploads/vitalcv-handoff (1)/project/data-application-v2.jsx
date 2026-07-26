// WAVE 24 · Application Active State — data fixtures
// In-progress packet, BEFORE submission. The original view-application.jsx
// is the read-only sealed-and-submitted artifact. v2 is the LIVE composition
// surface: clinician working through it, with autofill from the Inbox,
// conflict resolution between sources, and a strict gate before submit.

const APPLICATION_V2_META = {
  id: 'PKT-2026-04-18-MM01',
  packetVersion: 'CAQH-2026.02 · VCV-extended',
  applicant: 'Macie Elizabeth Miller, PA-C',
  destination: 'Cedar Health System · Medical Staff Office',
  applicationType: 'Initial Appointment',
  opened: '2026-04-12 09:14 UTC',
  lastSaved: '2026-05-09 11:42 UTC',
  autosaveSeconds: 12,
  status: 'in_progress',          // in_progress | ready | locked
  expectedSubmitBy: '2026-05-15',
  // Telemetry the clinician sees in the rail. Composition time only — does
  // not include time spent gathering documents in the Inbox.
  activeMinutes: 47,
  sessionsCount: 4,
};
window.APPLICATION_V2_META = APPLICATION_V2_META;

// Section composition state. Each section is one of:
//   complete    — every required field has a value AND attestation is signed
//   ready       — every required field has a value, attestation pending
//   in_progress — at least one required field still empty
//   blocked     — has at least one CONFLICT row (sources disagree)
//   not_started — zero required fields filled
const APPLICATION_V2_SECTIONS = [
  { id: 'A', n: '01', label: 'Demographics & Identity',     state: 'complete',    required: 14, filled: 14, conflicts: 0, autofilled: 11 },
  { id: 'B', n: '02', label: 'Education & Training',         state: 'ready',       required: 9,  filled: 9,  conflicts: 0, autofilled: 6 },
  { id: 'C', n: '03', label: 'Licensure & Certification',   state: 'blocked',     required: 11, filled: 10, conflicts: 1, autofilled: 8 },
  { id: 'D', n: '04', label: 'Work History (10y)',           state: 'in_progress', required: 18, filled: 13, conflicts: 0, autofilled: 9 },
  { id: 'E', n: '05', label: 'Hospital Affiliations',        state: 'in_progress', required: 6,  filled: 4,  conflicts: 0, autofilled: 3 },
  { id: 'F', n: '06', label: 'Malpractice Coverage',         state: 'ready',       required: 8,  filled: 8,  conflicts: 0, autofilled: 5 },
  { id: 'G', n: '07', label: 'References (3)',               state: 'in_progress', required: 9,  filled: 4,  conflicts: 0, autofilled: 0 },
  { id: 'H', n: '08', label: 'Disclosure Questions',         state: 'in_progress', required: 12, filled: 9,  conflicts: 0, autofilled: 0 },
  { id: 'I', n: '09', label: 'Privileges Requested',         state: 'not_started', required: 7,  filled: 0,  conflicts: 0, autofilled: 0 },
  { id: 'J', n: '10', label: 'Authorization & Release',      state: 'not_started', required: 4,  filled: 0,  conflicts: 0, autofilled: 0 },
];
window.APPLICATION_V2_SECTIONS = APPLICATION_V2_SECTIONS;

// The active section the user is editing (drives the body panel).
const APPLICATION_V2_ACTIVE_ID = 'C';

// Detailed view of the currently-active section. The body panel renders
// these row-by-row with mixed statuses to show the live composition mode:
//   filled       — clinician (or autofill) supplied a value, no problem
//   autofilled   — value pulled from a verified source, awaiting clinician confirm
//   empty        — required, blank
//   conflict     — two sources disagree; clinician must resolve
//   stale        — value was filled, but the source has refreshed since
const APPLICATION_V2_ACTIVE_SECTION = {
  id: 'C',
  n: '03',
  label: 'Licensure & Certification',
  subtitle: 'State licenses, DEA registration, and board certifications. Each row must trace back to a primary source.',
  rows: [
    {
      id: 'C.1', label: 'CA Physician Assistant license',
      value: 'PA 56214', state: 'filled',
      source: 'Medical Board of California · live registry',
      source_kind: 'primary',
      attested: true,
    },
    {
      id: 'C.2', label: 'CA license · expiration',
      value: '2027-05-31', state: 'autofilled',
      source: 'Medical Board of California · live registry',
      source_kind: 'primary',
      attested: false,
      hint: 'Pulled from registry on 2026-05-09. Confirm before submit.',
    },
    {
      id: 'C.3', label: 'CA license · disciplinary status',
      value: 'No actions on record', state: 'autofilled',
      source: 'Medical Board of California · live registry',
      source_kind: 'primary',
      attested: false,
    },
    {
      id: 'C.4', label: 'NCCPA certification number',
      value: '14-3201-9824', state: 'filled',
      source: 'NCCPA · primary verification',
      source_kind: 'primary',
      attested: true,
    },
    {
      id: 'C.5', label: 'NCCPA · current period',
      value: '2025-01-14 → 2027-12-31', state: 'autofilled',
      source: 'NCCPA · primary verification',
      source_kind: 'primary',
      attested: false,
    },
    {
      id: 'C.6', label: 'DEA registration number',
      state: 'conflict',
      conflict: {
        message: 'Two sources disagree. Pick one to write to the packet, then attest.',
        choices: [
          { id: 'a', label: 'MM2345678', source: 'DEA · public registry',          source_kind: 'primary', recommended: true },
          { id: 'b', label: 'BM2345678', source: 'CAQH · clinician self-attested', source_kind: 'self' },
        ],
      },
      attested: false,
    },
    {
      id: 'C.7', label: 'DEA · schedules',
      value: 'II, IIN, III, IIIN, IV, V', state: 'autofilled',
      source: 'DEA · public registry',
      source_kind: 'primary',
      attested: false,
    },
    {
      id: 'C.8', label: 'DEA · expiration',
      value: '2027-09-30', state: 'autofilled',
      source: 'DEA · public registry',
      source_kind: 'primary',
      attested: false,
    },
    {
      id: 'C.9', label: 'Other state licenses',
      value: '— none —', state: 'filled',
      source: 'Clinician attestation',
      source_kind: 'self',
      attested: true,
    },
    {
      id: 'C.10', label: 'BLS certification · expiration',
      value: '2026-08-12', state: 'stale',
      source: 'AHA Atlas · verified 2026-02-14',
      source_kind: 'primary',
      attested: true,
      stale: { days: 84, severity: 'expires-soon' },
      hint: 'Expires within 95 days. Renewal required before appointment.',
    },
    {
      id: 'C.11', label: 'ACLS certification · expiration',
      value: '', state: 'empty',
      source: '—',
      attested: false,
      hint: 'Cedar Health requires ACLS for OR privileges. Upload card or request from AHA.',
    },
  ],
};
window.APPLICATION_V2_ACTIVE_SECTION = APPLICATION_V2_ACTIVE_SECTION;

// Autofill suggestions panel — what the system has found in the Inbox
// that could prefill remaining empty rows. Each suggestion carries
// provenance so the clinician sees WHERE the value would come from.
const APPLICATION_V2_AUTOFILL_SUGGESTIONS = [
  {
    id: 'sug-1', targetRow: 'C.11', targetLabel: 'ACLS certification · expiration',
    value: '2027-04-22',
    source: 'aha_acls_card_2025.pdf · uploaded 2026-04-15',
    source_kind: 'document',
    confidence: 'high',
    extractedFields: ['issued', 'expiration', 'card_id'],
  },
  {
    id: 'sug-2', targetRow: 'D.4', targetLabel: 'Memorial Hosp. · supervisor reference',
    value: 'Dr. Anika Rao · arao@memorial.org · (714) 555-0182',
    source: 'memorial_offboarding_packet.pdf · uploaded 2026-04-15',
    source_kind: 'document',
    confidence: 'medium',
    extractedFields: ['supervisor_name', 'supervisor_contact'],
  },
  {
    id: 'sug-3', targetRow: 'E.2', targetLabel: 'Memorial Hosp. · privileges held',
    value: 'Orthopedic Surgery · First Assist · 2024-08 → 2026-03',
    source: 'memorial_priv_letter_2026-03.pdf · uploaded 2026-03-28',
    source_kind: 'document',
    confidence: 'high',
    extractedFields: ['privilege_set', 'start_date', 'end_date'],
  },
];
window.APPLICATION_V2_AUTOFILL_SUGGESTIONS = APPLICATION_V2_AUTOFILL_SUGGESTIONS;

// Submission gate — strict pre-submit checklist. Any unchecked item
// disables the SUBMIT action; the gate is the load-bearing piece of
// the active state. Mirrors the PSV checklist contract from Wave 7.
const APPLICATION_V2_SUBMIT_GATE = [
  { id: 'g1', label: 'Every required field has a value',
    state: 'partial', detail: '95 of 98 filled · 3 still empty in §G, §I, §J' },
  { id: 'g2', label: 'No active conflicts between sources',
    state: 'fail', detail: '1 conflict · §C.6 DEA registration' },
  { id: 'g3', label: 'No fields are stale beyond freshness window',
    state: 'warn', detail: '1 row near expiration · §C.10 BLS' },
  { id: 'g4', label: 'Every section attestation strip is initialed',
    state: 'partial', detail: '4 of 10 sections initialed' },
  { id: 'g5', label: 'Authorization & Release signed',
    state: 'fail', detail: '§J not started · required to seal packet' },
  { id: 'g6', label: 'Identity verification within 48h',
    state: 'pass', detail: 'NPPES re-verified 2026-05-09 11:38 UTC' },
];
window.APPLICATION_V2_SUBMIT_GATE = APPLICATION_V2_SUBMIT_GATE;

// Activity log — recent composition events. Drives the right-rail
// "What happened" feed and is the source of truth for autosave receipts.
const APPLICATION_V2_ACTIVITY = [
  { ts: '2026-05-09 11:42 UTC', who: 'M. Miller',  what: 'edited §C.1 — entered CA license number',          kind: 'edit' },
  { ts: '2026-05-09 11:39 UTC', who: 'system',     what: 'autofilled §C.7, §C.8 from DEA registry',            kind: 'autofill' },
  { ts: '2026-05-09 11:38 UTC', who: 'system',     what: 'detected conflict on §C.6 DEA — DEA vs. CAQH',       kind: 'conflict' },
  { ts: '2026-05-09 11:32 UTC', who: 'system',     what: 'flagged §C.10 BLS as nearing expiration',            kind: 'stale' },
  { ts: '2026-05-08 17:11 UTC', who: 'M. Miller',  what: 'completed §B Education & Training',                  kind: 'milestone' },
  { ts: '2026-05-08 16:47 UTC', who: 'system',     what: 'autofilled §B.1–§B.6 from Western U. transcript',    kind: 'autofill' },
  { ts: '2026-05-04 09:22 UTC', who: 'M. Miller',  what: 'opened packet · session 3 of 4',                     kind: 'session' },
];
window.APPLICATION_V2_ACTIVITY = APPLICATION_V2_ACTIVITY;
