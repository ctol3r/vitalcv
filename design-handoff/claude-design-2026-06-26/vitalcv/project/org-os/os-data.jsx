// ════════════════════════════════════════════════════════════════════════
// VitalCV · Organization Operating System — W510
// os-data.jsx — synthetic but coherent workforce dataset for Meridian Health
// NOW anchor: 2026-06-26
// ════════════════════════════════════════════════════════════════════════

const NOW = new Date('2026-06-26T09:14:00');
const NOW_LABEL = 'Jun 26, 2026 · 09:14';

const ORG = {
  name: 'Meridian Health',
  kind: 'Integrated delivery network',
  region: 'Pacific Northwest · 5 facilities',
  totalProviders: 842,
  workingSet: 'Live roster · all NPIs enrolled on VitalCV',
  facilities: [
    { id: 'mgen', name: 'Meridian General',      short: 'MGen',  providers: 314 },
    { id: 'cedar', name: 'Cedar Valley Medical',  short: 'Cedar', providers: 196 },
    { id: 'north', name: 'Northgate Clinics',     short: 'North', providers: 168 },
    { id: 'harbor', name: 'Harbor Point Surgical', short: 'Harbor', providers: 92 },
    { id: 'tele', name: 'Meridian Telehealth',     short: 'Tele',  providers: 72 },
  ],
};

// ── helpers ───────────────────────────────────────────────────────────────
function daysUntil(iso) {
  const d = new Date(iso + 'T00:00:00');
  return Math.round((d - NOW) / 86400000);
}
function daysAgo(iso) {
  const d = new Date(iso + 'T00:00:00');
  return Math.round((NOW - d) / 86400000);
}
function initials(name) {
  return name.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
}
// readiness derived from the weakest signal a provider carries
//   ready   — fully verified, evidence fresh, license clear
//   watch   — fresh but something approaching (license < 90d, evidence aging)
//   gap     — missing or stale credential, action required
//   blocked — cannot work today (expired license, exclusion, suspended)

