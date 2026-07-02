// WAVE 1200 — REASONING LAYER
// Population roster, organization pipelines, what-if scenarios, graph-derived
// recommendations, and explainable reasoning traces. Everything here resolves
// against the Wave 1100 graph (NODES / LINKS / ADJ) — answers are traversed.

/* ================================================================
   ROLE TARGETS — the senior positions the engine reasons about
   ================================================================ */
const ROLE_TARGETS = {
  'medical-director': { label: 'Medical Director',           reqs: ['Active unrestricted license', '7+ yrs clinical', 'Documented leadership', 'No adverse actions'] },
  'lead-app':         { label: 'Lead Advanced Practice Provider', reqs: ['APP license', 'Supervision of ≥3 APPs', 'Operational ownership'] },
  'service-chief':    { label: 'Service-line Chief',         reqs: ['Specialty board cert', 'P&L ownership', 'Strategic mandate'] },
  'clinical-faculty': { label: 'Clinical Faculty',           reqs: ['Terminal degree', 'Teaching record', 'Peer-reviewed output'] },
};
window.ROLE_TARGETS = ROLE_TARGETS;

/* ================================================================
   CLINICIAN ROSTER — the population the graph reasons across.
   The subject (Macie) is the same node as the Wave 1100 self.
   ================================================================ */
const CLINICIANS = [
  { id: 'self', name: 'Macie Miller', cred: 'PA-C', role: 'PA, Cardiology', specialty: 'Cardiology',
    org: 'Cedar Health System', state: 'CA', trainedAt: ['Stanford · SoM', 'UCLA Medical Center'],
    years: 4, readiness: 86, eligible: ['lead-app'], near: ['service-chief'],
    dims: { clinical: 88, leadership: 64, research: 41, operational: 72, academic: 70 },
    blockers: ['Second leadership appointment', 'Formal supervision of ≥3 APPs'], you: true },
  { id: 'c-vasquez', name: 'Dr. Helen Vasquez', cred: 'MD', role: 'Fellowship Director', specialty: 'Cardiology',
    org: 'UCLA Medical Center', state: 'CA', trainedAt: ['UCLA Medical Center'],
    years: 18, readiness: 95, eligible: ['medical-director', 'lead-app', 'clinical-faculty'], near: [],
    dims: { clinical: 96, leadership: 90, research: 84, operational: 78, academic: 92 }, blockers: [] },
  { id: 'c-lee', name: 'Dr. Marcus Lee', cred: 'MD', role: 'Chief, Cardiology', specialty: 'Cardiology',
    org: 'Cedar Health System', state: 'CA', trainedAt: ['UCLA Medical Center'],
    years: 21, readiness: 97, eligible: ['medical-director', 'service-chief'], near: [],
    dims: { clinical: 95, leadership: 96, research: 70, operational: 94, academic: 80 }, blockers: [] },
  { id: 'c-rao', name: 'Dr. Anita Rao', cred: 'PhD', role: 'PA Program Director', specialty: 'Education',
    org: 'Western U. Health Sci.', state: 'CA', trainedAt: ['Western U. Health Sci.'],
    years: 14, readiness: 89, eligible: ['clinical-faculty', 'medical-director'], near: [],
    dims: { clinical: 70, leadership: 82, research: 78, operational: 74, academic: 94 }, blockers: [] },
  { id: 'c-whitfield', name: 'Sara Whitfield', cred: 'PA-C', role: 'Senior PA · co-author', specialty: 'Cardiology',
    org: 'Cedar Health System', state: 'CA', trainedAt: ['Western U. Health Sci.'],
    years: 9, readiness: 78, eligible: ['lead-app'], near: ['clinical-faculty'],
    dims: { clinical: 84, leadership: 58, research: 66, operational: 70, academic: 60 },
    blockers: ['Terminal-degree gap for faculty'] },
  { id: 'c-sandoval', name: 'Dr. Robert Sandoval', cred: 'MD', role: 'Cardiologist', specialty: 'Cardiology',
    org: 'Bay Cardiovascular Group', state: 'CA', trainedAt: ['Stanford · SoM'],
    years: 12, readiness: 90, eligible: ['medical-director', 'lead-app'], near: [],
    dims: { clinical: 92, leadership: 80, research: 74, operational: 76, academic: 82 }, blockers: [] },
  { id: 'c-natarajan', name: 'Dr. Priya Natarajan', cred: 'MD', role: 'Hospitalist Lead', specialty: 'Internal Med.',
    org: 'Stanford · SoM', state: 'CA', trainedAt: ['Stanford · SoM'],
    years: 11, readiness: 91, eligible: ['medical-director', 'service-chief'], near: [],
    dims: { clinical: 90, leadership: 86, research: 72, operational: 88, academic: 80 }, blockers: [] },
  { id: 'c-cho', name: 'Daniel Cho', cred: 'PA-C', role: 'Emergency PA', specialty: 'Emergency Med.',
    org: 'Sierra Acute Care', state: 'NV', trainedAt: ['Stanford · SoM'],
    years: 7, readiness: 73, eligible: ['lead-app'], near: [],
    dims: { clinical: 80, leadership: 60, research: 40, operational: 72, academic: 54 },
    blockers: ['Practices outside CA jurisdiction'] },
  { id: 'c-okafor', name: 'James Okafor', cred: 'PA-C', role: 'AAPA Caucus Chair', specialty: 'Primary Care',
    org: 'AAPA Cardiovascular', state: 'IL', trainedAt: ['Rush University'],
    years: 10, readiness: 66, eligible: [], near: ['lead-app'],
    dims: { clinical: 70, leadership: 74, research: 48, operational: 58, academic: 56 },
    blockers: ['No current clinical appointment'] },
];
window.CLINICIANS = CLINICIANS;
const CLIN_BY_ID = Object.fromEntries(CLINICIANS.map(c => [c.id, c]));
window.CLIN_BY_ID = CLIN_BY_ID;

