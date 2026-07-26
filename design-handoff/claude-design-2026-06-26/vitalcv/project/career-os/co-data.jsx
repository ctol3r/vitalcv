// Career OS — Career Evidence dataset.
// The "stack" the surfaces project from: an owned EvidenceCollection → TimelineProjection
// (Memory), TrustProjection (Reputation), GraphProjection (Mobility). All facts source-bound.

const ENTITY = {
  id: 'macie-miller',
  fullName: 'MACIE MILLER',
  credential: 'PA-C',
  specialty: 'Cardiology · Physician Assistant',
  npi: '1346053246',
  city: 'Los Angeles, CA',
  initials: 'MM',
  yearsPracticing: 4,
  enumerated: '2022',
  ledgerId: 'vcv-ledger:macie-miller:0x91f4',
  ownerSince: '2022-06-11',
};

/* ====================== THE SEVEN REPUTATION DIMENSIONS ======================
   Canon (W235): credibility is domain-specific. A profile, never a single score.
   value = current strength 0–100 (projected, never stored) · median = anonymous field median
   trend = recent direction · evidenceCount = verified events feeding the dimension */
const DIMENSIONS = [
  { key: 'authority',   label: 'Authority',   blurb: 'Standing to practice — licensure & certification, unbroken and unrestricted.', value: 88, median: 70, trend: 'steady', evidenceCount: 5, Icon: Icon.Badge,        fed: ['CA PA license', 'NCCPA cert', 'DEA', 'clean record'] },
  { key: 'clinical',    label: 'Clinical',    blurb: 'Credibility at the bedside — privileges, case volume, peer-corroborated care.', value: 74, median: 62, trend: 'rising', evidenceCount: 6, Icon: Icon.Stethoscope, fed: ['privileges', 'case volume', 'fellowship'] },
  { key: 'research',    label: 'Research',    blurb: 'Contribution to the field — peer-reviewed publication and scholarship.',       value: 41, median: 48, trend: 'rising', evidenceCount: 2, Icon: Icon.Microscope,  fed: ['publications', 'abstracts'] },
  { key: 'leadership',  label: 'Leadership',  blurb: 'Responsibility entrusted — services led, appointments, scope of teams.',        value: 33, median: 52, trend: 'rising', evidenceCount: 1, Icon: Icon.Briefcase,   fed: ['protocol lead'] },
  { key: 'academic',    label: 'Academic',    blurb: 'Training the next generation — teaching, mentorship, trainees supervised.',     value: 49, median: 46, trend: 'rising', evidenceCount: 3, Icon: Icon.GraduationCap, fed: ['precepting', 'fellowship faculty'] },
  { key: 'operational', label: 'Operational', blurb: 'Dependability at scale — tenure, continuity, institutional reliability.',       value: 79, median: 58, trend: 'steady', evidenceCount: 4, Icon: Icon.Activity,    fed: ['tenure', 'continuity'] },
  { key: 'service',     label: 'Service',     blurb: 'Stewardship of the profession — society work, committees, guideline authorship.', value: 36, median: 50, trend: 'rising', evidenceCount: 2, Icon: Icon.Users,       fed: ['committee', 'society'] },
];
window.DIMENSIONS = DIMENSIONS;
const DIM = Object.fromEntries(DIMENSIONS.map(d => [d.key, d]));
window.DIM = DIM;

/* ====================== CAREER EVENTS (the spine) ======================
   Each is a dated, sourced, typed CareerEvent. Reputation moves ONLY on verified events.
   dir: 'up' raises · 'floor' raises and sets a permanent floor · 'down' adverse (verified)
   state: verified | conferred | adverse | historical | pending | access */
