// WAVE 25 · Career Autopilot v2 — data fixtures
// Clinician-side ambient infrastructure, evolved. The original (Wave 15) was a
// dense renewal radar. v2 is calmer: ONE thing to do today, a clean horizon,
// the system queue separated from the human queue, and a drift score that
// breaks down into receipts.
//
// Reuse policy: AUTOPILOT_CLINICIAN, RENEWAL_HORIZON, ACTION_META, KIND_META,
// PORTABILITY_MAP from Wave 15 are still available for the legacy view.
// v2 introduces its own focused fixtures below.

const AUTOPILOT_V2_CLINICIAN = {
  name: 'Macie Miller, PA-C',
  npi: '1346053246',
  trustLevel: 'T3',
  trustScore: 0.94,
  monitoringSince: '2024-09-12',
  lastSync: '2026-05-09 11:52 UTC',
  asOf: '2026-05-09',
  homeState: 'CA',
  // Plain-English mode of operation.
  posture: 'ambient',                // ambient | attention-needed | urgent
  postureSummary: 'Everything is current. One thing to handle this week. Nothing on fire.',
};
window.AUTOPILOT_V2_CLINICIAN = AUTOPILOT_V2_CLINICIAN;

// "Today" focus — the single thing the clinician should look at today. Drives
// the hero card. Selected from NBA queue by impact × time-to-act.
const AUTOPILOT_V2_TODAY = {
  id: 'today-acls',
  title: 'Book your ACLS skills check',
  why: 'Cedar privileges auto-suspend if your card lapses. You have 26 days.',
  oneClick: 'Hold a slot at SF General · Sat May 24, 9:00 AM',
  alternativeLabel: 'See 11 other slots within 25 mi',
  signal: 'AHA roster refreshed 4 minutes ago',
  estCompletion: '4 hours · in-person',
  source: 'AHA ATLAS · primary',
  expiresOn: '2026-06-04',
};
window.AUTOPILOT_V2_TODAY = AUTOPILOT_V2_TODAY;

// Renewal horizon, simplified for v2. Each row carries a clear lane:
//   "system" — VitalCV will renew this for you
//   "human"  — only YOU can do this; we'll prompt you
//   "watch"  — we're just monitoring; nothing to do
const AUTOPILOT_V2_HORIZON = [
  { id: 'h1', label: 'CA PA License',          expires: '2026-09-30', days: 144, lane: 'system', auth: 'CA Medical Board',     fee: '$370', note: 'CME tracker on schedule · 38/50 hrs' },
  { id: 'h2', label: 'DEA Registration',       expires: '2026-08-15', days: 98,  lane: 'system', auth: 'US DEA',                fee: '$888', note: 'Will file Form 224a 60 days before' },
  { id: 'h3', label: 'CAQH Re-attestation',    expires: '2026-07-12', days: 64,  lane: 'system', auth: 'CAQH ProView',          fee: 'no fee', note: '23 payer panels depend on this' },
  { id: 'h4', label: 'ACLS Card',              expires: '2026-06-04', days: 26,  lane: 'human',  auth: 'AHA',                    fee: '$255', note: 'In-person skills check required' },
  { id: 'h5', label: 'TB · annual',            expires: '2026-04-25', days: 0,   lane: 'human',  auth: 'Cedar Employee Health',  fee: 'no fee', note: 'Done last year · book before lapse' },
  { id: 'h6', label: 'NCCPA Certification',    expires: '2027-12-31', days: 600, lane: 'watch',  auth: 'NCCPA',                  fee: '$350', note: '62/100 PANRE CME on file' },
  { id: 'h7', label: 'Medicare Revalidation',  expires: '2027-02-28', days: 296, lane: 'watch',  auth: 'CMS · PECOS',            fee: 'no fee', note: 'Pre-fills from current packet' },
  { id: 'h8', label: 'Cedar Privileges',       expires: '2028-04-30', days: 723, lane: 'watch',  auth: 'Cedar Credentials Cmte', fee: 'no fee', note: 'Re-privileging cycle 2-yr' },
];
window.AUTOPILOT_V2_HORIZON = AUTOPILOT_V2_HORIZON;

// Drift score breakdown. The composite trust score (0-1) is built from these
// signals — the panel renders each contributor with its weight and source.
const AUTOPILOT_V2_DRIFT = {
  composite: 0.94,
  band: 'Stable',                    // Stable | Watching | Drifting
  asOf: '2026-05-09 11:52 UTC',
  components: [
    { id: 'd1', label: 'Identity (NPPES)',          score: 1.00, weight: 0.20, status: 'unchanged 8d',         source: 'NPPES daily delta' },
    { id: 'd2', label: 'Sanctions (OIG/LEIE)',      score: 1.00, weight: 0.20, status: 'clean · monthly run',  source: 'OIG monthly · May 2026' },
    { id: 'd3', label: 'Licensure freshness',       score: 0.92, weight: 0.20, status: '2 sources <30d',       source: 'CA MBC + WA PA registry' },
    { id: 'd4', label: 'DEA freshness',             score: 0.95, weight: 0.10, status: 'last refresh 11d',     source: 'DEA public registry' },
    { id: 'd5', label: 'Document attestation age',  score: 0.84, weight: 0.15, status: '1 doc >180d',          source: 'Inbox · ACLS card' },
    { id: 'd6', label: 'Address / contact match',   score: 0.96, weight: 0.05, status: 'NPPES vs CAQH match',   source: 'NPPES + CAQH cross-ref' },
    { id: 'd7', label: 'CME progress vs window',    score: 0.76, weight: 0.10, status: '38 of 50 hrs · 12 to go', source: 'CA Provider CME ledger' },
  ],
};
window.AUTOPILOT_V2_DRIFT = AUTOPILOT_V2_DRIFT;

