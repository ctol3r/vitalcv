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

/* ═══════════════════════════════════════════════════════════════════════════
   WAVE 1000 — CAREER PLATFORM datasets
   The career home for a clinician's whole professional life — not a résumé.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ---------- Career headline: where am I, right now ---------- */
const CAREER_STATE = {
  stage: 'Establishment → Leadership',
  stageNote: 'Year 4 of practice · first entrusted leadership on record',
  trustScore: 94, trustLabel: 'High · current',
  trustNote: 'All authority evidence fresh · 1 gated read pending',
  standing: '78th', standingNote: 'percentile vs. anonymous field median',
  momentum: 'rising', momentumNote: '5 of 7 dimensions trending up this year',
};
window.CAREER_STATE = CAREER_STATE;

/* ---------- What changed since you last looked ---------- */
const CAREER_CHANGES = [
  { id: 'ch1', tone: 'emerald', Icon: Icon.ShieldCheck, when: '2 days ago', title: 'OIG exclusion re-read — clear', detail: 'Monthly sanction screen confirmed no match. Authority stays green.' },
  { id: 'ch2', tone: 'violet',  Icon: Icon.Award,       when: '6 days ago', title: 'Service Excellence recognition conferred', detail: 'Cedar Health nominated you for sustained reliability on the cardiology service.' },
  { id: 'ch3', tone: 'indigo',  Icon: Icon.Eye,         when: '1 week ago', title: '3 recruiters viewed your verified profile', detail: 'Two tertiary centers and one academic system, all in-network.' },
  { id: 'ch4', tone: 'amber',   Icon: Icon.Clock,       when: '3 weeks ago', title: 'License freshness window opening', detail: 'CA PA license re-query scheduled before 2027-04-30 expiry.' },
];
window.CAREER_CHANGES = CAREER_CHANGES;

/* ---------- Next best actions (what should I do next) ---------- */
const NEXT_ACTIONS = [
  { id: 'na1', priority: 'high', Icon: Icon.Microscope, title: 'Submit your second publication', why: 'One more peer-reviewed work moves Research from below to above the field median — the single highest-leverage move on your record.', effort: 'In progress · draft 80%', dim: 'research' },
  { id: 'na2', priority: 'high', Icon: Icon.Stamp, title: 'Add Nevada + Arizona licensure', why: 'Compact-adjacent licenses expand your addressable market by 11 systems and ~380 miles.', effort: '~3 weeks · you own this', dim: 'authority' },
  { id: 'na3', priority: 'med', Icon: Icon.Users, title: 'Confirm AAPA committee seat', why: 'A standing committee role converts membership into Service standing the field reads.', effort: 'Reply to invitation', dim: 'service' },
  { id: 'na4', priority: 'med', Icon: Icon.Briefcase, title: 'Document the discharge-protocol outcomes', why: 'Quantified results turn your protocol lead into a citable leadership artifact.', effort: '~1 hour', dim: 'leadership' },
];
window.NEXT_ACTIONS = NEXT_ACTIONS;

/* ---------- Current organizations (affiliations) ---------- */
const ORGANIZATIONS = [
  { id: 'org-cedar', name: 'Cedar Health System', role: 'PA, Cardiology · Allied Health', kind: 'Employer', since: '2023', status: 'active', location: 'Los Angeles, CA', detail: 'Active clinical privileges · primary appointment', verified: true, tenureMonths: 33, icon: 'Building' },
  { id: 'org-aapa',  name: 'American Academy of Physician Associates', role: 'Member · Cardiovascular caucus', kind: 'Society', since: '2026', status: 'active', location: 'National', detail: 'Society membership · committee participation', verified: true, tenureMonths: 4, icon: 'Users' },
  { id: 'org-western', name: 'Western U. of Health Sciences', role: 'Clinical preceptor · PA program', kind: 'Academic', since: '2025', status: 'active', location: 'Pomona, CA', detail: 'Named preceptor · 2 rotations', verified: true, tenureMonths: 12, icon: 'GraduationCap' },
  { id: 'org-ucla',  name: 'UCLA Medical Center', role: 'Postgraduate PA Fellow · Cardiology', kind: 'Training', since: '2022', status: 'completed', location: 'Los Angeles, CA', detail: 'Completed 12-month fellowship · distinction', verified: true, tenureMonths: 12, icon: 'Award' },
];
window.ORGANIZATIONS = ORGANIZATIONS;

