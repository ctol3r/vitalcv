// WAVE 15 · Career Autopilot (Trust Mode)
// Clinician-side ambient infrastructure: renewals, portability, drift, NBA.

const AUTOPILOT_CLINICIAN = {
  name: 'Macie Miller, PA-C',
  npi: '1346053246',
  homeState: 'CA',
  homeBoard: 'Medical Board of California',
  primaryFacility: 'Cedar Health · Surgical Pavilion',
  trustLevel: 'T3',                           // Verified · Active
  trustScore: 0.94,                           // composite, see DRIFT_FACTORS
  monitoringSince: '2024-09-12',
  lastFullSync: '2026-04-18 14:32 UTC',
  enrollmentsActive: 23,                      // payer panels currently effective
};
window.AUTOPILOT_CLINICIAN = AUTOPILOT_CLINICIAN;

// Renewal radar — every credential plotted on a 0-540 day horizon.
// kind: license | dea | board | certification | enrollment | clearance
// daysToExpire negative = expired (system blocks scheduling)
const RENEWAL_HORIZON = [
  { id: 'lic-ca',      kind: 'license',      label: 'CA PA License',                  expires: '2026-09-30', daysToExpire: 156, action: 'renew_self', protocol: 'CA BPC §3530.5 · CME 50 hrs/2yr',     authority: 'Medical Board of California', autoRenewable: true,  fee: '$370',  cmeRequired: 50, cmeOnFile: 38 },
  { id: 'dea',         kind: 'dea',          label: 'DEA Registration',               expires: '2026-08-15', daysToExpire: 110, action: 'renew_self', protocol: 'DEA Form 224a · 3-yr cycle',           authority: 'US DEA',                       autoRenewable: true,  fee: '$888',  cmeRequired: null, cmeOnFile: null },
  { id: 'cert-ncc',    kind: 'board',        label: 'NCCPA Certification',            expires: '2027-12-31', daysToExpire: 612, action: 'monitor',     protocol: 'NCCPA · PANRE 10-yr cycle',           authority: 'NCCPA',                        autoRenewable: false, fee: '$350',  cmeRequired: 100, cmeOnFile: 62 },
  { id: 'cert-acls',   kind: 'certification',label: 'ACLS Card',                       expires: '2026-06-04', daysToExpire: 39,  action: 'urgent',      protocol: 'AHA · 2-yr renewal · in-person skills', authority: 'American Heart Assn',         autoRenewable: false, fee: '$255',  cmeRequired: null, cmeOnFile: null, classBooked: false },
  { id: 'cert-bls',    kind: 'certification',label: 'BLS Card',                        expires: '2027-01-10', daysToExpire: 259, action: 'monitor',     protocol: 'AHA · 2-yr renewal',                  authority: 'American Heart Assn',         autoRenewable: false, fee: '$95',   cmeRequired: null, cmeOnFile: null },
  { id: 'med-rev',     kind: 'enrollment',   label: 'Medicare Revalidation',          expires: '2027-02-28', daysToExpire: 308, action: 'monitor',     protocol: 'CMS · 5-yr revalidation cycle',       authority: 'CMS · PECOS',                  autoRenewable: false, fee: 'no fee', cmeRequired: null, cmeOnFile: null },
  { id: 'priv-ced',    kind: 'enrollment',   label: 'Cedar Privileges',                expires: '2028-04-30', daysToExpire: 735, action: 'monitor',     protocol: 'Cedar Bylaws §IV · 2-yr re-privileging', authority: 'Cedar Credentials Cmte',      autoRenewable: false, fee: 'no fee', cmeRequired: null, cmeOnFile: null },
  { id: 'tb',          kind: 'clearance',    label: 'TB · annual',                     expires: '2026-04-25', daysToExpire: 0,   action: 'expiring',    protocol: 'TJC IC.02.04.01 · annual',            authority: 'Cedar Employee Health',       autoRenewable: false, fee: 'no fee', cmeRequired: null, cmeOnFile: null },
  { id: 'caqh',        kind: 'enrollment',   label: 'CAQH Re-attestation',             expires: '2026-07-12', daysToExpire: 76,  action: 'renew_self', protocol: 'CAQH · 120-day attestation',           authority: 'CAQH ProView',                 autoRenewable: true,  fee: 'no fee', cmeRequired: null, cmeOnFile: null },
];
window.RENEWAL_HORIZON = RENEWAL_HORIZON;

