// WAVE 1400 — HEALTHCARE OPERATIONS ENGINE · operational data model
// Wave 1300 made VitalCV configurable infrastructure. Wave 1400 is the
// operational layer that runs on top of it: a live roster of providers moving
// through each organization's pipeline, the work that surrounds them, and an
// append-only ledger of every operational action. Surfaces never invent data —
// they read the roster + the event log this file seeds and the store mutates.

/* ---------- Roles (the people doing the work) ---------- */
const ROLES = {
  recruiter:    { id: 'recruiter',     label: 'Recruiter',               short: 'Recruiting',     icon: 'Search',        accent: '#6aa8f5' },
  credentialing:{ id: 'credentialing', label: 'Credentialing Specialist', short: 'Credentialing',  icon: 'ShieldCheck',   accent: '#34d8e8' },
  chair:        { id: 'chair',         label: 'Department Chair',        short: 'Department',     icon: 'Building',      accent: '#c08bf0' },
  mso:          { id: 'mso',           label: 'Medical Staff Office',    short: 'MSO',            icon: 'Stamp',         accent: '#f0a93a' },
  cmo:          { id: 'cmo',           label: 'Chief Medical Officer',   short: 'Executive',      icon: 'Award',         accent: '#5ed6a4' },
  program:      { id: 'program',       label: 'Program Director',        short: 'Program',        icon: 'GraduationCap', accent: '#6aa8f5' },
  coordinator:  { id: 'coordinator',   label: 'Staffing Coordinator',    short: 'Staffing',       icon: 'Users',         accent: '#f0a93a' },
  payer_ops:    { id: 'payer_ops',     label: 'Network Operations',      short: 'Network Ops',    icon: 'Network',       accent: '#ec7a9b' },
};
window.ROLES = ROLES;

/* ---------- Team members (assignees) per role ---------- */
const TEAM = [
  { id: 'u1', name: 'Dana Whitfield',  role: 'credentialing', initials: 'DW' },
  { id: 'u2', name: 'Marcus Reyes',    role: 'recruiter',     initials: 'MR' },
  { id: 'u3', name: 'Priya Anand',     role: 'mso',           initials: 'PA' },
  { id: 'u4', name: 'Sloane Carter',   role: 'credentialing', initials: 'SC' },
  { id: 'u5', name: 'Theo Lindqvist',  role: 'coordinator',   initials: 'TL' },
  { id: 'u6', name: 'Renée Okafor',    role: 'cmo',           initials: 'RO' },
  { id: 'u7', name: 'Jonah Park',      role: 'recruiter',     initials: 'JP' },
  { id: 'u8', name: 'Camila Duarte',   role: 'payer_ops',     initials: 'CD' },
];
window.TEAM = TEAM;

/* ---------- Specialties ---------- */
const SPECIALTIES = ['Cardiology','Emergency Medicine','Internal Medicine','Pediatrics','Anesthesiology','Radiology','Family Medicine','Hospitalist','OB-GYN','Psychiatry','Orthopedics','Neurology','Oncology','Dermatology','Pulmonology','Nephrology'];

/* ---------- Name pools (deterministic roster) ---------- */
const FIRST = ['Aria','Dev','Luis','Priya','Tomás','Hana','Omar','Greta','Ivy','Noah','Zoe','Macie','Elena','Marcus','Nadia','Caleb','Soraya','Idris','Wren','Yusuf','Lena','Ravi','Mira','Felix','Anaya','Diego','Phoebe','Kian','Tessa','Amari','Bianca','Hugo','Saanvi','Otis','Leila','Cyrus','Vera','Mateo','Indira','Rohan','Esme','Tariq','Juno','Selima','Bodhi','Carys','Dmitri','Aisha','Niko','Petra'];
const LAST  = ['Miller','Patel','Chen','Romero','Nair','Vega','Sato','Haddad','Lindqvist','Brooks','Frank','Park','Okafor','Duarte','Reyes','Anand','Carter','Whitfield','Sorensen','Adebayo','Kowalski','Nakamura','Ferreira','Bauer','Costa','Ibrahim','Larsen','Petrov','Mensah','Solberg','Rahman','Castillo','Novak','Bell','Khan','Andersen','Mwangi','Holt','Russo','Greene'];

