// ════════════════════════════════════════════════════════════════════════
// WAVE 265 · ORGANIZATION GRAPH — data model
// Organizations are first-class objects in the same ecosystem as clinicians.
// An organization is identity + facilities + specialties + verified
// affiliations, and it OWNS opportunity containers (never matches — W265-D5).
// Trust for an organization, like a clinician, is projected from source-bound
// verification, never stored as a single score.
// ════════════════════════════════════════════════════════════════════════

const G = {};

G.NOW = 'Apr 18, 2026';

// ── Organization directory ─────────────────────────────────────────────────
// One organization is fully built (Cedar Health System — Macie Miller's
// verified employer). The others are real nodes in the graph with lighter
// records, enough to render the relationship explorer and cross-links.
G.ORGS = [
  {
    id: 'cedar-health',
    name: 'Cedar Health System',
    short: 'Cedar Health',
    initials: 'CH',
    kind: 'Integrated health system',
    tagline: 'Nonprofit integrated delivery network · Orange County, CA',
    focal: true,
    identity: {
      legalName: 'Cedar Health System, Inc.',
      orgNpi: '1659471203',
      ccn: '050342',
      ein: '95-3654128',
      taxStatus: '501(c)(3) Nonprofit',
      founded: '1971',
      hq: 'Irvine, CA',
      website: 'cedarhealth.org',
      entityType: 'Type 2 — Organization',
      taxonomy: '282N00000X — General Acute Care Hospital',
    },
    stats: { facilities: 4, beds: 612, providers: 1840, specialties: 9, openReqs: 3, affiliations: 5 },
    facilities: [
      { id: 'f-main', name: 'Cedar Regional Medical Center', city: 'Irvine, CA', type: 'Acute care hospital', beds: 384, ccn: '050342', npi: '1659471203', verified: true, lead: true },
      { id: 'f-ortho', name: 'Cedar Orthopedic Institute', city: 'Irvine, CA', type: 'Specialty surgical center', beds: 96, ccn: '050879', npi: '1730284417', verified: true },
      { id: 'f-south', name: 'Cedar Health · Mission Viejo', city: 'Mission Viejo, CA', type: 'Acute care hospital', beds: 132, ccn: '051104', npi: '1942007733', verified: true },
      { id: 'f-clinics', name: 'Cedar Medical Group', city: '14 sites · Orange County', type: 'Ambulatory clinic network', beds: 0, ccn: '—', npi: '1083925561', verified: true },
    ],
    specialties: [
      { id: 's-ortho', name: 'Orthopedic Surgery', providers: 64, apps: 22, demand: 'high', note: 'Joint replacement & ortho trauma — Macie Miller’s service line' },
      { id: 's-em', name: 'Emergency Medicine', providers: 88, apps: 31, demand: 'high', note: 'Level II trauma center' },
      { id: 's-cards', name: 'Cardiology', providers: 52, apps: 18, demand: 'med', note: 'Structural heart program' },
      { id: 's-im', name: 'Internal Medicine', providers: 140, apps: 44, demand: 'med', note: 'Hospitalist & primary care' },
      { id: 's-onc', name: 'Oncology', providers: 41, apps: 15, demand: 'med', note: 'NCI-aligned infusion program' },
      { id: 's-neuro', name: 'Neurosciences', providers: 28, apps: 9, demand: 'low', note: 'Stroke-certified' },
    ],
    affiliations: [
      { id: 'a-jc',   name: 'The Joint Commission', kind: 'Accreditation', detail: 'Hospital accreditation · current', source: 'Quality Check', tier: 'T4', verified: true, since: '2018', expires: 'Mar 2027' },
      { id: 'a-cms',  name: 'CMS Medicare', kind: 'Federal program', detail: 'CCN 050342 · enrolled & participating', source: 'PECOS', tier: 'T4', verified: true, since: '1972', expires: null },
      { id: 'a-uci',  name: 'UCI School of Medicine', kind: 'Academic affiliate', detail: 'Residency & rotation partner', source: 'ACGME', tier: 'T3', verified: true, since: '2009', expires: null },
      { id: 'a-magnet', name: 'ANCC Magnet', kind: 'Nursing recognition', detail: 'Magnet-designated · nursing excellence', source: 'ANCC', tier: 'T3', verified: true, since: '2021', expires: 'Sep 2026' },
      { id: 'a-trauma', name: 'ACS Level II Trauma', kind: 'Verification', detail: 'Verified trauma center', source: 'Am. College of Surgeons', tier: 'T3', verified: true, since: '2015', expires: 'Jun 2026' },
    ],
  },
  { id: 'hoag-ortho', name: 'Hoag Orthopedic Institute', short: 'Hoag Ortho', initials: 'HO', kind: 'Specialty hospital', tagline: 'High-volume joint replacement', hq: 'Irvine, CA', orgNpi: '1558392047', stats: { facilities: 2, providers: 210, openReqs: 1 } },
  { id: 'providence', name: 'Providence', short: 'Providence', initials: 'PR', kind: 'Integrated network', tagline: 'Multi-state Catholic health system', hq: 'Renton, WA', orgNpi: '1447261180', stats: { facilities: 51, providers: 24000, openReqs: 1 } },
  { id: 'uci-health', name: 'UCI Health', short: 'UCI Health', initials: 'UC', kind: 'Academic medical center', tagline: 'University of California, Irvine', hq: 'Orange, CA', orgNpi: '1336178420', stats: { facilities: 3, providers: 1100, openReqs: 1 } },
  { id: 'or-medical', name: 'OR Medical Group', short: 'OR Medical', initials: 'OR', kind: 'Physician group', tagline: 'Observed Macie’s verified passport', hq: 'Irvine, CA', orgNpi: '1265038819', stats: { facilities: 1, providers: 64, openReqs: 0 } },
  { id: 'comphealth', name: 'CompHealth', short: 'CompHealth', initials: 'CO', kind: 'Staffing network', tagline: 'Locum tenens credentialing partner', hq: 'Salt Lake City, UT', orgNpi: '1093817265', stats: { facilities: 0, providers: 0, openReqs: 1 } },
];