// ── provider roster ─────────────────────────────────────────────────────
// trust = composite 0–100 (federal source confirmation + evidence depth + continuity)
const PROVIDERS = [
  { name: 'Macie Miller',     role: 'PA-C',   spec: 'Hospital Medicine',     fac: 'mgen',   npi: '1346053246', emp: 'Employed', trust: 96, readiness: 'ready',   evidence: 6,   licState: 'WA', licType: 'Physician Assistant', licExp: '2027-08-31', tenure: 41, mobility: 3, lastVerified: '2026-06-25', value: 'high', flags: [] },
  { name: 'David Okonkwo',    role: 'MD',     spec: 'Cardiology',            fac: 'mgen',   npi: '1730412882', emp: 'Employed', trust: 98, readiness: 'ready',   evidence: 3,   licState: 'WA', licType: 'Physician & Surgeon', licExp: '2028-02-28', tenure: 88, mobility: 2, lastVerified: '2026-06-26', value: 'high', flags: [] },
  { name: 'Priya Nair',       role: 'MD',     spec: 'Anesthesiology',        fac: 'harbor', npi: '1992730015', emp: 'Employed', trust: 94, readiness: 'watch',   evidence: 22,  licState: 'WA', licType: 'Physician & Surgeon', licExp: '2026-09-12', tenure: 63, mobility: 1, lastVerified: '2026-06-19', value: 'high', flags: ['license-90'] },
  { name: 'James Whitfield',  role: 'CRNA',   spec: 'Anesthesia',            fac: 'harbor', npi: '1558204417', emp: 'Employed', trust: 91, readiness: 'ready',   evidence: 9,   licState: 'WA', licType: 'Registered Nurse · APRN', licExp: '2027-04-30', tenure: 27, mobility: 4, lastVerified: '2026-06-24', value: 'mid', flags: [] },
  { name: 'Sofia Reyes',      role: 'NP',     spec: 'Family Medicine',       fac: 'north',  npi: '1043390228', emp: 'Employed', trust: 88, readiness: 'gap',     evidence: 61,  licState: 'WA', licType: 'Nurse Practitioner', licExp: '2027-01-15', tenure: 19, mobility: 2, lastVerified: '2026-04-26', value: 'mid', flags: ['evidence-stale', 'dea-missing'] },
  { name: 'Marcus Bell',      role: 'MD',     spec: 'Emergency Medicine',    fac: 'mgen',   npi: '1629948100', emp: 'Locum',    trust: 79, readiness: 'watch',   evidence: 14,  licState: 'WA', licType: 'Physician & Surgeon', licExp: '2026-08-04', tenure: 4,  mobility: 7, lastVerified: '2026-06-12', value: 'mid', flags: ['license-90', 'locum'] },
  { name: 'Elena Petrov',     role: 'MD',     spec: 'Radiology',             fac: 'cedar',  npi: '1881556203', emp: 'Telehealth',trust: 92, readiness: 'ready',   evidence: 7,   licState: 'WA', licType: 'Physician & Surgeon', licExp: '2027-11-20', tenure: 33, mobility: 5, lastVerified: '2026-06-25', value: 'mid', flags: [] },
  { name: 'Tobias Grant',     role: 'DO',     spec: 'Orthopedic Surgery',    fac: 'harbor', npi: '1457009912', emp: 'Employed', trust: 95, readiness: 'ready',   evidence: 5,   licState: 'WA', licType: 'Osteopathic Physician', licExp: '2028-06-30', tenure: 71, mobility: 1, lastVerified: '2026-06-26', value: 'high', flags: [] },
  { name: 'Hannah Cole',      role: 'NP',     spec: 'Oncology',              fac: 'cedar',  npi: '1304778820', emp: 'Employed', trust: 90, readiness: 'watch',   evidence: 18,  licState: 'WA', licType: 'Nurse Practitioner', licExp: '2026-08-22', tenure: 52, mobility: 2, lastVerified: '2026-06-20', value: 'high', flags: ['license-90'] },
  { name: 'Raymond Liu',      role: 'MD',     spec: 'Gastroenterology',      fac: 'mgen',   npi: '1720394455', emp: 'Employed', trust: 93, readiness: 'ready',   evidence: 11,  licState: 'WA', licType: 'Physician & Surgeon', licExp: '2027-09-09', tenure: 60, mobility: 3, lastVerified: '2026-06-23', value: 'high', flags: [] },
  { name: 'Grace Adeyemi',    role: 'PA-C',   spec: 'Dermatology',           fac: 'north',  npi: '1612330078', emp: 'Employed', trust: 87, readiness: 'gap',     evidence: 44,  licState: 'WA', licType: 'Physician Assistant', licExp: '2027-03-18', tenure: 23, mobility: 2, lastVerified: '2026-05-13', value: 'mid', flags: ['cme-gap'] },
  { name: 'Owen Fletcher',    role: 'MD',     spec: 'Internal Medicine',     fac: 'north',  npi: '1390557741', emp: 'Employed', trust: 84, readiness: 'blocked', evidence: 30,  licState: 'WA', licType: 'Physician & Surgeon', licExp: '2026-06-10', tenure: 38, mobility: 2, lastVerified: '2026-06-11', value: 'mid', flags: ['license-expired'] },
  { name: 'Naomi Schwartz',   role: 'MD',     spec: 'Neurology',             fac: 'cedar',  npi: '1845220967', emp: 'Employed', trust: 96, readiness: 'ready',   evidence: 4,   licState: 'WA', licType: 'Physician & Surgeon', licExp: '2028-01-31', tenure: 79, mobility: 1, lastVerified: '2026-06-26', value: 'high', flags: [] },
  { name: 'Caleb Moreno',     role: 'CRNA',   spec: 'Anesthesia',            fac: 'harbor', npi: '1238847720', emp: 'Locum',    trust: 76, readiness: 'gap',     evidence: 38,  licState: 'OR', licType: 'Registered Nurse · APRN', licExp: '2027-02-01', tenure: 3,  mobility: 9, lastVerified: '2026-05-19', value: 'low', flags: ['state-mismatch', 'locum'] },
  { name: 'Isabel Fontaine',  role: 'NP',     spec: 'Pediatrics',            fac: 'north',  npi: '1567893011', emp: 'Employed', trust: 89, readiness: 'ready',   evidence: 8,   licState: 'WA', licType: 'Nurse Practitioner', licExp: '2027-07-07', tenure: 45, mobility: 2, lastVerified: '2026-06-24', value: 'mid', flags: [] },
  { name: 'Victor Hale',      role: 'MD',     spec: 'Pulmonology',           fac: 'mgen',   npi: '1409928374', emp: 'Employed', trust: 91, readiness: 'watch',   evidence: 16,  licState: 'WA', licType: 'Physician & Surgeon', licExp: '2026-09-28', tenure: 56, mobility: 2, lastVerified: '2026-06-18', value: 'high', flags: ['license-90'] },
  { name: 'Leila Haddad',     role: 'MD',     spec: 'OB/GYN',                fac: 'cedar',  npi: '1356771209', emp: 'Employed', trust: 94, readiness: 'ready',   evidence: 6,   licState: 'WA', licType: 'Physician & Surgeon', licExp: '2027-12-12', tenure: 67, mobility: 1, lastVerified: '2026-06-25', value: 'high', flags: [] },
  { name: 'Dominic Russo',    role: 'PA-C',   spec: 'Emergency Medicine',    fac: 'mgen',   npi: '1778452300', emp: 'Locum',    trust: 72, readiness: 'gap',     evidence: 52,  licState: 'WA', licType: 'Physician Assistant', licExp: '2026-10-30', tenure: 2,  mobility: 11,lastVerified: '2026-05-05', value: 'low', flags: ['evidence-stale', 'locum'] },
  { name: 'Amara Diallo',     role: 'MD',     spec: 'Endocrinology',         fac: 'north',  npi: '1690033418', emp: 'Telehealth',trust: 90, readiness: 'ready',   evidence: 10,  licState: 'WA', licType: 'Physician & Surgeon', licExp: '2027-10-04', tenure: 29, mobility: 4, lastVerified: '2026-06-22', value: 'mid', flags: [] },
  { name: 'Henry Caldwell',   role: 'DO',     spec: 'Hospital Medicine',     fac: 'mgen',   npi: '1523668094', emp: 'Employed', trust: 86, readiness: 'watch',   evidence: 24,  licState: 'WA', licType: 'Osteopathic Physician', licExp: '2026-09-05', tenure: 48, mobility: 2, lastVerified: '2026-06-15', value: 'mid', flags: ['license-90'] },
].map((p, i) => ({
  id: 'p' + (i + 1),
  initials: initials(p.name),
  licDays: daysUntil(p.licExp),
  verifiedDays: daysAgo(p.lastVerified),
  ...p,
}));