// Action category metadata
const ACTION_META = {
  monitor:    { label: 'Monitoring',     dot: 'bg-slate-400',   text: 'text-slate-600',  pill: 'bg-slate-100 ring-slate-300' },
  renew_self: { label: 'Renew',          dot: 'bg-indigo-500',  text: 'text-indigo-700', pill: 'bg-indigo-50 ring-indigo-600/20' },
  expiring:   { label: 'Expiring soon',  dot: 'bg-amber-500',   text: 'text-amber-800',  pill: 'bg-amber-50 ring-amber-600/20' },
  urgent:     { label: 'Action required',dot: 'bg-rose-500',    text: 'text-rose-700',   pill: 'bg-rose-50 ring-rose-600/20' },
};
window.ACTION_META = ACTION_META;

const KIND_META = {
  license:       { label: 'State License', glyph: '⚖' },
  dea:           { label: 'Controlled Substance', glyph: 'Rx' },
  board:         { label: 'Board Cert', glyph: '◆' },
  certification: { label: 'Certification', glyph: '+' },
  enrollment:    { label: 'Enrollment', glyph: '↳' },
  clearance:     { label: 'Health Clearance', glyph: '✚' },
};
window.KIND_META = KIND_META;

// Portability — states where you currently practice / are enrolled
// status: licensed | compact_eligible | enrolled_payer | dormant
const PORTABILITY_MAP = [
  { state: 'CA', name: 'California',  status: 'licensed',         since: '2018-06', payers: 23, primary: true,  note: 'Home state · Board #PA-58129' },
  { state: 'NV', name: 'Nevada',      status: 'compact_eligible', since: null,      payers: 0,  primary: false, note: 'Eligible via IMLC fast-track · 14-day issuance' },
  { state: 'OR', name: 'Oregon',      status: 'compact_eligible', since: null,      payers: 0,  primary: false, note: 'Eligible via IMLC fast-track · 21-day issuance' },
  { state: 'AZ', name: 'Arizona',     status: 'compact_eligible', since: null,      payers: 0,  primary: false, note: 'Eligible · MSO endorsement available' },
  { state: 'WA', name: 'Washington',  status: 'licensed',         since: '2022-03', payers: 4,  primary: false, note: 'License #WA-PA-22441 · Active · used last for tele-consult Q4' },
  { state: 'TX', name: 'Texas',       status: 'dormant',          since: '2019-08', payers: 0,  primary: false, note: 'License lapsed 2023-11 · reactivation requires 8 CME hrs' },
];
window.PORTABILITY_MAP = PORTABILITY_MAP;

// Next Best Actions — concrete, ranked, with provenance and dollar/day impact
const NBA_QUEUE = [
  {
    id: 'nba-acls',
    rank: 1,
    severity: 'high',
    title: 'Book ACLS skills check',
    subtitle: 'Card expires June 4 · 39 days · class slots tightening',
    impact: 'Without renewal, Cedar moderate-sedation privilege auto-suspends June 5.',
    receipt: 'Pulled from AHA roster · refreshed 14m ago',
    ctaLabel: 'See class slots near 94110',
    ctaSecondary: 'Snooze 7d',
  },
  {
    id: 'nba-cme',
    rank: 2,
    severity: 'medium',
    title: 'CA PA renewal · 12 CME hrs short',
    subtitle: 'Renewal opens July 1 · 38/50 hrs on file',
    impact: 'On current pace you finish CME 14 days late. Ten on-demand AAPA courses match your scope.',
    receipt: 'CME ledger reconciled with AAPA membership · 4d ago',
    ctaLabel: 'Plan CME (12 hrs)',
    ctaSecondary: 'I have credits elsewhere',
  },
  {
    id: 'nba-imlc',
    rank: 3,
    severity: 'low',
    title: 'Pre-stage NV license via IMLC',
    subtitle: 'Tahoe locum offers in your inbox · 14-day issuance',
    impact: 'Pre-staging captures up to ~$28k in tele-consult and locum margin without dual board fees.',
    receipt: 'Inferred from 3 inbound recruiter messages · last week',
    ctaLabel: 'Start IMLC pre-stage',
    ctaSecondary: 'Not interested',
  },
];
window.NBA_QUEUE = NBA_QUEUE;

