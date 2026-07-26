// WAVE 21 · Activation Launchpad data
// Employer pilot-onboarding wizard. 4 steps to first usable receipt.
//
// IMPORTANT: this surface intentionally avoids any claim of integration,
// certification, or guaranteed time-to-decision. Estimates are gated on
// data the employer enters (Step 1 wage, Step 3 baseline).

// Single source of truth for estimate qualifier copy. Reused everywhere a
// numeric projection appears so the "estimate" framing cannot drift.
const LABEL_QUALIFIER = {
  countdown: 'Estimated · based on current ingestion rate',
  hours:     'Projected · subject to volume',
  dollars:   'Estimated · based on your default wage',
  baseline:  'You enter this · used as the comparison point for ROI',
};
window.LABEL_QUALIFIER = LABEL_QUALIFIER;

// Org under activation. `state` drives top-level routing inside the launchpad.
//   fresh       → all steps not-started, only Step 1 unlocked
//   activating  → Steps 1..N in flight (the normal demo state)
//   active      → handoff card replaces checklist
//   paused      → resume CTA visible, all steps frozen at last state
const ACTIVATION_ORG = {
  id: 'org_demo_pilot_01',
  displayName: '',                 // empty until Step 1 done
  baselinePolicy: null,            // { statesServed: [...], decisionSlaDays }
  defaultWageUsd: null,            // null = hours-only ROI render
  state: 'activating',
  pilotId: 'PILOT-2026-Q2-014',
  pilotStartedAt: '2026-05-06 09:12 UTC',
  pilotContact: 'Karen Patel · VP, Credentialing',
};
window.ACTIVATION_ORG = ACTIVATION_ORG;

// Step model. Each step exposes:
//   id, num, title, sub
//   state: 'not-started' | 'in-progress' | 'complete' | 'blocked-on-org-input'
//   gateReason (only when blocked-on-org-input)
//   completedAt (only when complete)
const ACTIVATION_STEPS = [
  {
    id: 'org-profile',
    num: 1,
    title: 'Org profile',
    sub: 'Display name, baseline policy, and the default wage we use for ROI math.',
  },
  {
    id: 'sample-uploads',
    num: 2,
    title: 'Sample uploads',
    sub: 'Upload 5+ sample clinician credential bundles. We parse and stage them in the Inbox.',
    minRequired: 5,
  },
  {
    id: 'baseline',
    num: 3,
    title: 'First-decision baseline',
    sub: 'Tell us your current time-to-first-decision in days. ROI is measured against this number.',
  },
  {
    id: 'go-live',
    num: 4,
    title: 'Go-live',
    sub: 'Confirm and switch the org from Activating to Active. Reveals ROI Console and Monitoring.',
  },
];
window.ACTIVATION_STEPS = ACTIVATION_STEPS;

// Step status meta — uses the existing app palette. Note: we use "Complete"
// (never "Verified") for done steps — Verified is reserved for PSV claims.
const STEP_STATUS_META = {
  'not-started':          { label: 'Not started', cls: 'text-slate-500 bg-white ring-slate-200',           dot: 'bg-slate-300' },
  'in-progress':          { label: 'In progress', cls: 'text-amber-800 bg-amber-50 ring-amber-600/20',     dot: 'bg-amber-500' },
  'complete':             { label: 'Complete',    cls: 'text-emerald-700 bg-emerald-50 ring-emerald-600/20', dot: 'bg-emerald-600' },
  'blocked-on-org-input': { label: 'Blocked',     cls: 'text-rose-700 bg-rose-50 ring-rose-600/20',         dot: 'bg-rose-500' },
};
window.STEP_STATUS_META = STEP_STATUS_META;

// Sample uploads — Step 2 fixture. Mix of states across the parse pipeline:
//   uploaded → parsed → extracted → staged-in-inbox
//   plus 'failed' for the degraded case (acceptance criterion).
const ACTIVATION_SAMPLE_UPLOADS = [
  { id: 'up_01', filename: 'sample_pa_macie_miller.pdf',     sizeKb: 412,  state: 'staged-in-inbox', uploadedAt: '6m ago',  parsedAt: '5m ago',  notes: 'PA-C bundle · CV + 3 license images + prior cred file' },
  { id: 'up_02', filename: 'sample_md_ortho_chen.pdf',       sizeKb: 1284, state: 'staged-in-inbox', uploadedAt: '5m ago',  parsedAt: '4m ago',  notes: 'MD bundle · 11 documents, OCR clean' },
  { id: 'up_03', filename: 'sample_np_psych_alvarez.pdf',    sizeKb: 982,  state: 'extracted',       uploadedAt: '4m ago',  parsedAt: '3m ago',  notes: 'NP bundle · awaiting field-level extraction review' },
  { id: 'up_04', filename: 'sample_md_em_okafor.pdf',        sizeKb: 2104, state: 'parsed',          uploadedAt: '3m ago',  parsedAt: '2m ago',  notes: 'MD · large file, parsing complete, extraction queued' },
  { id: 'up_05', filename: 'sample_pa_surg_lee.pdf',         sizeKb: 318,  state: 'uploaded',        uploadedAt: '90s ago', parsedAt: null,      notes: 'PA · in parser queue (position 2 of 3)' },
  { id: 'up_06', filename: 'sample_md_unreadable_scan.pdf',  sizeKb: 1620, state: 'failed',          uploadedAt: '8m ago',  parsedAt: null,      notes: 'OCR confidence below 0.40 on 7/9 pages — likely fax-of-fax. Re-upload a higher-quality scan.' },
  { id: 'up_07', filename: 'sample_np_fnp_wright.pdf',       sizeKb: 745,  state: 'staged-in-inbox', uploadedAt: '12m ago', parsedAt: '11m ago', notes: 'NP-FNP · clean parse, all 6 fields extracted' },
];
window.ACTIVATION_SAMPLE_UPLOADS = ACTIVATION_SAMPLE_UPLOADS;