const BLOCKERS = [
  { id: 'b_npi',     label: 'NPI mismatch with source registry',   sev: 'high' },
  { id: 'b_lic',     label: 'State license verification pending',   sev: 'high' },
  { id: 'b_dea',     label: 'DEA registration not yet returned',    sev: 'med'  },
  { id: 'b_ref',     label: 'Peer reference unresponsive',          sev: 'med'  },
  { id: 'b_mal',     label: 'Malpractice history under review',     sev: 'high' },
  { id: 'b_doc',     label: 'Missing primary source document',      sev: 'med'  },
  { id: 'b_gap',     label: 'Unexplained gap in work history',      sev: 'low'  },
  { id: 'b_pay',     label: 'Payer enrollment ID not issued',       sev: 'med'  },
];
window.SPECIALTIES = SPECIALTIES; window.BLOCKERS = BLOCKERS;

/* ---------- WORKSPACES (same orgs as Wave 1300 — operations runs on them) ---------- */
const WORKSPACES = [
  {
    id: 'amc', name: 'Northwell Academic Medical Center', type: 'Academic Medical Center',
    accent: '#34d8e8', icon: 'GraduationCap', short: 'AMC',
    terms: { provider: 'Provider', providerPl: 'Providers', group: 'Department', groupPl: 'Departments' },
    stats: { providers: 1840, groups: 42, active: 1612 },
    groups: ['Cardiology','Emergency','Internal Medicine','Surgery','Pediatrics','Radiology','Anesthesiology','Neurology'],
    stages: [
      { id: 's1', label: 'Recruit',              owner: 'recruiter',     sla: 14 },
      { id: 's2', label: 'Interview',            owner: 'chair',         sla: 21 },
      { id: 's3', label: 'Evidence Review',      owner: 'credentialing', sla: 10 },
      { id: 's4', label: 'Credential Readiness', owner: 'credentialing', sla: 30 },
      { id: 's5', label: 'Privileging',          owner: 'mso',           sla: 14 },
      { id: 's6', label: 'Offer',                owner: 'chair',         sla: 7  },
      { id: 's7', label: 'Onboarding',           owner: 'mso',           sla: 21 },
      { id: 's8', label: 'Active',               owner: 'cmo',           sla: 0  },
    ],
    roleIds: ['recruiter', 'credentialing', 'chair', 'mso', 'cmo'],
  },
  {
    id: 'community', name: 'Cedar Valley Community Hospital', type: 'Community Hospital',
    accent: '#5ed6a4', icon: 'Heart', short: 'CVH',
    terms: { provider: 'Clinician', providerPl: 'Clinicians', group: 'Unit', groupPl: 'Units' },
    stats: { providers: 410, groups: 16, active: 372 },
    groups: ['Med-Surg','Emergency','ICU','Maternity','Outpatient','Cardiology'],
    stages: [
      { id: 's1', label: 'Refer',                owner: 'recruiter',     sla: 10 },
      { id: 's2', label: 'Evidence Review',      owner: 'credentialing', sla: 14 },
      { id: 's3', label: 'Credential Readiness', owner: 'credentialing', sla: 21 },
      { id: 's4', label: 'Privileging',          owner: 'mso',           sla: 14 },
      { id: 's5', label: 'Onboarding',           owner: 'mso',           sla: 14 },
      { id: 's6', label: 'Active',               owner: 'cmo',           sla: 0  },
    ],
    roleIds: ['credentialing', 'mso', 'chair', 'cmo'],
  },
  {
    id: 'group', name: 'Summit Cardiology Medical Group', type: 'Medical Group',
    accent: '#f0a93a', icon: 'Briefcase', short: 'SCG',
    terms: { provider: 'Provider', providerPl: 'Providers', group: 'Practice', groupPl: 'Practices' },
    stats: { providers: 96, groups: 7, active: 88 },
    groups: ['North Clinic','Interventional','Electrophysiology','Imaging','South Clinic'],
    stages: [
      { id: 's1', label: 'Recruit',            owner: 'recruiter',     sla: 12 },
      { id: 's2', label: 'Offer',              owner: 'recruiter',     sla: 7  },
      { id: 's3', label: 'Evidence Review',    owner: 'credentialing', sla: 10 },
      { id: 's4', label: 'Payer Enrollment',   owner: 'payer_ops',     sla: 45 },
      { id: 's5', label: 'Onboarding',         owner: 'coordinator',   sla: 14 },
      { id: 's6', label: 'Active',             owner: 'chair',         sla: 0  },
    ],
    roleIds: ['recruiter', 'credentialing', 'payer_ops', 'coordinator'],
  },
  {
    id: 'staffing', name: 'Meridian Locums & Staffing', type: 'Staffing Agency',
    accent: '#c08bf0', icon: 'Users', short: 'MLS',
    terms: { provider: 'Candidate', providerPl: 'Candidates', group: 'Client', groupPl: 'Clients' },
    stats: { providers: 2310, groups: 184, active: 640 },
    groups: ['Mercy West','St. Anne','Valley Health','Pinewood','Lakeside','Harbor General'],
    stages: [
      { id: 's1', label: 'Source',             owner: 'recruiter',     sla: 5  },
      { id: 's2', label: 'Screen',             owner: 'recruiter',     sla: 7  },
      { id: 's3', label: 'Evidence Review',    owner: 'credentialing', sla: 7  },
      { id: 's4', label: 'Submit to Client',   owner: 'coordinator',   sla: 3  },
      { id: 's5', label: 'Offer',              owner: 'coordinator',   sla: 5  },
      { id: 's6', label: 'Credential Readiness',owner: 'credentialing',sla: 14 },
      { id: 's7', label: 'On Assignment',      owner: 'coordinator',   sla: 0  },
    ],
    roleIds: ['recruiter', 'coordinator', 'credentialing'],
  },
  {
    id: 'residency', name: 'University Hospital Residency', type: 'Residency Program',
    accent: '#6aa8f5', icon: 'GraduationCap', short: 'UHR',
    terms: { provider: 'Resident', providerPl: 'Residents', group: 'Program', groupPl: 'Programs' },
    stats: { providers: 312, groups: 24, active: 288 },
    groups: ['Internal Medicine','Surgery','Pediatrics','Emergency','Psychiatry','Family Medicine'],
    stages: [
      { id: 's1', label: 'Match',              owner: 'program',       sla: 0  },
      { id: 's2', label: 'Evidence Review',    owner: 'credentialing', sla: 21 },
      { id: 's3', label: 'Onboarding',         owner: 'program',       sla: 30 },
      { id: 's4', label: 'Active',             owner: 'program',       sla: 0  },
      { id: 's5', label: 'Milestone Review',   owner: 'program',       sla: 0  },
      { id: 's6', label: 'Graduation',         owner: 'program',       sla: 0  },
    ],
    roleIds: ['program', 'credentialing', 'cmo'],
  },
  {
    id: 'payer', name: 'BlueRiver Health Plan', type: 'Payer Network',
    accent: '#ec7a9b', icon: 'Network', short: 'BRH',
    terms: { provider: 'Network Provider', providerPl: 'Network Providers', group: 'Network', groupPl: 'Networks' },
    stats: { providers: 14200, groups: 38, active: 12940 },
    groups: ['Commercial PPO','Medicare Advantage','Medicaid','HMO Gold','EPO','Tiered Network'],
    stages: [
      { id: 's1', label: 'Application',        owner: 'payer_ops',     sla: 5  },
      { id: 's2', label: 'Evidence Review',    owner: 'credentialing', sla: 30 },
      { id: 's3', label: 'Credential Readiness',owner: 'credentialing',sla: 45 },
      { id: 's4', label: 'Committee Review',   owner: 'cmo',           sla: 30 },
      { id: 's5', label: 'Directory Listing',  owner: 'payer_ops',     sla: 7  },
      { id: 's6', label: 'In-Network',         owner: 'payer_ops',     sla: 0  },
    ],
    roleIds: ['payer_ops', 'credentialing', 'cmo'],
  },
];
window.WORKSPACES = WORKSPACES;