/* ---------- Experience (positions, longitudinal) ---------- */
const EXPERIENCE = [
  { id: 'xp-cedar', title: 'Physician Assistant · Cardiology', org: 'Cedar Health System', start: '2023', end: 'Present', current: true,
    summary: 'Inpatient and outpatient cardiology service. Manages post-MI follow-up, discharge protocols, and a steady patient panel.',
    facts: ['~1,400 patient encounters / year', 'Led PA-managed discharge protocol redesign', '33 months continuous · no gaps'], state: 'verified' },
  { id: 'xp-fellow', title: 'Postgraduate PA Fellow · Cardiology', org: 'UCLA Medical Center · GME', start: '2022', end: '2023', current: false,
    summary: 'Competitive 12-month cardiology fellowship. Rotated through cath lab, EP, heart failure, and consult service.',
    facts: ['1 of 8 fellows · cohort distinction', 'Cath lab + EP + heart failure rotations', 'Co-authored case series during fellowship'], state: 'verified' },
];
window.EXPERIENCE = EXPERIENCE;

/* ---------- Publications (detailed) ---------- */
const PUBLICATIONS = [
  { id: 'pub1', year: '2024', title: 'PA-led post-MI follow-up protocols: a single-center case series', venue: 'Journal of Cardiovascular Nursing', role: 'Co-author', doi: '10.1097/JCN.0000…7f2a', cites: 7, state: 'verified' },
  { id: 'pub2', year: '2026', title: 'Reducing 30-day readmission via structured APP discharge pathways', venue: 'In review · JACC: Advances', role: 'First author', doi: 'pending', cites: 0, state: 'pending' },
];
window.PUBLICATIONS = PUBLICATIONS;

/* ---------- Teaching record ---------- */
const TEACHING = [
  { id: 't1', label: 'PA students precepted', value: 6, sub: 'Western U. · 2 rotations / yr', icon: 'GraduationCap' },
  { id: 't2', label: 'Fellowship lectures', value: 9, sub: 'UCLA cardiology didactics', icon: 'Book' },
  { id: 't3', label: 'New-hire APPs onboarded', value: 4, sub: 'Cedar Health · 2024–26', icon: 'Users' },
];
window.TEACHING = TEACHING;

/* ---------- Professional relationships (the network) ---------- */
const RELATIONSHIPS = [
  { id: 'rel1', name: 'Dr. Helen Vasquez', role: 'Cardiology Fellowship Director', org: 'UCLA Medical Center', tie: 'Mentor', strength: 'strong', attests: 'Clinical · Academic', initials: 'HV', years: 4, willRef: true },
  { id: 'rel2', name: 'Dr. Marcus Lee', role: 'Chief, Cardiology Service', org: 'Cedar Health System', tie: 'Supervisor', strength: 'strong', attests: 'Clinical · Operational · Leadership', initials: 'ML', years: 3, willRef: true },
  { id: 'rel3', name: 'Sara Whitfield, PA-C', role: 'Senior PA · co-author', org: 'Cedar Health System', tie: 'Peer', strength: 'medium', attests: 'Research · Clinical', initials: 'SW', years: 3, willRef: true },
  { id: 'rel4', name: 'Dr. Anita Rao', role: 'PA Program Director', org: 'Western U. of Health Sciences', tie: 'Collaborator', strength: 'medium', attests: 'Academic · Teaching', initials: 'AR', years: 1, willRef: false },
  { id: 'rel5', name: 'James Okafor, PA-C', role: 'AAPA Caucus Chair', org: 'AAPA Cardiovascular', tie: 'Peer', strength: 'emerging', attests: 'Service', initials: 'JO', years: 1, willRef: false },
];
window.RELATIONSHIPS = RELATIONSHIPS;