// Portability narrative — where could you work next, ranked by friction.
// Each entry has a *plain-English* time-to-practice, not just license rules.
const AUTOPILOT_V2_PORTABILITY = [
  { state: 'CA', name: 'California',  status: 'home',        ttp: 'now',     friction: 'none',    payers: 23, note: 'Home state · 23 payers active' },
  { state: 'WA', name: 'Washington',  status: 'licensed',    ttp: 'now',     friction: 'low',     payers: 4,  note: 'Active license · 4 payers · used last Q4' },
  { state: 'NV', name: 'Nevada',      status: 'compact',     ttp: '14 days', friction: 'low',     payers: 0,  note: 'IMLC fast-track · we have the packet ready' },
  { state: 'OR', name: 'Oregon',      status: 'compact',     ttp: '21 days', friction: 'low',     payers: 0,  note: 'IMLC fast-track · we have the packet ready' },
  { state: 'AZ', name: 'Arizona',     status: 'compact',     ttp: '28 days', friction: 'medium',  payers: 0,  note: 'MSO endorsement option available' },
  { state: 'TX', name: 'Texas',       status: 'dormant',     ttp: '90 days', friction: 'high',    payers: 0,  note: 'Lapsed 2023-11 · 8 CME hrs to reinstate' },
];
window.AUTOPILOT_V2_PORTABILITY = AUTOPILOT_V2_PORTABILITY;

// What VitalCV did this week — the receipt-backed ambient log. This is the
// load-bearing element: the surface SHOWS work happening, not just promises.
const AUTOPILOT_V2_THIS_WEEK = [
  { ts: '2026-05-09 11:52 UTC', kind: 'monitor', what: 'Refreshed NPPES · no changes' },
  { ts: '2026-05-09 09:14 UTC', kind: 'monitor', what: 'Refreshed CA Medical Board · license active, no actions' },
  { ts: '2026-05-08 22:40 UTC', kind: 'monitor', what: 'Refreshed OIG / LEIE monthly run · no exclusions' },
  { ts: '2026-05-08 14:02 UTC', kind: 'auto',    what: 'Filed CME tracker pull from CA provider portal · 38/50 hrs' },
  { ts: '2026-05-07 17:28 UTC', kind: 'alert',   what: 'Detected ACLS expiring in 28 days · queued for your action' },
  { ts: '2026-05-06 08:01 UTC', kind: 'monitor', what: 'Refreshed DEA public registry · schedules unchanged' },
  { ts: '2026-05-05 11:07 UTC', kind: 'auto',    what: 'Pre-built CAQH attestation packet · ready to file in 64d' },
  { ts: '2026-05-04 09:33 UTC', kind: 'monitor', what: 'Refreshed WA PA registry · license active' },
];
window.AUTOPILOT_V2_THIS_WEEK = AUTOPILOT_V2_THIS_WEEK;

// Mailbox — items waiting for the clinician's eyes. Distinct from "today"
// (which is the ONE focus). Mailbox is the small backlog beneath that.
const AUTOPILOT_V2_MAILBOX = [
  { id: 'm1', kind: 'sign',     label: 'Sign annual delegation acknowledgment for VitalCV', from: 'VitalCV · admin', age: '2d', urgent: false },
  { id: 'm2', kind: 'review',   label: 'Review pre-built CAQH attestation packet',           from: 'system',          age: '4d', urgent: false },
  { id: 'm3', kind: 'attest',   label: 'Confirm "no new sanctions" for monthly attestation', from: 'system',          age: '5d', urgent: false },
];
window.AUTOPILOT_V2_MAILBOX = AUTOPILOT_V2_MAILBOX;

// Disclosures the surface honestly carries. Rendered in the footer.
const AUTOPILOT_V2_DISCLOSURES = [
  'VitalCV monitors public registries on your behalf. Renewals in the "system" lane are filed automatically using your stored attestations; nothing is filed without a fresh signed attestation from you.',
  'The drift score is a heuristic. It does not predict future actions and is not a substitute for primary-source verification when an employer is making an appointment decision.',
  'Portability time-to-practice estimates assume IMLC fast-track eligibility and are conservative. Actual timing depends on board responsiveness and your CME currency.',
];
window.AUTOPILOT_V2_DISCLOSURES = AUTOPILOT_V2_DISCLOSURES;
