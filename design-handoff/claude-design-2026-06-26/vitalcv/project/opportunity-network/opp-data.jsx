// ════════════════════════════════════════════════════════════════════════
// WAVE 270 · OPPORTUNITY NETWORK — data model + readiness engine
// Opportunities are never stored as matches. Readiness is PROJECTED in real
// time by evaluating each role's requirements against Macie Miller's owned,
// source-bound evidence ledger (W.EVIDENCE) and trust profile (W.TRUST_*).
// Evidence creates opportunity — this file is where that projection happens.
// ════════════════════════════════════════════════════════════════════════

const O = {};

// ── Requirement library ───────────────────────────────────────────────────
// Some requirements map onto evidence she already tracks (ref → W.EVIDENCE).
// Others are evidence she does not yet hold — described here so a gap can be
// explained, not just flagged.
O.REQ_LIB = {
  // synthetic evidence (not yet in her ledger)
  'dea':            { label: 'DEA Registration',        kind: 'License',     desc: 'Controlled-substance authority (Schedule II–V).' },
  'education-psv':  { label: 'Education PSV',            kind: 'Education',   desc: 'Sealed final transcript — primary-source verified.' },
  'state-wa':       { label: 'WA State PA License',      kind: 'License',     desc: 'Active Washington licensure for multi-site practice.' },
  'leadership':     { label: 'Leadership Experience',   kind: 'Experience',  desc: 'Documented supervisory or service-line leadership.' },
  'gcp':            { label: 'GCP Training',             kind: 'Training',    desc: 'Good Clinical Practice certification (ICH-GCP).' },
  'publication':    { label: 'Peer-Reviewed Publication',kind: 'Recognition',desc: 'At least one indexed authorship.' },
  'rfa-privileges': { label: 'First-Assist Privileges',  kind: 'Privilege',   desc: 'Surgical first-assistant privileges on file.' },
};

// ── Clinician experience profile (for timeline / experience requirements) ──
O.PROFILE = {
  years: 1.2,
  leadership: false,
  research: false,
  publications: 0,
  teaching: false,
  states: ['CA'],
  startWindow: 'Available in 30 days',
  city: 'Irvine, CA',
};