const FAC_NAME = Object.fromEntries(ORG.facilities.map(f => [f.id, f.short]));
const FAC_FULL = Object.fromEntries(ORG.facilities.map(f => [f.id, f.name]));

// ── readiness rollup (scaled to full org of 842) ──────────────────────────
const _rcount = { ready: 0, watch: 0, gap: 0, blocked: 0 };
PROVIDERS.forEach(p => { _rcount[p.readiness]++; });
// Org-wide readiness (the verdict the executive reads). The directory below
// shows a 20-provider working-set sample (`_rcount`) deliberately weighted to
// problems for review; the whole org is healthier and sums to totalProviders.
const READINESS = {
  sample: _rcount,
  ready:   733,
  watch:   71,
  gap:     28,
  blocked: 10,
};
READINESS.readyPct = Math.round((READINESS.ready / ORG.totalProviders) * 100);
READINESS.notReady = READINESS.gap + READINESS.blocked;

// 30-second verdict
const VERDICT = {
  headline: READINESS.readyPct >= 85 ? 'Workforce is ready' : 'Attention required',
  pct: READINESS.readyPct,
  tone: READINESS.readyPct >= 85 ? 'verified' : READINESS.readyPct >= 75 ? 'pending' : 'blocked',
  line: `${READINESS.ready} of ${ORG.totalProviders} providers can work today with current, source-verified credentials. ${READINESS.blocked} cannot work right now; ${READINESS.gap} need action this week.`,
};