// Drift monitor — for each canonical field, when was it last verified vs. attested?
// status: fresh | aging | stale | divergent
const DRIFT_FIELDS = [
  { id: 'address',     label: 'Practice address',   verifiedAt: '2026-04-12', attestedAt: '2026-04-18', status: 'fresh',     authority: 'NPPES · live ping',                        delta: '6 days' },
  { id: 'tin',         label: 'Tax ID / TIN',        verifiedAt: '2026-04-18', attestedAt: '2026-04-18', status: 'fresh',     authority: 'IRS TIN match · payer rosters',           delta: 'same day' },
  { id: 'dea',         label: 'DEA schedules',       verifiedAt: '2026-04-15', attestedAt: '2026-04-18', status: 'fresh',     authority: 'DEA registration database',                delta: '3 days' },
  { id: 'malpractice', label: 'Malpractice carrier', verifiedAt: '2026-01-09', attestedAt: '2026-04-18', status: 'aging',     authority: 'Coverage letter · MedPro',                 delta: '99 days' },
  { id: 'reference-1', label: 'Peer reference · Lin, MD', verifiedAt: '2025-08-22', attestedAt: '2026-04-18', status: 'stale', authority: 'Direct attestation · 2025-08',           delta: '239 days' },
  { id: 'phone',       label: 'Direct phone',        verifiedAt: '2025-12-04', attestedAt: '2026-04-18', status: 'aging',     authority: 'CAQH ProView',                              delta: '135 days' },
  { id: 'specialty',   label: 'Self-reported specialty', verifiedAt: null,       attestedAt: '2026-04-18', status: 'divergent', authority: 'No primary source · attestation only',    delta: 'never verified' },
];
window.DRIFT_FIELDS = DRIFT_FIELDS;

const DRIFT_META = {
  fresh:     { label: 'Fresh',     pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-600' },
  aging:     { label: 'Aging',     pill: 'bg-slate-100 text-slate-700 ring-slate-300',         dot: 'bg-slate-500' },
  stale:     { label: 'Stale',     pill: 'bg-amber-50 text-amber-800 ring-amber-600/20',       dot: 'bg-amber-500' },
  divergent: { label: 'Divergent', pill: 'bg-rose-50 text-rose-700 ring-rose-600/20',          dot: 'bg-rose-500' },
};
window.DRIFT_META = DRIFT_META;

// Trust score factors — composite for the headline number
const TRUST_FACTORS = [
  { label: 'Primary-source verifications fresh',    weight: 0.30, score: 0.97, note: '7/7 anchor sources within 30-day window' },
  { label: 'No active sanctions or NPDB queries',   weight: 0.25, score: 1.00, note: 'OIG/SAM clean · NPDB nightly · no actions' },
  { label: 'Document attestations current',         weight: 0.15, score: 0.92, note: '1 attestation aging > 60 days' },
  { label: 'Malpractice coverage on file',          weight: 0.15, score: 0.88, note: 'Carrier letter aging 99 days' },
  { label: 'CME / continuing competence pace',      weight: 0.10, score: 0.76, note: '38/50 hrs · on track if current pace holds' },
  { label: 'Profile drift index',                   weight: 0.05, score: 0.84, note: '2 fields aging · 1 divergent self-report' },
];
window.TRUST_FACTORS = TRUST_FACTORS;