const EVENTS = [
  {
    id: 'ev-degree-bs', year: 2017, date: '2017-05', kind: 'Education', icon: 'GraduationCap',
    title: 'B.S. Biological Sciences', org: 'University of California, Davis',
    detail: 'Undergraduate degree conferred. Foundation evidence; verified via registrar attestation.',
    source: 'UC Davis Registrar', authority: 'Institutional registrar · direct attestation',
    state: 'verified', tier: 'T3', dir: 'up', dims: [], era: 'formation',
    receipt: 'vc2:edu:0x2a7c…41de',
  },
  {
    id: 'ev-pa-school', year: 2022, date: '2022-06', kind: 'Education', icon: 'GraduationCap',
    title: 'M.S. Physician Assistant Studies', org: 'Stanford University · School of Medicine',
    detail: 'Terminal professional degree. PSV via registrar direct. The credential that opens licensure.',
    source: 'Stanford Registrar', authority: 'Institutional registrar · direct attestation',
    state: 'verified', tier: 'T3', dir: 'up', dims: ['academic'], era: 'formation',
    receipt: 'vc2:edu:0x8c10…d74c',
  },
  {
    id: 'ev-nccpa', year: 2022, date: '2022-08', kind: 'Certification', icon: 'Badge',
    title: 'NCCPA Certification · PA-C', org: 'National Commission on Certification of PAs',
    detail: 'National board certification achieved. Primary-sealed by the issuing authority. Sets a permanent Authority floor.',
    source: 'NCCPA', authority: 'NCCPA · primary-sealed feed (T4)',
    state: 'verified', tier: 'T4', dir: 'floor', dims: ['authority'], era: 'formation',
    receipt: 'vc2:nccpa:0x4a7e…91c3',
  },
  {
    id: 'ev-fellowship', year: 2022, date: '2022-07', kind: 'Fellowship', icon: 'Award',
    title: 'Postgraduate PA Fellowship · Cardiology', org: 'UCLA Medical Center',
    detail: 'Competitive 12-month cardiology fellowship. Selective; corroborated by program director attestation. Raises Clinical and Academic standing.',
    source: 'UCLA GME', authority: 'Program · director attestation',
    state: 'verified', tier: 'T3', dir: 'up', dims: ['clinical', 'academic'], era: 'establishment',
    receipt: 'vc2:gme:0xc731…88aa',
  },
  {
    id: 'ev-license-ca', year: 2023, date: '2023-04', kind: 'Licensure', icon: 'Stamp',
    title: 'California PA License · PA-052987', org: 'Medical Board of California',
    detail: 'State license to practice issued, in good standing, no disciplinary actions. The Authority dimension a regulator reads.',
    source: 'CA Medical Board', authority: 'State of California · issuing authority',
    state: 'verified', tier: 'T3', dir: 'floor', dims: ['authority'], era: 'establishment',
    receipt: 'vc2:cabrd:0x55a2…0091',
  },
  {
    id: 'ev-claim', year: 2023, date: '2023-11', kind: 'Adverse', icon: 'AlertTri',
    title: 'Closed malpractice claim · settled', org: 'The Doctors Company · carrier record',
    detail: 'Allegation of delayed diagnosis. Settled for $18,000 indemnity, no admission of liability. Fully disclosed, investigated, resolved — surfaced literally, never softened. A verified adverse fact: the only kind that may lower standing.',
    source: 'Carrier · self-query', authority: 'Verified adverse fact · disclosed §H Q5',
    state: 'adverse', tier: 'T3', dir: 'down', dims: ['clinical'], era: 'establishment',
    receipt: 'vc2:att:0xa3-2023-11',
  },
  {
    id: 'ev-cedar', year: 2023, date: '2023-09', kind: 'Appointment', icon: 'Building',
    title: 'Allied Health appointment · PA, Cardiology', org: 'Cedar Health System',
    detail: 'Active clinical privileges granted. Continuity here builds Operational and Clinical standing month over month.',
    source: 'Cedar Health MSO', authority: 'Medical Staff Office · appointment record',
    state: 'verified', tier: 'T3', dir: 'up', dims: ['clinical', 'operational'], era: 'establishment',
    receipt: 'vc2:mso:0x4fe2…1dc4',
  },
  {
    id: 'ev-pub', year: 2024, date: '2024-03', kind: 'Publication', icon: 'Microscope',
    title: 'Co-author · peer-reviewed case series', org: 'J. Cardiovascular Nursing',
    detail: 'Peer-reviewed publication on PA-led post-MI follow-up protocols. Accretes Research standing; a body of work compounds over decades.',
    source: 'CrossRef · DOI', authority: 'Publisher · DOI-registered',
    state: 'verified', tier: 'T3', dir: 'up', dims: ['research'], era: 'establishment',
    receipt: 'vc2:doi:10.1097…7f2a',
  },
  {
    id: 'ev-dea', year: 2025, date: '2025-01', kind: 'Certification', icon: 'Badge',
    title: 'DEA Registration · Schedules II–V', org: 'U.S. Drug Enforcement Administration',
    detail: 'Federal prescribing authority active through 2027. Strengthens Authority; unlocks role eligibility across systems.',
    source: 'DEA', authority: 'DEA · federal registry',
    state: 'verified', tier: 'T3', dir: 'up', dims: ['authority'], era: 'establishment',
    receipt: 'vc2:dea:0xbm03…9127',
  },
  {
    id: 'ev-precept', year: 2025, date: '2025-06', kind: 'Academic', icon: 'GraduationCap',
    title: 'Clinical preceptor · PA students', org: 'Western U. of Health Sciences',
    detail: 'Named clinical preceptor for two PA rotations. Propagates practice beyond self — builds Academic standing.',
    source: 'Program affiliation', authority: 'Program · preceptor agreement',
    state: 'verified', tier: 'T2', dir: 'up', dims: ['academic'], era: 'establishment',
    receipt: 'vc2:precept:0x6a12…fe29',
  },
  {
    id: 'ev-protocol', year: 2025, date: '2025-10', kind: 'Leadership', icon: 'Briefcase',
    title: 'Lead · cardiology discharge protocol', org: 'Cedar Health System',
    detail: 'Led redesign of the PA-managed discharge protocol for the cardiology service. First entrusted responsibility — opens the Leadership dimension.',
    source: 'Cedar Health MSO', authority: 'Department · service record',
    state: 'verified', tier: 'T2', dir: 'up', dims: ['leadership', 'operational'], era: 'leadership',
    receipt: 'vc2:lead:0x88fe…1dc4',
  },
  {
    id: 'ev-society', year: 2026, date: '2026-02', kind: 'Service', icon: 'Users',
    title: 'Member · AAPA Cardiovascular caucus', org: 'American Academy of Physician Associates',
    detail: 'Society membership and committee participation. Early Service standing — stewardship peers confer over a career.',
    source: 'AAPA', authority: 'Society · membership record',
    state: 'verified', tier: 'T2', dir: 'up', dims: ['service'], era: 'leadership',
    receipt: 'vc2:aapa:0x01b4…fe29',
  },
];
window.EVENTS = EVENTS;