/* ---------- Seeded RNG (mulberry32) ---------- */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// How many live, in-motion records to generate for a workspace's roster.
function rosterSize(ws) {
  const inMotion = ws.stats.providers - ws.stats.active;
  return Math.max(24, Math.min(64, Math.round(inMotion * 0.5) + 18));
}

// Generate the operational roster for a workspace — deterministic from its id.
function genRoster(ws) {
  const r = rng(hashStr('w1400:' + ws.id));
  const n = rosterSize(ws);
  const lastIdx = ws.stages.length - 1; // the "Active/In-Network/On Assignment" terminal stage
  const out = [];
  for (let i = 0; i < n; i++) {
    const fi = Math.floor(r() * FIRST.length), li = Math.floor(r() * LAST.length);
    const name = 'Dr. ' + FIRST[fi] + ' ' + LAST[li];
    // distribute across non-terminal stages with mild decay, plus a slice already Active
    let stageIdx;
    const u = r();
    if (u < 0.26) stageIdx = lastIdx; // recently went active — feeds license/risk surfaces
    else {
      // weight earlier stages a bit heavier
      const w = Math.floor(Math.pow(r(), 1.35) * lastIdx);
      stageIdx = Math.min(lastIdx - 1, w);
    }
    const stage = ws.stages[stageIdx];
    const isActive = stageIdx === lastIdx;
    const progress = (stageIdx + (isActive ? 1 : r() * 0.9)) / ws.stages.length;
    let readiness = Math.round(38 + progress * 56 + (r() - 0.5) * 14);
    readiness = Math.max(12, Math.min(100, readiness));
    const sla = stage.sla || 0;
    const daysInStage = sla > 0 ? Math.round(r() * sla * 1.7) : Math.round(r() * 120);
    const overdue = sla > 0 && daysInStage > sla;
    // blockers — earlier/lower readiness records more likely to be blocked
    const blockers = [];
    if (!isActive && r() < (overdue ? 0.62 : 0.24)) {
      const b = BLOCKERS[Math.floor(r() * BLOCKERS.length)];
      blockers.push(b.id);
      if (r() < 0.22) { const b2 = BLOCKERS[Math.floor(r() * BLOCKERS.length)]; if (b2.id !== b.id) blockers.push(b2.id); }
    }
    // risk
    const hasHigh = blockers.some(id => (BLOCKERS.find(b => b.id === id) || {}).sev === 'high');
    let risk = 'low';
    if (hasHigh || readiness < 50) risk = 'high';
    else if (blockers.length || overdue || readiness < 72) risk = 'med';
    // license expiry for active records (days until expiry; some lapsing soon)
    const licenseDays = isActive ? Math.round(-30 + r() * 400) : null;
    const assignedTo = stage.owner ? (TEAM.filter(t => t.role === stage.owner)[Math.floor(r() * 3)] || TEAM.find(t => t.role === stage.owner)) : null;
    out.push({
      id: ws.id + '-p' + i,
      name, specialty: SPECIALTIES[Math.floor(r() * SPECIALTIES.length)],
      group: ws.groups[Math.floor(r() * ws.groups.length)],
      npi: '1' + String(Math.floor(r() * 1e9)).padStart(9, '0'),
      stageIdx, isActive, readiness, risk, daysInStage, sla, overdue,
      blockers, licenseDays,
      assignee: assignedTo ? assignedTo.id : null,
      owner: stage.owner,
      flagged: r() < 0.12,
    });
  }
  return out;
}
window.genRoster = genRoster; window.rng = rng; window.hashStr = hashStr;