/* ================================================================
   ORGANIZATION PIPELINES — leadership readiness by institution
   ================================================================ */
const ORG_PIPELINES = [
  { id: 'o-ucla',   name: 'UCLA Medical Center',  loc: 'Los Angeles, CA', score: 91, ready: 5, emerging: 6, bench: 14, openRoles: 3, note: 'Deepest bench — fellowship engine feeds directors annually.' },
  { id: 'o-stanford', name: 'Stanford · SoM',     loc: 'Palo Alto, CA',   score: 88, ready: 4, emerging: 5, bench: 11, openRoles: 2, note: 'Research-weighted pipeline; strong faculty conversion.' },
  { id: 'o-cedar',  name: 'Cedar Health System',  loc: 'Los Angeles, CA', score: 82, ready: 3, emerging: 4, bench: 9,  openRoles: 4, note: 'Operational leaders; APP-led pathways maturing fast.' },
  { id: 'o-western', name: 'Western U. Health Sci.', loc: 'Pomona, CA',   score: 74, ready: 2, emerging: 3, bench: 7,  openRoles: 1, note: 'Academic-heavy; thinner on operational leadership.' },
  { id: 'o-aapa',   name: 'AAPA Cardiovascular',  loc: 'National society', score: 61, ready: 1, emerging: 3, bench: 6,  openRoles: 0, note: 'Influence network, not an employer pipeline.' },
];
window.ORG_PIPELINES = ORG_PIPELINES;

/* ================================================================
   REASONING TRACES — the explainable spine.
   Each trace is a full chain: question → traversal → evidence →
   reasoning → conclusion. Surfaces (path, studio, explore) all
   reference these by id, so every recommendation can explain itself.
   ================================================================ */