G.byId = (id) => G.ORGS.find(o => o.id === id);
G.focal = () => G.ORGS.find(o => o.focal);

// ── W265-D5 · Opportunity containers ────────────────────────────────────────
// Organization-OWNED objects. These are NOT matches and carry NO clinician
// readiness. A container declares what the org needs; matching lives in a
// different layer entirely (the Opportunity Network projects against these).
// status: open | draft | pooled | filled
G.CONTAINERS = [
  {
    id: 'REQ-2026-0412', orgId: 'cedar-health', title: 'Orthopedic Surgery PA-C',
    facilityId: 'f-ortho', specialty: 'Orthopedic Surgery', status: 'open',
    employment: 'Full-time', openings: 2, comp: '$135–152K', posted: 'Apr 06, 2026',
    owner: 'Dana Whitfield · Ortho Service Line', visibility: 'Network + internal',
    summary: 'Operative and clinic coverage on the orthopedic service line, ortho trauma call rotation.',
    declared: [
      { ref: 'identity',  label: 'Verified identity (NPI)', kind: 'Identity', required: true },
      { ref: 'licensure', label: 'CA PA license · active', kind: 'License', required: true },
      { ref: 'boardcert', label: 'PA-C board certification', kind: 'Certification', required: true },
      { ref: 'sanctions', label: 'Sanctions / exclusions clear', kind: 'Standing', required: true },
      { ref: 'bls',       label: 'BLS certification', kind: 'Life support', required: true },
      { ref: 'coi',       label: 'Malpractice coverage', kind: 'Insurance', required: true },
      { ref: 'experience',label: '1+ years orthopedic practice', kind: 'Experience', required: false },
    ],
    pipeline: { observing: 7, packetsReceived: 4, inReview: 2 },
  },
  {
    id: 'REQ-2026-0388', orgId: 'cedar-health', title: 'Surgical First Assistant · Orthopedics',
    facilityId: 'f-ortho', specialty: 'Orthopedic Surgery', status: 'open',
    employment: 'Full-time', openings: 1, comp: '$142–168K', posted: 'Apr 15, 2026',
    owner: 'Dana Whitfield · Ortho Service Line', visibility: 'Network + internal',
    summary: 'Dedicated first-assist role in the joint-replacement program. Controlled-substance privileges required for peri-operative management.',
    declared: [
      { ref: 'identity',  label: 'Verified identity (NPI)', kind: 'Identity', required: true },
      { ref: 'licensure', label: 'CA PA license · active', kind: 'License', required: true },
      { ref: 'boardcert', label: 'PA-C board certification', kind: 'Certification', required: true },
      { ref: 'dea',       label: 'DEA registration', kind: 'License', required: true },
      { ref: 'acls',      label: 'ACLS certification', kind: 'Life support', required: true },
      { ref: 'sanctions', label: 'Sanctions / exclusions clear', kind: 'Standing', required: true },
    ],
    pipeline: { observing: 3, packetsReceived: 1, inReview: 0 },
  },
  {
    id: 'REQ-2026-0401', orgId: 'cedar-health', title: 'Lead PA · Orthopedic Service Line',
    facilityId: 'f-ortho', specialty: 'Orthopedic Surgery', status: 'pooled',
    employment: 'Full-time', openings: 1, comp: '$165–190K', posted: 'Talent pool',
    owner: 'Dana Whitfield · Ortho Service Line', visibility: 'Internal talent pool',
    summary: 'Supervisory role over the APP team. Held in a talent pool — surfaces to internal APPs building toward leadership.',
    declared: [
      { ref: 'identity',   label: 'Verified identity (NPI)', kind: 'Identity', required: true },
      { ref: 'licensure',  label: 'CA PA license · active', kind: 'License', required: true },
      { ref: 'boardcert',  label: 'PA-C board certification', kind: 'Certification', required: true },
      { ref: 'leadership', label: 'Documented leadership', kind: 'Experience', required: true },
      { ref: 'experience', label: '3+ years in practice', kind: 'Experience', required: true },
    ],
    pipeline: { observing: 5, packetsReceived: 0, inReview: 0 },
  },
  {
    id: 'REQ-2026-0356', orgId: 'cedar-health', title: 'Emergency Medicine PA · Nights',
    facilityId: 'f-main', specialty: 'Emergency Medicine', status: 'open',
    employment: 'Full-time', openings: 3, comp: '$128–148K', posted: 'Mar 28, 2026',
    owner: 'Priya Nandakumar · EM Group', visibility: 'Network + internal',
    summary: 'Overnight emergency coverage at the Level II trauma center. High-acuity, team-based.',
    declared: [
      { ref: 'identity',  label: 'Verified identity (NPI)', kind: 'Identity', required: true },
      { ref: 'licensure', label: 'CA PA license · active', kind: 'License', required: true },
      { ref: 'boardcert', label: 'PA-C board certification', kind: 'Certification', required: true },
      { ref: 'acls',      label: 'ACLS certification', kind: 'Life support', required: true },
      { ref: 'sanctions', label: 'Sanctions / exclusions clear', kind: 'Standing', required: true },
    ],
    pipeline: { observing: 12, packetsReceived: 8, inReview: 3 },
  },
  {
    id: 'REQ-2026-0299', orgId: 'cedar-health', title: 'Cardiology NP · Structural Heart',
    facilityId: 'f-main', specialty: 'Cardiology', status: 'filled',
    employment: 'Full-time', openings: 1, comp: '$148–172K', posted: 'Feb 12, 2026',
    owner: 'Marcus Reyes · Cardiology', visibility: 'Closed',
    summary: 'Structural heart program support. Filled Apr 2026 via a verified VitalCV packet.',
    declared: [
      { ref: 'identity',  label: 'Verified identity (NPI)', kind: 'Identity', required: true },
      { ref: 'licensure', label: 'CA NP license · active', kind: 'License', required: true },
      { ref: 'boardcert', label: 'Board certification', kind: 'Certification', required: true },
    ],
    pipeline: { observing: 0, packetsReceived: 14, inReview: 0 },
    filledNote: 'Closed in 19 days · packet replayed without re-credentialing',
  },
  {
    id: 'REQ-CH-2241', orgId: 'comphealth', title: 'Locum Tenens · Orthopedic PA',
    facilityId: null, specialty: 'Orthopedic Surgery', status: 'open',
    employment: 'Contract · 13 wk', openings: 4, comp: '$98/hr', posted: 'Apr 09, 2026',
    owner: 'Network credentialing desk', visibility: 'Network',
    summary: 'Short-term operative coverage across partnered Southern California orthopedic groups. Credentialing pre-cleared via a verified VitalCV evidence packet.',
    declared: [
      { ref: 'identity',  label: 'Verified identity (NPI)', kind: 'Identity', required: true },
      { ref: 'licensure', label: 'CA PA license · active', kind: 'License', required: true },
      { ref: 'boardcert', label: 'PA-C board certification', kind: 'Certification', required: true },
      { ref: 'sanctions', label: 'Sanctions / exclusions clear', kind: 'Standing', required: true },
      { ref: 'npdb',      label: 'Adverse-history (NPDB) clear', kind: 'Standing', required: true },
    ],
    pipeline: { observing: 9, packetsReceived: 6, inReview: 2 },
  },
];