/* ====================== RECOGNITION (conferred — cannot self-claim) ====================== */
const RECOGNITION = [
  { id: 'rec-fellow-distinction', year: 2023, date: '2023-06', title: 'Fellowship Distinction in Cardiology', conferrer: 'UCLA Medical Center · GME',
    blurb: 'Awarded to the top fellow of the cohort. Conferred by the program, undecaying, cannot be self-claimed.', selectivity: '1 of 8 fellows', dims: ['clinical', 'academic'], state: 'conferred', receipt: 'vc2:rec:0xc7e1…0f' },
  { id: 'rec-poster', year: 2024, date: '2024-09', title: 'Best Poster · Regional PA Research Day', conferrer: 'CA Academy of PAs',
    blurb: 'Peer-judged recognition for the post-MI follow-up case series. Amplifies the verified publication beneath it.', selectivity: '1 of 40 posters', dims: ['research'], state: 'conferred', receipt: 'vc2:rec:0x4d22…81' },
  { id: 'rec-service-star', year: 2025, date: '2025-12', title: 'Service Excellence Recognition', conferrer: 'Cedar Health System',
    blurb: 'Institutional recognition for sustained reliability on the cardiology service. Conferred, on the record.', selectivity: 'department nomination', dims: ['operational'], state: 'conferred', receipt: 'vc2:rec:0x9a14…c3' },
];
window.RECOGNITION = RECOGNITION;

/* ====================== MAJOR MILESTONES (floors — never fall below) ====================== */
const MILESTONES = [
  { id: 'ms-nccpa',   year: 2022, label: 'Board certified', detail: 'NCCPA · PA-C', dim: 'authority', icon: 'Badge' },
  { id: 'ms-license', year: 2023, label: 'Licensed to practice', detail: 'California · PA-052987', dim: 'authority', icon: 'Stamp' },
  { id: 'ms-appoint', year: 2023, label: 'First clinical appointment', detail: 'Cedar Health · Cardiology', dim: 'clinical', icon: 'Building' },
  { id: 'ms-pub',     year: 2024, label: 'First peer-reviewed work', detail: 'J. Cardiovascular Nursing', dim: 'research', icon: 'Microscope' },
  { id: 'ms-lead',    year: 2025, label: 'First entrusted leadership', detail: 'Discharge protocol lead', dim: 'leadership', icon: 'Briefcase' },
];
window.MILESTONES = MILESTONES;

/* ====================== TRUST HISTORY (how belief in evidence changed) ======================
   Trust decays and refreshes. This is the audit trail of re-reads, corroboration, and freshness. */