// ── hiring pipeline ────────────────────────────────────────────────────────
const HIRING_STAGES = [
  { id: 'sourced',       label: 'Sourced',       sub: 'Identified · NPI matched' },
  { id: 'review',        label: 'Evidence Review', sub: 'Packet under decision' },
  { id: 'offer',         label: 'Offer',         sub: 'Terms out · awaiting accept' },
  { id: 'credentialing', label: 'Credentialing', sub: 'PSV + committee' },
  { id: 'starting',      label: 'Starting',      sub: 'Cleared · onboarding' },
];

const CANDIDATES = [
  { name: 'Olivia Brennan',  role: 'MD',   spec: 'Cardiology',         stage: 'review',        trust: 93, evidence: 91, days: 2,  recruiter: 'J. Okafor', fac: 'mgen',   offer: 0,   cred: 0,  signal: 'ready',  note: 'All federal lanes verified. Board-certified, no sanctions. Decision-ready.' },
  { name: 'Theo Nakamura',   role: 'CRNA', spec: 'Anesthesia',         stage: 'review',        trust: 81, evidence: 68, days: 5,  recruiter: 'M. Vance',  fac: 'harbor', offer: 0,   cred: 0,  signal: 'watch',  note: 'License verified. Malpractice history under review — one closed claim, 2021.' },
  { name: 'Renata Alvarez',  role: 'NP',   spec: 'Family Medicine',    stage: 'sourced',       trust: 88, evidence: 74, days: 1,  recruiter: 'J. Okafor', fac: 'north',  offer: 0,   cred: 0,  signal: 'ready',  note: 'Portable record imported from prior system. 4 orgs of continuity.' },
  { name: 'Kwame Mensah',    role: 'MD',   spec: 'Emergency Medicine', stage: 'sourced',       trust: 85, evidence: 70, days: 3,  recruiter: 'M. Vance',  fac: 'mgen',   offer: 0,   cred: 0,  signal: 'ready',  note: 'Active WA license, DEA current. Evidence packet 70% complete.' },
  { name: 'Sienna Bianchi',  role: 'MD',   spec: 'Hospital Medicine',  stage: 'offer',         trust: 95, evidence: 96, days: 4,  recruiter: 'J. Okafor', fac: 'cedar',  offer: 60,  cred: 0,  signal: 'ready',  note: 'Offer extended Jun 22. Verbal yes. Comp package finalizing.' },
  { name: 'Aaron Feldman',   role: 'PA-C', spec: 'Orthopedics',        stage: 'offer',         trust: 89, evidence: 88, days: 7,  recruiter: 'M. Vance',  fac: 'harbor', offer: 35,  cred: 0,  signal: 'watch',  note: 'Offer out 7 days, no response. Recruiter following up today.' },
  { name: 'Mira Solberg',    role: 'MD',   spec: 'Neurology',          stage: 'credentialing', trust: 97, evidence: 99, days: 11, recruiter: 'J. Okafor', fac: 'cedar',  offer: 100, cred: 72, signal: 'ready',  note: 'PSV complete. Committee review scheduled Jul 1. On track.' },
  { name: 'Dante Russo',     role: 'CRNA', spec: 'Anesthesia',         stage: 'credentialing', trust: 90, evidence: 92, days: 16, recruiter: 'M. Vance',  fac: 'harbor', offer: 100, cred: 48, signal: 'watch',  note: 'Awaiting one PSV: prior hospital privileges letter. Chased 2×.' },
  { name: 'Lucia Romano',    role: 'NP',   spec: 'Pediatrics',         stage: 'starting',      trust: 94, evidence: 98, days: 21, recruiter: 'J. Okafor', fac: 'north',  offer: 100, cred: 100,signal: 'ready',  note: 'Cleared. Start date Jun 30. Orientation booked.' },
  { name: 'Felix Andersen',  role: 'MD',   spec: 'Radiology',          stage: 'starting',      trust: 96, evidence: 97, days: 26, recruiter: 'M. Vance',  fac: 'cedar',  offer: 100, cred: 100,signal: 'ready',  note: 'Cleared. Telehealth credentialed. Start date Jul 6.' },
].map((c, i) => ({ id: 'c' + (i + 1), initials: initials(c.name), ...c }));