G.containersFor = (orgId) => G.CONTAINERS.filter(c => c.orgId === orgId);
G.containerById = (id) => G.CONTAINERS.find(c => c.id === id);

G.CONTAINER_STATUS = {
  open:   { label: 'Open', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' },
  pooled: { label: 'Talent pool', chip: 'bg-sky-50 text-sky-700 ring-sky-600/20', dot: 'bg-sky-500' },
  draft:  { label: 'Draft', chip: 'bg-slate-100 text-slate-600 ring-slate-300', dot: 'bg-slate-400' },
  filled: { label: 'Filled', chip: 'bg-slate-100 text-slate-500 ring-slate-300', dot: 'bg-slate-300' },
};

// ── W265-D2 · Organization timeline ─────────────────────────────────────────
// kind: hiring | leadership | recognition
G.TIMELINE = [
  { id: 'e1', date: 'Apr 14, 2026', year: '2026', kind: 'hiring', title: 'Orthopedic PA requisition opened', detail: 'REQ-2026-0412 — 2 openings on the ortho service line. Surfaced to the verified network.', source: 'Internal ATS', tier: 'T2' },
  { id: 'e2', date: 'Apr 02, 2026', year: '2026', kind: 'hiring', title: 'Cardiology NP role filled', detail: 'REQ-2026-0299 closed in 19 days — candidate cleared via a replayed VitalCV packet, no re-credentialing.', source: 'VitalCV packet', tier: 'T4' },
  { id: 'e3', date: 'Mar 09, 2026', year: '2026', kind: 'leadership', title: 'Dana Whitfield named Ortho Service Line Director', detail: 'Promoted to lead the orthopedic APP team; now owner of all ortho requisitions.', source: 'HR record', tier: 'T2' },
  { id: 'e4', date: 'Jan 22, 2026', year: '2026', kind: 'recognition', title: 'ANCC Magnet redesignation', detail: 'Nursing excellence redesignation confirmed for the 2026–2030 cycle.', source: 'ANCC', tier: 'T3' },
  { id: 'e5', date: 'Nov 15, 2025', year: '2025', kind: 'recognition', title: 'ACS Level II Trauma re-verification', detail: 'American College of Surgeons re-verified the trauma center designation.', source: 'ACS', tier: 'T3' },
  { id: 'e6', date: 'Sep 03, 2025', year: '2025', kind: 'leadership', title: 'Dr. Helen Park appointed Chief Medical Officer', detail: 'System CMO appointment — prior VP of Medical Affairs.', source: 'HR record', tier: 'T2' },
  { id: 'e7', date: 'Feb 03, 2025', year: '2025', kind: 'hiring', title: 'Macie Miller, PA-C joined Orthopedics', detail: 'First VitalCV-verified hire onto the ortho service line. Employment reconciled to PECOS.', source: 'PECOS ⇄ attested', tier: 'T3', clinician: true },
  { id: 'e8', date: 'Jun 18, 2024', year: '2024', kind: 'recognition', title: 'Cedar Orthopedic Institute opened', detail: '96-bed specialty surgical center for joint replacement and ortho trauma.', source: 'CMS · new CCN', tier: 'T4' },
];

G.TIMELINE_KIND = {
  hiring:      { label: 'Hiring', icon: 'Briefcase', dot: 'bg-emerald-500', chip: 'text-emerald-700 bg-emerald-50 ring-emerald-600/20' },
  leadership:  { label: 'Leadership', icon: 'User', dot: 'bg-indigo-500', chip: 'text-indigo-700 bg-indigo-50 ring-indigo-600/20' },
  recognition: { label: 'Recognition', icon: 'Award', dot: 'bg-amber-500', chip: 'text-amber-700 bg-amber-50 ring-amber-600/20' },
};

// ── W265-D3 · Organization trust ─────────────────────────────────────────────
// Verification sources for the ORG identity & affiliations, with freshness.
G.TRUST_SOURCES = [
  { id: 'nppes', name: 'NPPES', org: 'CMS · NPPES', tier: 'T4', confirms: 'Organization identity & NPI', last: 'Just now', fresh: 100, cadence: 'Continuous delta scan', state: 'verified' },
  { id: 'pecos', name: 'PECOS', org: 'CMS', tier: 'T4', confirms: 'Medicare enrollment · CCN', last: '8 days ago', fresh: 88, cadence: 'Quarterly revalidation', state: 'verified' },
  { id: 'jc',    name: 'Joint Commission', org: 'Quality Check', tier: 'T4', confirms: 'Hospital accreditation', last: '21 days ago', fresh: 74, cadence: 'On survey & publish', state: 'verified' },
  { id: 'acgme', name: 'ACGME', org: 'Accreditation Council', tier: 'T3', confirms: 'Academic affiliation', last: '40 days ago', fresh: 62, cadence: 'Annual', state: 'verified' },
  { id: 'ancc',  name: 'ANCC Magnet', org: 'Am. Nurses Credentialing Ctr', tier: 'T3', confirms: 'Magnet designation', last: '88 days ago', fresh: 44, cadence: '4-year cycle', state: 'aging' },
  { id: 'acs',   name: 'ACS Trauma', org: 'Am. College of Surgeons', tier: 'T3', confirms: 'Level II trauma verification', last: 'Renews in 49 days', fresh: 38, cadence: '3-year cycle', state: 'expiring' },
];

// Trust indicators — projected health signals, not a stored score.
G.TRUST_INDICATORS = [
  { id: 'identity', label: 'Identity resolved', note: 'Organization NPI & legal entity confirmed at the federal registry', state: 'strong', value: 'NPPES · T4' },
  { id: 'enrollment', label: 'Medicare participating', note: 'CCN 050342 enrolled & in good standing in PECOS', state: 'strong', value: 'PECOS · T4' },
  { id: 'accreditation', label: 'Accreditation current', note: 'Joint Commission hospital accreditation active to Mar 2027', state: 'strong', value: 'TJC · T4' },
  { id: 'sanctions', label: 'No federal exclusions', note: 'Entity clear on OIG/LEIE — no excluded affiliated providers flagged', state: 'strong', value: 'OIG/LEIE' },
  { id: 'recognition', label: 'Trauma verification aging', note: 'ACS Level II re-verification due in 49 days', state: 'attention', value: 'Renews Jun 2026' },
];

G.TRUST_STATE = {
  strong:    { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Strong' },
  attention: { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Attention' },
  aging:     { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Aging' },
  expiring:  { dot: 'bg-orange-500', text: 'text-orange-700', label: 'Expiring' },
  verified:  { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Verified' },
};

// Freshness ledger — recent verification events for the org.
G.FRESHNESS = [
  { t: 'Apr 18, 2026 · 14:30', tone: 'ok',   src: 'NPPES', msg: 'Organization NPI delta scan — no change. Identity stands verified.' },
  { t: 'Apr 10, 2026 · 02:08', tone: 'ok',   src: 'PECOS', msg: 'Quarterly revalidation — CCN 050342 enrolled & participating.' },
  { t: 'Mar 28, 2026 · 09:14', tone: 'info', src: 'Network', msg: 'Macie Miller, PA-C re-presented her verified employment edge.' },
  { t: 'Mar 09, 2026 · 11:00', tone: 'warn', src: 'ACS',   msg: 'Level II trauma verification renews in 49 days — routed to quality office.' },
  { t: 'Jan 22, 2026 · 16:40', tone: 'ok',   src: 'ANCC',  msg: 'Magnet redesignation confirmed for the 2026–2030 cycle.' },
];

// ── W265-D4 · Clinician ↔ Organization relationship graph ────────────────────
// The chain: Clinician ↔ Employment ↔ Organization ↔ Opportunity.
// Edges are typed and carry their own verification.
G.GRAPH = {
  clinician: {
    id: 'macie', name: 'Macie Miller', credential: 'PA-C', initials: 'MM',
    specialty: 'Orthopedic Surgery', npi: '1346053246', city: 'Irvine, CA',
  },
  // employment / observation edges from the clinician to organizations
  edges: [
    { id: 'edge-cedar', type: 'employment', orgId: 'cedar-health', label: 'Employed', verb: 'is employed by',
      since: 'Feb 2025', role: 'PA-C · Orthopedics', verified: true, source: 'PECOS ⇄ attested', tier: 'T3',
      detail: 'Current employment, reconciled to a CMS reassignment record.' },
    { id: 'edge-or', type: 'observation', orgId: 'or-medical', label: 'Observed', verb: 'was observed by',
      since: 'Apr 2026', role: 'Verified packet re-use', verified: true, source: 'Network cross-observation', tier: 'T2',
      detail: 'A second system replayed her verified passport — strengthens Practice.' },
    { id: 'edge-comphealth', type: 'credentialing', orgId: 'comphealth', label: 'Pre-cleared', verb: 'is pre-cleared by',
      since: 'Apr 2026', role: 'Locum credentialing', verified: true, source: 'Evidence packet', tier: 'T2',
      detail: 'Credentialing pre-cleared from her evidence packet — no employment.' },
  ],
  // opportunity containers reachable from each organization (D4 → D5 link)
  // resolved at render time from G.CONTAINERS by orgId.
};

// Relationship edge styling
G.EDGE_TYPE = {
  employment:    { label: 'Employment', color: '#059669', soft: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', stroke: '#059669' },
  observation:   { label: 'Observation', color: '#0284c7', soft: 'bg-sky-50 text-sky-700 ring-sky-600/20', stroke: '#0284c7' },
  credentialing: { label: 'Credentialing', color: '#7c3aed', soft: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20', stroke: '#7c3aed' },
};

G.tierTone = (t) => ({ T1: 'text-slate-600 border-slate-300', T2: 'text-sky-700 border-sky-300', T3: 'text-indigo-700 border-indigo-300', T4: 'text-emerald-700 border-emerald-300' }[t] || 'text-slate-600 border-slate-300');

window.G = G;