const TRUST_HISTORY = [
  { t: '2026-06-18 02:14 UTC', kind: 'refresh', source: 'OIG / LEIE', msg: 'Monthly exclusion dataset re-read — no match. Sanction-clear confirmed.', tone: 'ok' },
  { t: '2026-06-11 09:00 UTC', kind: 'corroborate', source: 'PECOS', msg: 'Medicare enrollment re-confirmed at Cedar Health — corroborates appointment record.', tone: 'ok' },
  { t: '2026-05-30 14:05 UTC', kind: 'decay', source: 'CA Medical Board', msg: 'License freshness window approaching — re-query scheduled before expiry 2027-04-30.', tone: 'warn' },
  { t: '2026-04-08 18:41 UTC', kind: 'network', source: 'Partner network', msg: 'Passport re-used at OR Medical Group (Irvine) — federated corroboration of identity.', tone: 'info' },
  { t: '2026-03-04 11:22 UTC', kind: 'corroborate', source: 'NCCPA', msg: 'Certification re-sealed (T4) — primary-source signature renewed.', tone: 'ok' },
  { t: '2026-02-22 08:30 UTC', kind: 'refresh', source: 'NPPES', msg: 'Identity delta scan — no change to enumeration record.', tone: 'muted' },
  { t: '2025-11-02 16:12 UTC', kind: 'resolve', source: 'Carrier', msg: 'Closed-claim disclosure re-affirmed: settled, no admission, no further action.', tone: 'muted' },
];
window.TRUST_HISTORY = TRUST_HISTORY;

/* ====================== EVIDENCE SOURCES (what feeds reputation) ====================== */
const EVIDENCE_SOURCES = [
  { id: 'nppes', label: 'NPPES', authority: 'CMS · federal registry', tier: 'T4', feeds: ['authority'], state: 'verified', last: '2026-06-18', count: 3 },
  { id: 'nccpa', label: 'NCCPA', authority: 'National certification body', tier: 'T4', feeds: ['authority'], state: 'verified', last: '2026-03-04', count: 1 },
  { id: 'cabrd', label: 'CA Medical Board', authority: 'State of California', tier: 'T3', feeds: ['authority'], state: 'verified', last: '2026-05-30', count: 1 },
  { id: 'dea',   label: 'DEA', authority: 'U.S. DEA · federal', tier: 'T3', feeds: ['authority'], state: 'verified', last: '2026-01-12', count: 1 },
  { id: 'pecos', label: 'PECOS', authority: 'CMS · enrollment', tier: 'T3', feeds: ['operational'], state: 'verified', last: '2026-06-11', count: 2 },
  { id: 'mso',   label: 'Cedar Health MSO', authority: 'Medical Staff Office', tier: 'T3', feeds: ['clinical', 'operational', 'leadership'], state: 'verified', last: '2026-06-01', count: 4 },
  { id: 'gme',   label: 'UCLA GME', authority: 'Graduate medical education', tier: 'T3', feeds: ['clinical', 'academic'], state: 'verified', last: '2023-06-30', count: 2 },
  { id: 'doi',   label: 'CrossRef / DOI', authority: 'Publisher registry', tier: 'T3', feeds: ['research'], state: 'verified', last: '2024-03-15', count: 2 },
  { id: 'npdb',  label: 'NPDB', authority: 'HRSA · adverse history', tier: 'T4', feeds: ['authority', 'clinical'], state: 'access', last: '—', count: 0 },
];
window.EVIDENCE_SOURCES = EVIDENCE_SOURCES;

/* ====================== REPUTATION HISTORY (era-by-era accumulation) ======================
   Per-era projected strength of each dimension. Shows accumulation, never a single curve. */
const ERAS = [
  { key: 'formation',     label: 'Formation',     years: 'YR 0–1',  note: 'Establish Authority — degree, certification.' },
  { key: 'establishment', label: 'Establishment', years: 'YR 1–3',  note: 'Prove the work — privileges, first publication.' },
  { key: 'leadership',    label: 'Leadership',    years: 'YR 3–4',  note: 'Take responsibility — protocol lead, society.' },
  { key: 'standing',      label: 'Standing',      years: 'YR 4+',   note: 'Projected — steward the field over decades.' },
];
window.ERAS = ERAS;
// strength snapshots per era (0–100). 'standing' is projected (dashed).
const REP_HISTORY = {
  authority:   [62, 86, 88, 92],
  clinical:    [10, 58, 74, 84],
  research:    [4,  30, 41, 60],
  leadership:  [2,  12, 33, 58],
  academic:    [18, 38, 49, 66],
  operational: [6,  60, 79, 86],
  service:     [2,  16, 36, 56],
};
window.REP_HISTORY = REP_HISTORY;