const TRACES = {
  'lead-app-ready': {
    id: 'lead-app-ready',
    question: 'Is this clinician ready for a Lead Advanced Practice Provider role?',
    target: 'g-lead',
    seedIds: ['self', 'g-lead', 'r-protocol', 'h-service', 's-discharge', 'r-cedar', 'p-lee'],
    traversal: [
      { from: 'self', rel: 'pursues', to: 'g-lead' },
      { from: 'g-lead', rel: 'needs', to: 'r-protocol' },
      { from: 'g-lead', rel: 'needs', to: 'h-service' },
      { from: 'g-lead', rel: 'needs', to: 's-discharge' },
      { from: 'r-protocol', rel: 'at', to: 'o-cedar' },
      { from: 'self', rel: 'reports', to: 'p-lee' },
    ],
    evidence: [
      { id: 'r-protocol', weight: 'load-bearing', note: 'Discharge-protocol leadership — operational ownership, source-verified by Cedar.' },
      { id: 'h-service', weight: 'load-bearing', note: 'Service Excellence honor — conferred, cannot be self-claimed.' },
      { id: 's-discharge', weight: 'supporting', note: 'Discharge-protocol skill applied across two roles.' },
      { id: 'p-lee', weight: 'corroborating', note: 'Chief of Cardiology will attest to operational leadership.' },
    ],
    reasoning: [
      'Two of three load-bearing requirements are met and source-backed.',
      'Operational ownership is demonstrated, not asserted — the protocol role carries a conferred honor.',
      'The single gap is formal supervision of ≥3 APPs; no node on the ledger satisfies it yet.',
    ],
    conclusion: { verdict: 'Conditionally ready', state: 'pending', confidence: 71,
      text: 'Eligible to interview now. One structural gap — supervised APP headcount — separates conditional from full readiness. Closing it is a single appointment away.' },
  },
  'md-eligibility': {
    id: 'md-eligibility',
    question: 'Which clinicians are eligible for Medical Director?',
    population: true,
    requireEligible: 'medical-director',
    reasoning: [
      'Eligibility is a conjunction: active unrestricted license AND 7+ years clinical AND documented leadership AND zero adverse actions.',
      'The graph evaluates each clinician against all four — a single missing edge disqualifies.',
      'Five of nine clear every requirement; the rest fail on tenure or leadership evidence, not licensure.',
    ],
    conclusion: { verdict: '5 of 9 eligible', state: 'verified', confidence: 100,
      text: 'Eligibility is fully decidable from source-backed nodes. No human screening required to produce this shortlist.' },
  },
  'stanford-ca': {
    id: 'stanford-ca',
    question: 'Who trained at Stanford and practices in California?',
    population: true,
    reasoning: [
      'A two-predicate filter: trainedAt contains Stanford · SoM AND practice state = CA.',
      'Training edges are verified against the institution node; state is read from the active license.',
      'Three clinicians satisfy both predicates; one Stanford-trained clinician is excluded for practicing in NV.',
    ],
    conclusion: { verdict: '3 matches', state: 'verified', confidence: 100,
      text: 'A question no résumé database answers cleanly — here it is one graph traversal over verified training and licensure edges.' },
  },
  'readiness-block': {
    id: 'readiness-block',
    question: 'What evidence is preventing readiness?',
    target: 'g-specialist',
    seedIds: ['self', 'g-specialist', 'pub-2', 'com-aapa', 'c-fellowship', 'r-cedar'],
    traversal: [
      { from: 'self', rel: 'pursues', to: 'g-specialist' },
      { from: 'g-specialist', rel: 'needs', to: 'c-fellowship' },
      { from: 'g-specialist', rel: 'needs', to: 'r-cedar' },
      { from: 'self', rel: 'authored', to: 'pub-2' },
      { from: 'self', rel: 'seats', to: 'com-aapa' },
    ],
    evidence: [
      { id: 'pub-2', weight: 'blocking', note: 'Second publication is in review — pending, not yet source-backed.' },
      { id: 'com-aapa', weight: 'blocking', note: 'Guideline-review seat is pending confirmation.' },
    ],
    reasoning: [
      'Readiness for Senior Cardiology PA is 86% — the path is complete but for two pending nodes.',
      'Neither blocker is a missing credential; both are nodes awaiting source confirmation.',
      'No adverse or historical node is dragging the score — the gap is latency, not deficiency.',
    ],
    conclusion: { verdict: '2 pending nodes', state: 'pending', confidence: 86,
      text: 'Readiness is gated by confirmation latency, not capability. Both blockers resolve on external acknowledgement — a journal decision and a committee seat.' },
  },
  'org-pipeline': {
    id: 'org-pipeline',
    question: 'Which organizations have the strongest leadership pipeline?',
    population: true,
    reasoning: [
      'Pipeline strength = ready leaders + emerging leaders, weighted by bench depth and conferred recognition density.',
      'Each clinician node carries a readiness score; organizations aggregate the clinicians tied to them.',
      'UCLA leads on conversion — its fellowship reliably promotes ready directors — while Cedar leads on operational APP pathways.',
    ],
    conclusion: { verdict: 'UCLA · 91', state: 'verified', confidence: 92,
      text: 'Leadership pipeline is an emergent property of the graph, not a survey. It updates the moment a clinician\u2019s readiness node changes.' },
  },
};
window.TRACES = TRACES;