// ── Opportunities ──────────────────────────────────────────────────────────
// Each requirement is a descriptor the engine resolves live:
//   { type:'evidence', ref }        → status from W.EVIDENCE / REQ_LIB
//   { type:'trust',    ref, min }   → score from W.TRUST_DIMENSIONS
//   { type:'experience', key, need }→ value from O.PROFILE
O.OPPORTUNITIES = [
  {
    id: 'cedar-ortho-pa',
    title: 'Orthopedic Surgery PA-C',
    org: 'Cedar Health System', orgKind: 'Current employer · internal',
    location: 'Irvine, CA', type: 'Full-time', comp: '$135–152K', posted: '4 days ago',
    blurb: 'Continue and formalize your role on the Cedar orthopedic service line. Operative and clinic coverage, ortho trauma call rotation.',
    network: 'Reused your passport · Apr 06',
    req: [
      { type: 'evidence', ref: 'identity' },
      { type: 'evidence', ref: 'licensure' },
      { type: 'evidence', ref: 'boardcert' },
      { type: 'evidence', ref: 'sanctions' },
      { type: 'evidence', ref: 'bls' },
      { type: 'evidence', ref: 'coi' },
      { type: 'evidence', ref: 'workhistory' },
      { type: 'trust', ref: 'identity', min: 80 },
      { type: 'trust', ref: 'authority', min: 75 },
      { type: 'trust', ref: 'standing', min: 80 },
      { type: 'experience', key: 'years', need: 1 },
    ],
  },
  {
    id: 'comphealth-locum',
    title: 'Locum Tenens · Orthopedic PA',
    org: 'CompHealth', orgKind: 'Staffing network',
    location: 'Southern California', type: 'Contract · 13 wk', comp: '$98/hr', posted: '1 week ago',
    blurb: 'Short-term operative coverage across partnered Southern California orthopedic groups. Credentialing pre-cleared via your verified evidence packet.',
    network: '6 systems accept VitalCV packets',
    req: [
      { type: 'evidence', ref: 'identity' },
      { type: 'evidence', ref: 'licensure' },
      { type: 'evidence', ref: 'boardcert' },
      { type: 'evidence', ref: 'sanctions' },
      { type: 'evidence', ref: 'bls' },
      { type: 'evidence', ref: 'acls' },
      { type: 'evidence', ref: 'coi' },
      { type: 'evidence', ref: 'npdb' },
      { type: 'trust', ref: 'authority', min: 75 },
      { type: 'trust', ref: 'standing', min: 85 },
      { type: 'experience', key: 'years', need: 1 },
    ],
  },
  {
    id: 'hoag-first-assist',
    title: 'Surgical First Assistant · Orthopedics',
    org: 'Hoag Orthopedic Institute', orgKind: 'Specialty hospital',
    location: 'Irvine, CA', type: 'Full-time', comp: '$142–168K', posted: '3 days ago',
    blurb: 'Dedicated first-assist role in a high-volume joint-replacement program. Controlled-substance privileges required for peri-operative management.',
    network: '32 first-assist roles need DEA',
    req: [
      { type: 'evidence', ref: 'identity' },
      { type: 'evidence', ref: 'licensure' },
      { type: 'evidence', ref: 'boardcert' },
      { type: 'evidence', ref: 'sanctions' },
      { type: 'evidence', ref: 'bls' },
      { type: 'evidence', ref: 'acls' },
      { type: 'evidence', ref: 'coi' },
      { type: 'evidence', ref: 'dea' },
      { type: 'trust', ref: 'authority', min: 80 },
      { type: 'trust', ref: 'standing', min: 85 },
      { type: 'trust', ref: 'practice', min: 60 },
      { type: 'experience', key: 'years', need: 1 },
    ],
  },
  {
    id: 'providence-multisite',
    title: 'Orthopedic PA · Multi-Site',
    org: 'Providence', orgKind: 'Integrated network',
    location: 'WA · CA', type: 'Full-time', comp: '$138–160K', posted: '2 weeks ago',
    blurb: 'Cross-state coverage requiring Medicare enrollment and Washington licensure. Strong fit once federal enrollment and a second-state license are on file.',
    network: 'Enrollment unlocks 11 payer-bound roles',
    req: [
      { type: 'evidence', ref: 'identity' },
      { type: 'evidence', ref: 'licensure' },
      { type: 'evidence', ref: 'state-wa' },
      { type: 'evidence', ref: 'boardcert' },
      { type: 'evidence', ref: 'sanctions' },
      { type: 'evidence', ref: 'medicare' },
      { type: 'evidence', ref: 'dea' },
      { type: 'trust', ref: 'authority', min: 80 },
      { type: 'trust', ref: 'enrollment', min: 70 },
      { type: 'experience', key: 'years', need: 1 },
    ],
  },
  {
    id: 'cedar-lead-pa',
    title: 'Lead PA · Orthopedic Service Line',
    org: 'Cedar Health System', orgKind: 'Current employer · promotion',
    location: 'Irvine, CA', type: 'Full-time', comp: '$165–190K', posted: 'Talent pool',
    blurb: 'Supervisory role over the APP team for orthopedics. Requires demonstrated leadership and a deeper practice record before you clear the bar.',
    network: 'On your growth path · 18 mo horizon',
    req: [
      { type: 'evidence', ref: 'identity' },
      { type: 'evidence', ref: 'licensure' },
      { type: 'evidence', ref: 'boardcert' },
      { type: 'evidence', ref: 'sanctions' },
      { type: 'evidence', ref: 'leadership' },
      { type: 'trust', ref: 'authority', min: 85 },
      { type: 'trust', ref: 'practice', min: 80 },
      { type: 'experience', key: 'years', need: 3 },
      { type: 'experience', key: 'leadership', need: true },
    ],
  },
  {
    id: 'uci-research',
    title: 'Clinical Research Sub-Investigator',
    org: 'UCI Health', orgKind: 'Academic medical center',
    location: 'Irvine, CA', type: 'Part-time', comp: '$58/hr', posted: '5 days ago',
    blurb: 'Sub-investigator on orthopedic outcomes trials. Requires Good Clinical Practice training and a record of scholarly authorship.',
    network: 'Research credential opens 7 academic roles',
    req: [
      { type: 'evidence', ref: 'identity' },
      { type: 'evidence', ref: 'licensure' },
      { type: 'evidence', ref: 'boardcert' },
      { type: 'evidence', ref: 'gcp' },
      { type: 'evidence', ref: 'publication' },
      { type: 'trust', ref: 'identity', min: 80 },
      { type: 'trust', ref: 'authority', min: 75 },
      { type: 'experience', key: 'research', need: true },
    ],
  },
];