const PIPELINE = HIRING_STAGES.map(s => ({
  ...s,
  count: CANDIDATES.filter(c => c.stage === s.id).length,
  members: CANDIDATES.filter(c => c.stage === s.id),
}));

// ── workforce health derived sets ───────────────────────────────────────────
const EXPIRING = PROVIDERS
  .filter(p => p.licDays <= 120)
  .sort((a, b) => a.licDays - b.licDays);

const CRED_GAPS = PROVIDERS
  .filter(p => p.flags.some(f => ['dea-missing', 'cme-gap', 'evidence-stale', 'state-mismatch'].includes(f)))
  .map(p => ({
    ...p,
    gap: p.flags.includes('dea-missing') ? 'DEA registration not on file'
       : p.flags.includes('cme-gap')     ? 'CME cycle 14 credits short'
       : p.flags.includes('state-mismatch') ? 'License state ≠ work state (OR→WA)'
       : 'Evidence stale · re-pull required',
  }));

const COVERAGE = [
  { unit: 'Anesthesia · Harbor Point', staffed: 6, target: 8, risk: 'high',     note: '2 CRNA reqs open · 1 license expiring' },
  { unit: 'Emergency · Meridian Gen',  staffed: 11, target: 12, risk: 'watch',   note: '1 locum on 30-day, 1 candidate in offer' },
  { unit: 'Oncology · Cedar Valley',   staffed: 9,  target: 9,  risk: 'watch',   note: 'Fully staffed · 1 license expiring Aug' },
  { unit: 'Hospital Med · Meridian Gen', staffed: 22, target: 22, risk: 'low',    note: 'Stable · evidence fresh' },
  { unit: 'Primary Care · Northgate',  staffed: 14, target: 16, risk: 'high',     note: '1 provider blocked, 1 gap · 2 reqs' },
];

const HIGH_VALUE = PROVIDERS
  .filter(p => p.value === 'high')
  .map(p => ({
    ...p,
    retention: p.tenure > 60 ? 'anchored' : p.flags.includes('locum') ? 'flight-risk' : p.licDays < 90 ? 'at-risk' : 'stable',
  }))
  .sort((a, b) => b.trust - a.trust);

const RETENTION = {
  anchored:   HIGH_VALUE.filter(p => p.retention === 'anchored').length,
  stable:     PROVIDERS.filter(p => p.tenure >= 24 && !p.flags.includes('locum')).length,
  atRisk:     PROVIDERS.filter(p => p.licDays < 90 && p.value === 'high').length,
  flightRisk: PROVIDERS.filter(p => p.emp === 'Locum').length,
  avgTenure:  Math.round(PROVIDERS.reduce((s, p) => s + p.tenure, 0) / PROVIDERS.length),
};