/* ================================================================
   NL EXPLORER QUERIES — natural-language questions that parse into
   structured graph queries and resolve to a visualized answer.
   ================================================================ */
const NL_QUERIES = [
  {
    id: 'md-eligibility', traceId: 'md-eligibility',
    nl: 'Show clinicians eligible for Medical Director.',
    parse: { intent: 'FILTER · people', entities: ['Medical Director'], predicate: 'eligible ∋ medical-director', viz: 'roster' },
    Icon: 'Award',
    resolve() {
      const rows = CLINICIANS.filter(c => c.eligible.includes('medical-director'))
        .map(c => ({ clin: c, why: `${c.years} yrs · ${c.cred} · leadership ${c.dims.leadership}` }))
        .sort((a, b) => b.clin.readiness - a.clin.readiness);
      const rejected = CLINICIANS.filter(c => !c.eligible.includes('medical-director') && !c.you)
        .map(c => ({ clin: c, why: c.years < 7 ? 'tenure < 7 yrs' : (c.blockers[0] || 'leadership evidence thin') }));
      return { viz: 'roster', rows, rejected, metric: c => c.readiness, metricLabel: 'readiness' };
    },
  },
  {
    id: 'stanford-ca', traceId: 'stanford-ca',
    nl: 'Who trained at Stanford and practices in California?',
    parse: { intent: 'FILTER · people', entities: ['Stanford · SoM', 'California'], predicate: 'trainedAt ∋ Stanford ∧ state = CA', viz: 'roster' },
    Icon: 'GraduationCap',
    resolve() {
      const matchP = c => c.trainedAt.some(t => t.includes('Stanford'));
      const rows = CLINICIANS.filter(c => matchP(c) && c.state === 'CA')
        .map(c => ({ clin: c, why: `${c.org} · ${c.specialty}` }))
        .sort((a, b) => b.clin.readiness - a.clin.readiness);
      const rejected = CLINICIANS.filter(c => matchP(c) && c.state !== 'CA')
        .map(c => ({ clin: c, why: `practices ${c.state} — fails CA predicate` }));
      return { viz: 'roster', rows, rejected, metric: c => c.readiness, metricLabel: 'readiness' };
    },
  },
  {
    id: 'readiness-block', traceId: 'readiness-block',
    nl: 'What evidence is preventing readiness?',
    parse: { intent: 'TRAVERSE · evidence', entities: ['Senior Cardiology PA'], predicate: 'needs ∧ state = pending', viz: 'subgraph' },
    Icon: 'AlertTri',
    resolve() {
      const t = TRACES['readiness-block'];
      const ids = t.seedIds;
      const links = LINKS.filter(l => ids.includes(l.source) && ids.includes(l.target));
      return { viz: 'subgraph', focus: 'g-specialist', ids, links,
        rows: t.evidence.map(e => ({ node: NODE_BY_ID[e.id], detail: e.note })) };
    },
  },
  {
    id: 'org-pipeline', traceId: 'org-pipeline',
    nl: 'Which organizations have the strongest leadership pipeline?',
    parse: { intent: 'RANK · organizations', entities: ['leadership pipeline'], predicate: 'order by pipeline_score desc', viz: 'orgs' },
    Icon: 'Building',
    resolve() {
      return { viz: 'orgs', rows: [...ORG_PIPELINES].sort((a, b) => b.score - a.score) };
    },
  },
];
window.NL_QUERIES = NL_QUERIES;