/* ---------- Active career goals ---------- */
const GOALS = [
  { id: 'g1', title: 'Reach Senior Cardiology PA at a tertiary center', horizon: 'by 2027', progress: 78, dims: ['clinical', 'authority'],
    steps: [ { label: 'Cardiology fellowship', done: true }, { label: '4y continuity', done: true }, { label: 'NPDB query (employer)', done: false }, { label: 'Reference refresh', done: false } ] },
  { id: 'g2', title: 'Move Research standing above field median', horizon: 'by 2026 Q4', progress: 55, dims: ['research'],
    steps: [ { label: 'First publication', done: true }, { label: 'Best-poster recognition', done: true }, { label: 'Second publication', done: false } ] },
  { id: 'g3', title: 'Establish a leadership track', horizon: 'by 2028', progress: 34, dims: ['leadership', 'operational'],
    steps: [ { label: 'Protocol lead', done: true }, { label: 'Second appointment', done: false }, { label: 'Supervise ≥3 APPs', done: false } ] },
];
window.GOALS = GOALS;

/* ---------- Career intelligence insights ---------- */
const INSIGHTS = [
  { id: 'in1', Icon: Icon.TrendingUp, kind: 'Momentum', text: 'Your Clinical standing rose 16 points in 18 months — the fastest-moving dimension on your record.', tone: 'emerald' },
  { id: 'in2', Icon: Icon.Target,     kind: 'Leverage', text: 'A single second publication is worth more to your market position than any other available move.', tone: 'indigo' },
  { id: 'in3', Icon: Icon.Scale,      kind: 'Balance',  text: 'Authority and Operational are well above median; Research and Service trail. Your record is deep, not yet broad.', tone: 'slate' },
  { id: 'in4', Icon: Icon.Route,      kind: 'Horizon',  text: 'Two of three projected paths open within 24 months. The specialist track is open now.', tone: 'slate' },
];
window.INSIGHTS = INSIGHTS;

/* ═══ OPPORTUNITY CENTER ═══
   Aggregates internal recs, recruiter interest, org invitations, milestones,
   mobility suggestions, future readiness. Every item answers: why now · why you. */
const OPPORTUNITIES = [
  { id: 'opp1', lane: 'recruiter', kind: 'Recruiter interest', org: 'Scripps · La Jolla', role: 'Senior Cardiology PA', match: 86, comp: '$142–158k', location: 'San Diego, CA · 95mi',
    whyNow: 'Two openings posted this month; they filter for cardiology-fellowship PAs with ≥4y continuity — a thin pool.',
    whyYou: 'You match all required evidence today. Only an employer NPDB query stands between you and a verified application.',
    Icon: Icon.Eye, tone: 'indigo', hot: true },
  { id: 'opp2', lane: 'internal', kind: 'Internal recommendation', org: 'Cedar Health System', role: 'Lead Advanced Practice Provider', match: 71, comp: 'Band 4', location: 'Current employer',
    whyNow: 'Your discharge-protocol lead and Service Excellence recognition put you on the internal succession shortlist this cycle.',
    whyYou: 'You already hold the operational standing; the role needs one more documented leadership artifact you can produce this quarter.',
    Icon: Icon.Briefcase, tone: 'slate', hot: false },
  { id: 'opp3', lane: 'invitation', kind: 'Organization invitation', org: 'AAPA Cardiovascular', role: 'Standing committee seat', match: 92, comp: 'Service', location: 'National · remote',
    whyNow: 'The caucus is seating its 2026 guideline-review committee now; your membership and publication qualify you.',
    whyYou: 'A committee seat is the cleanest way to convert membership into Service standing the field actually reads.',
    Icon: Icon.Users, tone: 'violet', hot: false },
  { id: 'opp4', lane: 'mobility', kind: 'Mobility suggestion', org: '11 systems · NV + AZ', role: 'Multi-state expansion', match: 64, comp: '+32 role matches', location: 'Compact-adjacent',
    whyNow: 'Nevada and Arizona are processing PA licenses in ~3 weeks right now — a faster window than usual.',
    whyYou: 'Your clean record and current certifications make these near-automatic; they unlock a ~380-mile radius.',
    Icon: Icon.Route, tone: 'slate', hot: false },
  { id: 'opp5', lane: 'academic', kind: 'Recruiter interest', org: 'Western U. of Health Sciences', role: 'Clinical Faculty · PA Program', match: 58, comp: '$118–132k', location: 'Pomona, CA · 32mi',
    whyNow: 'They are expanding cardiology faculty for the next cohort and have seen your preceptor record.',
    whyYou: 'Your preceptor history and fellowship distinction are the foundation; the gap is a formal teaching load.',
    Icon: Icon.GraduationCap, tone: 'slate', hot: false },
];
window.OPPORTUNITIES = OPPORTUNITIES;

