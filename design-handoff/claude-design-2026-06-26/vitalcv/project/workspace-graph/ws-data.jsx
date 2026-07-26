// ════════════════════════════════════════════════════════════════════════
// WAVE 275 · WORKSPACE GRAPH — data model
// A workspace is the connective tissue of the VitalCV ecosystem. It is the
// single surface where a Person, an Organization, and the Opportunities
// between them operate together. Multi-sided by construction: clinicians,
// recruiters, and organizations are MEMBERS of the same room.
//
//        Person  ↔  Workspace  ↔  Organization  ↔  Opportunity
//
// Nothing here is a "match". Opportunities are declarations the org owns,
// evidence is source-bound, trust is projected — never a stored score.
// ════════════════════════════════════════════════════════════════════════

const W = {};

W.NOW = 'Apr 18, 2026';

// ── party system ────────────────────────────────────────────────────────────
// Every actor in a workspace belongs to one of three sides. The whole point of
// the workspace is that these sides share one operating surface.
W.PARTY = {
  organization: { label: 'Organization', chip: 'bg-slate-100 text-slate-700 ring-slate-300', dot: 'bg-slate-500', ink: 'text-slate-700' },
  clinician:    { label: 'Clinician',    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500', ink: 'text-emerald-700' },
  recruiter:    { label: 'Recruiter',    chip: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20', dot: 'bg-indigo-500', ink: 'text-indigo-700' },
};

W.tierTone = (t) => ({ T1: 'text-slate-600 border-slate-300', T2: 'text-sky-700 border-sky-300', T3: 'text-indigo-700 border-indigo-300', T4: 'text-emerald-700 border-emerald-300' }[t] || 'text-slate-600 border-slate-300');

// ── W275-D5 · Workspaces (the switcher inventory) ───────────────────────────
// One fully-built shared workspace plus a personal lens and a recruiter lens.
// `type` sets the default lens; every workspace still exposes all four surfaces.
W.WORKSPACES = [
  {
    id: 'cedar-ortho',
    name: 'Cedar Ortho Service Line',
    short: 'Cedar Ortho',
    initials: 'CO',
    type: 'organization',
    subtitle: 'Cedar Health System · Orthopedics',
    scope: 'Shared with 3 sides · 11 members',
    focal: true,
    sides: ['organization', 'clinician', 'recruiter'],
    stats: { members: 11, opportunities: 4, evidence: 26, mobility: 5 },
  },
  {
    id: 'macie',
    name: 'Macie Miller, PA-C',
    short: 'Macie Miller',
    initials: 'MM',
    type: 'personal',
    subtitle: 'Personal career workspace',
    scope: 'Private · you + invited verifiers',
    sides: ['clinician', 'organization', 'recruiter'],
    stats: { members: 4, opportunities: 3, evidence: 14, mobility: 5 },
  },
  {
    id: 'comphealth',
    name: 'CompHealth Locums Desk',
    short: 'CompHealth',
    initials: 'CH',
    type: 'recruiter',
    subtitle: 'Locum tenens credentialing partner',
    scope: 'Shared with partnered groups · 6 members',
    sides: ['recruiter', 'clinician', 'organization'],
    stats: { members: 6, opportunities: 5, evidence: 31, mobility: 12 },
  },
];

W.WS_TYPE = {
  organization: { label: 'Organization workspace', icon: 'Building', tint: 'text-slate-600' },
  personal:     { label: 'Personal workspace',     icon: 'User',     tint: 'text-emerald-700' },
  recruiter:    { label: 'Recruiter workspace',    icon: 'Network',  tint: 'text-indigo-700' },
};

W.byId = (id) => W.WORKSPACES.find(w => w.id === id) || W.WORKSPACES[0];
W.focal = () => W.WORKSPACES.find(w => w.focal) || W.WORKSPACES[0];

// ── Members ──────────────────────────────────────────────────────────────────
// The roster that makes a workspace multi-sided. role = function in this room.
W.MEMBERS = {
  'cedar-ortho': [
    { id: 'm-dana', name: 'Dana Whitfield', initials: 'DW', party: 'organization', role: 'Service line director', detail: 'Owns ortho requisitions', verified: true, you: false },
    { id: 'm-helen', name: 'Dr. Helen Park', initials: 'HP', party: 'organization', role: 'Chief Medical Officer', detail: 'Cedar Health System', verified: true },
    { id: 'm-rosa', name: 'Rosa Iyer', initials: 'RI', party: 'organization', role: 'Credentialing lead', detail: 'Verifies inbound packets', verified: true },
    { id: 'm-macie', name: 'Macie Miller, PA-C', initials: 'MM', party: 'clinician', role: 'PA-C · Orthopedics', detail: 'Verified employment edge', verified: true, you: true },
    { id: 'm-james', name: 'James Okafor, PA-C', initials: 'JO', party: 'clinician', role: 'Candidate · REQ-0412', detail: 'Packet in review', verified: true },
    { id: 'm-lena', name: 'Lena Brooks, NP', initials: 'LB', party: 'clinician', role: 'Talent pool · Lead PA', detail: 'Building toward leadership', verified: true },
    { id: 'm-priya', name: 'Priya Nandakumar', initials: 'PN', party: 'recruiter', role: 'EM Group lead', detail: 'Cross-service hiring', verified: true },
    { id: 'm-comp', name: 'CompHealth Desk', initials: 'CH', party: 'recruiter', role: 'Locum credentialing', detail: 'Pre-clears evidence packets', verified: true },
  ],
  'macie': [
    { id: 'm-macie', name: 'Macie Miller, PA-C', initials: 'MM', party: 'clinician', role: 'Owner', detail: 'This is your passport', verified: true, you: true },
    { id: 'm-cedar', name: 'Cedar Health System', initials: 'CH', party: 'organization', role: 'Verified employer', detail: 'Employment since Feb 2025', verified: true },
    { id: 'm-or', name: 'OR Medical Group', initials: 'OR', party: 'organization', role: 'Observer', detail: 'Replayed your passport', verified: true },
    { id: 'm-comp', name: 'CompHealth Desk', initials: 'CH', party: 'recruiter', role: 'Credentialing partner', detail: 'Pre-cleared locum coverage', verified: true },
  ],
  'comphealth': [
    { id: 'm-comp', name: 'CompHealth Desk', initials: 'CH', party: 'recruiter', role: 'Owner', detail: 'Credentialing partner', verified: true, you: true },
    { id: 'm-macie', name: 'Macie Miller, PA-C', initials: 'MM', party: 'clinician', role: 'Pre-cleared · Ortho', detail: 'Locum-ready packet', verified: true },
    { id: 'm-cedar', name: 'Cedar Health System', initials: 'CH', party: 'organization', role: 'Partnered group', detail: 'Accepts replayed packets', verified: true },
    { id: 'm-hoag', name: 'Hoag Orthopedic Institute', initials: 'HO', party: 'organization', role: 'Partnered group', detail: 'High-volume joints', verified: true },
  ],
};
W.membersFor = (wsId) => W.MEMBERS[wsId] || [];

// ── Opportunities (org-owned containers, surfaced into the workspace) ────────
W.OPPS = {
  'cedar-ortho': [
    { id: 'REQ-2026-0412', title: 'Orthopedic Surgery PA-C', specialty: 'Orthopedic Surgery', status: 'open', openings: 2, comp: '$135–152K', owner: 'Dana Whitfield', posted: 'Apr 06', observing: 7, packets: 4, review: 2 },
    { id: 'REQ-2026-0388', title: 'Surgical First Assistant · Ortho', specialty: 'Orthopedic Surgery', status: 'open', openings: 1, comp: '$142–168K', owner: 'Dana Whitfield', posted: 'Apr 15', observing: 3, packets: 1, review: 0 },
    { id: 'REQ-2026-0401', title: 'Lead PA · Ortho Service Line', specialty: 'Orthopedic Surgery', status: 'pooled', openings: 1, comp: '$165–190K', owner: 'Dana Whitfield', posted: 'Talent pool', observing: 5, packets: 0, review: 0 },
    { id: 'REQ-2026-0299', title: 'Cardiology NP · Structural Heart', specialty: 'Cardiology', status: 'filled', openings: 1, comp: '$148–172K', owner: 'Marcus Reyes', posted: 'Feb 12', observing: 0, packets: 14, review: 0, note: 'Filled in 19 days · packet replayed' },
  ],
  'macie': [
    { id: 'REQ-2026-0412', title: 'Orthopedic Surgery PA-C', specialty: 'Orthopedic Surgery', status: 'open', openings: 2, comp: '$135–152K', owner: 'Cedar Health', posted: 'Apr 06', observing: 7, packets: 4, review: 2, ready: true },
    { id: 'REQ-2026-0401', title: 'Lead PA · Ortho Service Line', specialty: 'Orthopedic Surgery', status: 'pooled', openings: 1, comp: '$165–190K', owner: 'Cedar Health', posted: 'Talent pool', observing: 5, packets: 0, review: 0, ready: false, gap: 'Documented leadership' },
    { id: 'REQ-CH-2241', title: 'Locum Tenens · Orthopedic PA', specialty: 'Orthopedic Surgery', status: 'open', openings: 4, comp: '$98/hr', owner: 'CompHealth', posted: 'Apr 09', observing: 9, packets: 6, review: 2, ready: true },
  ],
  'comphealth': [
    { id: 'REQ-CH-2241', title: 'Locum Tenens · Orthopedic PA', specialty: 'Orthopedic Surgery', status: 'open', openings: 4, comp: '$98/hr', owner: 'Network desk', posted: 'Apr 09', observing: 9, packets: 6, review: 2 },
    { id: 'REQ-CH-2255', title: 'Locum · Emergency Medicine PA', specialty: 'Emergency Medicine', status: 'open', openings: 2, comp: '$104/hr', owner: 'Network desk', posted: 'Apr 12', observing: 5, packets: 2, review: 1 },
    { id: 'REQ-CH-2210', title: 'Locum · Hospitalist NP', specialty: 'Internal Medicine', status: 'open', openings: 3, comp: '$92/hr', owner: 'Network desk', posted: 'Mar 30', observing: 11, packets: 7, review: 3 },
    { id: 'REQ-CH-2188', title: 'Locum · Cardiology NP', specialty: 'Cardiology', status: 'pooled', openings: 1, comp: '$110/hr', owner: 'Network desk', posted: 'Talent pool', observing: 4, packets: 0, review: 0 },
    { id: 'REQ-CH-2150', title: 'Locum · Ortho First Assist', specialty: 'Orthopedic Surgery', status: 'filled', openings: 1, comp: '$112/hr', owner: 'Network desk', posted: 'Feb 28', observing: 0, packets: 9, review: 0, note: 'Filled · packet pre-cleared' },
  ],
};
W.oppsFor = (wsId) => W.OPPS[wsId] || [];

W.OPP_STATUS = {
  open:   { label: 'Open', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' },
  pooled: { label: 'Talent pool', chip: 'bg-sky-50 text-sky-700 ring-sky-600/20', dot: 'bg-sky-500' },
  draft:  { label: 'Draft', chip: 'bg-slate-100 text-slate-600 ring-slate-300', dot: 'bg-slate-400' },
  filled: { label: 'Filled', chip: 'bg-slate-100 text-slate-500 ring-slate-300', dot: 'bg-slate-300' },
};

// ── Evidence (source-bound artifacts flowing through the workspace) ──────────
// state: verified | aging | expiring. Every item names its source + tier.
W.EVIDENCE = [
  { id: 'ev-id',     label: 'Verified identity', kind: 'Identity', source: 'NPPES', tier: 'T4', state: 'verified', last: 'Just now', holder: 'Macie Miller', note: 'NPI 1346053246 resolved at federal registry' },
  { id: 'ev-lic',    label: 'CA PA license · active', kind: 'License', source: 'CA PA Board', tier: 'T4', state: 'verified', last: '6 days ago', holder: 'Macie Miller', note: 'License PA-21847 · active to Nov 2027' },
  { id: 'ev-board',  label: 'PA-C board certification', kind: 'Certification', source: 'NCCPA', tier: 'T4', state: 'verified', last: '12 days ago', holder: 'Macie Miller', note: 'Certified · maintenance current' },
  { id: 'ev-employ', label: 'Employment · Cedar Health', kind: 'Affiliation', source: 'PECOS ⇄ attested', tier: 'T3', state: 'verified', last: '21 days ago', holder: 'Macie Miller', note: 'Reconciled to CMS reassignment record' },
  { id: 'ev-bls',    label: 'BLS certification', kind: 'Life support', source: 'AHA', tier: 'T3', state: 'verified', last: '34 days ago', holder: 'Macie Miller', note: 'Active to Aug 2026' },
  { id: 'ev-coi',    label: 'Malpractice coverage', kind: 'Insurance', source: 'Carrier attestation', tier: 'T2', state: 'aging', last: '71 days ago', holder: 'Macie Miller', note: 'Re-attestation due in 19 days' },
  { id: 'ev-dea',    label: 'DEA registration', kind: 'License', source: 'DEA', tier: 'T4', state: 'expiring', last: 'Renews in 41 days', holder: 'Macie Miller', note: 'Required for first-assist roles' },
  { id: 'ev-sanc',   label: 'Sanctions / exclusions clear', kind: 'Standing', source: 'OIG / LEIE', tier: 'T4', state: 'verified', last: '3 days ago', holder: 'Macie Miller', note: 'No federal exclusions' },
];

// ── W275-D3 · Clinician career ───────────────────────────────────────────────
W.CLINICIAN = {
  name: 'Macie Miller, PA-C', initials: 'MM', specialty: 'Orthopedic Surgery',
  npi: '1346053246', city: 'Irvine, CA', since: 'Feb 2025',
};

// Career health — projected signals, never one stored score.
W.CAREER_HEALTH = [
  { id: 'identity', label: 'Identity', note: 'Verified & resolved at the federal registry', state: 'strong', value: '100%', pct: 100 },
  { id: 'practice', label: 'Practice', note: 'Active employment + cross-observation by a second system', state: 'strong', value: 'Strong', pct: 92 },
  { id: 'standing', label: 'Standing', note: 'No sanctions, exclusions, or adverse history', state: 'strong', value: 'Clear', pct: 100 },
  { id: 'currency', label: 'Currency', note: 'Two items aging — malpractice & DEA renewals approaching', state: 'attention', value: '2 aging', pct: 74 },
];

// Readiness — projected against real opportunities. Ready = all required
// evidence satisfied. Gaps are named, never scored.
W.READINESS = [
  { id: 'REQ-2026-0412', title: 'Orthopedic Surgery PA-C', org: 'Cedar Health', ready: true,  satisfied: 7, required: 7, gap: null },
  { id: 'REQ-CH-2241',  title: 'Locum Tenens · Orthopedic PA', org: 'CompHealth', ready: true,  satisfied: 5, required: 5, gap: null },
  { id: 'REQ-2026-0388', title: 'Surgical First Assistant · Ortho', org: 'Cedar Health', ready: false, satisfied: 5, required: 6, gap: 'DEA registration renews in 41 days' },
  { id: 'REQ-2026-0401', title: 'Lead PA · Ortho Service Line', org: 'Cedar Health', ready: false, satisfied: 4, required: 5, gap: 'Documented leadership not yet evidenced' },
];

// Mobility — where this verified passport can travel without re-credentialing.
// state: unlocked | reachable | locked
W.MOBILITY = [
  { id: 'mb-cedar', org: 'Cedar Health System', market: 'Irvine, CA', state: 'unlocked', basis: 'Current verified employer', via: 'Employment edge · T3' },
  { id: 'mb-comp',  org: 'CompHealth network', market: 'Southern California', state: 'unlocked', basis: 'Locum credentialing pre-cleared', via: 'Evidence packet · T2' },
  { id: 'mb-or',    org: 'OR Medical Group', market: 'Irvine, CA', state: 'unlocked', basis: 'Passport replayed & accepted', via: 'Cross-observation · T2' },
  { id: 'mb-hoag',  org: 'Hoag Orthopedic Institute', market: 'Irvine, CA', state: 'reachable', basis: 'Accepts replayed packets · 1 attestation needed', via: 'Partnered group' },
  { id: 'mb-prov',  org: 'Providence', market: 'Multi-state', state: 'reachable', basis: 'WA/OR licensure required for cross-state', via: 'Network member' },
];

W.MOBILITY_STATE = {
  unlocked:  { label: 'Unlocked', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500', icon: 'Check' },
  reachable: { label: 'Reachable', chip: 'bg-sky-50 text-sky-700 ring-sky-600/20', dot: 'bg-sky-500', icon: 'ArrowRight' },
  locked:    { label: 'Locked', chip: 'bg-slate-100 text-slate-500 ring-slate-300', dot: 'bg-slate-300', icon: 'Lock' },
};

// ── W275-D2 · Organization side ──────────────────────────────────────────────
W.ORG = {
  name: 'Cedar Health System', short: 'Cedar Health', initials: 'CH',
  kind: 'Integrated health system', tagline: 'Nonprofit integrated delivery network · Orange County, CA',
  identity: {
    legalName: 'Cedar Health System, Inc.', orgNpi: '1659471203', ccn: '050342',
    taxStatus: '501(c)(3) Nonprofit', founded: '1971', hq: 'Irvine, CA',
    website: 'cedarhealth.org', taxonomy: '282N00000X — General Acute Care Hospital',
  },
  stats: { facilities: 4, beds: 612, providers: 1840, openReqs: 3 },
};

// Org trust sources (projected, freshness-aware)
W.TRUST_SOURCES = [
  { id: 'nppes', name: 'NPPES', org: 'CMS · NPPES', tier: 'T4', confirms: 'Organization identity & NPI', last: 'Just now', fresh: 100, state: 'verified' },
  { id: 'pecos', name: 'PECOS', org: 'CMS', tier: 'T4', confirms: 'Medicare enrollment · CCN', last: '8 days ago', fresh: 88, state: 'verified' },
  { id: 'jc',    name: 'Joint Commission', org: 'Quality Check', tier: 'T4', confirms: 'Hospital accreditation', last: '21 days ago', fresh: 74, state: 'verified' },
  { id: 'ancc',  name: 'ANCC Magnet', org: 'Am. Nurses Credentialing Ctr', tier: 'T3', confirms: 'Magnet designation', last: '88 days ago', fresh: 44, state: 'aging' },
  { id: 'acs',   name: 'ACS Trauma', org: 'Am. College of Surgeons', tier: 'T3', confirms: 'Level II trauma verification', last: 'Renews in 49 days', fresh: 38, state: 'expiring' },
];

// Active talent — clinicians the org is operating with, by relationship.
W.ACTIVE_TALENT = [
  { id: 't-macie', name: 'Macie Miller, PA-C', initials: 'MM', rel: 'Employed', relType: 'employment', specialty: 'Orthopedics', since: 'Feb 2025', evidence: 'Verified packet · T3', state: 'verified' },
  { id: 't-james', name: 'James Okafor, PA-C', initials: 'JO', rel: 'In review', relType: 'review', specialty: 'Orthopedics', since: 'REQ-0412', evidence: 'Packet replayed · 4 days', state: 'pending' },
  { id: 't-lena',  name: 'Lena Brooks, NP', initials: 'LB', rel: 'Talent pool', relType: 'pool', specialty: 'Orthopedics', since: 'REQ-0401', evidence: 'Internal · building readiness', state: 'pool' },
  { id: 't-dev',   name: 'Devon Park, PA-C', initials: 'DP', rel: 'Observing', relType: 'observing', specialty: 'Emergency Med', since: 'REQ-0356', evidence: 'Verified · not yet applied', state: 'observing' },
];

W.TALENT_REL = {
  employment: { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' },
  review:     { chip: 'bg-amber-50 text-amber-700 ring-amber-600/20', dot: 'bg-amber-500' },
  pool:       { chip: 'bg-sky-50 text-sky-700 ring-sky-600/20', dot: 'bg-sky-500' },
  observing:  { chip: 'bg-slate-100 text-slate-600 ring-slate-300', dot: 'bg-slate-400' },
};

// ── W275-D4 · Shared activity feed ───────────────────────────────────────────
// The four canonical event types from the mission, plus member joins.
// type: evidence | trust | mobility | opportunity | member
W.ACTIVITY = [
  { id: 'a1', day: 'Today', t: '14:30', type: 'evidence', party: 'clinician', actor: 'Macie Miller', title: 'Evidence verified', detail: 'NPPES delta scan confirmed — verified identity stands. No change.', source: 'NPPES', tier: 'T4', ws: ['cedar-ortho','macie'] },
  { id: 'a2', day: 'Today', t: '11:48', type: 'opportunity', party: 'organization', actor: 'Dana Whitfield', title: 'Opportunity created', detail: 'REQ-2026-0388 — Surgical First Assistant opened on the ortho service line.', ref: 'REQ-2026-0388', ws: ['cedar-ortho'] },
  { id: 'a3', day: 'Today', t: '09:12', type: 'mobility', party: 'clinician', actor: 'Macie Miller', title: 'Mobility unlocked', detail: 'OR Medical Group replayed the verified passport — a third destination is now reachable without re-credentialing.', source: 'Cross-observation', tier: 'T2', ws: ['cedar-ortho','macie'] },
  { id: 'a4', day: 'Yesterday', t: '16:05', type: 'trust', party: 'organization', actor: 'Cedar Health', title: 'Trust milestone reached', detail: 'Joint Commission accreditation re-confirmed for the current cycle. Organization trust holds at T4.', source: 'Quality Check', tier: 'T4', ws: ['cedar-ortho'] },
  { id: 'a5', day: 'Yesterday', t: '13:20', type: 'member', party: 'recruiter', actor: 'CompHealth Desk', title: 'Member joined', detail: 'CompHealth credentialing desk joined the workspace as a recruiter side.', ws: ['cedar-ortho','comphealth'] },
  { id: 'a6', day: 'Yesterday', t: '10:41', type: 'evidence', party: 'clinician', actor: 'James Okafor', title: 'Evidence verified', detail: 'Inbound packet for REQ-2026-0412 replayed — 6 of 7 declarations satisfied in review.', ref: 'REQ-2026-0412', ws: ['cedar-ortho'] },
  { id: 'a7', day: 'Apr 16', t: '15:30', type: 'opportunity', party: 'recruiter', actor: 'CompHealth Desk', title: 'Opportunity created', detail: 'REQ-CH-2255 — Locum Emergency Medicine PA posted across partnered groups.', ref: 'REQ-CH-2255', ws: ['comphealth'] },
  { id: 'a8', day: 'Apr 16', t: '08:55', type: 'mobility', party: 'clinician', actor: 'Macie Miller', title: 'Mobility unlocked', detail: 'CompHealth pre-cleared the evidence packet — locum coverage across Southern California is now unlocked.', source: 'Evidence packet', tier: 'T2', ws: ['comphealth','macie'] },
  { id: 'a9', day: 'Apr 14', t: '11:00', type: 'opportunity', party: 'organization', actor: 'Dana Whitfield', title: 'Opportunity created', detail: 'REQ-2026-0412 — Orthopedic Surgery PA-C opened with 2 openings.', ref: 'REQ-2026-0412', ws: ['cedar-ortho','macie'] },
  { id: 'a10', day: 'Apr 14', t: '09:30', type: 'trust', party: 'clinician', actor: 'Macie Miller', title: 'Trust milestone reached', detail: 'Practice signal reached Strong — current employment plus a second-system observation.', source: 'Projection', tier: 'T3', ws: ['macie','cedar-ortho'] },
  { id: 'a11', day: 'Apr 12', t: '14:10', type: 'evidence', party: 'clinician', actor: 'Macie Miller', title: 'Evidence verified', detail: 'CA PA license re-checked against the state board — active to Nov 2027.', source: 'CA PA Board', tier: 'T4', ws: ['macie','cedar-ortho'] },
  { id: 'a12', day: 'Apr 10', t: '02:08', type: 'trust', party: 'organization', actor: 'Cedar Health', title: 'Trust milestone reached', detail: 'PECOS quarterly revalidation — CCN 050342 enrolled & participating.', source: 'PECOS', tier: 'T4', ws: ['cedar-ortho'] },
];

W.ACTIVITY_TYPE = {
  evidence:    { label: 'Evidence verified', icon: 'ShieldCheck', dot: 'bg-emerald-500', ring: 'ring-emerald-600/20', soft: 'bg-emerald-50 text-emerald-700', ink: 'text-emerald-600' },
  trust:       { label: 'Trust milestone', icon: 'Award', dot: 'bg-indigo-500', ring: 'ring-indigo-600/20', soft: 'bg-indigo-50 text-indigo-700', ink: 'text-indigo-600' },
  mobility:    { label: 'Mobility unlocked', icon: 'Route', dot: 'bg-sky-500', ring: 'ring-sky-600/20', soft: 'bg-sky-50 text-sky-700', ink: 'text-sky-600' },
  opportunity: { label: 'Opportunity created', icon: 'Briefcase', dot: 'bg-amber-500', ring: 'ring-amber-600/20', soft: 'bg-amber-50 text-amber-700', ink: 'text-amber-600' },
  member:      { label: 'Member joined', icon: 'Users', dot: 'bg-slate-400', ring: 'ring-slate-300', soft: 'bg-slate-100 text-slate-600', ink: 'text-slate-500' },
};

W.activityFor = (wsId) => W.ACTIVITY.filter(a => !wsId || (a.ws && a.ws.includes(wsId)));

W.STATE_TONE = {
  strong:    { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Strong' },
  verified:  { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Verified' },
  attention: { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Attention' },
  aging:     { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Aging' },
  expiring:  { dot: 'bg-orange-500', text: 'text-orange-700', label: 'Expiring' },
};

window.W = W;