/* ================================================================
   WHAT-IF SCENARIOS — toggleable career moves; effects project
   across four axes and ghost new nodes into the graph.
   ================================================================ */
const SCENARIO_BASE = { trust: 84, career: 86, orgs: 5, opps: 3 };
window.SCENARIO_BASE = SCENARIO_BASE;

const SCENARIOS = [
  { id: 's-cert', label: 'Add Heart-Failure certification', sub: 'CHFN · ~6 months', Icon: 'Badge', cat: 'Credential',
    effects: { trust: 3, career: 4, orgs: 1, opps: 1 },
    adds: [{ label: 'CHFN Certification', family: 'credential', icon: 'Badge' }],
    opens: ['Cedar HF service line'], unlocks: ['Service-line Chief (HF)'],
    note: 'A board certification is an authority node — it raises the floor of every role that needs licensure-grade evidence.' },
  { id: 's-supervise', label: 'Formally supervise ≥3 APPs', sub: 'Appointment · ~3 months', Icon: 'Users', cat: 'Leadership',
    effects: { trust: 2, career: 9, orgs: 0, opps: 1 },
    adds: [{ label: 'APP Supervision', family: 'work', icon: 'Users' }],
    opens: [], unlocks: ['Lead Advanced Practice Provider'],
    note: 'This is the single load-bearing gap for Lead APP. It converts conditional readiness to full readiness.' },
  { id: 's-texas', label: 'Add Texas licensure', sub: 'Relicense · ~4 months', Icon: 'Stamp', cat: 'Mobility',
    effects: { trust: 1, career: 2, orgs: 2, opps: 2 },
    adds: [{ label: 'TX PA License', family: 'credential', icon: 'Stamp' }],
    opens: ['Houston Methodist', 'UT Southwestern'],
    unlocks: ['Cross-state Senior Cardiology PA'],
    note: 'Licensure is jurisdictional. A second state doubles the addressable employer graph without changing the clinical record.' },
  { id: 's-publish', label: 'Publish second peer-reviewed study', sub: 'Acceptance · pending', Icon: 'Microscope', cat: 'Research',
    effects: { trust: 4, career: 5, orgs: 1, opps: 1 },
    adds: [{ label: 'Peer-reviewed study #2', family: 'work', icon: 'Microscope' }],
    opens: ['Western U. faculty track'], unlocks: ['Clinical Faculty'],
    note: 'Research is the thinnest dimension. A second work is the highest-leverage single node — it lifts academic and research together.' },
  { id: 's-fellowship', label: 'Complete leadership fellowship', sub: 'Program · ~12 months', Icon: 'Award', cat: 'Education',
    effects: { trust: 5, career: 8, orgs: 2, opps: 2 },
    adds: [{ label: 'Leadership Fellowship', family: 'credential', icon: 'Award' }],
    opens: ['UCLA service-line lead', 'Cedar directorship'], unlocks: ['Medical Director track'],
    note: 'A formal leadership credential closes the gap conferred recognition only hints at — it is the bridge from clinician to director.' },
  { id: 's-join-ucla', label: 'Join UCLA as service-line lead', sub: 'Move · ~6 months', Icon: 'Building', cat: 'Mobility',
    effects: { trust: 2, career: 7, orgs: 1, opps: 2 },
    adds: [{ label: 'UCLA Service Lead role', family: 'work', icon: 'Briefcase' }],
    opens: ['UCLA fellowship-director track'], unlocks: ['Lead APP', 'Clinical Faculty'],
    note: 'UCLA has the deepest leadership pipeline in the graph. Joining it raises mobility by attaching to a proven conversion engine.' },
];
window.SCENARIOS = SCENARIOS;

/* ================================================================
   RECOMMENDATION STUDIO — recommendations that emerge from the graph.
   Every card cites its basis nodes and links to a reasoning trace.
   ================================================================ */