const FUTURE_READINESS = [
  { id: 'fr1', label: 'Specialist depth track', window: 'open now', ready: 100, note: 'Senior cardiology PA at a tertiary center — all evidence in hand.' },
  { id: 'fr2', label: 'Service-line leadership', window: '12–24 mo', ready: 71, note: 'One more leadership appointment + APP supervision.' },
  { id: 'fr3', label: 'Academic / faculty', window: '18–36 mo', ready: 58, note: 'Formal teaching load + curriculum contribution.' },
  { id: 'fr4', label: 'Research-weighted roles', window: '6–12 mo', ready: 45, note: 'Second publication lifts the whole lane above median.' },
];
window.FUTURE_READINESS = FUTURE_READINESS;

/* ═══ PROFESSIONAL LEGACY (/legacy) ═══
   The long-term story of a clinician's career. Privacy-preserving where it must be. */
const LEGACY_IMPACT = [
  { id: 'li1', metric: '~5,600', label: 'Patient encounters', sub: 'cumulative · privacy-preserving estimate', Icon: Icon.Heart },
  { id: 'li2', metric: '4', label: 'Organizations served', sub: 'employer · training · academic · society', Icon: Icon.Building },
  { id: 'li3', metric: '6', label: 'Clinicians taught', sub: 'PA students precepted to date', Icon: Icon.GraduationCap },
  { id: 'li4', metric: '2', label: 'Peer-reviewed works', sub: '7 citations · 1 in review', Icon: Icon.Microscope },
  { id: 'li5', metric: '1', label: 'Protocol authored', sub: 'PA-managed cardiology discharge', Icon: Icon.Briefcase },
  { id: 'li6', metric: '3', label: 'Honors conferred', sub: 'cannot be self-claimed', Icon: Icon.Award },
];
window.LEGACY_IMPACT = LEGACY_IMPACT;

const LEGACY_CHAPTERS = [
  { id: 'lc1', era: 'Formation', years: '2017–2022', headline: 'Built the foundation to practice', body: 'Undergraduate science, then a terminal PA degree at Stanford and national board certification. The credentials that open the door, each primary-source sealed.', anchors: ['B.S. UC Davis', 'M.S. Stanford', 'NCCPA PA-C'] },
  { id: 'lc2', era: 'Establishment', years: '2022–2025', headline: 'Proved the work at the bedside', body: 'A competitive cardiology fellowship with cohort distinction, California licensure, first clinical appointment, and a first peer-reviewed publication. A closed claim, fully disclosed — surfaced literally, resolved on the record.', anchors: ['UCLA fellowship', 'CA license', 'Cedar Health', 'First publication'] },
  { id: 'lc3', era: 'Leadership', years: '2025–present', headline: 'Took entrusted responsibility', body: 'Led the redesign of the cardiology discharge protocol, began precepting PA students, and joined the AAPA cardiovascular caucus. The first chapter where the career propagates beyond the self.', anchors: ['Protocol lead', 'Preceptor', 'AAPA caucus'] },
  { id: 'lc4', era: 'Standing', years: 'projected', headline: 'Stewarding the field over decades', body: 'The chapters ahead — senior specialist depth, a leadership track, faculty teaching, sustained research. Where recognition compounds into reputation that outlives any single role.', anchors: ['Senior specialist', 'Service-line lead', 'Faculty'], projected: true },
];
window.LEGACY_CHAPTERS = LEGACY_CHAPTERS;

const MENTORSHIP = [
  { id: 'mt1', name: 'Western U. PA students', kind: 'Precepted', count: 6, detail: 'Two clinical rotations per year since 2025.' },
  { id: 'mt2', name: 'Cedar Health new-hire APPs', kind: 'Onboarded', count: 4, detail: 'Structured first-90-days onboarding for incoming PAs.' },
  { id: 'mt3', name: 'Fellowship didactics', kind: 'Lectured', count: 9, detail: 'Guest lectures in the UCLA cardiology curriculum.' },
];
window.MENTORSHIP = MENTORSHIP;

window.ENTITY = ENTITY;