// ── Readiness engine ───────────────────────────────────────────────────────
// Resolves a requirement against the owned ledger / trust profile.
O.resolveReq = function (r) {
  if (r.type === 'evidence') {
    const ev = W.EVIDENCE.find(e => e.id === r.ref);
    if (ev) {
      const lib = O.REQ_LIB[r.ref] || {};
      return {
        type: 'evidence', ref: r.ref,
        label: ev.label, kind: ev.category, tier: ev.tier,
        status: ev.status,                       // verified | pending | expiring | missing
        met: ev.status === 'verified' || ev.status === 'expiring' || ev.status === 'pending',
        atRisk: ev.status === 'expiring',
        soft: ev.status === 'pending',
        detail: ev.summary, daysLeft: ev.daysLeft,
        source: ev.source,
      };
    }
    // synthetic — not yet in her ledger → it's a gap
    const lib = O.REQ_LIB[r.ref] || { label: r.ref, kind: 'Evidence', desc: '' };
    return { type: 'evidence', ref: r.ref, label: lib.label, kind: lib.kind, tier: null,
      status: 'missing', met: false, atRisk: false, soft: false, detail: lib.desc, synthetic: true };
  }
  if (r.type === 'trust') {
    const d = W.TRUST_DIMENSIONS.find(x => x.id === r.ref) || {};
    return {
      type: 'trust', ref: r.ref, label: d.label, min: r.min,
      score: d.score, median: d.median, state: d.state,
      met: d.score >= r.min, atRisk: d.score >= r.min && d.score < r.min + 8,
      detail: d.note,
    };
  }
  // experience
  const v = O.PROFILE[r.key];
  let met, label, have, need;
  if (r.key === 'years') { met = v >= r.need; label = `${r.need}+ years in practice`; have = `${O.PROFILE.years} yr`; need = `${r.need} yr`; }
  else if (r.key === 'leadership') { met = v === true; label = 'Leadership experience'; have = v ? 'On record' : 'Not yet'; need = 'Required'; }
  else if (r.key === 'research') { met = v === true; label = 'Research experience'; have = v ? 'On record' : 'Not yet'; need = 'Required'; }
  else { met = !!v; label = r.key; have = String(v); need = 'Required'; }
  return { type: 'experience', ref: r.key, label, met, atRisk: false, have, need, detail: label };
};

// Full evaluation for one opportunity.
O.evaluate = function (opp) {
  const reqs = opp.req.map(O.resolveReq);
  const total = reqs.length;
  const met = reqs.filter(r => r.met).length;
  const gaps = reqs.filter(r => !r.met);
  const atRisk = reqs.filter(r => r.met && r.atRisk);
  const pct = Math.round((met / total) * 100);

  // hard gaps = unmet requirements that aren't merely "in flight"
  const hardGaps = gaps.length;

  let level;
  if (hardGaps === 0 && atRisk.length === 0) level = 'ready';
  else if (hardGaps === 0) level = 'conditional';
  else if (hardGaps === 1) level = 'nearly';
  else if (pct >= 62) level = 'building';
  else level = 'aspirational';

  return { reqs, total, met, gaps, atRisk, pct, hardGaps, level,
    evidence: reqs.filter(r => r.type === 'evidence'),
    trust: reqs.filter(r => r.type === 'trust'),
    experience: reqs.filter(r => r.type === 'experience') };
};