const REC_CATS = [
  { id: 'career',       label: 'Career moves', Icon: 'TrendingUp' },
  { id: 'leadership',   label: 'Leadership',   Icon: 'Users' },
  { id: 'education',    label: 'Education',    Icon: 'GraduationCap' },
  { id: 'research',     label: 'Research',     Icon: 'Microscope' },
  { id: 'recruiters',  label: 'Recruiters',   Icon: 'Handshake' },
  { id: 'organizations', label: 'Organizations', Icon: 'Building' },
];
window.REC_CATS = REC_CATS;

const RECOMMENDATIONS = [
  { id: 'rec-1', cat: 'career', title: 'Interview for Senior Cardiology PA now', impact: 'high', confidence: 86,
    basis: ['c-fellowship', 'r-cedar', 'pub-1', 'c-license'], traceId: 'readiness-block',
    rationale: 'The strongest path on the record is complete — degree → certification → license → fellowship → role → publication. Readiness is 86%, gated only by confirmation latency, not capability.',
    effect: 'Open now · one employer NPDB query from full readiness.' },
  { id: 'rec-2', cat: 'leadership', title: 'Secure formal supervision of ≥3 APPs', impact: 'high', confidence: 71,
    basis: ['r-protocol', 'h-service', 's-discharge'], traceId: 'lead-app-ready',
    rationale: 'Two of three load-bearing requirements for Lead APP are met and source-backed. The only structural gap is supervised APP headcount — a single appointment closes it.',
    effect: 'Converts conditional → full Lead APP readiness (+9 career).' },
  { id: 'rec-3', cat: 'leadership', title: 'Pursue a formal leadership fellowship', impact: 'medium', confidence: 64,
    basis: ['r-protocol', 'h-service', 'p-lee'], traceId: 'lead-app-ready',
    rationale: 'Conferred recognition hints at leadership, but no credential node certifies it. A leadership fellowship is the bridge from clinician to the Medical Director track.',
    effect: 'Unlocks Medical Director track · +5 trust.' },
  { id: 'rec-4', cat: 'education', title: 'Add a Heart-Failure subspecialty certification', impact: 'medium', confidence: 68,
    basis: ['s-cardiology', 'r-cedar', 'c-nccpa'], traceId: null,
    rationale: 'Cardiology is the deepest clinical domain on the record, but it has no subspecialty authority node. CHFN raises the floor of every HF-specific role.',
    effect: 'Opens Cedar HF service line · +1 opportunity.' },
  { id: 'rec-5', cat: 'research', title: 'Land the second peer-reviewed study', impact: 'high', confidence: 74,
    basis: ['pub-1', 'pub-2', 's-research'], traceId: 'readiness-block',
    rationale: 'Research is the thinnest dimension — two publications, one in review. A second accepted work is the single highest-leverage node, lifting academic and research together.',
    effect: 'Unlocks Clinical Faculty · +4 trust, +5 career.' },
  { id: 'rec-6', cat: 'research', title: 'Convert the AAPA guideline seat', impact: 'low', confidence: 58,
    basis: ['com-aapa', 'o-aapa', 'p-okafor'], traceId: null,
    rationale: 'A pending committee seat is a service-dimension node awaiting confirmation. Converting it adds the only national-society evidence on the record.',
    effect: 'Resolves a pending node · +national reach.' },
  { id: 'rec-7', cat: 'recruiters', title: 'Dr. Marcus Lee — strongest corroborating reference', impact: 'high', confidence: 90,
    basis: ['p-lee', 'r-cedar', 'h-service'], traceId: 'lead-app-ready',
    rationale: 'The Chief of Cardiology is connected to the same operational evidence he would attest to. Attestation is a relationship a recruiter can verify at its source — not a checkbox.',
    effect: 'Corroborates clinical + operational + leadership.' },
  { id: 'rec-8', cat: 'recruiters', title: 'Bay Cardiovascular Group is actively hiring your profile', impact: 'medium', confidence: 62,
    basis: ['c-sandoval', 'g-specialist', 'c-license'], traceId: null,
    rationale: 'A Stanford-trained, CA-licensed cardiologist in the network (Sandoval) sits inside an org with open senior-PA roles matching your verified profile.',
    effect: '2 open roles match · warm network path.' },
  { id: 'rec-9', cat: 'organizations', title: 'UCLA has the deepest pipeline for your trajectory', impact: 'medium', confidence: 78,
    basis: ['o-ucla', 'c-fellowship', 'p-vasquez'], traceId: 'org-pipeline',
    rationale: 'UCLA leads the leadership-pipeline ranking (91) with proven director conversion. You already hold a fellowship and a mentor edge into it — a warm structural path.',
    effect: 'Highest-conversion org · existing warm edges.' },
  { id: 'rec-10', cat: 'organizations', title: 'Cedar is the fastest operational-leadership path', impact: 'medium', confidence: 70,
    basis: ['o-cedar', 'r-protocol', 'p-lee'], traceId: 'lead-app-ready',
    rationale: 'Cedar leads on APP-led pathways and you already own a protocol there. Staying converts existing operational evidence to a Lead APP appointment faster than any move.',
    effect: '4 open roles · no relocation cost.' },
  { id: 'rec-11', cat: 'career', title: 'Add Texas licensure to double employer reach', impact: 'low', confidence: 55,
    basis: ['c-license', 'c-nccpa'], traceId: null,
    rationale: 'Licensure is jurisdictional. A second state attaches the clinical record to an entirely new employer subgraph at no change to the underlying evidence.',
    effect: '+2 organizations, +2 opportunities.' },
];
window.RECOMMENDATIONS = RECOMMENDATIONS;