/* ====================== MOBILITY ======================
   Readiness, opportunity signals, missing evidence, advancement paths.
   GraphProjection: where the owned ledger lets the clinician go next. */
const READINESS = {
  score: 82, label: 'Market-ready', sub: 'Conditional on two gated reads',
  dimensions: [
    { key: 'authority',  ready: true,  note: 'License + cert + DEA all current' },
    { key: 'clinical',   ready: true,  note: 'Privileges active · 4y continuity' },
    { key: 'operational',ready: true,  note: 'Steady tenure, reliability proven' },
    { key: 'research',   ready: false, note: 'Thin — one publication on record' },
    { key: 'leadership', ready: false, note: 'Emerging — one entrusted role' },
  ],
};
window.READINESS = READINESS;

const OPPORTUNITY_SIGNALS = [
  { id: 'op-reqs',    metric: '14', unit: 'open requisitions', label: 'You qualify today', detail: 'Across 6 health systems in the partner network, weighted to your verified profile.', tone: 'emerald', Icon: Icon.Briefcase },
  { id: 'op-dea',     metric: '+32', unit: 'unlock with DEA-state pairing', label: 'Nearby unlock', detail: 'Multi-state prescribing pairing would surface 32 additional role matches.', tone: 'indigo', Icon: Icon.TrendingUp },
  { id: 'op-network', metric: '147', unit: 'roles in network radius', label: 'Total addressable', detail: 'Within a 60-mile radius of Los Angeles, matched to a cardiology PA profile.', tone: 'slate', Icon: Icon.Network },
  { id: 'op-comp',    metric: '78th', unit: 'compensation percentile', label: 'Standing vs. field', detail: 'Projected against an anonymous field median for your dimensions — never a named ranking.', tone: 'slate', Icon: Icon.Gauge },
];
window.OPPORTUNITY_SIGNALS = OPPORTUNITY_SIGNALS;

const MISSING_EVIDENCE = [
  { id: 'me-npdb',     label: 'NPDB Continuous Query', dim: 'authority', impact: 'Required by most employers', state: 'access',  owner: 'Employer', detail: 'Federal law requires an authorized institution to query. Unlocks the adverse-history lane.', unlocks: 'gate · most roles' },
  { id: 'me-nv-license', label: 'Nevada + Arizona licensure', dim: 'authority', impact: '+11 systems, ~380mi radius', state: 'unknown', owner: 'Clinician', detail: 'Adding compact-adjacent state licenses expands the addressable radius substantially.', unlocks: '+11 systems' },
  { id: 'me-pub2',     label: 'Second peer-reviewed work', dim: 'research', impact: 'Lifts Research above median', state: 'unknown', owner: 'Clinician', detail: 'A second publication would move Research standing from below to above the field median.', unlocks: 'research tier' },
  { id: 'me-acls',     label: 'Refresh ACLS attestation', dim: 'clinical', impact: 'Keeps Clinical fresh', state: 'pending', owner: 'Clinician', detail: 'Current through 2027 — a routine refresh keeps the freshness window green.', unlocks: 'freshness' },
];
window.MISSING_EVIDENCE = MISSING_EVIDENCE;

const ADVANCEMENT_PATHS = [
  {
    id: 'path-lead', title: 'Lead Advanced Practice Provider', horizon: '12–24 months', match: 71,
    summary: 'A service-line leadership track. Builds on your protocol-lead role and operational standing.',
    have: ['Operational standing', 'Clinical credibility', 'Entrusted protocol lead'],
    need: ['Second leadership appointment', 'Formal supervision of ≥3 APPs'],
    dims: ['leadership', 'operational'],
  },
  {
    id: 'path-academic', title: 'Clinical Faculty · PA Program', horizon: '18–36 months', match: 58,
    summary: 'An educator track. Your preceptor record and fellowship distinction are the foundation.',
    have: ['Preceptor record', 'Fellowship distinction', 'Academic standing rising'],
    need: ['Faculty appointment', 'Sustained teaching load', 'Curriculum contribution'],
    dims: ['academic', 'research'],
  },
  {
    id: 'path-specialist', title: 'Senior Cardiology PA · tertiary center', horizon: '6–12 months', match: 86,
    summary: 'A depth track at a higher-acuity center. Your strongest, most immediate path.',
    have: ['Cardiology fellowship', 'CAQ track', '4y continuity', 'Clean record'],
    need: ['NPDB query (employer)', 'Reference refresh'],
    dims: ['clinical', 'authority'],
  },
];
window.ADVANCEMENT_PATHS = ADVANCEMENT_PATHS;

window.ENTITY = ENTITY;