// Status meta for upload pipeline.
const UPLOAD_STATE_META = {
  'uploaded':         { label: 'Uploaded',         pct: 25,  cls: 'text-slate-600 bg-slate-100 ring-slate-300',       dot: 'bg-slate-400' },
  'parsed':           { label: 'Parsed',           pct: 55,  cls: 'text-indigo-700 bg-indigo-50 ring-indigo-600/20',  dot: 'bg-indigo-500' },
  'extracted':        { label: 'Extracted',        pct: 80,  cls: 'text-amber-800 bg-amber-50 ring-amber-600/20',     dot: 'bg-amber-500' },
  'staged-in-inbox':  { label: 'Staged in Inbox',  pct: 100, cls: 'text-emerald-700 bg-emerald-50 ring-emerald-600/20', dot: 'bg-emerald-600' },
  'failed':           { label: 'Parse failed',     pct: 100, cls: 'text-rose-700 bg-rose-50 ring-rose-600/20',         dot: 'bg-rose-500' },
};
window.UPLOAD_STATE_META = UPLOAD_STATE_META;

// Observed ingestion rate — drives the Step-4 countdown.
// Updated as files move through the pipeline; static here for the demo.
const ACTIVATION_INGESTION_RATE = {
  observedFilesPerHour: 12,
  estimatedHoursToFirstReceipt: 26,
  // The countdown is a smoothed estimate — we never claim a guaranteed time.
  modelVersion: 'vc-launchpad-1.0',
};
window.ACTIVATION_INGESTION_RATE = ACTIVATION_INGESTION_RATE;

// Baseline the employer enters in Step 3.
// In the demo this is left null until they "submit" the form, then we drop in
// 21 days (the industry-typical pre-VitalCV number we benchmark against).
const ACTIVATION_BASELINE = {
  currentTimeToFirstDecisionDays: 21,
  source: 'Org-provided · entered by Karen Patel during activation',
};
window.ACTIVATION_BASELINE = ACTIVATION_BASELINE;

// ROI projection used by the side card. Hours are unconditional. The dollar
// field is computed in the renderer ONLY when ORG.defaultWageUsd is non-null.
const ACTIVATION_ROI_PROJECTION = {
  projectedHoursSavedWeek2: 38,
  // Dollar value is intentionally NOT precomputed — we want renderer-side gating.
  modelVersion: 'vc-roi-week2-1.1',
  basis: 'Comparison vs. org baseline of 21d → VitalCV first-receipt window of ~26h',
};
window.ACTIVATION_ROI_PROJECTION = ACTIVATION_ROI_PROJECTION;

// Curated dropdown options for Step 1 — keep the surface honest.
const STATES_OPTIONS = [
  { code: 'CA', label: 'California' },
  { code: 'TX', label: 'Texas' },
  { code: 'NY', label: 'New York' },
  { code: 'FL', label: 'Florida' },
  { code: 'WA', label: 'Washington' },
  { code: 'IL', label: 'Illinois' },
  { code: 'MA', label: 'Massachusetts' },
  { code: 'AZ', label: 'Arizona' },
  { code: 'CO', label: 'Colorado' },
  { code: 'OR', label: 'Oregon' },
];
window.STATES_OPTIONS = STATES_OPTIONS;

const SLA_OPTIONS = [
  { value: 3,  label: '3 days · aggressive' },
  { value: 5,  label: '5 days · industry leading' },
  { value: 7,  label: '7 days · default' },
  { value: 10, label: '10 days · conservative' },
  { value: 14, label: '14 days · matches our current process' },
];
window.SLA_OPTIONS = SLA_OPTIONS;

// Cross-wave routes for the post-go-live handoff card. These are placeholder
// hashes that map to existing app views in this prototype.
const ACTIVATION_HANDOFF_TARGETS = {
  roi:        { route: '#/roi',        label: 'Open ROI Console',  sub: 'Wave 22 · pilot-revenue surface' },
  monitoring: { route: '#/monitoring', label: 'Open monitoring',   sub: 'Wave 27 · refresh diffs + lane health' },
};
window.ACTIVATION_HANDOFF_TARGETS = ACTIVATION_HANDOFF_TARGETS;