/* ================================================================
   GLOBAL SEARCH INDEX — every entity, tagged by the search facets
   the spec calls out (People, Organizations, Evidence, Licenses,
   Certifications, Research, Publications, Mentorship, Opportunities).
   Each entry knows its graph degree + hop distance from self.
   ================================================================ */
const SEARCH_FACETS = [
  { id: 'people',         label: 'People',         Icon: 'User',          test: n => n.family === 'person' },
  { id: 'organizations',  label: 'Organizations',  Icon: 'Building',      test: n => n.family === 'institution' },
  { id: 'evidence',       label: 'Evidence',       Icon: 'Activity',      test: n => n.family === 'work' && n.type !== 'Publication' },
  { id: 'licenses',       label: 'Licenses',       Icon: 'Stamp',         test: n => n.type === 'Licensure' },
  { id: 'certifications', label: 'Certifications', Icon: 'Badge',         test: n => n.type === 'Certification' },
  { id: 'research',       label: 'Research',       Icon: 'Microscope',    test: n => n.type === 'Publication' || (n.dims || []).includes('research') },
  { id: 'mentorship',     label: 'Mentorship',     Icon: 'Handshake',     test: n => n.type === 'Mentor' || n.type === 'Supervisor' },
  { id: 'opportunities',  label: 'Opportunities',  Icon: 'Target',        test: n => n.family === 'aspiration' },
];
window.SEARCH_FACETS = SEARCH_FACETS;

// hop distance from self (BFS), computed once
const HOPS = (() => {
  const dist = { self: 0 }; let frontier = ['self'], d = 0;
  while (frontier.length) {
    const next = [];
    frontier.forEach(id => (ADJ[id] || []).forEach(e => { if (dist[e.id] == null) { dist[e.id] = d + 1; next.push(e.id); } }));
    frontier = next; d++;
  }
  return dist;
})();
window.HOPS = HOPS;

function facetsFor(node) { return SEARCH_FACETS.filter(f => f.test(node)).map(f => f.id); }
window.facetsFor = facetsFor;

// The flat searchable index
const SEARCH_INDEX = NODES.filter(n => n.id !== 'self').map(n => ({
  node: n,
  facets: facetsFor(n),
  degree: (ADJ[n.id] || []).length,
  hops: HOPS[n.id] ?? 99,
  hay: `${n.label} ${n.sub} ${n.type} ${(n.dims || []).join(' ')}`.toLowerCase(),
}));
window.SEARCH_INDEX = SEARCH_INDEX;

// Curated example searches to seed the empty state
const SEARCH_SUGGESTIONS = ['Cardiology', 'license', 'UCLA', 'leadership', 'publication', 'mentor'];
window.SEARCH_SUGGESTIONS = SEARCH_SUGGESTIONS;
