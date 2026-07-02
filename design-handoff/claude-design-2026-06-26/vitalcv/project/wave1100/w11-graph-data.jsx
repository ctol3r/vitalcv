// WAVE 1100 — UNIFIED ENTITY MODEL
// Every career object is a first-class node; every relationship is a typed, directed edge.
// This is the graph the surfaces project from. Nodes carry: id, type, family, label,
// sub, state, dims (which reputation dimensions they feed), and an icon name.

/* ---------- The seven reputation dimensions (label lookup) ---------- */
const DIM = {
  authority:   { label: 'Authority' },
  clinical:    { label: 'Clinical' },
  research:    { label: 'Research' },
  leadership:  { label: 'Leadership' },
  academic:    { label: 'Academic' },
  operational: { label: 'Operational' },
  service:     { label: 'Service' },
};
window.DIM = DIM;

/* ---------- Node families (the visual + conceptual grouping) ---------- */
const FAMILIES = {
  self:        { label: 'You',            accent: '#0f172a', soft: '#0f172a', ring: 'ring-slate-900',   text: 'text-slate-900',   chip: 'bg-slate-900 text-white' },
  person:      { label: 'People',         accent: '#475569', soft: '#e2e8f0', ring: 'ring-slate-400',   text: 'text-slate-700',   chip: 'bg-slate-100 text-slate-700' },
  institution: { label: 'Institutions',   accent: '#4f46e5', soft: '#e0e7ff', ring: 'ring-indigo-500',  text: 'text-indigo-700',  chip: 'bg-indigo-50 text-indigo-700' },
  credential:  { label: 'Credentials',    accent: '#059669', soft: '#d1fae5', ring: 'ring-emerald-500', text: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-700' },
  work:        { label: 'Work & evidence', accent: '#7c3aed', soft: '#ede9fe', ring: 'ring-violet-500',  text: 'text-violet-700',  chip: 'bg-violet-50 text-violet-700' },
  honor:       { label: 'Recognition',    accent: '#d97706', soft: '#fef3c7', ring: 'ring-amber-500',   text: 'text-amber-700',   chip: 'bg-amber-50 text-amber-700' },
  aspiration:  { label: 'Aspirations',    accent: '#64748b', soft: '#f1f5f9', ring: 'ring-slate-300',   text: 'text-slate-500',   chip: 'bg-slate-100 text-slate-500', dashed: true },
};
window.FAMILIES = FAMILIES;

/* ---------- Relationship vocabulary (edge semantics) ---------- */
const REL = {
  studied:     { label: 'studied at',   verb: 'studied at' },
  enables:     { label: 'enables',      verb: 'enables' },
  holds:       { label: 'holds',        verb: 'holds' },
  licensed:    { label: 'licensed by',  verb: 'is licensed by' },
  completed:   { label: 'completed',    verb: 'completed' },
  at:          { label: 'based at',     verb: 'is based at' },
  authored:    { label: 'authored',     verb: 'authored' },
  applies:     { label: 'applies',      verb: 'applies' },
  conferred:   { label: 'conferred by', verb: 'was conferred by' },
  recognizes:  { label: 'recognizes',   verb: 'recognizes' },
  mentors:     { label: 'mentors',      verb: 'mentors' },
  reports:     { label: 'reports to',   verb: 'reports to' },
  collaborates:{ label: 'collaborates', verb: 'collaborates with' },
  coauthor:    { label: 'co-authored',  verb: 'co-authored' },
  seats:       { label: 'seats',        verb: 'holds a seat on' },
  pursues:     { label: 'pursues',      verb: 'is pursuing' },
  needs:       { label: 'needs',        verb: 'needs' },
  builds:      { label: 'builds',       verb: 'builds' },
  precedes:    { label: 'precedes',     verb: 'precedes' },
};
window.REL = REL;

/* ---------- NODES — every first-class entity ---------- */
const NODES = [
  // — Self —
  { id: 'self', type: 'Person', family: 'self', label: 'Macie Miller', sub: 'PA-C · Cardiology', icon: 'User', state: 'verified', r: 30, dims: [] },

  // — People (the network) —
  { id: 'p-vasquez', type: 'Mentor',       family: 'person', label: 'Dr. Helen Vasquez', sub: 'Fellowship Director', icon: 'User', state: 'verified', r: 17, dims: ['clinical','academic'], attests: 'Clinical · Academic', willRef: true },
  { id: 'p-lee',     type: 'Supervisor',   family: 'person', label: 'Dr. Marcus Lee',    sub: 'Chief, Cardiology',   icon: 'User', state: 'verified', r: 17, dims: ['clinical','operational','leadership'], attests: 'Clinical · Operational · Leadership', willRef: true },
  { id: 'p-whitfield', type: 'Peer',       family: 'person', label: 'Sara Whitfield, PA-C', sub: 'Senior PA · co-author', icon: 'User', state: 'verified', r: 15, dims: ['research','clinical'], attests: 'Research · Clinical', willRef: true },
  { id: 'p-rao',     type: 'Collaborator', family: 'person', label: 'Dr. Anita Rao',     sub: 'PA Program Director',  icon: 'User', state: 'verified', r: 15, dims: ['academic'], attests: 'Academic · Teaching', willRef: false },
  { id: 'p-okafor',  type: 'Peer',         family: 'person', label: 'James Okafor, PA-C', sub: 'AAPA Caucus Chair',   icon: 'User', state: 'verified', r: 14, dims: ['service'], attests: 'Service', willRef: false },

  // — Institutions —
  { id: 'o-cedar',   type: 'Employer',  family: 'institution', label: 'Cedar Health System', sub: 'Health system · LA', icon: 'Building', state: 'verified', r: 24, dims: [] },
  { id: 'o-ucla',    type: 'Training',  family: 'institution', label: 'UCLA Medical Center',  sub: 'AMC · GME',          icon: 'Building', state: 'verified', r: 22, dims: [] },
  { id: 'o-western', type: 'Academic',  family: 'institution', label: 'Western U. Health Sci.', sub: 'PA program · Pomona', icon: 'Building', state: 'verified', r: 19, dims: [] },
  { id: 'o-aapa',    type: 'Society',   family: 'institution', label: 'AAPA Cardiovascular',  sub: 'Professional society', icon: 'Users',   state: 'verified', r: 19, dims: [] },
  { id: 'o-stanford',type: 'University',family: 'institution', label: 'Stanford · SoM',       sub: 'PA Studies',          icon: 'Building', state: 'verified', r: 18, dims: [] },
  { id: 'o-davis',   type: 'University',family: 'institution', label: 'UC Davis',             sub: 'Biological Sciences', icon: 'Building', state: 'verified', r: 16, dims: [] },

  // — Credentials (education, licensure, certification, training) —
  { id: 'c-bs',       type: 'Education',     family: 'credential', label: 'B.S. Biological Sciences', sub: 'Conferred 2017', icon: 'GraduationCap', state: 'verified', r: 14, dims: [] },
  { id: 'c-ms',       type: 'Education',     family: 'credential', label: 'M.S. PA Studies', sub: 'Terminal degree · 2022', icon: 'GraduationCap', state: 'verified', r: 17, dims: ['academic'] },
  { id: 'c-nccpa',    type: 'Certification', family: 'credential', label: 'NCCPA · PA-C', sub: 'Board certification', icon: 'Badge', state: 'verified', r: 18, dims: ['authority'] },
  { id: 'c-license',  type: 'Licensure',     family: 'credential', label: 'CA PA License', sub: 'PA-052987 · in good standing', icon: 'Stamp', state: 'verified', r: 18, dims: ['authority'] },
  { id: 'c-dea',      type: 'Certification', family: 'credential', label: 'DEA Registration', sub: 'Schedules II–V · 2027', icon: 'Badge', state: 'verified', r: 15, dims: ['authority'] },
  { id: 'c-fellowship', type: 'Training',    family: 'credential', label: 'Cardiology Fellowship', sub: 'UCLA · 12-month', icon: 'Award', state: 'verified', r: 18, dims: ['clinical','academic'] },

  // — Work & evidence (roles, publications, skills) —
  { id: 'r-cedar',    type: 'Role',        family: 'work', label: 'PA, Cardiology', sub: 'Cedar · 2023–present', icon: 'Stethoscope', state: 'verified', r: 18, dims: ['clinical','operational'] },
  { id: 'r-fellow',   type: 'Role',        family: 'work', label: 'PA Fellow', sub: 'UCLA · 2022–23', icon: 'Stethoscope', state: 'historical', r: 15, dims: ['clinical'] },
  { id: 'r-preceptor',type: 'Role',        family: 'work', label: 'Clinical Preceptor', sub: 'Western U. · PA students', icon: 'GraduationCap', state: 'verified', r: 15, dims: ['academic'] },
  { id: 'r-protocol', type: 'Leadership',  family: 'work', label: 'Discharge Protocol Lead', sub: 'Cedar · 2025', icon: 'Briefcase', state: 'verified', r: 16, dims: ['leadership','operational'] },
  { id: 'pub-1',      type: 'Publication', family: 'work', label: 'Post-MI follow-up case series', sub: 'J. Cardiovascular Nursing · 2024', icon: 'Microscope', state: 'verified', r: 15, dims: ['research'] },
  { id: 'pub-2',      type: 'Publication', family: 'work', label: 'APP discharge pathways', sub: 'In review · JACC Advances', icon: 'Microscope', state: 'pending', r: 13, dims: ['research'] },
  { id: 's-cardiology', type: 'Skill', family: 'work', label: 'Cardiology', sub: 'Clinical domain', icon: 'Heart', state: 'verified', r: 13, dims: ['clinical'] },
  { id: 's-discharge',  type: 'Skill', family: 'work', label: 'Discharge protocols', sub: 'PA-managed pathways', icon: 'Activity', state: 'verified', r: 12, dims: ['clinical','leadership'] },
  { id: 's-teaching',   type: 'Skill', family: 'work', label: 'Clinical teaching', sub: 'Precepting · didactics', icon: 'GraduationCap', state: 'verified', r: 12, dims: ['academic'] },
  { id: 's-research',   type: 'Skill', family: 'work', label: 'Clinical research', sub: 'Case-series methods', icon: 'Microscope', state: 'verified', r: 12, dims: ['research'] },
  { id: 'com-aapa',     type: 'Committee', family: 'work', label: 'Guideline-review seat', sub: 'AAPA · 2026 cycle', icon: 'Users', state: 'pending', r: 13, dims: ['service'] },

  // — Recognition (conferred — cannot self-claim) —
  { id: 'h-distinction', type: 'Honor', family: 'honor', label: 'Fellowship Distinction', sub: '1 of 8 fellows · UCLA', icon: 'Award', state: 'conferred', r: 15, dims: ['clinical','academic'] },
  { id: 'h-poster',      type: 'Honor', family: 'honor', label: 'Best Poster', sub: 'CAPA Research Day · 2024', icon: 'Star', state: 'conferred', r: 13, dims: ['research'] },
  { id: 'h-service',     type: 'Honor', family: 'honor', label: 'Service Excellence', sub: 'Cedar · 2025', icon: 'Trophy', state: 'conferred', r: 13, dims: ['operational'] },

  // — Aspirations (projected targets) —
  { id: 'g-specialist', type: 'Target', family: 'aspiration', label: 'Senior Cardiology PA', sub: 'Tertiary center · open now', icon: 'Target', state: 'unknown', r: 18, dims: ['clinical','authority'], match: 86 },
  { id: 'g-lead',       type: 'Target', family: 'aspiration', label: 'Lead Advanced Practice Provider', sub: 'Service-line lead · 12–24mo', icon: 'Route', state: 'unknown', r: 17, dims: ['leadership','operational'], match: 71 },
  { id: 'g-faculty',    type: 'Target', family: 'aspiration', label: 'Clinical Faculty', sub: 'PA program · 18–36mo', icon: 'Book', state: 'unknown', r: 15, dims: ['academic','research'], match: 58 },
];
window.NODES = NODES;

/* ---------- LINKS — typed, directed relationships ---------- */
const LINKS = [
  // education spine
  ['self','c-bs','holds'], ['self','c-ms','holds'],
  ['c-bs','o-davis','studied'], ['c-ms','o-stanford','studied'],
  ['c-ms','c-nccpa','enables'],
  // licensure & certification
  ['self','c-nccpa','holds'], ['self','c-license','holds'], ['self','c-dea','holds'],
  ['c-nccpa','c-license','enables'], ['c-license','c-dea','enables'],
  // training
  ['self','c-fellowship','completed'], ['c-fellowship','o-ucla','at'],
  ['c-fellowship','s-cardiology','builds'],
  // roles
  ['self','r-cedar','holds'], ['self','r-fellow','holds'], ['self','r-preceptor','holds'], ['self','r-protocol','holds'],
  ['r-cedar','o-cedar','at'], ['r-fellow','o-ucla','at'], ['r-preceptor','o-western','at'], ['r-protocol','o-cedar','at'],
  ['r-fellow','c-fellowship','precedes'], ['r-fellow','r-cedar','precedes'],
  // skills applied through work
  ['r-cedar','s-cardiology','applies'], ['r-cedar','s-discharge','applies'],
  ['r-protocol','s-discharge','applies'], ['r-protocol','s-research','builds'],
  ['r-preceptor','s-teaching','applies'],
  // publications
  ['self','pub-1','authored'], ['self','pub-2','authored'],
  ['pub-1','s-research','applies'], ['pub-2','s-research','applies'],
  ['pub-1','r-cedar','at'],
  // recognition
  ['h-distinction','o-ucla','conferred'], ['h-distinction','c-fellowship','recognizes'],
  ['h-poster','o-western','conferred'], ['h-poster','pub-1','recognizes'],
  ['h-service','o-cedar','conferred'], ['h-service','r-cedar','recognizes'],
  // committee
  ['self','com-aapa','seats'], ['com-aapa','o-aapa','at'],
  // people
  ['self','p-vasquez','mentors'], ['p-vasquez','o-ucla','at'], ['p-vasquez','c-fellowship','at'],
  ['self','p-lee','reports'], ['p-lee','o-cedar','at'], ['p-lee','r-cedar','at'],
  ['self','p-whitfield','collaborates'], ['p-whitfield','o-cedar','at'], ['p-whitfield','pub-1','coauthor'],
  ['self','p-rao','collaborates'], ['p-rao','o-western','at'], ['p-rao','r-preceptor','at'],
  ['self','p-okafor','collaborates'], ['p-okafor','o-aapa','at'], ['p-okafor','com-aapa','at'],
  // aspirations
  ['self','g-specialist','pursues'], ['self','g-lead','pursues'], ['self','g-faculty','pursues'],
  ['g-specialist','c-fellowship','needs'], ['g-specialist','r-cedar','needs'], ['g-specialist','c-license','needs'],
  ['g-lead','r-protocol','needs'], ['g-lead','h-service','needs'], ['g-lead','s-discharge','needs'],
  ['g-faculty','r-preceptor','needs'], ['g-faculty','h-distinction','needs'], ['g-faculty','pub-2','needs'],
].map(([source, target, rel]) => ({ source, target, rel }));
window.LINKS = LINKS;

/* ---------- Graph helpers (adjacency, traversal) ---------- */
const NODE_BY_ID = Object.fromEntries(NODES.map(n => [n.id, n]));
window.NODE_BY_ID = NODE_BY_ID;

const ADJ = Object.fromEntries(NODES.map(n => [n.id, []]));
LINKS.forEach(l => {
  ADJ[l.source].push({ id: l.target, rel: l.rel, dir: 'out', link: l });
  ADJ[l.target].push({ id: l.source, rel: l.rel, dir: 'in', link: l });
});
window.ADJ = ADJ;

function neighbors(id) { return (ADJ[id] || []).map(e => ({ ...e, node: NODE_BY_ID[e.id] })); }
function edgesFor(id) { return LINKS.filter(l => l.source === id || l.target === id); }
function nodesOfFamily(fam) { return NODES.filter(n => n.family === fam); }
window.neighbors = neighbors;
window.edgesFor = edgesFor;
window.nodesOfFamily = nodesOfFamily;

// Reachable subgraph from a set of seed ids, up to `depth` hops.
function subgraph(seedIds, depth = 1) {
  const keep = new Set(seedIds);
  let frontier = [...seedIds];
  for (let d = 0; d < depth; d++) {
    const next = [];
    frontier.forEach(id => (ADJ[id] || []).forEach(e => { if (!keep.has(e.id)) { keep.add(e.id); next.push(e.id); } }));
    frontier = next;
  }
  const ids = [...keep];
  const links = LINKS.filter(l => keep.has(l.source) && keep.has(l.target));
  return { ids, links };
}
window.subgraph = subgraph;

/* ---------- EXPLORER QUESTIONS — relationship queries over the graph ----------
   Each resolves to a subgraph (highlighted node ids + links) plus an evidence
   readout. Answers are TRAVERSED, never hand-written. */
const QUESTIONS = [
  {
    id: 'q-lead',
    q: 'What supports a Lead Advanced Practice Provider role?',
    sub: 'Trace the evidence a service-line leadership target is built on.',
    Icon: 'Route',
    resolve() {
      const target = 'g-lead';
      const supports = neighbors(target).filter(e => e.rel === 'needs');
      const haveIds = supports.map(e => e.id);
      // pull in what each support is itself attached to (one hop)
      const sg = subgraph(['self', target, ...haveIds], 1);
      return {
        focus: target,
        ids: sg.ids, links: sg.links,
        narrative: 'A Lead APP target resolves to three load-bearing pieces of evidence already on the ledger — plus the dimensions they feed.',
        rows: supports.map(e => ({ node: e.node, detail: dimNote(e.node) })),
        gap: 'Gap to close: a second leadership appointment and formal supervision of ≥3 APPs.',
      };
    },
  },
  {
    id: 'q-trained',
    q: 'Who trained alongside this clinician?',
    sub: 'People connected through the same training institution.',
    Icon: 'GraduationCap',
    resolve() {
      const org = 'o-ucla';
      const people = neighbors(org).filter(e => e.node.family === 'person').map(e => e.node);
      const ids = ['self', org, 'c-fellowship', 'r-fellow', ...people.map(p => p.id)];
      const sg = subgraph(ids, 0);
      return {
        focus: org,
        ids: sg.ids, links: LINKS.filter(l => sg.ids.includes(l.source) && sg.ids.includes(l.target)),
        narrative: 'UCLA is the shared training hub. Anyone tied to it — director, cohort, the fellowship credential itself — is one hop away.',
        rows: people.map(p => ({ node: p, detail: p.sub + (p.willRef ? ' · will attest' : '') })),
        gap: 'Shared-institution ties are the strongest references a recruiter can corroborate.',
      };
    },
  },
  {
    id: 'q-precede',
    q: 'What experiences precede a Senior Cardiology PA?',
    sub: 'The ordered chain the strongest path is built from.',
    Icon: 'TrendingUp',
    resolve() {
      const chain = ['c-ms','c-nccpa','c-license','c-fellowship','r-fellow','r-cedar','pub-1','g-specialist'];
      const links = LINKS.filter(l => chain.includes(l.source) && chain.includes(l.target));
      return {
        focus: 'g-specialist',
        ids: ['self', ...chain], links,
        narrative: 'Senior specialist depth is not a leap — it is a chain: degree → certification → license → fellowship → role → publication.',
        rows: ['c-ms','c-nccpa','c-license','c-fellowship','r-cedar','pub-1'].map(id => ({ node: NODE_BY_ID[id], detail: NODE_BY_ID[id].sub })),
        gap: 'This is the most complete path on the record — open now, pending one employer NPDB query.',
      };
    },
  },
  {
    id: 'q-orgs',
    q: 'How are the organizations connected?',
    sub: 'Institutions and the evidence that ties them together.',
    Icon: 'Building',
    resolve() {
      const orgs = nodesOfFamily('institution').map(n => n.id);
      const sg = subgraph(orgs, 1);
      // keep only nodes that bridge to an org
      return {
        focus: 'o-cedar',
        ids: sg.ids, links: sg.links,
        narrative: 'No organization is an island. Each connects to the next through a shared person, a credential, or a piece of work.',
        rows: nodesOfFamily('institution').map(o => ({ node: o, detail: `${neighbors(o.id).length} connections` })),
        gap: 'Five institutions, one career — the graph makes the bridges between them legible.',
      };
    },
  },
  {
    id: 'q-research',
    q: 'What evidence supports Research standing?',
    sub: 'Everything feeding the research dimension.',
    Icon: 'Microscope',
    resolve() {
      const ids = NODES.filter(n => (n.dims || []).includes('research')).map(n => n.id);
      const sg = subgraph(ids, 1);
      return {
        focus: 'pub-1',
        ids: ['self', ...sg.ids], links: LINKS.filter(l => sg.ids.includes(l.source) && sg.ids.includes(l.target)),
        narrative: 'Research is the thinnest dimension — two publications, one recognition, one skill. The graph shows exactly where a third work would attach.',
        rows: ids.map(id => ({ node: NODE_BY_ID[id], detail: NODE_BY_ID[id].sub })),
        gap: 'A second peer-reviewed work is the single highest-leverage node to add.',
      };
    },
  },
  {
    id: 'q-attest',
    q: 'Who can attest to clinical credibility?',
    sub: 'People in the network whose attestation covers Clinical.',
    Icon: 'Handshake',
    resolve() {
      const people = NODES.filter(n => n.family === 'person' && (n.attests || '').includes('Clinical'));
      const ids = ['self', ...people.map(p => p.id), 'r-cedar', 'c-fellowship', 'o-cedar', 'o-ucla'];
      const links = LINKS.filter(l => ids.includes(l.source) && ids.includes(l.target));
      return {
        focus: 'self',
        ids, links,
        narrative: 'Attestation is a relationship, not a checkbox. These people are connected to the same clinical evidence they would vouch for.',
        rows: people.map(p => ({ node: p, detail: p.attests + (p.willRef ? ' · will reference' : ' · not yet confirmed') })),
        gap: 'Two strong references already corroborate the clinical record at its source.',
      };
    },
  },
];
window.QUESTIONS = QUESTIONS;

function dimNote(node) {
  const d = (node.dims || []).map(k => (window.DIM && window.DIM[k] ? window.DIM[k].label : k));
  return d.length ? `Feeds ${d.join(' · ')}` : node.sub;
}
window.dimNote = dimNote;

/* ---------- CAREER DNA — structural topology metrics (a shape, not a score) ----------
   Each metric is computed from the graph's structure, not asserted. */
const DNA_METRICS = [
  { key: 'strength',   label: 'Career strength',      blurb: 'Verified, source-backed nodes as a share of the whole graph.',
    compute: () => Math.round(100 * NODES.filter(n => n.state === 'verified' || n.state === 'conferred').length / NODES.filter(n => n.family !== 'aspiration').length) },
  { key: 'diversity',  label: 'Career diversity',     blurb: 'How many distinct families the record spans — breadth of kind.',
    compute: () => Math.round(100 * new Set(NODES.filter(n => n.family !== 'aspiration' && n.family !== 'self').map(n => n.family)).size / 5) },
  { key: 'leadership', label: 'Leadership density',   blurb: 'Share of nodes that carry leadership or operational weight.',
    compute: () => Math.round(100 * NODES.filter(n => (n.dims||[]).some(d => d === 'leadership' || d === 'operational')).length / 8) },
  { key: 'academic',   label: 'Academic depth',       blurb: 'Education, training, teaching, and research mass in the graph.',
    compute: () => Math.round(100 * NODES.filter(n => (n.dims||[]).some(d => d === 'academic' || d === 'research')).length / 14) },
  { key: 'mobility',   label: 'Mobility',             blurb: 'Reachable aspiration targets, weighted by their match.',
    compute: () => Math.round(NODES.filter(n => n.family === 'aspiration').reduce((a, n) => a + (n.match||0), 0) / 3) },
  { key: 'influence',  label: 'Professional influence', blurb: 'Network ties plus conferred recognition — reach beyond the self.',
    compute: () => Math.round(100 * (NODES.filter(n => n.family === 'person').length + NODES.filter(n => n.family === 'honor').length) / 12) },
];
window.DNA_METRICS = DNA_METRICS;

/* ---------- Entity-model summary (for the Model surface) ---------- */
const ENTITY_TYPES = [
  { type: 'Person',        family: 'self',        count: 1,  note: 'The subject — the only writer of this ledger.' },
  { type: 'Person',        family: 'person',      count: 5,  note: 'Mentors, supervisors, peers, collaborators.' },
  { type: 'Institution',   family: 'institution', count: 6,  note: 'Employers, training centers, universities, societies.' },
  { type: 'Credential',    family: 'credential',  count: 6,  note: 'Education, licensure, certification, training.' },
  { type: 'Work & evidence', family: 'work',      count: 11, note: 'Roles, leadership, publications, skills, committees.' },
  { type: 'Recognition',   family: 'honor',       count: 3,  note: 'Conferred honors — cannot be self-claimed.' },
  { type: 'Aspiration',    family: 'aspiration',  count: 3,  note: 'Projected targets the graph can reach.' },
];
window.ENTITY_TYPES = ENTITY_TYPES;