// ── analytics series ────────────────────────────────────────────────────────
// time-to-start (days), trailing 8 months
const TTS_SERIES = [
  { m: 'Nov', v: 96 }, { m: 'Dec', v: 91 }, { m: 'Jan', v: 84 }, { m: 'Feb', v: 79 },
  { m: 'Mar', v: 71 }, { m: 'Apr', v: 64 }, { m: 'May', v: 58 }, { m: 'Jun', v: 52 },
];
const TTS_BASELINE = 119; // pre-VitalCV industry mean

// credential throughput — files cleared per week, trailing 8 weeks
const THROUGHPUT = [
  { w: 'W18', v: 14 }, { w: 'W19', v: 17 }, { w: 'W20', v: 16 }, { w: 'W21', v: 21 },
  { w: 'W22', v: 19 }, { w: 'W23', v: 24 }, { w: 'W24', v: 23 }, { w: 'W25', v: 27 },
];

// readiness over time (% ready), trailing 8 months
const READINESS_SERIES = [
  { m: 'Nov', v: 74 }, { m: 'Dec', v: 77 }, { m: 'Jan', v: 79 }, { m: 'Feb', v: 81 },
  { m: 'Mar', v: 83 }, { m: 'Apr', v: 85 }, { m: 'May', v: 86 }, { m: 'Jun', v: 87 },
];

// evidence freshness distribution (days since last verify, % of roster)
const FRESHNESS_DIST = [
  { band: '0–7d',    pct: 41, tone: 'verified' },
  { band: '8–30d',   pct: 34, tone: 'verified' },
  { band: '31–60d',  pct: 16, tone: 'pending' },
  { band: '61–90d',  pct: 6,  tone: 'pending' },
  { band: '90d+',    pct: 3,  tone: 'blocked' },
];

const ANALYTICS_KPIS = [
  { label: 'Median time-to-start', value: '52', unit: 'days', delta: -56, deltaLabel: 'vs 119d industry', tone: 'verified' },
  { label: 'Credential throughput', value: '27', unit: '/wk', delta: +93, deltaLabel: 'vs W18 baseline', tone: 'verified' },
  { label: 'Provider readiness',    value: '87', unit: '%',   delta: +13, deltaLabel: 'since Nov', tone: 'verified' },
  { label: 'Evidence freshness',    value: '75', unit: '% < 30d', delta: +8, deltaLabel: 'rolling 90d', tone: 'verified' },
];

// ── upcoming risks (dashboard) ──────────────────────────────────────────────
const RISKS = [
  { in: 0,   sev: 'high',  title: '10 providers blocked from work',     who: 'Owen Fletcher, MD +9 · expired or lapsed license', why: 'License not current', action: 'Hold privileges' },
  { in: 16,  sev: 'high',  title: 'Anesthesia coverage below target',  who: 'Harbor Point · 6 of 8 staffed', why: 'CRNA license expiring + 2 open reqs', action: 'Escalate hiring' },
  { in: 48,  sev: 'watch', title: '3 licenses expire within 90 days',  who: 'Nair, Hale, Caldwell + 2', why: 'Renewal not yet confirmed', action: 'Trigger renewals' },
  { in: 72,  sev: 'watch', title: '4 providers with stale evidence',   who: 'Reyes, Russo, Adeyemi, Moreno', why: 'Last verified > 45 days', action: 'Re-pull sources' },
];

Object.assign(window, {
  NOW, NOW_LABEL, ORG, PROVIDERS, FAC_NAME, FAC_FULL, READINESS, VERDICT,
  HIRING_STAGES, CANDIDATES, PIPELINE, EXPIRING, CRED_GAPS, COVERAGE,
  HIGH_VALUE, RETENTION, TTS_SERIES, TTS_BASELINE, THROUGHPUT,
  READINESS_SERIES, FRESHNESS_DIST, ANALYTICS_KPIS, RISKS,
  daysUntil, daysAgo, osInitials: initials,
});