/* ---------- Queue definitions — selectors over the roster ---------- */
// Each returns the matching records; the surface computes priority/impact/action.
const QUEUE_DEFS = [
  { id: 'evidence',  label: 'Evidence awaiting review', icon: 'FileText',    owner: 'credentialing',
    desc: 'Records sitting in an evidence-review stage that need a credentialing decision.',
    match: (p, ws) => !p.isActive && /evidence/i.test(ws.stages[p.stageIdx].label),
    action: 'Open dossier & verify primary sources',
    impact: 'Unblocks credential readiness for this record' },
  { id: 'license',   label: 'License expiring soon',    icon: 'Calendar',    owner: 'credentialing',
    desc: 'Active providers whose state license lapses within 90 days.',
    match: (p) => p.isActive && p.licenseDays != null && p.licenseDays <= 90,
    action: 'Trigger renewal outreach & request updated license',
    impact: 'Prevents a privileging lapse and lost billable days' },
  { id: 'recruiting',label: 'Recruiting bottleneck',    icon: 'Search',      owner: 'recruiter',
    desc: 'Early-stage records past their SLA — the pipeline is stalling at the top.',
    match: (p, ws) => p.overdue && p.stageIdx <= 1 && !p.isActive,
    action: 'Re-engage candidate or re-route to another sourcer',
    impact: 'Restores pipeline throughput at the funnel mouth' },
  { id: 'missing',   label: 'Missing documentation',    icon: 'AlertTri',    owner: 'credentialing',
    desc: 'Records blocked specifically on a missing primary-source document.',
    match: (p) => p.blockers.includes('b_doc') || p.blockers.includes('b_gap'),
    action: 'Request document from provider or source registry',
    impact: 'Clears the most common cause of credentialing delay' },
  { id: 'interviews',label: 'Pending interviews',       icon: 'Users',       owner: 'chair',
    desc: 'Records waiting on a department interview decision.',
    match: (p, ws) => !p.isActive && /interview|screen|committee/i.test(ws.stages[p.stageIdx].label),
    action: 'Schedule or record the interview outcome',
    impact: 'Keeps qualified candidates moving toward offer' },
  { id: 'offers',    label: 'Pending offers',           icon: 'Send',        owner: 'recruiter',
    desc: 'Records in an offer stage awaiting issuance or signature.',
    match: (p, ws) => !p.isActive && /offer|submit/i.test(ws.stages[p.stageIdx].label),
    action: 'Issue offer or follow up on outstanding signature',
    impact: 'Converts a vetted candidate into committed headcount' },
  { id: 'blockers',  label: 'Credential blockers',      icon: 'ShieldAlert', owner: 'credentialing',
    desc: 'Records held by a high-severity verification blocker.',
    match: (p) => p.blockers.some(id => (BLOCKERS.find(b => b.id === id) || {}).sev === 'high'),
    action: 'Resolve the blocking verification or escalate',
    impact: 'Removes the single hardest gate to readiness' },
];
window.QUEUE_DEFS = QUEUE_DEFS;

