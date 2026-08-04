// WAVE 1200 — THE CAREER UNIVERSE (dense graph generator)
// Expands the curated subject graph (NODES/LINKS) into a population-scale
// knowledge graph of a few hundred nodes — clinicians, institutions, and every
// piece of evidence that ties them together — so the graph reads like a real
// professional universe (Obsidian-style density), with the curated subject
// subgraph preserved by id so the reasoning surfaces can still highlight it.

(function () {
  // ---- deterministic PRNG (mulberry32) so the layout & topology are stable ----
  let _s = 0x9e3779b9;
  function rnd() { _s |= 0; _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  const pick = a => a[Math.floor(rnd() * a.length)];
  const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

  // ---- color + size by family (dark-canvas palette, tuned to the reference) ----
  const FAM_COLOR = {
    self:        '#fde047',
    person:      '#fbe33a',
    institution: '#34d8e8',
    credential:  '#5eead4',
    work:        '#7cc6e8',
    honor:       '#f472b6',
    aspiration:  '#c084fc',
  };
  window.FAM_COLOR = FAM_COLOR;

  const U = [];   // nodes
  const E = [];   // edges  {s, t}
  const byId = {};
  function add(n) { if (byId[n.id]) return byId[n.id]; byId[n.id] = n; U.push(n); return n; }
  function link(s, t, rel) { if (s && t && s !== t) E.push({ s, t, rel: rel || 'rel' }); }

  // ---- 1. seed the curated subject graph (keep ids; carry curated flag) ----
  NODES.forEach(n => add({
    id: n.id, label: n.label, sub: n.sub, family: n.family, type: n.type,
    icon: n.icon, state: n.state, curated: true, subject: n.id === 'self',
    base: n.r || 14,
  }));
  LINKS.forEach(l => link(l.source, l.target, l.rel));

  // ---- 2. expand the institution layer (curated orgs + roster employers) ----
  const EXTRA_ORGS = [
    { id: 'o-bay',     label: 'Bay Cardiovascular Group', sub: 'Group practice · SF' },
    { id: 'o-sierra',  label: 'Sierra Acute Care',        sub: 'Acute network · NV' },
    { id: 'o-rush',    label: 'Rush University',          sub: 'AMC · Chicago' },
    { id: 'o-methodist', label: 'Houston Methodist',      sub: 'AMC · TX' },
    { id: 'o-utsw',    label: 'UT Southwestern',          sub: 'AMC · TX' },
    { id: 'o-scripps', label: 'Scripps Health',           sub: 'Health system · SD' },
    { id: 'o-cedars',  label: 'Cedars-Sinai',             sub: 'AMC · LA' },
  ];
  EXTRA_ORGS.forEach(o => add({ id: o.id, label: o.label, sub: o.sub, family: 'institution', type: 'Institution', icon: 'Building', state: 'verified', base: 18 }));
  const ALL_ORG_IDS = U.filter(n => n.family === 'institution').map(n => n.id);

  // ---- 3. roster clinicians as bright person hubs (curated self/network already in) ----
  CLINICIANS.filter(c => c.id !== 'self' && !byId[c.id]).forEach(c => {
    add({ id: c.id, label: c.name, sub: `${c.cred} · ${c.role}`, family: 'person', type: 'Clinician', icon: 'User', state: 'verified', base: 15, roster: true });
  });

  // ---- 4. generate a population of peer clinicians to fill the universe ----
  const FIRST = ['Aisha','Noah','Mateo','Lena','Priya','Tomas','Hana','Caleb','Iris','Omar','Maya','Felix','Nora','Diego','Zoe','Ravi','Elena','Jonah','Sana','Theo','Lucia','Kai','Mira','Ezra','Dahlia','Bo','Yuki','Ana','Soren','Nadia','Reza','Cleo','Hugo','Vera','Amir','Tess','Leo','Inez','Cyrus','Della'];
  const LAST = ['Park','Nguyen','Okonkwo','Reyes','Bauer','Haddad','Sato','Mensah','Romano','Kohl','Abara','Vance','Petrov','Singh','Ortiz','Larsen','Chowdhury','Mwangi','Greco','Delgado','Frost','Aziz','Bianchi','Novak','Serrano','Kim','Hoff','Mallick','Quill','Ramos'];
  const CRED = ['PA-C','MD','DO','NP','PharmD'];
  const SPEC = ['Cardiology','Internal Med.','Emergency Med.','Hospitalist','Primary Care','Critical Care','Electrophysiology'];
  const PEERS = [];
  for (let i = 0; i < 46; i++) {
    const id = `pg-${i}`;
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const cred = pick(CRED);
    const base = 10 + (rnd() < 0.18 ? ri(3, 7) : 0); // a few become bigger hubs
    add({ id, label: name, sub: `${cred} · ${pick(SPEC)}`, family: 'person', type: 'Clinician', icon: 'User', state: 'verified', base, peer: true });
    PEERS.push(id);
  }

  // ---- 5. attach every (non-self) clinician to 1–2 institutions + spawn evidence spokes ----
  const allPeople = U.filter(n => n.family === 'person' && n.id !== 'self');
  const CERTS = ['Board Certification','ACLS','BLS','PALS','DEA Registration','State License','Subspecialty Cert','Fellowship Cert'];
  const WORKS = ['Clinical Role','Quality Project','Protocol Lead','Committee Seat','Preceptorship','Case Series','Registry Study','Skill: Procedures','Skill: Teaching','Skill: Research'];
  const HONORS = ['Service Award','Best Poster','Teaching Honor','Chief Resident','Distinction'];
  let k = 0;
  allPeople.forEach(p => {
    // institution ties (these create the dense hubs)
    const homeN = p.roster ? 1 : ri(1, 2);
    const homes = [];
    for (let h = 0; h < homeN; h++) { const o = pick(ALL_ORG_IDS); if (!homes.includes(o)) { homes.push(o); link(p.id, o, 'at'); } }
    // evidence spokes — credentials (teal), work (blue), occasional honor (pink)
    const nCred = ri(2, 4), nWork = ri(2, 5), nHonor = rnd() < 0.4 ? 1 : 0;
    for (let c = 0; c < nCred; c++) { const id = `ev-${k++}`; add({ id, label: pick(CERTS), sub: p.label, family: 'credential', type: 'Credential', icon: 'Badge', state: rnd() < 0.85 ? 'verified' : 'pending', base: 7 }); link(p.id, id, 'holds'); if (rnd() < 0.5 && homes[0]) link(id, homes[0], 'at'); }
    for (let w = 0; w < nWork; w++) { const id = `ev-${k++}`; add({ id, label: pick(WORKS), sub: p.label, family: 'work', type: 'Evidence', icon: 'Activity', state: rnd() < 0.8 ? 'verified' : 'pending', base: 7 }); link(p.id, id, 'applies'); if (rnd() < 0.55 && homes[0]) link(id, homes[homes.length > 1 && rnd() < 0.4 ? 1 : 0], 'at'); }
    for (let h = 0; h < nHonor; h++) { const id = `ev-${k++}`; add({ id, label: pick(HONORS), sub: p.label, family: 'honor', type: 'Recognition', icon: 'Award', state: 'conferred', base: 8 }); link(p.id, id, 'recognizes'); if (homes[0]) link(id, homes[0], 'conferred'); }
  });

  // ---- 6. weave the core: shared-institution colleagues, co-authorship, mentorship ----
  const byOrg = {};
  ALL_ORG_IDS.forEach(o => byOrg[o] = []);
  E.forEach(e => { if (ALL_ORG_IDS.includes(e.t) && byId[e.s]?.family === 'person') byOrg[e.t].push(e.s); });
  Object.values(byOrg).forEach(members => {
    for (let i = 0; i < members.length; i++) {
      if (rnd() < 0.22) { const a = members[i], b = pick(members); if (a !== b) link(a, b, 'collaborates'); }
    }
  });
  // a handful of mentorship hubs (senior people gain spokes to juniors → radial bursts)
  const seniors = allPeople.filter(p => p.base >= 14).slice(0, 6);
  seniors.forEach(s => { const n = ri(4, 9); for (let i = 0; i < n; i++) { const j = pick(PEERS); if (j !== s.id) link(s.id, j, 'mentors'); } s.base = Math.max(s.base, 16); });

  // ---- 7. opportunity layer (pink/purple targets) tied to qualifying clinicians ----
  const OPPS = [
    { id: 'op-md-1', label: 'Medical Director · Cardiology', org: 'o-ucla' },
    { id: 'op-md-2', label: 'Medical Director · CV Service', org: 'o-cedar' },
    { id: 'op-lead-1', label: 'Lead APP · Cardiology', org: 'o-cedar' },
    { id: 'op-lead-2', label: 'Lead APP · Acute Care', org: 'o-sierra' },
    { id: 'op-chief-1', label: 'Service-line Chief · HF', org: 'o-stanford' },
    { id: 'op-fac-1', label: 'Clinical Faculty · PA Studies', org: 'o-western' },
    { id: 'op-fac-2', label: 'Clinical Faculty · Med', org: 'o-stanford' },
    { id: 'op-sr-1', label: 'Senior Cardiology PA', org: 'o-bay' },
    { id: 'op-sr-2', label: 'Senior Cardiology PA', org: 'o-cedars' },
    { id: 'op-dir-1', label: 'APP Director', org: 'o-methodist' },
  ];
  OPPS.forEach(o => {
    add({ id: o.id, label: o.label, sub: byId[o.org]?.label || 'Open role', family: 'aspiration', type: 'Opportunity', icon: 'Target', state: 'unknown', base: 11 });
    link(o.id, o.org, 'at');
    // tie to 2–5 eligible-ish clinicians
    const n = ri(2, 5); for (let i = 0; i < n; i++) { const p = pick(allPeople).id; link(o.id, p, 'needs'); }
  });
  // connect the subject's curated aspirations into this opportunity layer too
  link('g-specialist', 'op-sr-1', 'precedes'); link('g-lead', 'op-lead-1', 'precedes'); link('g-faculty', 'op-fac-1', 'precedes');

  // ---- finalize: degree, adjacency, dedupe edges ----
  const seen = new Set();
  const edges = [];
  E.forEach(e => { const key = e.s < e.t ? `${e.s}|${e.t}` : `${e.t}|${e.s}`; if (seen.has(key) || !byId[e.s] || !byId[e.t]) return; seen.add(key); edges.push(e); });
  const deg = {}; U.forEach(n => deg[n.id] = 0);
  edges.forEach(e => { deg[e.s]++; deg[e.t]++; });
  const adj = {}; U.forEach(n => adj[n.id] = []);
  edges.forEach(e => { adj[e.s].push(e.t); adj[e.t].push(e.s); });
  U.forEach(n => {
    n.deg = deg[n.id];
    // node radius: base size, gently boosted by degree (hubs grow), like Obsidian
    n.r = Math.min(n.subject ? 30 : 26, n.base + Math.sqrt(n.deg) * 1.7);
    n.color = FAM_COLOR[n.family] || '#7cc6e8';
  });

  window.UNIVERSE = { nodes: U, edges, byId, adj };
})();