// Readiness level metadata (palette stays within the wallet's tokens).
O.LEVEL = {
  ready:        { label: 'Ready now',     order: 0, chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500', ring: '#059669', text: 'text-emerald-700', soft: 'bg-emerald-50', blurb: 'All required evidence verified and current.' },
  conditional:  { label: 'Ready · act soon', order: 1, chip: 'bg-amber-50 text-amber-800 ring-amber-600/20', dot: 'bg-amber-500', ring: '#d97706', text: 'text-amber-800', soft: 'bg-amber-50', blurb: 'Ready today — one or more proofs expiring.' },
  nearly:       { label: 'Nearly ready',  order: 2, chip: 'bg-sky-50 text-sky-700 ring-sky-600/20', dot: 'bg-sky-500', ring: '#0284c7', text: 'text-sky-700', soft: 'bg-sky-50', blurb: 'A single gap stands between you and ready.' },
  building:     { label: 'Building',      order: 3, chip: 'bg-orange-50 text-orange-700 ring-orange-600/20', dot: 'bg-orange-500', ring: '#ea580c', text: 'text-orange-700', soft: 'bg-orange-50', blurb: 'A few requirements still to satisfy.' },
  aspirational: { label: 'Aspirational',  order: 4, chip: 'bg-slate-100 text-slate-600 ring-slate-300', dot: 'bg-slate-400', ring: '#64748b', text: 'text-slate-600', soft: 'bg-slate-50', blurb: 'On your growth path — experience to build.' },
};

// Pre-evaluate + sort by readiness for the home view.
O.ranked = function () {
  return O.OPPORTUNITIES
    .map(o => ({ ...o, ev: O.evaluate(o) }))
    .sort((a, b) => (O.LEVEL[a.ev.level].order - O.LEVEL[b.ev.level].order) || (b.ev.pct - a.ev.pct));
};

O.byId = function (id) {
  const o = O.OPPORTUNITIES.find(x => x.id === id);
  return o ? { ...o, ev: O.evaluate(o) } : null;
};

// ── Match explainer (D3) — three alignments ───────────────────────────────
O.alignment = function (opp) {
  const ev = opp.ev || O.evaluate(opp);
  const evMet = ev.evidence.filter(r => r.met).length;
  const trMet = ev.trust.filter(r => r.met).length;
  // timeline: experience + license validity + location + start window
  const exp = ev.experience;
  const expMet = exp.filter(r => r.met).length;
  return {
    evidence: {
      met: evMet, total: ev.evidence.length,
      pct: Math.round(evMet / Math.max(1, ev.evidence.length) * 100),
      summary: `${evMet} of ${ev.evidence.length} required proofs already verified in your owned ledger.`,
    },
    trust: {
      met: trMet, total: ev.trust.length,
      pct: ev.trust.length ? Math.round(trMet / ev.trust.length * 100) : 100,
      summary: ev.trust.length
        ? `${trMet} of ${ev.trust.length} trust dimensions clear this role's bar — measured against the field median, never a named peer.`
        : 'No trust threshold set for this role.',
    },
    timeline: {
      met: expMet, total: Math.max(1, exp.length),
      pct: exp.length ? Math.round(expMet / exp.length * 100) : 100,
      summary: `${O.PROFILE.years} years in practice · ${O.PROFILE.city} · ${O.PROFILE.startWindow}.`,
    },
  };
};

// ── D4 · Career recommendations ────────────────────────────────────────────
// Each step is an action that produces evidence → which unlocks opportunities.
O.RECOMMENDATIONS = [
  {
    id: 'renew-license', icon: 'ShieldCheck', kind: 'Renewal', priority: 'now',
    title: 'Renew your CA PA license',
    why: 'Expires in 30 days. Lets two ready roles slip to “act soon” and decays your Authority dimension.',
    effort: '20 min', cost: '$330', horizon: 'Immediate',
    produces: 'Refreshes CA PA License → T3, Authority holds at 82',
    affects: { trust: ['authority'], evidence: ['licensure'] },
    unlocks: 0, protects: 2,
    cta: 'Start renewal',
  },
  {
    id: 'obtain-dea', icon: 'Stamp', kind: 'Credential', priority: 'high',
    title: 'Obtain DEA registration',
    why: 'The single most valuable gap. Adds controlled-substance authority — the only thing between you and the Hoag first-assist role.',
    effort: '1–2 weeks', cost: '$888', horizon: '2 weeks',
    produces: 'New evidence: DEA Registration → unlocks Schedule II–V authority',
    affects: { trust: ['authority'], evidence: ['dea'] },
    unlocks: 32, protects: 0,
    cta: 'Begin DEA application',
  },
  {
    id: 'education-psv', icon: 'Book', kind: 'Verification', priority: 'med',
    title: 'Complete your Education PSV',
    why: 'Collect your sealed final transcript to upgrade your degree from T3 to primary-sealed T4 and lift the Education dimension out of “building”.',
    effort: '1 form', cost: 'Free', horizon: '3–4 weeks',
    produces: 'Upgrades Degree T3 → T4, Education dimension 58 → ~74',
    affects: { trust: ['education'], evidence: ['education-psv', 'degree'] },
    unlocks: 4, protects: 0,
    cta: 'Request transcript',
  },
  {
    id: 'gcp-training', icon: 'ClipboardCheck', kind: 'Training', priority: 'med',
    title: 'Complete GCP training',
    why: 'Good Clinical Practice certification is the entry credential for research roles. Pairs with a first authorship to open academic positions.',
    effort: '4 hrs · online', cost: '$125', horizon: '1 week',
    produces: 'New evidence: GCP Training → research-eligible',
    affects: { trust: [], evidence: ['gcp'] },
    unlocks: 7, protects: 0,
    cta: 'Enroll in course',
  },
  {
    id: 'add-publication', icon: 'FileText', kind: 'Recognition', priority: 'growth',
    title: 'Add a peer-reviewed publication',
    why: 'A single indexed authorship strengthens your Recognition footprint and is a hard requirement for sub-investigator roles.',
    effort: 'Ongoing', cost: '—', horizon: '6–12 months',
    produces: 'New recognition evidence → research + faculty pathways',
    affects: { trust: [], evidence: ['publication'] },
    unlocks: 7, protects: 0,
    cta: 'Log a publication',
  },
  {
    id: 'leadership', icon: 'Users', kind: 'Experience', priority: 'growth',
    title: 'Gain leadership experience',
    why: 'Take a charge or preceptor role to build the Practice dimension and document supervisory experience for the Lead PA track.',
    effort: 'Ongoing', cost: '—', horizon: '12–18 months',
    produces: 'Builds Practice 64 → 80+, documents leadership evidence',
    affects: { trust: ['practice'], evidence: ['leadership'] },
    unlocks: 1, protects: 0,
    cta: 'Explore the path',
  },
];

// ── D5 · Network growth feed ───────────────────────────────────────────────
// kind: unlock (opportunity) | evidence (recognized) | trust (milestone) | network
O.GROWTH = [
  { id: 'g1', date: 'Apr 18, 2026', kind: 'evidence', icon: 'ShieldCheck',
    head: 'Identity re-confirmed at the federal registry',
    body: 'NPPES delta scan returned no change — your Identity evidence stands verified, holding two ready roles in place.',
    cause: 'NPPES · T4', effect: 'Identity dimension 96' },
  { id: 'g2', date: 'Apr 14, 2026', kind: 'unlock', icon: 'Unlock',
    head: 'New opportunity matched: Locum Tenens · Orthopedic PA',
    body: 'Your verified evidence packet pre-cleared CompHealth credentialing — the role moved from “building” to ready without you applying.',
    cause: 'Standing 90 + verified packet', effect: '+1 ready opportunity' },
  { id: 'g3', date: 'Apr 12, 2026', kind: 'trust', icon: 'Gauge',
    head: 'Trust milestone: Standing reached strong',
    body: 'OIG/LEIE April dataset cleared with no exclusions. Your Standing dimension crossed the bar for locum and first-assist roles.',
    cause: 'OIG/LEIE · T4', effect: 'Standing 76 → 90' },
  { id: 'g4', date: 'Apr 06, 2026', kind: 'network', icon: 'Network',
    head: 'Your passport was re-used at OR Medical Group',
    body: 'A second health system observed your verified evidence — a cross-observation that strengthens Practice and surfaces you to their req pool.',
    cause: 'Network cross-observation', effect: '+1 system observing you' },
  { id: 'g5', date: 'Feb 28, 2026', kind: 'evidence', icon: 'Award',
    head: 'Board certification re-sealed',
    body: 'NCCPA primary-sealed your PA-C certification for the new 10-year cycle, keeping every clinical role you match eligible.',
    cause: 'NCCPA · T4', effect: 'Authority held at 82' },
  { id: 'g6', date: 'Jan 28, 2025', kind: 'unlock', icon: 'Unlock',
    head: 'First opportunity matched: Orthopedic Surgery PA-C',
    body: 'Once your license, certification and standing were all verified, your first ready role appeared at Cedar Health.',
    cause: 'License + Cert + Standing verified', effect: 'First ready opportunity' },
  { id: 'g7', date: 'Feb 11, 2025', kind: 'trust', icon: 'Sparkles',
    head: 'Career wallet opened — identity verified',
    body: 'Your owned evidence ledger was established at enumeration. The opportunity network began projecting matches from day one.',
    cause: 'NPPES enumeration', effect: 'Network activated' },
];

// ── Headline counts for D1 / D5 ────────────────────────────────────────────
O.summary = function () {
  const r = O.ranked();
  const ready = r.filter(o => o.ev.level === 'ready' || o.ev.level === 'conditional').length;
  const nearly = r.filter(o => o.ev.level === 'nearly').length;
  const building = r.filter(o => o.ev.level === 'building' || o.ev.level === 'aspirational').length;
  return {
    ready, nearly, building, total: r.length,
    unlockedThisMonth: 1,
    evidenceRecognized: W.count('verified'),
    trustMilestones: W.TRUST_DIMENSIONS.filter(d => d.state === 'strong').length,
  };
};

window.O = O;