/* ---------- Event taxonomy (what an operational action records) ---------- */
const EVENT_TYPES = {
  evidence_submitted:   { label: 'Evidence submitted',      icon: 'FileText',    tone: 'slate'   },
  verification_done:    { label: 'Verification completed',  icon: 'ShieldCheck', tone: 'emerald' },
  recruiter_assigned:   { label: 'Recruiter assigned',      icon: 'UserPlus',    tone: 'accent'  },
  work_assigned:        { label: 'Work assigned',           icon: 'UserPlus',    tone: 'accent'  },
  interview_done:       { label: 'Interview completed',     icon: 'Users',       tone: 'slate'   },
  offer_issued:         { label: 'Offer issued',            icon: 'Send',        tone: 'amber'   },
  offer_accepted:       { label: 'Offer accepted',          icon: 'Handshake',   tone: 'emerald' },
  evidence_approved:    { label: 'Evidence approved',       icon: 'CheckCircle', tone: 'emerald' },
  blocker_resolved:     { label: 'Blocker resolved',        icon: 'Unlock',      tone: 'emerald' },
  stage_advanced:       { label: 'Advanced to next stage',  icon: 'ArrowRight',  tone: 'accent'  },
  issue_escalated:      { label: 'Issue escalated',         icon: 'ChevronsUp',  tone: 'rose'    },
  recognition_updated:  { label: 'Recognition updated',     icon: 'Award',       tone: 'accent'  },
  org_notified:         { label: 'Organization notified',   icon: 'Bell',        tone: 'slate'   },
  readiness_changed:    { label: 'Readiness updated',       icon: 'Gauge',       tone: 'slate'   },
};
window.EVENT_TYPES = EVENT_TYPES;

const SAMPLE_NAMES = FIRST.map((f, i) => 'Dr. ' + f + ' ' + LAST[i % LAST.length]);
window.SAMPLE_NAMES = SAMPLE_NAMES;
